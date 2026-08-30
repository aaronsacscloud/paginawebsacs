/**
 * CHURN · las reglas, sin base de datos.
 *
 * Está separado de churn.lib.ts a propósito: aquel importa el cliente de
 * Supabase (servidor) y la pantalla que importara UNA constante de ahí se
 * llevaba el cliente entero al navegador. Medido: el CRM salía en blanco con
 * «supabaseUrl is required» — un módulo de servidor colado en el bundle no
 * avisa en tiempo de compilación, avisa cuando el usuario abre la página.
 *
 * Aquí vive lo que las DOS mitades necesitan: etapas, motivos, la máquina de
 * transiciones y los cálculos de la gracia. Nada toca la base.
 *
 * Un caso de churn es un EPISODIO: el cliente canceló, se le trabaja, y
 * termina recuperado o perdido. Si vuelve a cancelar después, es un episodio
 * nuevo — no se edita el viejo. Por eso la unidad no es «la empresa con un
 * estado» sino el caso, y por eso existe `episodio`.
 *
 * TODA regla vive aquí y se valida en el SERVIDOR. La UI puede esconder un
 * botón, pero esconder no es impedir: quien pegue a la API a mano tiene que
 * toparse con la misma pared. Y las tres reglas que de verdad importan viven
 * además como constraints en la base, porque una regla que solo existe en
 * código es una regla que un script olvidará.
 */

export type Etapa = 'detectado' | 'conciliacion' | 'gracia' | 'recuperado' | 'irrecuperable';

export const ETAPAS: { id: Etapa; l: string; bg: string; fg: string; d: string }[] = [
  { id: 'detectado', l: 'Detectado', bg: '#FFF8EC', fg: '#a06600', d: 'Canceló. Nadie lo ha tocado todavía.' },
  { id: 'conciliacion', l: 'En conciliación', bg: '#E3EDFD', fg: '#2C5FC4', d: 'Estamos hablando: qué pasó y qué le ofrecemos.' },
  { id: 'gracia', l: 'En gracia', bg: '#EEECFE', fg: '#5B4BD6', d: 'Usa el sistema bajo un acuerdo, con fecha de fin.' },
  { id: 'recuperado', l: 'Recuperado', bg: '#EAF8F2', fg: '#1E8A63', d: 'Volvió a pagar. Cuenta en la ARR.' },
  { id: 'irrecuperable', l: 'Irrecuperable', bg: '#f4f4f6', fg: '#5D6470', d: 'Se perdió. Cerrado con su motivo.' },
];
export const ETAPA = (id?: string | null) => ETAPAS.find(e => e.id === id) || ETAPAS[0];
export const ABIERTAS: Etapa[] = ['detectado', 'conciliacion', 'gracia'];
export const esAbierta = (e?: string | null) => ABIERTAS.includes(e as Etapa);

/**
 * El catálogo de motivos NO se inventó: sale de agrupar las 39 razones que
 * la gente ya había escrito al cancelar. El reparto medido (30-ago-2026) fue
 * 21 servicio · 10 no-uso · 2 dejó de pagar · 1 competencia · 1 implementación,
 * y CERO por precio — por eso `precio` existe pero no encabeza la lista.
 */
export const MOTIVOS: { id: string; l: string }[] = [
  { id: 'mal_servicio', l: 'Mal servicio o soporte' },
  { id: 'no_uso', l: 'Nunca lo usó' },
  { id: 'dejo_de_pagar', l: 'Dejó de pagar (sin decir por qué)' },
  { id: 'precio', l: 'Precio' },
  { id: 'competencia', l: 'Se fue con la competencia' },
  { id: 'implementacion', l: 'No completó la implementación' },
  { id: 'cerro_negocio', l: 'Cerró el negocio' },
  { id: 'otro', l: 'Otro' },
];
export const MOTIVO = (id?: string | null) => MOTIVOS.find(m => m.id === id)?.l || (id || '—');

/** Las transiciones que existen. Lo que no está aquí, no pasa. */
const PERMITIDAS: Record<Etapa, Etapa[]> = {
  detectado: ['conciliacion', 'gracia', 'recuperado', 'irrecuperable'],
  conciliacion: ['gracia', 'recuperado', 'irrecuperable'],
  gracia: ['recuperado', 'irrecuperable', 'conciliacion'],
  // Terminales: para volver se abre un episodio nuevo, nunca se reabre este.
  recuperado: [],
  irrecuperable: [],
};

export type Falla = { error: string; campo?: string };

/**
 * ¿Se puede mover este caso a esa etapa con estos datos? Devuelve la falla en
 * vez de lanzar: quien llama decide si responde 400 o pinta el mensaje.
 */
export function validarTransicion(caso: any, destino: Etapa, datos: any = {}): Falla | null {
  const origen = (caso?.etapa || 'detectado') as Etapa;
  if (origen === destino) return { error: 'El caso ya está en esa etapa.' };
  if (!PERMITIDAS[origen]?.includes(destino)) {
    return esAbierta(origen)
      ? { error: `No se puede pasar de «${ETAPA(origen).l}» a «${ETAPA(destino).l}».` }
      : { error: `Este caso está cerrado como «${ETAPA(origen).l}». Para volver a trabajarlo se abre un episodio nuevo.` };
  }

  if (destino === 'gracia') {
    // Una gracia sin fecha de fin es un cliente gratis para siempre.
    if (!String(datos.gracia_acuerdo || '').trim()) return { error: 'Escribe qué se pactó con el cliente.', campo: 'gracia_acuerdo' };
    if (!datos.gracia_fin) return { error: 'Ponle fecha de fin a la gracia: sin fecha, es un cliente gratis para siempre.', campo: 'gracia_fin' };
    if (datos.gracia_mrr == null || Number(datos.gracia_mrr) < 0) return { error: 'Di a cuánto va a volver a pagar al terminar la gracia.', campo: 'gracia_mrr' };
    if (String(datos.gracia_fin) <= new Date().toISOString().slice(0, 10)) return { error: 'La fecha de fin tiene que ser futura.', campo: 'gracia_fin' };
  }

  if (destino === 'recuperado' && !datos.subscription_nueva_id) {
    // Un recuperado que no paga es un dato que miente, y mentiría en la ARR.
    return { error: 'Para marcar recuperado hace falta la suscripción nueva. Créala desde el caso.', campo: 'subscription_nueva_id' };
  }

  if (destino === 'irrecuperable' && !String(datos.resultado_motivo || '').trim()) {
    return { error: 'Di por qué se perdió: es lo único que enseña para el siguiente rescate.', campo: 'resultado_motivo' };
  }

  return null;
}

/** Los campos que la transición escribe, además de la etapa. */
export function camposDeTransicion(destino: Etapa, datos: any = {}): Record<string, any> {
  const ahora = new Date().toISOString();
  const c: Record<string, any> = { etapa: destino, updated_at: ahora };
  if (destino === 'conciliacion') c.conciliacion_at = ahora;
  if (destino === 'gracia') {
    c.gracia_at = ahora;
    c.gracia_acuerdo = String(datos.gracia_acuerdo).trim();
    c.gracia_fin = datos.gracia_fin;
    c.gracia_mrr = Number(datos.gracia_mrr);
  }
  if (destino === 'recuperado') {
    c.cerrado_at = ahora; c.resultado = 'recuperado';
    c.subscription_nueva_id = datos.subscription_nueva_id;
    if (datos.resultado_motivo) c.resultado_motivo = String(datos.resultado_motivo).trim();
  }
  if (destino === 'irrecuperable') {
    c.cerrado_at = ahora; c.resultado = 'perdido';
    c.resultado_motivo = String(datos.resultado_motivo).trim();
  }
  return c;
}

/** Días que le quedan a la gracia (negativo = ya venció). */
export function diasDeGracia(caso: any): number | null {
  if (!caso?.gracia_fin) return null;
  const fin = new Date(String(caso.gracia_fin) + 'T23:59:59');
  return Math.ceil((fin.getTime() - Date.now()) / 86400000);
}

/**
 * El semáforo de la gracia. Lo interesante no es el tiempo: es si LA ESTÁ
 * USANDO. Una gracia de 30 días con el sistema en cero es una gracia que ya
 * fracasó, y hay que saberlo el día 10, no el 30.
 */
export function saludDeGracia(caso: any, empresa: any): { tono: 'bien' | 'ojo' | 'mal' | 'nd'; texto: string } {
  if (!empresa?.sacs_account) return { tono: 'nd', texto: 'sin cuenta ligada' };
  const dias = empresa.dias_sin_venta;
  if (dias == null) return { tono: 'nd', texto: 'sin datos de uso' };
  if (dias <= 3) return { tono: 'bien', texto: 'sí lo está usando' };
  if (dias <= 14) return { tono: 'ojo', texto: `${dias} d sin vender` };
  return { tono: 'mal', texto: `${dias} d sin vender` };
}
