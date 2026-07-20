"use client";

import { useState } from "react";
import { db } from "@/lib/db";

export default function Login() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await db.auth.sendMagicCode({ email: email.trim() });
      setStep("code");
    } catch {
      setError("No se pudo enviar el código. Revisá el email.");
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await db.auth.signInWithMagicCode({ email: email.trim(), code: code.trim() });
      // al iniciar sesión, useAuth actualiza y se renderiza la app
    } catch {
      setError("Código incorrecto o vencido.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold">
        Nut<span className="text-primary">ta</span>
      </h1>
      <p className="mt-1 text-sm text-muted">
        {step === "email"
          ? "Ingresá tu email para sincronizar tus datos entre dispositivos."
          : `Te enviamos un código a ${email}. Pegalo acá.`}
      </p>

      {step === "email" ? (
        <form onSubmit={sendCode} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputCls}
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Enviando…" : "Enviar código"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 flex flex-col gap-3">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            className={inputCls}
            placeholder="Código de 6 dígitos"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Verificando…" : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-sm text-muted"
          >
            ← Usar otro email
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
    </div>
  );
}
