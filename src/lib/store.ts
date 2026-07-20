"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook mínimo de persistencia en localStorage (local-first).
 * Se reemplazará por Neon + Server Actions en una fase posterior.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      // ignora JSON inválido
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage lleno o no disponible
    }
  }, [key, value, hydrated]);

  const update = useCallback(
    (updater: T | ((prev: T) => T)) => setValue(updater),
    [],
  );

  return { value, setValue: update, hydrated } as const;
}
