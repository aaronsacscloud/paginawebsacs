// SOPORTE · Verificación de citas y deduplicado. PURO: sin imports, sin BD, sin
// red — para poder probarlo de verdad y no "por lectura del código".
//
// La cita textual es el único candado real contra un modelo que rellena huecos:
// una petición inventada entra a la bandeja con la misma cara que una legítima,
// y basta una para que nadie vuelva a confiar en la lista.

/** Normaliza para comparar: sin acentos, sin puntuación, espacios colapsados.
 *  El modelo suele "arreglar" la ortografía del cliente al citarlo — y los
 *  clientes escriben CON MAYÚSCULAS, sin acentos y con dedazos. Comparar letra
 *  por letra rechazaría citas legítimas; esto compara las PALABRAS. */
export function normaliza(s: string): string {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** ¿La cita está de verdad en el hilo? Si no, el hallazgo se tira entero. */
export function citaVerificada(cita: string, hilo: string): boolean {
  const c = normaliza(cita), h = normaliza(hilo);
  // Menos de 15 caracteres no sostiene nada: "no funciona" cabe en cualquier
  // conversación y haría pasar cualquier invención.
  if (c.length < 15) return false;
  if (h.includes(c)) return true;
  // Tolerancia por elipsis: el modelo a veces une dos fragmentos con "…" o
  // "[...]". Se acepta solo si TODOS los trozos están en el hilo.
  const trozos = cita.split(/\s*[.…]{2,}\s*|\s*\[\.\.\.\]\s*/).map(normaliza).filter(t => t.length >= 15);
  return trozos.length > 1 && trozos.every(t => h.includes(t));
}

/** Llave de deduplicado: la misma petición detectada dos noches seguidas es una
 *  sola fila. Va por empresa + tipo + primeras palabras del título, no por el
 *  título completo: el modelo lo redacta distinto cada vez. */
export function huellaDe(companyId: string | null, cuenta: string | null, tipo: string, titulo: string): string {
  const quien = companyId || `cuenta:${normaliza(cuenta || 'sin-identificar')}`;
  const clave = normaliza(titulo).split(' ').slice(0, 7).join(' ');
  return `${quien}|${tipo}|${clave}`;
}
