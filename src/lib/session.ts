/**
 * "¿Qué hago hoy?": la sesión concreta que toca, ya ajustada a cómo llegás.
 *
 * NO inventa una rutina paralela. Arranca del día que te toca en tu plan del
 * mes (`lib/plan.ts`) y lo ajusta: recorta series si venís cargado, propone
 * cambiar el día si ese grupo lo entrenaste hace nada, o directamente manda a
 * descansar. Y siempre dice por qué, con las MISMAS razones que muestra el
 * panel de estado (`AthleteState.signals`).
 *
 * Es una función pura: no toca la red ni la IA. Todo sale de lo que el usuario
 * ya registró.
 */

import type { AthleteState } from "@/lib/athlete";
import { groupsOf } from "@/lib/gym";
import { WEEKLY_PLAN, getPlanDay, type PlanDay } from "@/lib/plan";
import { applySwaps, type PlanSlot } from "@/lib/planSwaps";
import { VACATION_DAY, VACATION_DOW, pickedDow } from "@/lib/vacation";
import type { PlanPick, PlanSwap, StrengthSet } from "@/lib/types";

export type SessionMode =
  | "completa"
  | "liviana"
  | "descanso"
  | "hecha"
  | "flexible";

export const MODE_LABEL: Record<SessionMode, string> = {
  completa: "Sesión completa",
  liviana: "Sesión liviana",
  descanso: "Descanso",
  hecha: "Ya entrenaste",
  flexible: "Rutina de vacaciones",
};

export type SessionExercise = PlanSlot & {
  /** Ya lo cargaste hoy. */
  done: boolean;
};

export type TodaySession = {
  mode: SessionMode;
  emoji: string;
  /** Qué se propone: "Empuje A (pecho enfocado)", "Descanso"… */
  title: string;
  exercises: SessionExercise[];
  cardio?: string;
  /** Por qué esto y no otra cosa. Vacío = no hay nada que justificar. */
  reasons: string[];
  /** Cuando se propone un día del plan distinto al del calendario. */
  swap?: { from: string; why: string };
};

const norm = (s: string) => s.trim().toLowerCase();

/** "espalda, hombros y brazos" — enumeración en castellano, no "y" repetidos. */
const listar = (xs: string[]) =>
  xs.length <= 1
    ? (xs[0] ?? "")
    : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

const dias = (n: number) =>
  n === 0 ? "hoy mismo" : n === 1 ? "ayer" : `hace ${n} días`;

/**
 * Grupos musculares que toca un día del plan, de los que la app sabe seguir.
 * (El dataset marca además "core", que no tiene fila propia en el estado.)
 */
const planGroups = (d: PlanDay, muscles: AthleteState["muscles"]): string[] => [
  ...new Set(
    d.exercises
      .flatMap((e) => groupsOf(e.name))
      .filter((g) => muscles.some((m) => m.group === g)),
  ),
];

/**
 * Hace cuántos días se entrenó el grupo MÁS reciente de esa sesión. Es lo que
 * dice si la sesión pisa músculo todavía fatigado. `null` = ninguno entrenado
 * nunca (no hay nada que esperar, está todo fresco).
 */
function freshness(day: PlanDay, muscles: AthleteState["muscles"]): number | null {
  const d = planGroups(day, muscles)
    .map((g) => muscles.find((m) => m.group === g)?.daysSince)
    .filter((v): v is number => v != null);
  return d.length ? Math.min(...d) : null;
}

/** "4 × 6-8" → "3 × 6-8". Nunca baja de 2 series. */
function lighten(sets: string): string {
  return sets.replace(/^\s*(\d+)/, (_, n: string) =>
    String(Math.max(2, Number(n) - 1)),
  );
}

export function buildTodaySession(x: {
  state: AthleteState;
  today: string;
  /** Series ya cargadas hoy (para tachar lo hecho). */
  daySets: StrengthSet[];
  /** Ejercicios que cambiaste hoy: la sesión tiene que proponer los tuyos. */
  swaps?: PlanSwap[];
  /** Días del plan elegidos a mano (modo vacaciones). */
  picks?: PlanPick[];
}): TodaySession {
  const { state, today, daySets } = x;
  const hechos = new Set(daySets.map((s) => norm(s.exercise)));
  const rec = state.recovery.score;
  const reasons: string[] = [];

  // De vacaciones el calendario no es el split del mes: es la rutina corta sin
  // equipamiento… salvo que hayas elegido un día del plan a mano, que es lo
  // que se hace cuando aparece un gimnasio en el viaje (ver `lib/vacation.ts`).
  const deViaje = state.vacation;
  const elegido = deViaje ? pickedDow(x.picks ?? [], today) : null;
  const elegidoDelPlan = elegido != null && elegido !== VACATION_DOW;
  const base = deViaje
    ? elegidoDelPlan
      ? (WEEKLY_PLAN.find((d) => d.dow === elegido) ?? VACATION_DAY)
      : VACATION_DAY
    : getPlanDay(today);
  // Con los cambios del día ya aplicados: si reemplazaste un ejercicio, la
  // sesión sugerida tiene que hablar del que vas a hacer, no del que no podés.
  const calendario = applySwaps(base, x.swaps ?? [], today);

  // --- Ya entrenaste: lo que queda del plan, no una sesión nueva ------------
  if (state.training.kind === "fuerza") {
    const faltan = calendario.exercises.filter((e) => !hechos.has(norm(e.name)));
    return {
      mode: "hecha",
      emoji: "✅",
      title: faltan.length
        ? `Te falta cerrar ${calendario.label}`
        : `${calendario.label}: completo`,
      exercises: calendario.exercises.map((e) => ({
        ...e,
        done: hechos.has(norm(e.name)),
      })),
      cardio: faltan.length ? calendario.cardio : undefined,
      reasons: [
        `${state.training.sets} series y ${Math.round(state.training.volume).toLocaleString("es-AR")} kg de volumen hoy`,
        ...state.signals.slice(0, 2),
      ],
    };
  }

  // --- Descanso: declarado por vos o por el plan ----------------------------
  // Ojo con `restDeclared` y no `rest`: de vacaciones TODOS los días sin
  // registro son descanso, y ahí sí hay algo que proponer (la rutina corta).
  if (state.training.restDeclared || calendario.rest) {
    return {
      mode: "descanso",
      emoji: "🧘",
      title: state.training.restDeclared ? "Hoy descansás" : calendario.label,
      exercises: [],
      cardio: calendario.cardio,
      reasons: state.training.restDeclared
        ? ["Lo marcaste como día de descanso"]
        : ["Es el día de descanso de tu plan"],
    };
  }

  // --- Cuánto aguanta el cuerpo hoy ----------------------------------------
  // La recuperación manda sobre el calendario: entrenar fuerte sin recuperar no
  // suma volumen, suma fatiga (y a la larga, lesiones).
  const agotado = (rec != null && rec < 45) || state.week.streak >= 6;
  // Dormir mal alcanza solo para bajar la sesión: es el factor que más pesa en
  // la recuperación, y esperar a que arrastre al score entero llega tarde.
  const sueño = state.status.find((s) => s.key === "sueno");
  const durmioMal = !!sueño?.logged && sueño.ratio < 0.7;
  const justo =
    (rec != null && rec < 65) || state.signals.length >= 2 || durmioMal;

  if (agotado) {
    reasons.push(
      ...(rec != null && rec < 45 ? [`recuperación ${rec}%`] : []),
      ...(state.week.streak >= 6
        ? [`${state.week.streak} días seguidos entrenando`]
        : []),
    );
    return {
      mode: "descanso",
      emoji: "🧘",
      title: "Hoy conviene parar",
      exercises: [],
      cardio: "Caminata suave o movilidad. Volvé mañana con todo.",
      reasons,
    };
  }

  // --- Qué sesión: la del calendario, salvo que pise músculo fatigado -------
  let day: typeof calendario = calendario;
  let swap: TodaySession["swap"];
  const propia = freshness(calendario, state.muscles);
  // De viaje no se rota nada: la rutina flexible es de cuerpo entero y elegir
  // "qué toca hoy" es justo la decisión que el modo saca del medio.
  if (!deViaje && propia != null && propia <= 1) {
    // Se busca el día del plan cuyo grupo más reciente esté MÁS descansado.
    const alternativas = WEEKLY_PLAN.filter(
      (d) => !d.rest && d.dow !== calendario.dow,
    )
      .map((d) => ({ day: d, fresh: freshness(d, state.muscles) ?? 99 }))
      .sort((a, b) => b.fresh - a.fresh);
    const mejor = alternativas[0];
    // Se cambia solo si la diferencia es real: mover el plan por un día de más
    // no vale la pena, y romper el orden del split tiene su costo.
    if (mejor && mejor.fresh - propia >= 2) {
      day = applySwaps(mejor.day, x.swaps ?? [], today);
      const gruposEntran = planGroups(mejor.day, state.muscles);
      const salen = listar(planGroups(calendario, state.muscles));
      const entran = listar(gruposEntran);
      const vienen = gruposEntran.length > 1 ? "vienen" : "viene";
      swap = {
        from: calendario.label,
        why:
          mejor.fresh >= 90
            ? `entrenaste ${salen} ${dias(propia)} y todavía no registraste ${entran}`
            : `entrenaste ${salen} ${dias(propia)}; ${entran} ${vienen} de ${mejor.fresh} días`,
      };
      reasons.push(`toca rotar: ${swap.why}`);
    }
  }

  const liviana = justo;
  if (liviana) reasons.push(...state.signals.slice(0, 3));

  // La rutina corta de viaje. Si elegiste un día del plan, en cambio, se sigue
  // de largo: esa sesión se lee como cualquier otra (y se aliviana si venís
  // justo), porque es una sesión de gimnasio de verdad.
  if (deViaje && !elegidoDelPlan) {
    return {
      mode: "flexible",
      emoji: day.emoji,
      title: day.label,
      exercises: day.exercises.map((e) => ({
        ...e,
        done: hechos.has(norm(e.name)),
      })),
      cardio: day.cardio,
      reasons: [
        "estás de vacaciones: cuerpo entero, sin equipamiento, 20 minutos",
        "alcanza con estimular el músculo: el volumen se recupera al volver",
      ],
    };
  }

  return {
    mode: liviana ? "liviana" : "completa",
    emoji: liviana ? "⚖️" : day.emoji,
    title: day.label,
    exercises: day.exercises.map((e) => ({
      ...e,
      sets: liviana ? lighten(e.sets) : e.sets,
      done: hechos.has(norm(e.name)),
    })),
    cardio: liviana
      ? "Cardio suave, 15-20 min. Hoy no sumes fatiga."
      : day.cardio,
    reasons: liviana
      ? reasons
      : [
          elegidoDelPlan
            ? "elegiste este día del plan para hoy"
            : rec != null && rec >= 80
              ? `recuperación ${rec}%: día para ir por un PR`
              : "venís bien: sesión completa",
          ...reasons,
        ],
  };
}
