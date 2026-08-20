/**
 * Lógica pura del correo: sin base de datos, sin red, sin entorno.
 *
 * Existe para poder PROBARLA. Este módulo lleva ~45 bugs encontrados a mano y
 * varios de los peores —el día calculado en UTC contra una columna en CDMX, la
 * ventana de lectura que hacía imposible una regla, los utm buscados en el
 * referrer— eran invisibles leyendo el código y obvios con un caso de prueba.
 * Todo lo que se pueda decidir sin tocar Postgres vive aquí.
 */

/** Rutas que no son del sitio público: el panel, las APIs, el pie de un correo. */
export const RUTA_INTERNA = /^\/(admin|api|email\/(baja|preferencias)|qa-)/i;

/**
 * ¿La ruta calza con el patrón? `/planes` calza con `/planes?x=1` y `/planes/anual`.
 *
 * La portada es el caso que se rompe solo: quitar la diagonal final deja `/`
 * como cadena vacía, y una cadena vacía se descarta como "patrón sin llenar".
 * Se normaliza a `/`, no a `''`.
 */
export function calza(ruta: string, patron: string): boolean {
  if (RUTA_INTERNA.test(String(ruta || ''))) return false;
  if (!String(patron || '').trim()) return false;
  const norm = (x: string) => String(x || '').toLowerCase().split('?')[0].replace(/\/+$/, '') || '/';
  const r = norm(ruta);
  const p = norm(patron);
  if (p.endsWith('*')) return r.startsWith(p.slice(0, -1));
  return r === p || r.startsWith(p + '/');
}

/** La fecha de hoy en CDMX, igual que el default de `web_disparos.dia`. */
export function diaCdmx(t: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(t);
}

/**
 * Cuántos días hacia atrás hay que LEER para evaluar una regla.
 *
 * No es lo mismo que el umbral de la regla. `ausencia` pregunta "vio X y lleva
 * N días sin volver": si solo se leen N días, la visita que la dispara queda
 * fuera por construcción y la regla no puede cumplirse nunca.
 */
export function ventanaDeLectura(tipo: string, dias: number): number {
  return tipo === 'ausencia' ? Math.min(120, dias * 4 + 7) : dias;
}

/**
 * De dónde llegó una visita.
 *
 * Los parámetros de campaña viajan en la URL de la página, NO en el referrer:
 * el referrer trae el dominio de quien te mandó. Buscarlos solo ahí clasifica
 * todo el tráfico pagado como "directo".
 */
export function clasificarOrigen(v: { sendId?: string | null; ruta?: string; referrer?: string | null }): string {
  if (v.sendId) return 'email';
  const marcas = /[?&](utm_|gclid|ttclid|fbclid|msclkid|li_fat_id)/i;
  if (marcas.test(String(v.ruta || ''))) return 'anuncio';
  if (marcas.test(String(v.referrer || ''))) return 'anuncio';
  const ref = String(v.referrer || '');
  if (!ref) return 'directo';
  if (/(google|bing|duckduckgo|yahoo)\./i.test(ref)) return 'buscador';
  if (/(facebook|instagram|tiktok|linkedin|x\.com|twitter|youtube|t\.co)\./i.test(ref)) return 'social';
  return 'referido';
}

/**
 * El escalón de calentamiento de un dominio nuevo: 50 al día, doblando cada
 * dos días. `null` = la rampa terminó (o no hay), manda el límite configurado.
 */
export function escalonCalentamiento(inicio: string | null | undefined, limiteDiario: number | null | undefined, ahora = Date.now()): number | null {
  if (!inicio) return null;
  const dia = Math.floor((ahora - Date.parse(inicio + 'T00:00:00Z')) / 86400000);
  if (dia < 0) return 50;
  const escalon = 50 * Math.pow(2, Math.floor(dia / 2));
  const tope = limiteDiario && limiteDiario > 0 ? limiteDiario : Infinity;
  return escalon >= tope ? null : escalon;
}
