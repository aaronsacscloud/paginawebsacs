/**
 * LO QUE ACABO DE USAR, PRIMERO.
 *
 * Snippets y plantillas se listaban en el orden en que los devuelve la base
 * —alfabético, o por fecha de creación— y eso reparte el trabajo al revés: en
 * una bandeja real se usan cinco todos los días y los otros treinta casi
 * nunca, pero los treinta salían arriba igual. En el teléfono se paga doble,
 * porque caben cuatro renglones en pantalla: encontrar el de siempre obligaba
 * a escribir en el buscador, que es justo lo que se quería evitar.
 *
 * Se guarda solo la LISTA DE IDS, en este aparato, sin contadores ni pesos:
 * el último que usé arriba. Es lo que la gente ya predice sin explicárselo.
 *
 * Vive en localStorage porque es preferencia de mano, no dato del negocio: no
 * merece un viaje al servidor y no importa si se pierde. Si el almacenamiento
 * está lleno o bloqueado (Safari en privado), todo sigue funcionando con el
 * orden de siempre — nunca revienta la lista por no poder recordar.
 */

const TOPE = 8;   // por omisión; los emojis piden más (caben dos renglones)

const leer = (clave: string): string[] => {
  try {
    const s = localStorage.getItem(`rec:${clave}`);
    const a = s ? JSON.parse(s) : [];
    return Array.isArray(a) ? a.filter(x => typeof x === 'string') : [];
  } catch { return []; }
};

/** Lo pone al frente y recorta. Llamarlo AL ELEGIR, no al mostrar. */
export function marcarReciente(clave: string, id: string | number | null | undefined, tope = TOPE) {
  if (id === null || id === undefined || id === '') return;
  try {
    const v = String(id);
    const lista = [v, ...leer(clave).filter(x => x !== v)].slice(0, tope);
    localStorage.setItem(`rec:${clave}`, JSON.stringify(lista));
  } catch { /* sin memoria: se queda el orden natural */ }
}

/**
 * Devuelve los mismos elementos, con los usados hace poco al frente y en el
 * orden en que se usaron. Los demás conservan su orden original — no se
 * revuelve nada que el usuario no haya tocado.
 */
export function ordenarPorReciente<T>(clave: string, items: T[], idDe: (x: T) => string | number | null | undefined): T[] {
  const rec = leer(clave);
  if (!rec.length) return items;
  const pos = new Map(rec.map((id, i) => [id, i]));
  const arriba: T[] = [], resto: T[] = [];
  for (const it of items) {
    const id = idDe(it);
    if (id !== null && id !== undefined && pos.has(String(id))) arriba.push(it); else resto.push(it);
  }
  arriba.sort((a, b) => (pos.get(String(idDe(a)))! - pos.get(String(idDe(b)))!));
  return [...arriba, ...resto];
}

/** Los ids recordados, del más reciente al más viejo. Para listas propias. */
export function leerRecientes(clave: string): string[] { return leer(clave); }

/** Cuántos de la lista son "recientes" — para dibujar la separación. */
export function cuantosRecientes<T>(clave: string, items: T[], idDe: (x: T) => string | number | null | undefined): number {
  const rec = new Set(leer(clave));
  return items.filter(x => { const id = idDe(x); return id !== null && id !== undefined && rec.has(String(id)); }).length;
}
