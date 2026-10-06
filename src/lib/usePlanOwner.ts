import { useEffect, useState } from "react";
import { isPlanOwner } from "@/lib/planOwner";

/**
 * `null` mientras se calcula el hash (unos milisegundos). Quien lo use decide
 * qué hacer en ese hueco: mostrar, sí; escribir algo en la base, no.
 */
export function usePlanOwner(email: string | null | undefined): boolean | null {
  const [result, setResult] = useState<{ email: string; owner: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    void isPlanOwner(email).then((owner) => {
      if (alive) setResult({ email: email ?? "", owner });
    });
    return () => {
      alive = false;
    };
  }, [email]);

  return result && result.email === (email ?? "") ? result.owner : null;
}
