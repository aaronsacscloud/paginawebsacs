// ══ TORRE DE CONTROL (goal del dueño 2026-09-03) ══════════════════════════════════════════════════════════════
// Una sola cola con todo lo que pide decisión en Trabajo inteligente: mensajes del agente por aprobar, propuestas de la
// Revisión diaria, reactivaciones, tareas del día (llamadas, veredictos, cadena de la reunión) y los pulsos de arriba.
// No inventa nada: lee las mismas tablas que las pestañas y las acciones se ejecutan con las mismas APIs.
import { supabase } from '../../supabase';
import { leerConfig } from './motor';

export type Urgencia = 'ahora' | 'hoy' | 'semana';
export type ItemTorre = {
  key: string; tipo: 'envio' | 'revision' | 'reactivacion' | 'tarea'; id: string; contact_id: string | null;
  lead: { nombre: string; empresa: string | null; giro: string | null; canal: string | null; etapa: string | null; telefono?: string | null };
  urgencia: Urgencia; cuando: string | null; titulo: string; chip: string; resumen: string; datos: any;
};
const cdmx = (d = new Date()) => new Date(d.getTime() - 6 * 3600e3);
const primerNombre = (s: any) => String(s || '').trim().split(/\s+/)[0] || '';

export async function colaTorre() {
  const cfg: any = await leerConfig();
  const ahora = Date.now(); const hoy = cdmx().toISOString().slice(0, 10);
  const [{ data: envios }, { data: revs }, { data: reacts }, { data: tareas }, { count: ejemplosPend }, { count: datosHig }] = await Promise.all([
    supabase.from('ti_envios').select('id, contact_id, telefono, mensaje, sale_at, origen, salida, adjuntos, plantilla, created_at, contacts(nombre, giro, fuente, lifecycle_stage, companies(nombre_comercial, nombre))').eq('estado', 'pendiente').order('sale_at').limit(60),
    supabase.from('ti_revision').select('id, contact_id, dia, avance, riesgo, resumen, que_funciono, preguntas_abiertas, propuesta, created_at, contacts(nombre, giro, fuente, lifecycle_stage, companies(nombre_comercial, nombre))').eq('estado', 'propuesta').order('created_at', { ascending: false }).limit(40),
    supabase.from('ti_reactivacion').select('id, contact_id, telefono, segmento, meses_sin_hablar, resumen_lead, pregunta_original, angulo, mensaje, mensaje_original, por_que, created_at, contacts(nombre, giro, fuente, lifecycle_stage, companies(nombre_comercial, nombre))').eq('estado', 'propuesta').order('created_at', { ascending: false }).limit(40),
    supabase.from('ti_tareas').select('id, contact_id, company_id, owner_id, familia, tipo, prioridad, vence_at, atrasada, origen, lote_tipo, payload, created_at, contacts(nombre, giro, fuente, lifecycle_stage, whatsapp, companies(nombre_comercial, nombre))').eq('estado', 'pendiente').neq('tipo', 'wa_libre').order('prioridad').order('vence_at').limit(200),
    supabase.from('ia_ejemplos').select('id', { count: 'exact', head: true }).eq('estado_rev', 'pendiente'),
    supabase.from('ti_tareas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').eq('tipo', 'dato').gte('prioridad', 5),
  ]);
  const lead = (c: any, fallbackTel?: string | null) => ({ nombre: c?.nombre || (fallbackTel ? `Lead ${String(fallbackTel).slice(-4)}` : 'Lead'), empresa: c?.companies?.nombre_comercial || c?.companies?.nombre || null, giro: c?.giro || null, canal: c?.fuente || null, etapa: c?.lifecycle_stage || null, telefono: c?.whatsapp || fallbackTel || null });
  const items: ItemTorre[] = [];
  for (const e of envios || []) {
    const min = (Date.parse(e.sale_at) - ahora) / 60e3; const s: any = e.salida || {};
    items.push({ key: `envio:${e.id}`, tipo: 'envio', id: e.id, contact_id: e.contact_id, lead: lead((e as any).contacts, e.telefono), urgencia: min <= 30 ? 'ahora' : String(cdmx(new Date(e.sale_at)).toISOString()).slice(0, 10) <= hoy ? 'hoy' : 'semana', cuando: e.sale_at, titulo: e.origen === 'reenganche' ? 'Aprobar reenganche (retomar conversación)' : e.origen === 'silencio' ? 'Aprobar toque de seguimiento' : e.origen === 'reactivacion' ? 'Aprobar reactivación programada' : e.origen === 'preparacion' ? 'Aprobar preparación de la demo' : 'Aprobar respuesta del agente', chip: 'Aprobar mensaje', resumen: s.objetivo || s.estado || '', datos: { ...e, contacts: undefined } });
  }
  for (const r of revs || []) {
    const p: any = r.propuesta || {};
    items.push({ key: `revision:${r.id}`, tipo: 'revision', id: r.id, contact_id: r.contact_id, lead: lead((r as any).contacts), urgencia: 'hoy', cuando: r.created_at, titulo: `Revisión diaria: ${p.tipo === 'mensaje_extra' ? 'mensaje extra' : p.tipo === 'plantilla' ? 'plantilla' : p.tipo === 'llamada' ? 'llamada' : p.tipo === 'descalificar' ? 'descalificar' : p.tipo || 'propuesta'}`, chip: 'Revisión diaria', resumen: r.resumen || '', datos: { ...r, contacts: undefined } });
  }
  for (const x of reacts || []) items.push({ key: `reactivacion:${x.id}`, tipo: 'reactivacion', id: x.id, contact_id: x.contact_id, lead: lead((x as any).contacts, x.telefono), urgencia: 'semana', cuando: x.created_at, titulo: `Reactivación: ${x.segmento === 'intencion' ? 'pidió precio o demo' : 'preguntó y no siguió'} hace ${x.meses_sin_hablar} meses`, chip: 'Reactivación', resumen: x.resumen_lead || '', datos: { ...x, contacts: undefined } });
  for (const t of tareas || []) {
    const p: any = t.payload || {};
    if (t.tipo === 'dato' && t.prioridad >= 5) continue;   // el lote de higiene vive en Datos
    const urg: Urgencia = t.prioridad <= 1 || t.atrasada ? 'ahora' : t.prioridad <= 3 ? 'hoy' : 'semana';
    const chip = t.tipo === 'llamada' ? 'Llamar' : t.tipo === 'veredicto' ? 'Decidir' : t.tipo === 'dato' ? (p.campo_clave?.startsWith('reunion_') ? 'Reunión' : p.campo_clave?.startsWith('cotizacion_') ? 'Cotización' : 'Dato') : t.tipo === 'responder' ? 'Responder' : t.tipo === 'wa_plantilla' ? 'Plantilla' : t.tipo === 'compromiso' ? 'Compromiso' : t.tipo;
    const ld = lead((t as any).contacts); if (!(t as any).contacts?.nombre && p.instruccion) ld.nombre = String(p.instruccion).split(' — ')[0].replace(/^¿/, '').slice(0, 60);   // tareas de empresa (Cuenta SACS, RFC): el nombre viene en la instrucción
    items.push({ key: `tarea:${t.id}`, tipo: 'tarea', id: t.id, contact_id: t.contact_id, lead: ld, urgencia: urg, cuando: t.vence_at, titulo: p.instruccion || p.campo || t.tipo, chip, resumen: p.porque || '', datos: { ...t, contacts: undefined } });
  }
  const orden: Record<Urgencia, number> = { ahora: 0, hoy: 1, semana: 2 };
  items.sort((a, b) => orden[a.urgencia] - orden[b.urgencia] || (Date.parse(a.cuando || '') || 0) - (Date.parse(b.cuando || '') || 0));
  const esCadena = (t: any) => ['reunion_resultado', 'reunion_minuta', 'reunion_interes'].includes(t.payload?.campo_clave);
  const esCot = (t: any) => ['cotizacion_estado', 'cotizacion_cobro'].includes(t.payload?.campo_clave) || ['cot_decision', 'cot_llamada'].includes(t.payload?.reloj);
  const latidoAt = cfg.observado_hasta ? Date.parse(cfg.observado_hasta) : 0;
  const pulsos = {
    por_aprobar: (envios || []).length + (revs || []).length + (reacts || []).length,
    llamadas: (tareas || []).filter(t => t.tipo === 'llamada').length,
    reunion: (tareas || []).filter(esCadena).length,
    cotizaciones: (tareas || []).filter(esCot).length,
    datos: datosHig || 0,
    aprendizaje: ejemplosPend || 0,
    agente: { activo: cfg.agente_activo === true, modo: cfg.agente_modo || 'sombra', latido_hace_min: latidoAt ? Math.round((ahora - latidoAt) / 60e3) : null, vivo: latidoAt ? ahora - latidoAt < 10 * 60e3 : false },
  };
  return { items, pulsos, hoy };
}
