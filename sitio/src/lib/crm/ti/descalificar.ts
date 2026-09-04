/**
 * POR DESCALIFICAR (decisión del dueño, 2026-09-04): su propia sección, no un renglón perdido en la Torre.
 *
 * Aquí llegan los leads que el sistema propone cerrar, por dos caminos:
 *   · el índice de vida: se agotaron los intentos reales y no hay señales;
 *   · el seguimiento de 1 a 4 días: el clasificador leyó que el lead DIJO que no le interesa.
 *
 * Cada uno viene con lo que hace falta para decidir en diez segundos: qué dijo, cuánto lleva, si alguna vez
 * contestó, si dejó dinero en la mesa (cotización o demo) y qué pasa con cada opción. Descalificar no borra a
 * nadie: lo saca del ciclo del agente y lo manda a nutrición.
 */
import { supabase } from '../../supabase';

const D = 86400e3;

export async function colaDescalificar(limite = 40) {
  const { data: tareas } = await supabase.from('ti_tareas')
    .select('id, contact_id, company_id, payload, origen, created_at, vence_at, prioridad, contacts(nombre, whatsapp, email, giro, lifecycle_stage, fuente, created_at, companies(nombre_comercial, nombre))')
    .eq('estado', 'pendiente').eq('tipo', 'veredicto').order('created_at', { ascending: true }).limit(limite);
  const lista = (tareas || []).filter(t => String((t.payload as any)?.propuesta || '') === 'descalificar');
  if (!lista.length) return [];
  const ids = lista.map(t => t.contact_id).filter(Boolean) as string[];

  // Todo el contexto de una vez: qué dijo el clasificador, si dejó dinero en la mesa y qué tanto le hemos escrito.
  const [{ data: clas }, { data: quotes }, { data: bks }, { data: envs }, { data: eventos }] = await Promise.all([
    supabase.from('ia_log').select('contact_id, razon, detalle, created_at').eq('accion', 'seguimiento_clasifica').in('contact_id', ids).order('created_at', { ascending: false }),
    supabase.from('quotes').select('contact_id, numero, total, estado, created_at').in('contact_id', ids).not('estado', 'in', '("deleted","plantilla")'),
    supabase.from('bookings').select('contact_id, estado, fecha').in('contact_id', ids),
    supabase.from('ti_envios').select('contact_id, estado, enviado_at').in('contact_id', ids).eq('estado', 'enviado'),
    supabase.from('ti_eventos').select('contact_id, tipo, ocurrio_at').in('contact_id', ids).in('tipo', ['wa_entrante', 'wa_saliente']),
  ]);

  const ahora = Date.now();
  return lista.map(t => {
    const cid = t.contact_id as string;
    const p: any = t.payload || {};
    const k: any = (t as any).contacts || {};
    const cl = (clas || []).find(x => x.contact_id === cid);
    const q = (quotes || []).filter(x => x.contact_id === cid);
    const b = (bks || []).filter(x => x.contact_id === cid);
    const ent = (eventos || []).filter(x => x.contact_id === cid && x.tipo === 'wa_entrante');
    const sal = (eventos || []).filter(x => x.contact_id === cid && x.tipo === 'wa_saliente');
    const ultEnt = ent.map(x => Date.parse(x.ocurrio_at)).sort((a, z) => z - a)[0] || null;
    const enviados = (envs || []).filter(x => x.contact_id === cid).length;
    const dinero = q.reduce((s, x) => s + (Number(x.total) || 0), 0);
    const asistio = b.some(x => x.estado === 'asistio');
    const noShow = b.filter(x => x.estado === 'no_asistio').length;

    // Por qué esta decisión importa: lo que se pierde si se cierra y lo que cuesta si se deja abierto.
    const razones: string[] = [];
    if (dinero > 0) razones.push(`Tiene ${q.length} cotización${q.length === 1 ? '' : 'es'} por $${Math.round(dinero).toLocaleString('es-MX')}: si lo cierras, ese dinero sale del pipeline.`);
    if (asistio) razones.push('Ya tuvo demo: no es un lead frío, es una oportunidad que se enfrió.');
    if (noShow) razones.push(`Faltó a ${noShow} demo${noShow === 1 ? '' : 's'} agendada${noShow === 1 ? '' : 's'}.`);
    if (!ent.length) razones.push('Nunca contestó un solo mensaje: nada indica que sea un lead real.');
    else razones.push(`Contestó ${ent.length} ${ent.length === 1 ? 'vez' : 'veces'}, la última hace ${Math.round((ahora - (ultEnt || ahora)) / D)} días.`);
    razones.push(`Le hemos escrito ${sal.length} ${sal.length === 1 ? 'mensaje' : 'mensajes'} (${enviados} del agente). Si sigue abierto, el agente le vuelve a escribir.`);

    const motivo: string = cl ? String(cl.razon || '').split(' · ')[0] : (p.sujeto === 'indice' ? 'indice' : 'silencio');
    return {
      id: t.id, contact_id: cid, company_id: t.company_id,
      nombre: k.nombre || 'Sin nombre', empresa: k.companies?.nombre_comercial || k.companies?.nombre || null,
      giro: k.giro || null, etapa: k.lifecycle_stage || null, telefono: k.whatsapp || p.whatsapp || null, email: k.email || null, fuente: k.fuente || null,
      creado: k.created_at || null, propuesta_at: t.created_at,
      titulo: p.instruccion || 'Se sugiere descalificar',
      porque: p.porque || (cl?.detalle as any)?.por_que || '',
      resumen: (cl?.detalle as any)?.resumen || null,
      dijo: (cl?.detalle as any)?.por_que || null,
      motivo, origen: t.origen || null,
      indice: p.indice ?? null,
      hechos: Array.isArray(p.hechos) ? p.hechos : [],
      razones,
      dinero, cotizaciones: q.length, demo_asistio: asistio, no_shows: noShow,
      respondio: ent.length, escritos: sal.length, enviados_agente: enviados,
      dias_sin_respuesta: ultEnt ? Math.round((ahora - ultEnt) / D) : null,
      resultados: p.resultados || { descalificar: 'Descalificar', seguir: 'Que siga', pausar: 'Pausar hasta una fecha' },
      motivos_no_era_lead: p.motivos_no_era_lead || null,
    };
  });
}

/** Resumen de la sección: cuántos, por qué motivo y cuánto dinero está en juego. */
export async function panelDescalificar() {
  const cola = await colaDescalificar(60);
  const porMotivo: Record<string, number> = {};
  for (const c of cola) porMotivo[c.motivo] = (porMotivo[c.motivo] || 0) + 1;
  return {
    total: cola.length,
    dijeron_no: cola.filter(c => c.motivo === 'dijo_no').length,
    nunca_contestaron: cola.filter(c => !c.respondio).length,
    con_dinero: cola.filter(c => c.dinero > 0).length,
    dinero: cola.reduce((s, c) => s + c.dinero, 0),
    por_motivo: porMotivo,
  };
}
