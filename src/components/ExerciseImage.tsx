"use client";

import { useState } from "react";
import { emojiForExercise } from "@/lib/emoji";

/**
 * Miniatura de un ejercicio (imagen bundleada de RepDB en /public/exercises).
 * Si no hay imagen o falla la carga, cae a un placeholder con emoji.
 */
export default function ExerciseImage({
  image,
  name,
  className = "",
}: {
  image?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = image && !failed;

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-background ${className}`}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- estáticos self-host, sin optimizador
        <img
          src={`/exercises/${image}`}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-2xl" aria-hidden>
          {emojiForExercise(name)}
        </span>
      )}
    </span>
  );
}
