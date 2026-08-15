/**
 * Envío de los avisos del plan desde el servidor.
 *
 * Es la mitad que faltaba: hasta ahora el recordatorio vivía en un `setInterval`
 * de la página, así que solo podía sonar con la app abierta —justo cuando no
 * hace falta que te avise—. Acá el cron de Vercel entra por `/api/push/[slot]`,
 * este módulo lee los datos con el SDK admin de InstantDB, arma el MISMO estado
 * del atleta que ve la pantalla y empuja el mensaje al dispositivo.
 *
 * Todo lo horario se calcula con el desfase guardado en la suscripción: el
 * servidor corre en UTC y "son las 8 de la mañana" solo es cierto en un lugar.
 */

import { init } from "@instantdb/admin";
import webpush from "web-push";
import { buildAthleteState } from "@/lib/athlete";
import { APP_ID } from "@/lib/appId";
import { effectiveWeight } from "@/lib/nutrition";
import { PLAN_GOALS, getPlanDay } from "@/lib/plan";
import { inSlot, planReminder, type Slot } from "@/lib/reminders";
import type {
  DailyMetrics,
  DrinkEntry,
  ExerciseEntry,
  FoodEntry,
  StrengthSet,
  Supplement,
  SupplementLog,
  WeightEntry,
} from "@/lib/types";

export type PushSub = {
  id: string;
  owner: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  tzOffset: number;
};

export type SendResult = {
  /** Suscripciones consideradas. */
  total: number;
  sent: number;
  /** Fuera de la franja horaria local (no es un error). */
  skippedHour: number;
  /** Sin nada que valga la pena interrumpir. */
  skippedEmpty: number;
  /** Suscripciones vencidas que se borraron. */
  expired: number;
  failed: number;
};

/** Fecha (YYYY-MM-DD) y hora en la zona del usuario, a partir del desfase. */
export function localParts(ms: number, tzOffsetMinutes: number) {
  const shifted = new Date(ms + tzOffsetMinutes * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
  };
}

/**
 * El día efectivo de un registro, en la zona del usuario. Replica lo que hace
 * `useNutta` en el cliente (derivar del `createdAt`, con el `date` guardado como
 * respaldo), pero sin depender de la zona horaria del servidor.
 */
function withLocalDate<T extends { date: string; createdAt?: number }>(
  rows: T[],
  tzOffset: number,
): T[] {
  return rows.map((r) =>
    r.createdAt ? { ...r, date: localParts(r.createdAt, tzOffset).date } : r,
  );
}

function adminDb() {
  const adminToken = process.env.INSTANT_ADMIN_TOKEN;
  if (!adminToken) throw new Error("Falta INSTANT_ADMIN_TOKEN");
  return init({ appId: APP_ID, adminToken });
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Faltan las claves VAPID");
  }
  // `mailto:` es lo que exige el estándar para que el servicio de push tenga a
  // quién avisarle si algo va mal con los envíos.
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:nutta@example.com",
    publicKey,
    privateKey,
  );
}

/** Manda el aviso de una franja a todos los dispositivos suscritos. */
export async function sendSlot(slot: Slot, now = Date.now()): Promise<SendResult> {
  configureWebPush();
  const db = adminDb();

  const data = (await db.query({
    pushSubs: {},
    profiles: {},
    foods: {},
    drinks: {},
    exercises: {},
    strengthSets: {},
    metrics: {},
    supplements: {},
    supplementLogs: {},
    weights: {},
  })) as unknown as Record<string, unknown[]>;

  const subs = (data.pushSubs ?? []) as unknown as PushSub[];
  const result: SendResult = {
    total: subs.length,
    sent: 0,
    skippedHour: 0,
    skippedEmpty: 0,
    expired: 0,
    failed: 0,
  };

  const mine = <T extends { owner: string }>(rows: unknown[], owner: string) =>
    (rows as T[]).filter((r) => r.owner === owner);

  for (const sub of subs) {
    const { date: today, hour } = localParts(now, sub.tzOffset);
    // El cron dispara a una hora UTC fija; si en el teléfono son las 3 de la
    // mañana, no se manda nada. Vale más un aviso de menos que uno a deshora.
    if (!inSlot(slot, hour)) {
      result.skippedHour++;
      continue;
    }

    const owner = sub.owner;
    const tz = sub.tzOffset;
    const foods = withLocalDate(mine<FoodEntry & { owner: string }>(data.foods ?? [], owner), tz);
    const drinks = withLocalDate(mine<DrinkEntry & { owner: string }>(data.drinks ?? [], owner), tz);
    const exercises = withLocalDate(
      mine<ExerciseEntry & { owner: string }>(data.exercises ?? [], owner),
      tz,
    );
    const strengthSets = withLocalDate(
      mine<StrengthSet & { owner: string }>(data.strengthSets ?? [], owner),
      tz,
    );
    const metrics = withLocalDate(
      mine<DailyMetrics & { owner: string }>(data.metrics ?? [], owner),
      tz,
    );
    const supplementLogs = withLocalDate(
      mine<SupplementLog & { owner: string }>(data.supplementLogs ?? [], owner),
      tz,
    );
    const supplements = mine<Supplement & { owner: string }>(data.supplements ?? [], owner);
    const weights = mine<WeightEntry & { owner: string }>(data.weights ?? [], owner);
    const profile = mine<{ owner: string; weight: number; objective: string }>(
      data.profiles ?? [],
      owner,
    )[0];

    const bodyWeight = effectiveWeight(profile?.weight ?? 0, weights, today);
    const state = buildAthleteState({
      foods,
      drinks,
      exercises,
      strengthSets,
      metrics,
      supplements,
      supplementLogs,
      // Las metas del plan son las que la app usa por defecto (ver page.tsx).
      goals: PLAN_GOALS,
      bodyWeight,
      date: today,
      today,
      objective: profile?.objective as never,
      hour,
    });

    const reminder = planReminder({
      slot,
      date: today,
      state,
      planDay: getPlanDay(today),
    });
    if (!reminder) {
      result.skippedEmpty++;
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: reminder.title,
          body: reminder.body,
          tag: reminder.tag,
          url: "/",
          requireInteraction: reminder.requireInteraction ?? false,
        }),
      );
      result.sent++;
    } catch (err) {
      // 404/410 = el navegador dio de baja ese endpoint (app desinstalada,
      // permisos revocados). Guardarlo para siempre solo acumula basura.
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await db.transact(db.tx.pushSubs[sub.id].delete());
        result.expired++;
      } else {
        result.failed++;
      }
    }
  }

  return result;
}
