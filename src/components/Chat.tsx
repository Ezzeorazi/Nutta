"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, ChartColumn, History, Mic, Send, Undo2 } from "lucide-react";
import { parseLogLine, splitLog } from "@/lib/chatLog";
import { localDateFromMs, type ChatMessage } from "@/lib/types";

/** Tipos mínimos de la Web Speech API (no están en lib.dom por defecto). */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const timeFmt = (ms: number) =>
  new Date(ms).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Chat({
  messages,
  onSend,
  onOpenMemory,
  onAnalyze,
  onUndo,
  canUndo = false,
  sending = false,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onOpenMemory?: () => void;
  onAnalyze?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  sending?: boolean;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Por defecto solo se ve el día del último mensaje: cargar meses de charla
  // entera cada vez que se abre el chat era lento y, sobre todo, ruido — casi
  // nadie necesita desplazarse hasta ayer para seguir la conversación de hoy.
  const lastDay =
    messages.length > 0
      ? localDateFromMs(messages[messages.length - 1].createdAt)
      : null;
  const visibleMessages = useMemo(
    () =>
      showAll || !lastDay
        ? messages
        : messages.filter((m) => localDateFromMs(m.createdAt) === lastDay),
    [messages, showAll, lastDay],
  );
  const hasOlder = !showAll && visibleMessages.length < messages.length;

  // Auto-scroll al último mensaje (o al aparecer el indicador de escritura).
  // Depende del total, no de `visibleMessages`: así tocar "Ver conversación
  // anterior" no te tira de nuevo al final, dejándote leer desde donde abriste.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) {
      flashHint("Tu navegador no soporta dictado por voz.");
      return;
    }
    const rec = new SR();
    rec.lang = "es-AR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setText(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const flashHint = (msg: string) => {
    setHint(msg);
    setTimeout(() => setHint(null), 2500);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      {/* Barra superior */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <h1 className="truncate text-lg font-bold tracking-tight">
          Nut<span className="text-primary">ta</span>
          <span className="ml-1.5 text-sm font-normal text-muted">tu coach</span>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {onAnalyze && (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={sending}
              aria-label="Analizar mi semana"
              className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent transition-transform duration-(--duration-fast) active:scale-90 disabled:opacity-40"
            >
              <ChartColumn size={19} strokeWidth={2} aria-hidden />
            </button>
          )}
          {onOpenMemory && (
            <button
              type="button"
              onClick={onOpenMemory}
              aria-label="Memoria"
              className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary transition-transform duration-(--duration-fast) active:scale-90"
            >
              <Brain size={19} strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
      </header>

      {/* Historial */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4">
        {messages.length === 0 && (
          <div className="mt-4 flex flex-col gap-3">
            <Bubble role="assistant">
              ¡Hola! Soy tu coach 💪 Contame qué comiste o entrenaste, como si le
              escribieras a un amigo.
            </Bubble>
            <div className="flex flex-col gap-1.5 text-xs text-muted">
              <p>Probá con:</p>
              {[
                "Desayuné 3 huevos y un café",
                "Corrí 20 minutos",
                "Comí pollo con arroz",
              ].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  className="w-fit rounded-full border border-border bg-card px-3 py-1.5 text-left text-foreground active:scale-95"
                >
                  «{ex}»
                </button>
              ))}
            </div>
          </div>
        )}

        {hasOlder && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium text-muted transition-transform duration-(--duration-fast) active:scale-95 hover:text-foreground"
            >
              <History size={14} strokeWidth={2} aria-hidden />
              Ver conversación anterior
            </button>
          </div>
        )}

        {visibleMessages.map((m) => {
          // El resumen de lo registrado viaja dentro del mismo string que la
          // respuesta (los mensajes se guardan como texto plano). Se separa acá
          // para dibujarlo como lista y no como un párrafo con saltos de línea.
          const { reply, logged } =
            m.role === "assistant"
              ? splitLog(m.text)
              : { reply: m.text, logged: [] };
          return (
            <div
              key={m.id}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div className="flex max-w-[85%] flex-col gap-1">
                {reply.trim() && <Bubble role={m.role}>{reply.trim()}</Bubble>}
                {logged.length > 0 && <LoggedCard lines={logged} />}
                <span
                  className={`px-1 text-[10px] text-muted ${
                    m.role === "user" ? "text-right" : "text-left"
                  }`}
                >
                  {timeFmt(m.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-card px-4 py-3 shadow-e1">
              <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
            </div>
          </div>
        )}
        {canUndo && !sending && onUndo && (
          <div className="flex justify-start pl-1 pt-1">
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 text-sm font-semibold text-accent transition-transform duration-(--duration-fast) active:scale-95"
            >
              <Undo2 size={15} strokeWidth={2.25} aria-hidden />
              Deshacer registro
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Barra de entrada (fija, por encima del BottomNav) */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-3 py-2.5">
          {hint && (
            <p className="mb-1.5 px-1 text-center text-xs text-accent">{hint}</p>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={toggleMic}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform duration-(--duration-fast) active:scale-90 ${
                listening
                  ? "animate-pulse bg-accent text-accent-foreground"
                  : "bg-sunken text-muted"
              }`}
              aria-label={listening ? "Detener dictado" : "Dictar por voz"}
              aria-pressed={listening}
            >
              <Mic size={19} strokeWidth={2} aria-hidden />
            </button>
            <div className="flex flex-1 items-end gap-2 rounded-2xl bg-card px-3.5 py-1.5 shadow-e1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Escribí un mensaje…"
                className="max-h-28 w-full resize-none bg-transparent py-1 text-sm outline-none"
                aria-label="Mensaje"
              />
            </div>
            <button
              type="button"
              onClick={send}
              disabled={!text.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-(--duration-fast) active:scale-90 disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-muted"
      style={{ animationDelay: delay }}
    />
  );
}

function Bubble({
  role,
  children,
}: {
  role: ChatMessage["role"];
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div
      className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? "rounded-br-md bg-primary text-primary-foreground"
          : "rounded-bl-md bg-card text-foreground shadow-e1"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Lo que el coach registró en ese turno.
 *
 * Antes era parte del texto de la burbuja, con saltos de línea: una lista de
 * datos numéricos leída como prosa. Como tarjeta, se puede escanear de un
 * vistazo si lo que entendió es lo que dijiste.
 */
function LoggedCard({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl rounded-bl-md bg-card px-4 py-3 shadow-e1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Registrado
      </p>
      <ul className="flex flex-col gap-2">
        {lines.map((line, i) => {
          const { emoji, name, stats } = parseLogLine(line);
          return (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 text-base leading-tight">{emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium capitalize">
                  {name}
                </span>
                {stats.length > 0 && (
                  <span className="block text-xs text-muted tabular-nums">
                    {stats.join(" · ")}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
