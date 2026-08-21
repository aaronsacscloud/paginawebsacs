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
  // Postgres devuelve `date` como 'YYYY-MM-DD', pero un cliente distinto puede
  // entregar el timestamp completo. Concatenar 'T00:00:00Z' a eso da NaN, y NaN
  // se arrastra hasta `!tope`, que es `true`: el límite diario desaparecía en
  // silencio y el calentamiento hacía justo lo contrario de lo que promete.
  const soloFecha = String(inicio).slice(0, 10);
  const t0 = Date.parse(soloFecha + 'T00:00:00Z');
  if (!Number.isFinite(t0)) return 50;   // fecha ilegible: lo más conservador
  const dia = Math.floor((ahora - t0) / 86400000);
  if (dia < 0) return 50;
  const escalon = 50 * Math.pow(2, Math.floor(dia / 2));
  const tope = limiteDiario && limiteDiario > 0 ? limiteDiario : Infinity;
  return escalon >= tope ? null : escalon;
}

/**
 * Cuáles recorridos se detienen.
 *
 * Dos filtros que se confunden fácil y que, mal puestos, dan los dos errores
 * opuestos: apagarle a un partner los embudos de otro (si no se acota al
 * inquilino), o seguir escribiéndole a quien ya contestó (si el interruptor
 * `parar_si_responde` se lee al revés).
 */
export function cualesDetener(
  activos: Array<{ id: string; automation_id: string }>,
  embudos: Array<{ id: string; parar_si_responde?: boolean | null; tenant_id?: string | null }>,
  op: { tenantId?: string | null; soloSiParar?: boolean } = {},
): string[] {
  const { tenantId = null, soloSiParar = true } = op;
  const porId = new Map(embudos.map(a => [a.id, a]));
  return activos.filter(e => {
    const a = porId.get(e.automation_id);
    // Un embudo que no se encuentra se trata como "sí detener": ante la duda,
    // callarse. Callar de más cuesta un correo que no salió; hablar de más
    // cuesta una queja de spam.
    if (!a) return true;
    if (tenantId && a.tenant_id && a.tenant_id !== tenantId) return false;
    if (soloSiParar && a.parar_si_responde === false) return false;
    return true;
  }).map(e => e.id);
}

/**
 * La dirección de respuesta de un envío: `reply+<id sin guiones>@dominio`.
 *
 * El RFC 5321 limita la parte local de una dirección a **64 octetos**. La
 * versión anterior metía ahí el token firmado completo —166 caracteres— y
 * servidores como Hostinger rechazaban la dirección al momento de escribir:
 * el correo llegaba perfecto y NADIE podía contestarlo. Un correo al que no se
 * puede responder es peor que uno que no se manda, porque parece que funcionó.
 *
 * Devuelve null si no hay dominio configurado (entonces se usa el reply_to
 * normal) y lanza si la dirección no cabe: es preferible fallar al enviar que
 * mandar un correo mudo.
 */
export function direccionRespuesta(sendId: string, dominio: string): string | null {
  const d = String(dominio || '').trim();
  if (!d) return null;
  const local = 'reply+' + String(sendId || '').replace(/-/g, '');
  if (local.length > 64) {
    throw new Error(`La parte local del Reply-To mide ${local.length} y el máximo es 64 (RFC 5321).`);
  }
  return `${local}@${d}`;
}

/**
 * Los estados que la BASE acepta para una inscripción.
 *
 * Están aquí y no sueltos en cada archivo porque ya costó dos veces: el
 * `update` de Postgrest **no lanza** cuando el valor viola el CHECK — devuelve
 * el error en `error`, y quien solo desestructura `data` no se entera. Con
 * `'detenido'` y con `'cancelado'` —dos valores que nadie permitió nunca— el
 * código decía que detenía embudos y no detenía ninguno, en silencio.
 */
export const ESTADOS_INSCRIPCION = ['activo', 'completado', 'goal_achieved', 'unenrolled', 'error', 'pausado'] as const;
export type EstadoInscripcion = typeof ESTADOS_INSCRIPCION[number];

/** El estado con el que se saca a alguien de un embudo. */
export const SALIDA: EstadoInscripcion = 'unenrolled';

export function esEstadoValido(e: string): e is EstadoInscripcion {
  return (ESTADOS_INSCRIPCION as readonly string[]).includes(e);
}
