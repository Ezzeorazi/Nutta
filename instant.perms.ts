// Reglas de permisos de InstantDB.
//
// El APP_ID es público (viaja al navegador y está en el repo), así que la única
// barrera entre los datos de un usuario y el resto del mundo son estas reglas.
// Se suben con:  npx instant-cli push perms
//
// Todas las entidades llevan `owner` = id del usuario logueado: cada uno lee y
// escribe solo lo suyo. `useNutta` igual consulta sin `where` y filtra en
// cliente; con estas reglas el servidor ya devuelve únicamente las filas propias.

import type { InstantRules } from "@instantdb/react";

const isOwner = "auth.id != null && auth.id == data.owner";

const rules = {
  // Aplica a todas las entidades del schema (profiles, foods, pushSubs, …).
  $default: {
    allow: {
      view: isOwner,
      create: isOwner,
      // `newData.owner` impide "regalarle" una fila a otro usuario.
      update: `${isOwner} && newData.owner == data.owner`,
      delete: isOwner,
    },
  },
  // Fotos de progreso: viven en `progress/<userId>/…` (ver `addPhoto`).
  $files: {
    allow: {
      view: "auth.id != null && data.path.startsWith('progress/' + auth.id + '/')",
      create: "auth.id != null && data.path.startsWith('progress/' + auth.id + '/')",
      delete: "auth.id != null && data.path.startsWith('progress/' + auth.id + '/')",
    },
  },
} satisfies InstantRules;

export default rules;
