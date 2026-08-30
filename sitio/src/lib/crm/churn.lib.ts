/**
 * CHURN · el motor del rescate.
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
import { supabase } from '../supabase';

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

/**
 * Los campos hermanos se mueven CON la etapa, en el mismo acto.
 *
 * Esto es el aprendizaje de «descalificado»: mover solo un campo dejaba al
 * cliente contando dos historias distintas —etapa por un lado, pastilla por
 * otro— y todo lo que enruta por el otro campo lo seguía tratando como antes.
 */
export async function sincronizarHermanos(caso: any, destino: Etapa) {
  const empresa = destino === 'recuperado' ? 'activo' : destino === 'irrecuperable' ? 'cancelado' : null;
  if (empresa) {
    await supabase.from('companies').update({ estado_cuenta: empresa }).eq('id', caso.company_id);
    await supabase.from('contacts')
      .update({ lifecycle_stage: destino === 'recuperado' ? 'cliente' : 'churned' })
      .eq('company_id', caso.company_id)
      .in('lifecycle_stage', destino === 'recuperado' ? ['churned'] : ['cliente', 'churned']);
  }
}

/** Una línea en la historia del caso. Va al MISMO río que la ficha 360. */
export async function anotar(caso: any, tipo: string, titulo: string, descripcion?: string, automatico = true) {
  await supabase.from('activities').insert({
    company_id: caso.company_id, churn_caso_id: caso.id,
    tipo, titulo, descripcion: descripcion || null, automatico,
  }).then(() => {}, () => {});
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

/**
 * ABRIR EL CASO SI APLICA. Idempotente a propósito: la llaman el momento de
 * cancelar (para que el caso exista al instante) y un barrido nocturno (la
 * red por si el primero falló o la baja entró por otro camino). Llamarla dos
 * veces no duplica nada.
 *
 * La regla de entrada salió de medir, no de suponer: es churn quien canceló y
 * NO conserva ninguna sub viva. Quien cancela una y mantiene otra es
 * CONTRACCIÓN — eso ya lo cuenta el ledger y no abre caso.
 */
export async function abrirCasoSiAplica(companyId: string): Promise<{ creado: boolean; caso_id?: string; motivo?: string }> {
  if (!companyId) return { creado: false, motivo: 'sin empresa' };

  const { data: subs } = await supabase.from('subscriptions')
    .select('id, estado, mrr, razon_cancelacion, cancelada_at, updated_at')
    .eq('company_id', companyId);
  const vivas = (subs || []).filter(s => ['activa', 'programada', 'pendiente_pago', 'pausada'].includes(s.estado));
  if (vivas.length) return { creado: false, motivo: 'conserva una suscripción viva: es contracción, no churn' };

  const canceladas = (subs || []).filter(s => s.estado === 'cancelada');
  if (!canceladas.length) return { creado: false, motivo: 'no tiene suscripciones canceladas' };

  // Un solo caso abierto por empresa. Si ya hay uno, se anota ahí: partir la
  // historia en dos casos paralelos es perder el hilo del rescate.
  const { data: vivo } = await supabase.from('churn_casos')
    .select('id').eq('company_id', companyId).in('etapa', ABIERTAS).maybeSingle();
  if (vivo) return { creado: false, caso_id: vivo.id, motivo: 'ya tenía un caso abierto' };

  canceladas.sort((a, b) => String(b.cancelada_at || b.updated_at || '').localeCompare(String(a.cancelada_at || a.updated_at || '')));
  const ultima = canceladas[0];
  const { data: previos } = await supabase.from('churn_casos')
    .select('id, episodio').eq('company_id', companyId).order('episodio', { ascending: false }).limit(1);
  const previo = previos?.[0];

  const { data, error } = await supabase.from('churn_casos').insert({
    company_id: companyId,
    subscription_id: ultima.id,
    mrr_perdido: canceladas.reduce((t, s) => t + Number(s.mrr || 0), 0),
    motivo_original: ultima.razon_cancelacion || null,
    motivo_categoria: categorizarRazon(ultima.razon_cancelacion),
    detectado_at: ultima.cancelada_at || new Date().toISOString(),
    fecha_estimada: !ultima.cancelada_at,
    episodio: (previo?.episodio || 0) + 1,
    caso_previo_id: previo?.id || null,
  }).select('id').single();
  if (error) return { creado: false, motivo: error.message };

  await anotar({ id: data.id, company_id: companyId }, 'nota', 'Caso de churn abierto',
    previo ? `Episodio ${(previo.episodio || 0) + 1}: este cliente ya se había ido antes.` : 'Detectado al cancelar la suscripción.');
  return { creado: true, caso_id: data.id };
}

/** El mismo mapeo del backfill, para que lo viejo y lo nuevo se cuenten igual. */
export function categorizarRazon(razon?: string | null): string | null {
  const r = String(razon || '').toLowerCase();
  if (!r.trim()) return null;
  if (r.includes('competencia')) return 'competencia';
  if (r.includes('implementaci')) return 'implementacion';
  if (r.includes('mal servicio') || r.includes('mal_servicio') || r.includes('soporte')) return 'mal_servicio';
  if (r === 'no_uso' || r.includes('no lo usaba') || (r.includes('nunca') && r.includes('us'))) return 'no_uso';
  if (r.includes('cerr') && r.includes('negocio')) return 'cerro_negocio';
  if (r.includes('precio') || r.includes('caro')) return 'precio';
  if (r.includes('dej') && r.includes('pagar')) return 'dejo_de_pagar';
  return 'otro';
}

