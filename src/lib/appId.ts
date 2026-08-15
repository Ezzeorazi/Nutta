/**
 * App ID de InstantDB. Es una clave pública (viaja al navegador), no un
 * secreto: la seguridad se maneja con las reglas de permisos de InstantDB.
 *
 * Vive en su propio archivo, y no en `db.ts`, porque el servidor también lo
 * necesita (ver `lib/pushServer.ts`) y `db.ts` inicializa el SDK de React:
 * importarlo desde una ruta de API rompe el build en tiempo de ejecución con
 * "Attempted to call the default export … from the server, but it's on the
 * client". Una constante suelta no arrastra nada.
 */
export const APP_ID = "8bcd1994-bd17-4415-a6a4-dc38934d780f";
