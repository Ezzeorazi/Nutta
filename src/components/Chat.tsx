"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

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
  sending = false,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onOpenMemory?: () => void;
  onAnalyze?: () => void;
  sending?: boolean;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Auto-scroll al último mensaje (o al aparecer el indicador de escritura).
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
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold">
          Nut<span className="text-primary">ta</span>
          <span className="ml-1 text-sm font-normal text-muted">tu coach</span>
        </h1>
        <div className="flex items-center gap-2">
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              disabled={sending}
              aria-label="Analizar mi semana"
              className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 text-lg active:scale-95 disabled:opacity-40"
            >
              📊
            </button>
          )}
          {onOpenMemory && (
            <button
              onClick={onOpenMemory}
              aria-label="Memoria"
              className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-lg active:scale-95"
            >
              🧠
            </button>
          )}
        </div>
      </header>

      {/* Historial */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-36 pt-4">
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

        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div className="flex max-w-[80%] flex-col gap-0.5">
              <Bubble role={m.role}>{m.text}</Bubble>
              <span
                className={`px-1 text-[10px] text-muted ${
                  m.role === "user" ? "text-right" : "text-left"
                }`}
              >
                {timeFmt(m.createdAt)}
              </span>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-3">
              <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Barra de entrada (fija, por encima del BottomNav) */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-3 py-2.5">
          {hint && (
            <p className="mb-1.5 px-1 text-center text-xs text-accent">{hint}</p>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={toggleMic}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg active:scale-95 ${
                listening
                  ? "animate-pulse bg-accent text-accent-foreground"
                  : "bg-card text-muted"
              }`}
              aria-label={listening ? "Detener dictado" : "Dictar por voz"}
            >
              🎙️
            </button>
            <div className="flex flex-1 items-end gap-2 rounded-2xl border border-border bg-card px-3 py-1.5">
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
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-lg text-primary-foreground transition active:scale-95 disabled:opacity-40"
              aria-label="Enviar"
            >
              ➤
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
      className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
        isUser
          ? "rounded-br-md bg-primary text-primary-foreground"
          : "rounded-bl-md border border-border bg-card text-foreground"
      }`}
    >
      {children}
    </div>
  );
}
