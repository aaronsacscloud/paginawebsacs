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

export type Etapa = 'detectado' | 'conciliacion' | 'gracia' | 'recuperado' | 'estable' | 'irrecuperable';

export const ETAPAS: { id: Etapa; l: string; bg: string; fg: string; d: string }[] = [
  { id: 'detectado', l: 'Detectado', bg: '#FFF8EC', fg: '#a06600', d: 'Canceló. Nadie lo ha tocado todavía.' },
  { id: 'conciliacion', l: 'En conciliación', bg: '#E3EDFD', fg: '#2C5FC4', d: 'Estamos hablando: qué pasó y qué le ofrecemos.' },
  { id: 'gracia', l: 'En gracia', bg: '#EEECFE', fg: '#5B4BD6', d: 'Usa el sistema bajo un acuerdo, con fecha de fin.' },
  { id: 'recuperado', l: 'En observación', bg: '#EAF8F2', fg: '#1E8A63', d: 'Volvió a pagar. Se le sigue de cerca hasta que el uso demuestre que se quedó.' },
  { id: 'estable', l: 'Estable', bg: '#E9F4EF', fg: '#146B4C', d: 'Aguantó la observación usando el sistema. Vuelve a ser un cliente normal.' },
  { id: 'irrecuperable', l: 'Irrecuperable', bg: '#f4f4f6', fg: '#5D6470', d: 'Se perdió. Cerrado con su motivo.' },
];
export const ETAPA = (id?: string | null) => ETAPAS.find(e => e.id === id) || ETAPAS[0];
/* Recuperado sigue ABIERTO: volver a pagar no es el final. Un cliente que se
   fue una vez es frágil —las razones que lo hicieron irse siguen ahí hasta
   que se prueban resueltas— así que se queda en la sección, en observación,
   y solo se gradúa cuando el USO demuestra que se quedó. */
export const ABIERTAS: Etapa[] = ['detectado', 'conciliacion', 'gracia', 'recuperado'];
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
  /* Desde la observación se puede graduar… o recaer. Que un recuperado vuelva
     a irse ANTES de graduarse no abre episodio nuevo: es el mismo rescate que
     falló, y contarlo aparte escondería que la gracia no aguantó. */
  recuperado: ['estable', 'irrecuperable', 'conciliacion'],
  // Terminales: para volver se abre un episodio nuevo, nunca se reabre este.
  estable: [],
  irrecuperable: [],
};

/** Cuánto dura la observación. Un trimestre: menos no prueba nada, y más
 *  convierte la sección en un archivo de gente que ya se quedó. */
export const DIAS_OBSERVACION = 90;

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
    /* NaN y 0 pasaban: NaN estallaba después con un mensaje crudo de Postgres,
       y 0 es exactamente el «cliente gratis para siempre» que esta regla
       existe para impedir. */
    const mrrVuelve = Number(datos.gracia_mrr);
    if (!Number.isFinite(mrrVuelve) || mrrVuelve <= 0) return { error: 'Di a cuánto va a volver a pagar al terminar la gracia (más de cero).', campo: 'gracia_mrr' };
    const hoy = new Date().toISOString().slice(0, 10);
    if (String(datos.gracia_fin) <= hoy) return { error: 'La fecha de fin tiene que ser futura.', campo: 'gracia_fin' };
    // Y con techo: sin tope, «hasta 2036» es una gracia válida.
    const tope = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    if (String(datos.gracia_fin) > tope) return { error: 'Una gracia no puede pasar de 6 meses. Si hace falta más, se extiende después.', campo: 'gracia_fin' };
  }

  if (destino === 'recuperado' && !datos.subscription_nueva_id) {
    // Un recuperado que no paga es un dato que miente, y mentiría en la ARR.
    return { error: 'Para marcar recuperado hace falta la suscripción nueva. Créala desde el caso.', campo: 'subscription_nueva_id' };
  }

  if (destino === 'estable') {
    if (origen !== 'recuperado') return { error: 'Solo se gradúa desde la observación.' };
    /* No se gradúa a alguien que no está usando el sistema. Graduarlo sería
       decir «este rescate funcionó» de alguien que va camino a irse otra vez:
       el dato que ya tenemos dice justo lo contrario. */
    if (datos.dias_sin_venta != null && Number(datos.dias_sin_venta) > 30) {
      return { error: 'Lleva más de 30 días sin vender: graduarlo diría que el rescate funcionó cuando no está usando el sistema.' };
    }
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
    /* NO se pone cerrado_at: el caso sigue abierto en observación. Ponerlo
       aquí era decir que el trabajo terminó al cobrar. */
    c.resultado = 'recuperado';
    c.observacion_hasta = new Date(Date.now() + DIAS_OBSERVACION * 86400000).toISOString().slice(0, 10);
    if (datos.uso_al_recuperar) c.uso_al_recuperar = datos.uso_al_recuperar;
    c.subscription_nueva_id = datos.subscription_nueva_id;
    if (datos.resultado_motivo) c.resultado_motivo = String(datos.resultado_motivo).trim();
  }
  if (destino === 'estable') {
    c.cerrado_at = ahora; c.resultado = 'recuperado';
    c.resultado_motivo = String(datos.resultado_motivo || '').trim() || 'Aguantó la observación usando el sistema.';
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

/* ═══ QUÉ ESTÁ USANDO ═══════════════════════════════════════════════════
 *
 * `uso_sacs` trae el detalle por MÓDULO (usa / total / docs_7d / docs_30d /
 * último / familia), no un sí-o-no. Eso permite contestar la pregunta que de
 * verdad decide un rescate: ¿está usando lo que dijo que le faltaba?
 *
 * Y comparar contra la foto que se guardó al abrir el caso permite la única
 * prueba real de que el rescate funcionó: lo usa MÁS que antes de irse.
 */
export type ModuloUso = { modulo: string; familia?: string; usa?: boolean; docs_7d?: number; docs_30d?: number; ultimo?: string | null; total?: number };

export function modulosDe(uso: any): ModuloUso[] {
  const m = uso?.modulos;
  return Array.isArray(m) ? m : [];
}

/** Los que de verdad se están usando ahora, de más a menos movimiento. */
export function modulosVivos(uso: any): ModuloUso[] {
  return modulosDe(uso)
    .filter(m => (m.docs_30d || 0) > 0)
    .sort((a, b) => (b.docs_30d || 0) - (a.docs_30d || 0));
}

/**
 * El antes contra el ahora. Devuelve qué módulos ARRANCÓ durante el rescate
 * (los que no usaba y ahora sí) y cuáles DEJÓ de usar — que es la señal
 * temprana de que se va otra vez.
 */
export function compararUso(antes: any, ahora: any): { arranco: string[]; dejo: string[]; sube: boolean | null } {
  const A = new Map(modulosDe(antes).map(m => [m.modulo, m]));
  const B = modulosDe(ahora);
  if (!A.size || !B.length) return { arranco: [], dejo: [], sube: null };
  const arranco: string[] = [], dejo: string[] = [];
  let totalAntes = 0, totalAhora = 0;
  for (const m of B) {
    const a = A.get(m.modulo);
    totalAhora += m.docs_30d || 0;
    totalAntes += a?.docs_30d || 0;
    if ((m.docs_30d || 0) > 0 && !(a?.docs_30d || 0)) arranco.push(m.modulo);
    if (!(m.docs_30d || 0) && (a?.docs_30d || 0) > 0) dejo.push(m.modulo);
  }
  return { arranco, dejo, sube: totalAntes === totalAhora ? null : totalAhora > totalAntes };
}

/**
 * ¿El rescate está funcionando? No es una opinión: es si el cliente usa hoy
 * lo que no usaba cuando se fue. Un «sí lo usa» genérico no distingue al que
 * factura todos los días del que entró una vez a ver.
 */
export function veredictoRescate(caso: any, empresa: any): { tono: 'bien' | 'ojo' | 'mal' | 'nd'; texto: string } {
  if (!empresa?.sacs_account) return { tono: 'nd', texto: 'sin cuenta ligada' };
  const vivos = modulosVivos(empresa.uso_sacs);
  if (!vivos.length) return { tono: 'mal', texto: 'no ha tocado el sistema' };
  const cmp = compararUso(caso?.uso_al_abrir, empresa.uso_sacs);
  if (cmp.arranco.length) return { tono: 'bien', texto: `arrancó ${cmp.arranco.length === 1 ? cmp.arranco[0] : `${cmp.arranco.length} módulos nuevos`}` };
  if (cmp.dejo.length) return { tono: 'ojo', texto: `dejó ${cmp.dejo.length === 1 ? cmp.dejo[0] : `${cmp.dejo.length} módulos`}` };
  const top = vivos[0];
  return { tono: 'bien', texto: `${top.modulo} · ${top.docs_30d} en 30 d` };
}

