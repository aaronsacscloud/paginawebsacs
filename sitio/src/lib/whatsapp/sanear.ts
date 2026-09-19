// `sanearParam` vive aquí y no dentro de `kapso-api.ts` por una razón de
// empaquetado, no de estilo: es una función pura que necesita el NAVEGADOR
// (la usa `variables-plantilla.ts`, que a su vez importan el Composer y las
// Plantillas del inbox), mientras que `kapso-api.ts` importa
// `node:async_hooks`, que en el navegador no existe. Mientras estuvieron en el
// mismo archivo, cualquier componente de cliente que quisiera sanear un
// parámetro se arrastraba el cliente de Kapso entero al bundle y el build
// reventaba con «AsyncLocalStorage is not exported».
//
// `kapso-api.ts` la sigue reexportando, así que ningún import existente cambia.

/** Meta rechaza una plantilla cuyo parámetro traiga saltos de línea, tabuladores
 *  o cuatro espacios seguidos. Un parámetro vacío también la rechaza: por eso el
 *  guion largo de respaldo en vez de una cadena vacía. */
export const sanearParam = (v: any): string =>
  (String(v ?? '').replace(/[\n\r\t]+/g, ' ').replace(/ {4,}/g, '   ').trim()) || '—';
