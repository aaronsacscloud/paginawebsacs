/**
 * ARCHIVAR UNA ACTIVIDAD DE LA LISTA DE LEADS ACTIVOS.
 *
 * «Ya vi esto, no me lo enseñes más» — pero con una vuelta que importa: NO se
 * archiva al lead, se archiva LO QUE YA VISTE de él. Se guarda la fecha de su
 * última actividad al momento de archivar; si el lead vuelve a moverse después
 * de eso, reaparece solo.
 *
 * Es la diferencia entre una bandeja y una lista negra. Archivar al lead
 * entero sería una trampa: el que archivaste el martes porque no tenía nada
 * interesante es el mismo que el jueves abre la cotización, y no volverías a
 * verlo nunca.
 *
 * Vive en localStorage: es una decisión de esta persona en este aparato, no un
 * dato del negocio, y no merece un viaje al servidor. Si se pierde, lo peor que
 * pasa es que vuelvas a ver algo que ya habías descartado.
 */

const LLAVE = 'crm:act-archivadas';

type Archivo = Record<string, string>;   // leadId -> ISO de la última actividad vista

function leer(): Archivo {
  if (typeof localStorage === 'undefined') return {};
  try { const j = JSON.parse(localStorage.getItem(LLAVE) || '{}'); return j && typeof j === 'object' ? j : {}; }
  catch { return {}; }
}

function guardar(a: Archivo) {
  try {
    /* Se podan las entradas viejas al escribir: sin esto el objeto crece para
       siempre con leads que ya nadie va a volver a ver. 60 días cubre de sobra
       la ventana más larga de la pantalla. */
    const corte = new Date(Date.now() - 60 * 864e5).toISOString();
    const limpio: Archivo = {};
    for (const [k, v] of Object.entries(a)) if (v > corte) limpio[k] = v;
    localStorage.setItem(LLAVE, JSON.stringify(limpio));
  } catch { /* sin espacio: se pierde el archivo, no la lista */ }
}

/** Archiva lo visto de este lead hasta su última actividad. */
export function archivar(leadId: string, ultimaActividadISO: string) {
  const a = leer(); a[leadId] = ultimaActividadISO; guardar(a);
}

/** Deshacer: vuelve a mostrarlo. */
export function desarchivar(leadId: string) {
  const a = leer(); delete a[leadId]; guardar(a);
}

/**
 * ¿Se oculta? Solo si su última actividad NO es más nueva que la archivada.
 * Cualquier movimiento posterior lo devuelve a la lista.
 */
export function estaArchivado(leadId: string, ultimaActividadISO: string | null | undefined): boolean {
  if (!ultimaActividadISO) return false;
  const marca = leer()[leadId];
  return !!marca && ultimaActividadISO <= marca;
}

/** Cuántos hay ocultos ahora mismo, para poder decirlo en pantalla. */
export function contarOcultos<T>(items: T[], id: (x: T) => string, ultima: (x: T) => string | null | undefined): number {
  return items.filter(x => estaArchivado(id(x), ultima(x))).length;
}
