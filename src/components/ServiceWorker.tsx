"use client";

import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    if (
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      // Cuando toma el control un service worker NUEVO (hubo deploy), se
      // recarga una vez para mostrar la versión nueva en vez de la que ya
      // estaba en pantalla. Sin controlador previo es la primera instalación:
      // no hay nada viejo que reemplazar.
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      const onChange = () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => reg.update())
        .catch(() => {
          // registro opcional: si falla, la app sigue funcionando online
        });
      return () =>
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
    }
  }, []);
  return null;
}
