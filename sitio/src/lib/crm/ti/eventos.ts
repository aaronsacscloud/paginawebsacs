// TRABAJO INTELIGENTE · A0 — LA BITÁCORA DE EVENTOS (ti_eventos).
//
// Principio: los eventos YA caen en tablas distintas (wa_mensajes, quotes,
// bookings, email_sends, ti_tareas, ia_log…). Aquí no se toca ningún
// webhook: cada ADAPTADOR lee su tabla desde una marca de agua y proyecta
// filas normalizadas a ti_eventos. El índice único (fuente_tabla, fuente_id,
// tipo, ocurrio_at) hace que correr dos veces sea inofensivo — igual que el
// generador de tareas.
//
// Se llama desde el observador (cada 2 min, incremental) y desde el cron
// ti-eventos con ?dias=N para el backfill. Devuelve los contact_id tocados
// para que perfil.ts recalcule solo esos.
import { supabase } from '../../supabase';

export type Evento = {
  contact_id: string | null;
  company_id?: string | null;
  tipo: string;
  canal: 'wa' | 'correo' | 'llamada' | 'web' | 'crm' | 'ia';
  actor: 'lead' | 'humano' | 'ia' | 'sistema' | 'valvula' | 'secuencia' | 'agenda';
  payload?: Record<string, any>;
  ocurrio_at: string;
  fuente_tabla: string;
  fuente_id: string;
};

const MS_MIN = 60e3, MS_D = 86400e3;
/** Solape al leer desde la marca: lo que llegó tarde a la tabla fuente no se pierde. */
const SOLAPE_MIN = 10;
const LOTE = 400;

/* ── marcas de agua por fuente (viven en ti_config.valor.eventos_marca) ── */
async function marcas(): Promise<Record<string, string>> {
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  return ((data?.valor as any)?.eventos_marca) || {};
}
async function guardarMarcas(m: Record<string, string>) {
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  await supabase.from('ti_config').update({ valor: { ...((data?.valor as any) || {}), eventos_marca: m } }).eq('id', 1);
}

/* ── escribir en lotes, ignorando duplicados ── */
async function registrar(evs: Evento[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < evs.length; i += LOTE) {
    const lote = evs.slice(i, i + LOTE).map(e => ({ ...e, payload: e.payload || {} }));
    const { data, error } = await supabase.from('ti_eventos')
      .upsert(lote, { onConflict: 'fuente_tabla,fuente_id,tipo,ocurrio_at', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`ti_eventos: ${error.message}`);
    n += (data || []).length;
  }
  return n;
}

/** Recorre una consulta paginada por rango de fecha. `col` es la columna del
 *  reloj; `desde` inclusivo. Tope duro para que un backfill no se coma la
 *  función entera. */
async function paginar(mk: (offset: number) => any, tope = 20000): Promise<any[]> {
  const out: any[] = [];
  for (let off = 0; off < tope; off += 1000) {
    const { data, error } = await mk(off).range(off, off + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const corto = (s: any, n = 240) => String(s || '').slice(0, n);

/** Los códigos de Meta que importan para las políticas (caso C26). */
function clasificarErrorWa(err: string | null): { codigo: string | null; clase: string } {
  const m = String(err || '').match(/\b(\d{6})\b/);
  const codigo = m ? m[1] : null;
  const clase = codigo === '131049' || codigo === '130472' ? 'marketing_limite'
    : codigo === '131047' ? 'ventana_cerrada'
    : codigo === '131026' ? 'no_alcanzable'
    : codigo ? 'otro' : 'sin_codigo';
  return { codigo, clase };
}

/* ══ ADAPTADORES ══ */

async function adWhatsapp(desde: string): Promise<Evento[]> {
  const msjs = await paginar(() => supabase.from('wa_mensajes')
    .select('id, conversation_id, direccion, tipo, cuerpo, status, error, autor, autor_id, created_at, metadata, wa_conversaciones(contact_id, company_id)')
    .gte('created_at', desde).is('borrado_at', null).order('created_at', { ascending: true }));
  const evs: Evento[] = [];
  for (const m of msjs) {
    const conv: any = (m as any).wa_conversaciones || {};
    const md: any = m.metadata || {};
    // Conversación sin contacto: no es de ningún lead, pero sus PLANTILLAS sí
    // cuentan para medir entrega/fallo por plantilla (caso C26: marketing vs
    // utility). Lo demás de esas conversaciones se ignora.
    if (!conv.contact_id && m.tipo !== 'template') continue;
    const base = { contact_id: (conv.contact_id as string) || null, company_id: conv.company_id || null, canal: 'wa' as const, fuente_tabla: 'wa_mensajes', fuente_id: String(m.id), ocurrio_at: m.created_at };
    if (m.direccion === 'entrante') {
      evs.push({ ...base, tipo: 'wa_entrante', actor: 'lead', payload: { texto: corto(m.cuerpo), tipo: m.tipo, conversation_id: m.conversation_id } });
      continue;
    }
    // saliente: ¿quién lo mandó?
    const actor: Evento['actor'] = m.autor === 'Agenda' ? 'agenda'
      : md.origen === 'secuencia' ? 'secuencia'
      : md.origen === 'valvula' ? 'valvula'
      : md.origen === 'copiloto' || md.origen === 'agente' ? 'ia'
      : (m.autor_id || m.autor) ? 'humano'
      : 'sistema';
    const payload: any = { texto: corto(m.cuerpo, 160), tipo: m.tipo, autor: m.autor || null, conversation_id: m.conversation_id };
    if (m.tipo === 'template') payload.plantilla = md.plantilla || null;
    if (md.origen === 'respond.io') payload.legacy = true;
    evs.push({ ...base, tipo: 'wa_saliente', actor, payload });
    if (m.status === 'failed') {
      const { codigo, clase } = clasificarErrorWa(m.error);
      evs.push({ ...base, tipo: 'wa_fallido', actor: 'sistema', payload: { codigo, clase, error: corto(m.error, 200), plantilla: md.plantilla || null, tipo: m.tipo } });
    }
    if (m.status === 'read') {
      // Kapso no guarda la hora de lectura: se aproxima a la del envío.
      evs.push({ ...base, tipo: 'wa_leido', actor: 'lead', payload: { aprox: true, plantilla: md.plantilla || null } });
    }
  }
  return evs;
}

async function adCotizaciones(desde: string): Promise<Evento[]> {
  // quotes no tiene updated_at: se leen por cada reloj propio.
  const cols = 'id, numero, total, plan, sucursales, estado, created_via, partner_id, contact_id, company_id, vistas, created_at, primera_vista_at, ultima_vista_at, aceptado_fecha, rechazado_fecha, pagado_fecha';
  const or = ['created_at', 'primera_vista_at', 'ultima_vista_at', 'aceptado_fecha', 'rechazado_fecha', 'pagado_fecha'].map(c => `${c}.gte.${desde}`).join(',');
  const qs = await paginar(() => supabase.from('quotes').select(cols).not('contact_id', 'is', null)
    .not('estado', 'in', '("draft","plantilla","deleted")').or(or).order('created_at', { ascending: true }));
  const evs: Evento[] = [];
  for (const q of qs) {
    const base = { contact_id: q.contact_id as string, company_id: q.company_id || null, canal: 'crm' as const, fuente_tabla: 'quotes', fuente_id: String(q.id) };
    const dinero = { numero: q.numero, total: Number(q.total) || 0, plan: q.plan, sucursales: q.sucursales, via: q.created_via, partner_id: q.partner_id || null };
    if (q.created_at >= desde) evs.push({ ...base, tipo: 'cotizacion_enviada', actor: 'humano', ocurrio_at: q.created_at, payload: dinero });
    if (q.primera_vista_at && q.primera_vista_at >= desde) evs.push({ ...base, canal: 'web', tipo: 'cotizacion_vista', actor: 'lead', ocurrio_at: q.primera_vista_at, payload: { ...dinero, vista: 'primera' } });
    if (q.ultima_vista_at && q.ultima_vista_at >= desde && q.ultima_vista_at !== q.primera_vista_at) evs.push({ ...base, canal: 'web', tipo: 'cotizacion_vista', actor: 'lead', ocurrio_at: q.ultima_vista_at, payload: { ...dinero, vista: 'ultima', vistas: q.vistas } });
    if (q.aceptado_fecha && q.aceptado_fecha >= desde) evs.push({ ...base, tipo: 'cotizacion_aceptada', actor: 'lead', ocurrio_at: q.aceptado_fecha, payload: dinero });
    if (q.rechazado_fecha && q.rechazado_fecha >= desde) evs.push({ ...base, tipo: 'cotizacion_rechazada', actor: 'lead', ocurrio_at: q.rechazado_fecha, payload: dinero });
    if (q.pagado_fecha && q.pagado_fecha >= desde) evs.push({ ...base, tipo: 'cotizacion_pagada', actor: 'lead', ocurrio_at: q.pagado_fecha, payload: dinero });
  }
  return evs;
}

const ESTADO_CITA: Record<string, string> = { asistio: 'cita_asistio', no_asistio: 'cita_no_asistio', cancelada: 'cita_cancelada', reagendada: 'cita_reagendada' };
async function adCitas(desde: string): Promise<Evento[]> {
  const bs = await paginar(() => supabase.from('bookings')
    .select('id, contact_id, company_id, fecha, hora_inicio, estado, origen, utm_source, referrer_partner_id, created_at, updated_at, cancelado_por, reagendada_desde_id')
    .not('contact_id', 'is', null).or(`created_at.gte.${desde},updated_at.gte.${desde}`).order('created_at', { ascending: true }));
  const evs: Evento[] = [];
  for (const b of bs) {
    const base = { contact_id: b.contact_id as string, company_id: b.company_id || null, canal: 'crm' as const, fuente_tabla: 'bookings', fuente_id: String(b.id) };
    const p = { fecha: b.fecha, hora: b.hora_inicio, origen: b.origen, utm: b.utm_source, partner_id: b.referrer_partner_id || null };
    if (b.created_at >= desde) evs.push({ ...base, tipo: 'cita_creada', actor: b.origen === 'ia' ? 'ia' : 'lead', ocurrio_at: b.created_at, payload: { ...p, reagendada_desde: b.reagendada_desde_id || null } });
    const t = ESTADO_CITA[b.estado];
    // El cambio de estado no tiene su propio reloj: se toma updated_at (aprox).
    if (t && b.updated_at >= desde && b.updated_at !== b.created_at) {
      evs.push({ ...base, tipo: t, actor: b.estado === 'cancelada' && b.cancelado_por === 'host' ? 'humano' : 'lead', ocurrio_at: b.updated_at, payload: { ...p, aprox: true } });
    }
  }
  return evs;
}

async function adCorreo(desde: string): Promise<Evento[]> {
  const evs: Evento[] = [];
  const sends = await paginar(() => supabase.from('email_sends')
    .select('id, contact_id, estado, sent_at, created_at, first_opened_at, clicked_at, bounced_at, bounce_type, categoria, asunto, automation_id, campaign_id, variante')
    .not('contact_id', 'is', null)
    .or(`created_at.gte.${desde},first_opened_at.gte.${desde},clicked_at.gte.${desde},bounced_at.gte.${desde}`)
    .order('created_at', { ascending: true }));
  for (const s of sends) {
    const base = { contact_id: s.contact_id as string, canal: 'correo' as const, fuente_tabla: 'email_sends', fuente_id: String(s.id) };
    const p = { asunto: corto(s.asunto, 120), categoria: s.categoria, variante: s.variante, automatico: !!(s.automation_id || s.campaign_id) };
    const enviado = s.sent_at || s.created_at;
    if (enviado >= desde) evs.push({ ...base, tipo: 'correo_enviado', actor: p.automatico ? 'secuencia' : 'humano', ocurrio_at: enviado, payload: p });
    if (s.first_opened_at && s.first_opened_at >= desde) evs.push({ ...base, tipo: 'correo_abierto', actor: 'lead', ocurrio_at: s.first_opened_at, payload: p });
    if (s.clicked_at && s.clicked_at >= desde) evs.push({ ...base, tipo: 'correo_clic', actor: 'lead', ocurrio_at: s.clicked_at, payload: p });
    if (s.bounced_at && s.bounced_at >= desde) evs.push({ ...base, tipo: 'correo_rebote', actor: 'sistema', ocurrio_at: s.bounced_at, payload: { ...p, bounce_type: s.bounce_type } });
  }
  const msjs = await paginar(() => supabase.from('email_messages')
    .select('id, direccion, asunto, cuerpo_texto, created_at, email_conversations!inner(contact_id, company_id)')
    .eq('direccion', 'entrante').gte('created_at', desde).order('created_at', { ascending: true }));
  for (const m of msjs) {
    const conv: any = (m as any).email_conversations || {};
    if (!conv.contact_id) continue;
    evs.push({ contact_id: conv.contact_id, company_id: conv.company_id || null, canal: 'correo', tipo: 'correo_respondido', actor: 'lead', ocurrio_at: m.created_at, fuente_tabla: 'email_messages', fuente_id: String(m.id), payload: { asunto: corto(m.asunto, 120), texto: corto(m.cuerpo_texto) } });
  }
  return evs;
}

async function adTareas(desde: string): Promise<Evento[]> {
  const evs: Evento[] = [];
  const ts = await paginar(() => supabase.from('ti_tareas')
    .select('id, contact_id, company_id, owner_id, familia, tipo, paso, origen, estado, resultado, hecho_at, hecho_por, payload')
    .in('estado', ['hecha', 'omitida']).not('contact_id', 'is', null).gte('hecho_at', desde).order('hecho_at', { ascending: true }));
  for (const t of ts) {
    const base = { contact_id: t.contact_id as string, company_id: t.company_id || null, fuente_tabla: 'ti_tareas', fuente_id: String(t.id), ocurrio_at: t.hecho_at };
    const p: any = { familia: t.familia, tipo_tarea: t.tipo, paso: t.paso, origen: t.origen, resultado: t.resultado, owner_id: t.owner_id, tipo_llamada: (t.payload as any)?.tipo_llamada || null };
    const porValvula = t.resultado === 'valvula_automatica';
    if (t.estado === 'omitida') { evs.push({ ...base, canal: 'crm', tipo: 'tarea_omitida', actor: 'humano', payload: p }); continue; }
    if (t.tipo === 'llamada') {
      // La llamada ES el evento: su resultado decide la cadencia y enseña la mejor hora.
      evs.push({ ...base, canal: 'llamada', tipo: 'llamada', actor: 'humano', payload: { ...p, contesto: t.resultado === 'contesto' || t.resultado === 'la_firma' || t.resultado === 'pidio_cambios' || t.resultado === 'la_rechazo' } });
    } else {
      evs.push({ ...base, canal: 'crm', tipo: 'tarea_hecha', actor: porValvula ? 'valvula' : 'humano', payload: p });
    }
  }
  const om = await paginar(() => supabase.from('ti_omisiones')
    .select('id, tarea_id, motivo, texto, created_at, ti_tareas!inner(contact_id, company_id, tipo, paso)').gte('created_at', desde));
  for (const o of om) {
    const t: any = (o as any).ti_tareas || {};
    if (!t.contact_id) continue;
    evs.push({ contact_id: t.contact_id, company_id: t.company_id || null, canal: 'crm', tipo: 'omision_motivo', actor: 'humano', ocurrio_at: o.created_at, fuente_tabla: 'ti_omisiones', fuente_id: String(o.id), payload: { motivo: o.motivo, texto: corto(o.texto, 200), tipo_tarea: t.tipo, paso: t.paso } });
  }
  const fa = await paginar(() => supabase.from('ti_faltas').select('id, owner_id, tipo, contact_id, created_at, detalle').gte('created_at', desde));
  for (const f of fa) evs.push({ contact_id: f.contact_id || null, canal: 'crm', tipo: 'falta', actor: 'sistema', ocurrio_at: f.created_at, fuente_tabla: 'ti_faltas', fuente_id: String(f.id), payload: { tipo_falta: f.tipo, owner_id: f.owner_id, espera_min: (f.detalle as any)?.espera_min ?? null } });
  return evs;
}

async function adIA(desde: string): Promise<Evento[]> {
  const rows = await paginar(() => supabase.from('ia_log').select('id, accion, contact_id, tarea_id, razon, contenido, costo_usd, created_at').gte('created_at', desde));
  return rows.map(r => ({
    contact_id: r.contact_id || null, canal: 'ia' as const, actor: 'ia' as const, ocurrio_at: r.created_at,
    tipo: r.accion?.startsWith('cubrir') ? 'ia_mensaje' : r.accion === 'no_pudo' ? 'ia_no_pudo' : r.accion === 'error' ? 'ia_error' : `ia_${r.accion}`,
    fuente_tabla: 'ia_log', fuente_id: String(r.id),
    payload: { accion: r.accion, razon: corto(r.razon, 160), texto: corto(r.contenido, 200), costo_usd: r.costo_usd, tarea_id: r.tarea_id },
  }));
}

async function adContactos(desde: string): Promise<Evento[]> {
  const evs: Evento[] = [];
  const cs = await paginar(() => supabase.from('contacts')
    .select('id, company_id, created_at, fuente, fuente_detalle, utm_source, utm_campaign, referrer_partner_id, giro, sucursales_interes, campana, origen_alta')
    .eq('lifecycle_stage', 'lead').is('archived_at', null).gte('created_at', desde));
  for (const c of cs) evs.push({ contact_id: c.id, company_id: c.company_id || null, canal: 'crm', tipo: 'lead_entro', actor: 'sistema', ocurrio_at: c.created_at, fuente_tabla: 'contacts', fuente_id: String(c.id), payload: { fuente: c.fuente, detalle: c.fuente_detalle, utm_source: c.utm_source, campana: c.utm_campaign || c.campana, partner_id: c.referrer_partner_id || null, giro: c.giro, sucursales: c.sucursales_interes, origen_alta: c.origen_alta } });
  const ss = await paginar(() => supabase.from('subscriptions').select('id, contact_id, company_id, nombre_plan, mrr, sucursales, partner_id, created_at, fecha_inicio')
    .not('contact_id', 'is', null).gte('created_at', desde));
  for (const s of ss) evs.push({ contact_id: s.contact_id, company_id: s.company_id || null, canal: 'crm', tipo: 'suscripcion_activa', actor: 'sistema', ocurrio_at: s.created_at, fuente_tabla: 'subscriptions', fuente_id: String(s.id), payload: { plan: s.nombre_plan, mrr: Number(s.mrr) || 0, sucursales: s.sucursales, partner_id: s.partner_id || null, inicio: s.fecha_inicio } });
  return evs;
}

const ADAPTADORES: Record<string, (desde: string) => Promise<Evento[]>> = {
  whatsapp: adWhatsapp, cotizaciones: adCotizaciones, citas: adCitas, correo: adCorreo, tareas: adTareas, ia: adIA, contactos: adContactos,
};

/** Corre los adaptadores. Sin `desde` usa la marca de cada fuente (menos el
 *  solape; tope 6 h hacia atrás para que una marca vieja no dispare un
 *  barrido gigante en el tick de 2 min). Devuelve conteos y los contactos
 *  tocados. */
export async function sincronizarEventos(opts: { desde?: string; fuentes?: string[] } = {}) {
  const ahora = new Date();
  const m = await marcas();
  const res: any = { nuevos: 0, por_fuente: {} as Record<string, number>, errores: {} as Record<string, string> };
  const tocados = new Set<string>();
  const nombres = opts.fuentes?.length ? opts.fuentes : Object.keys(ADAPTADORES);
  for (const nombre of nombres) {
    const ad = ADAPTADORES[nombre];
    if (!ad) continue;
    const desde = opts.desde || new Date(Math.max(
      (Date.parse(m[nombre] || '') || 0) - SOLAPE_MIN * MS_MIN,
      ahora.getTime() - 6 * 3600e3,
    )).toISOString();
    try {
      const evs = await ad(desde);
      const n = await registrar(evs);
      for (const e of evs) if (e.contact_id) tocados.add(e.contact_id);
      res.por_fuente[nombre] = n; res.nuevos += n;
      m[nombre] = ahora.toISOString();
    } catch (e: any) { res.errores[nombre] = String(e?.message || e); }
  }
  await guardarMarcas(m);
  res.tocados = [...tocados];
  return res;
}

/** Atajo para el backfill: N días hacia atrás. */
export const desdeDias = (dias: number) => new Date(Date.now() - Math.max(1, dias) * MS_D).toISOString();
