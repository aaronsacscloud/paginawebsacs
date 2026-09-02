// TRABAJO INTELIGENTE · EL AGENTE SDR DE WHATSAPP (en vivo, nivel N2).
//
// Decisión del dueño (2026-09-02): la IA lleva todo lo previo a la reunión y
// responde a cada WhatsApp entrante de un lead DESDE EL MINUTO CERO — no
// espera a que venza un SLA. Arranca en «auto con veto»: cada respuesta nace
// en ti_envios con su hora de salida (ahora + ventana), el humano la ve en
// «Próximos envíos» y la puede editar, detener o mandar ya; si nadie la toca,
// sale sola. Todo queda en ia_log.
//
// Candados: agente_activo en ti_config (kill-switch) · silenciar_ia por lead
// (ti_perfil) · nunca a contactos demo · nunca a clientes activos (se les
// redirige a soporte) · un solo envío pendiente por lead (uno nuevo reemplaza
// al anterior) · si un humano ya contestó después del lead, el agente calla.
import { supabase } from '../../supabase';
import { anthropic, MODELS, calculateCost, hasApiKey } from '../../ai/client';
import { WIKI_COMERCIAL, LIMITES_COPILOTO } from './wiki-comercial';
import { GUION_AGENTE, SALIDA_AGENTE } from './agente-guion';
import { contextoParaLead } from './conocimiento/index.ts';
import { leerConfig } from './motor';

const MS_MIN = 60e3;

export type SalidaAgente = {
  estado: string; objetivo: string; mensaje: string; responder: boolean;
  datos?: { campo: string; valor: string; confianza: number; evidencia?: string }[];
  escalar?: { si: boolean; motivo?: string };
  interes?: { nivel: 'alto' | 'medio' | 'bajo'; razon?: string };
  siguiente_toque?: { en_horas: number | null; angulo?: string };
  ultimo_mensaje?: string;
};

async function log(o: { accion: string; contact_id?: string | null; razon?: string; contenido?: string | null; costo?: number; detalle?: any }) {
  await supabase.from('ia_log').insert({ accion: o.accion, contact_id: o.contact_id || null, razon: o.razon || null, contenido: o.contenido || null, modelo: MODELS.opus, costo_usd: o.costo ?? null, detalle: o.detalle || null });
}

/** La conversación del contacto, en orden, con audios transcritos si los hay. */
async function charla(contactId: string, limite = 30) {
  const { data: convs } = await supabase.from('wa_conversaciones').select('id, telefono').eq('contact_id', contactId).order('ultimo_mensaje_at', { ascending: false }).limit(3);
  let msjs: any[] = [];
  for (const cv of convs || []) {
    const { data } = await supabase.from('wa_mensajes').select('direccion, cuerpo, tipo, transcript, autor, created_at')
      .eq('conversation_id', cv.id).is('borrado_at', null).order('created_at', { ascending: false }).limit(limite);
    msjs = msjs.concat((data || []).map(m => ({ ...m, conversation_id: cv.id, telefono: cv.telefono })));
  }
  msjs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return { msjs: msjs.slice(-limite), conversationId: convs?.[0]?.id || null, telefono: convs?.[0]?.telefono || null };
}

async function ejemplosAprobados(estado?: string) {
  let q = supabase.from('ia_ejemplos').select('estado, situacion, pulida, fuente').eq('estado_rev', 'aprobado').order('created_at', { ascending: false }).limit(60);
  const { data } = await q;
  if (!(data || []).length) return '';
  // Las correcciones del dueño primero (máxima prioridad), luego el resto del estado actual, luego lo demás.
  const orden = (e: any) => (e.fuente === 'correccion_dueno' ? 0 : 1) + (estado && e.estado === estado ? 0 : 2);
  const lista = (data || []).sort((a, b) => orden(a) - orden(b)).slice(0, 24);
  return '\n\nEJEMPLOS APROBADOS POR EL DUEÑO (así se contesta; imita el criterio, no el texto):\n'
    + lista.map(e => `[${e.estado}] Lead: ${e.situacion}\nNosotros: ${e.pulida}`).join('\n---\n');
}

/** Un turno del agente para un contacto: lee, decide, no envía. */
export async function decidirTurno(contactId: string): Promise<{ salida: SalidaAgente | null; costo: number; conversationId: string | null; telefono: string | null; motivo?: string }> {
  if (!hasApiKey()) return { salida: null, costo: 0, conversationId: null, telefono: null, motivo: 'sin_api_key' };
  const [{ msjs, conversationId, telefono }, { data: c }, { data: perfil }] = await Promise.all([
    charla(contactId),
    supabase.from('contacts').select('id, nombre, giro, sucursales_interes, lifecycle_stage, fuente, propiedades, whatsapp').eq('id', contactId).maybeSingle(),
    supabase.from('ti_perfil').select('etapa_interes, canales, mejor_hora_wa, ultima_respuesta_at, senales, silenciar_ia').eq('contact_id', contactId).maybeSingle(),
  ]);
  if (!c || !msjs.length) return { salida: null, costo: 0, conversationId, telefono, motivo: 'sin_conversacion' };
  const texto = msjs.map(m => `${m.direccion === 'entrante' ? 'LEAD' : 'NOSOTROS'} (${String(m.created_at).slice(0, 16).replace('T', ' ')}): ${m.tipo === 'audio' ? (m.transcript ? '[audio] ' + m.transcript : '[audio sin transcripción]') : String(m.cuerpo || `[${m.tipo}]`).slice(0, 500)}`).join('\n');
  const ultimo = [...msjs].reverse().find(m => m.direccion === 'entrante');
  const ctx = contextoParaLead({ giroCrm: c.giro || null, conversacion: texto, ultimoMensaje: ultimo?.cuerpo || ultimo?.transcript || '' });
  const crm = `LO QUE EL CRM SABE: nombre «${c.nombre || '?'}», etapa ${c.lifecycle_stage}, giro ${c.giro || 'desconocido'}, tiendas ${c.sucursales_interes ?? 'desconocido'}, fuente ${c.fuente || 'desconocida'}`
    + (perfil ? `; interés estimado ${perfil.etapa_interes || '?'}; última respuesta ${perfil.ultima_respuesta_at ? String(perfil.ultima_respuesta_at).slice(0, 10) : 'n/a'}.` : '.');
  const r = await anthropic.messages.create({
    model: MODELS.opus, max_tokens: 1800,
    system: `${GUION_AGENTE}\n\nLO QUE SABES (general):\n${WIKI_COMERCIAL}\n\nLO QUE SABES DE ESTE LEAD Y SU GIRO:\n${ctx.texto}\n\nLÍMITES:\n${LIMITES_COPILOTO}${await ejemplosAprobados()}`,
    messages: [{ role: 'user', content: `${crm}\n\nCONVERSACIÓN (lo más reciente al final; el último mensaje es del lead y te toca decidir):\n\n${texto}\n\n${SALIDA_AGENTE}` }],
  });
  const t = (r.content.find(b => b.type === 'text') as any)?.text || '{}';
  const costo = calculateCost(MODELS.opus, r.usage as any).cost_usd;
  let salida: any = null;
  try { salida = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { salida = null; }
  if (salida) salida.ultimo_mensaje = String(ultimo?.cuerpo || ultimo?.transcript || '').slice(0, 300);
  return { salida, costo: Number(costo) || 0, conversationId, telefono: telefono || c.whatsapp || null, motivo: salida ? undefined : 'json_invalido' };
}

/** Guarda lo que el lead soltó (datos con confianza) en su perfil, sin tocar campos del CRM a ciegas. */
async function registrarDatos(contactId: string, datos: SalidaAgente['datos'], interes?: SalidaAgente['interes']) {
  if (!datos?.length && !interes) return;
  const { data: p } = await supabase.from('ti_perfil').select('intenciones').eq('contact_id', contactId).maybeSingle();
  const prev: any[] = Array.isArray(p?.intenciones) ? p!.intenciones : [];
  const nuevos = (datos || []).filter(d => d && d.campo && d.valor).map(d => ({ ...d, cuando: new Date().toISOString(), fuente: 'agente' }));
  const fila: any = { contact_id: contactId, intenciones: [...prev, ...nuevos].slice(-60), updated_at: new Date().toISOString() };
  if (interes?.nivel) fila.score_probabilidad = interes.nivel === 'alto' ? 0.85 : interes.nivel === 'medio' ? 0.5 : 0.2;
  await supabase.from('ti_perfil').upsert(fila, { onConflict: 'contact_id' });
  // giro y tiendas: solo si el CRM no los tiene y la confianza es alta.
  const giro = nuevos.find(d => d.campo === 'giro' && d.confianza >= 0.8);
  const suc = nuevos.find(d => d.campo === 'sucursales' && d.confianza >= 0.8 && /^\d+$/.test(String(d.valor).trim()));
  if (giro) await supabase.from('contacts').update({ giro: String(giro.valor).slice(0, 60) }).eq('id', contactId).is('giro', null);
  if (suc) await supabase.from('contacts').update({ sucursales_interes: Number(suc.valor) }).eq('id', contactId).is('sucursales_interes', null);
}

/**
 * PROPONER: por cada lead que escribió desde la última corrida y sigue sin
 * respuesta humana, el agente decide y deja su respuesta en ti_envios
 * (pendiente, con ventana de veto). Corre con el observador.
 */
export async function proponerRespuestas(): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.agente_activo !== true) return { agente: 'apagado' };
  if (!hasApiKey()) return { agente: 'sin_api_key' };
  const ahora = new Date();
  const desde = new Date(Math.max(Date.parse(cfg.agente_marca || 0) || 0, ahora.getTime() - 6 * 3600e3)).toISOString();
  const res: any = { propuestos: 0, callo: 0, escalados: 0, saltados: 0, errores: 0 };

  const { data: evs } = await supabase.from('ti_eventos').select('contact_id, ocurrio_at')
    .eq('tipo', 'wa_entrante').gt('ocurrio_at', desde).not('contact_id', 'is', null).order('ocurrio_at', { ascending: true }).limit(100);
  const ultimoPor: Record<string, string> = {};
  for (const e of evs || []) ultimoPor[e.contact_id] = e.ocurrio_at;
  const ids = Object.keys(ultimoPor);
  if (!ids.length) { await guardarMarca(ahora); return res; }

  const [{ data: cs }, { data: perf }, { data: pend }] = await Promise.all([
    supabase.from('contacts').select('id, lifecycle_stage, propiedades, archived_at').in('id', ids),
    supabase.from('ti_perfil').select('contact_id, silenciar_ia, do_not_contact_hasta').in('contact_id', ids),
    supabase.from('ti_envios').select('id, contact_id, created_at').in('contact_id', ids).eq('estado', 'pendiente'),
  ]);
  const porC: Record<string, any> = {}; for (const c of cs || []) porC[c.id] = c;
  const porP: Record<string, any> = {}; for (const p of perf || []) porP[p.contact_id] = p;

  for (const cid of ids) {
    const c = porC[cid]; const p = porP[cid];
    if (!c || c.archived_at || (c.propiedades as any)?.demo_ti) { res.saltados++; continue; }
    if (!['lead', 'oportunidad'].includes(c.lifecycle_stage)) { res.saltados++; continue; }   // clientes: no es asunto del SDR
    if (p?.silenciar_ia || (p?.do_not_contact_hasta && Date.parse(p.do_not_contact_hasta) > ahora.getTime())) { res.saltados++; continue; }
    // ¿Un humano ya contestó después del último mensaje del lead? Entonces el agente calla.
    const { data: sal } = await supabase.from('ti_eventos').select('ocurrio_at, actor').eq('contact_id', cid)
      .in('tipo', ['wa_saliente']).gt('ocurrio_at', ultimoPor[cid]).limit(1);
    if ((sal || []).length) { res.saltados++; continue; }
    // Un solo pendiente por lead: el nuevo mensaje del lead reemplaza la propuesta anterior.
    const previos = (pend || []).filter(x => x.contact_id === cid);
    try {
      const d = await decidirTurno(cid);
      if (!d.salida) { res.errores++; await log({ accion: 'agente_error', contact_id: cid, razon: d.motivo || 'sin salida' }); continue; }
      const s = d.salida;
      await registrarDatos(cid, s.datos, s.interes);
      if (previos.length) await supabase.from('ti_envios').update({ estado: 'reemplazado', updated_at: ahora.toISOString() }).in('id', previos.map(x => x.id));
      if (s.escalar?.si) {
        res.escalados++;
        await escalarAlHumano(cid, s);
      }
      if (!s.responder || !s.mensaje || s.mensaje.trim().length < 2) {
        res.callo++;
        await log({ accion: 'agente_calla', contact_id: cid, razon: s.escalar?.si ? `escalado: ${s.escalar.motivo}` : s.objetivo, costo: d.costo, detalle: { estado: s.estado, interes: s.interes } });
        continue;
      }
      if (!d.telefono) { res.errores++; await log({ accion: 'agente_error', contact_id: cid, razon: 'sin teléfono' }); continue; }
      const ventana = Math.max(0, Number(cfg.agente_veto_min ?? 10));
      await supabase.from('ti_envios').insert({
        contact_id: cid, conversation_id: d.conversationId, telefono: d.telefono, origen: 'respuesta', estado: 'pendiente',
        mensaje: s.mensaje.trim(), salida: s, sale_at: new Date(ahora.getTime() + ventana * MS_MIN).toISOString(), modelo: MODELS.opus, costo_usd: d.costo,
      });
      await log({ accion: 'agente_propone', contact_id: cid, contenido: s.mensaje, costo: d.costo, razon: s.objetivo, detalle: { estado: s.estado, interes: s.interes, ventana_min: ventana } });
      res.propuestos++;
    } catch (e: any) { res.errores++; await log({ accion: 'agente_error', contact_id: cid, razon: String(e?.message || e) }); }
  }
  await guardarMarca(ahora);
  return res;
}

async function guardarMarca(ahora: Date) {
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  await supabase.from('ti_config').update({ valor: { ...((data?.valor as any) || {}), agente_marca: ahora.toISOString() } }).eq('id', 1);
}

/** El caso que el agente no debe resolver: P1 al humano con el motivo. */
async function escalarAlHumano(contactId: string, s: SalidaAgente) {
  const { data: c } = await supabase.from('contacts').select('nombre, whatsapp, owner_id, company_id').eq('id', contactId).maybeSingle();
  const nombre = String(c?.nombre || 'El lead').trim().split(/\s+/)[0];
  const { data: previa } = await supabase.from('ti_tareas').select('id').eq('contact_id', contactId).eq('estado', 'pendiente').in('tipo', ['responder', 'estafeta']).maybeSingle();
  const payload = {
    instruccion: `${nombre} necesita a un humano — ${String(s.escalar?.motivo || '').slice(0, 80)}`,
    porque: `El agente leyó la conversación y decidió no resolverlo solo: ${s.escalar?.motivo || 'fuera de sus límites'}.`,
    nombre: c?.nombre, whatsapp: c?.whatsapp, entrante: s.ultimo_mensaje, escalado_por_agente: true,
    hechos: [['Lo escaló el agente', 'ahora', String(s.escalar?.motivo || '').slice(0, 46), 'ambar'], ['Su último mensaje', '', String(s.ultimo_mensaje || '').slice(0, 46), 'verde']],
  };
  if (previa) await supabase.from('ti_tareas').update({ prioridad: 1, vence_at: new Date().toISOString(), payload, updated_at: new Date().toISOString() }).eq('id', previa.id);
  else await supabase.from('ti_tareas').insert({ contact_id: contactId, company_id: c?.company_id || null, owner_id: c?.owner_id || null, familia: 'responder', tipo: 'responder', prioridad: 1, vence_at: new Date().toISOString(), origen: 'evento', payload });
}

/**
 * DESPACHAR: manda lo pendiente cuya ventana de veto ya venció. Corre con el
 * observador (cada 2 min) y con «enviar ya». Escribe el espejo en el inbox
 * para que el hilo lo muestre como cualquier mensaje nuestro.
 */
export async function despacharEnvios(opts: { forzar?: boolean; soloId?: string } = {}): Promise<any> {
  const cfg: any = await leerConfig();
  const res: any = { enviados: 0, fallidos: 0 };
  if (cfg.agente_activo !== true && !opts.forzar) return { agente: 'apagado' };
  const ahora = new Date();
  let q = supabase.from('ti_envios').select('*').eq('estado', 'pendiente').lte('sale_at', ahora.toISOString()).order('sale_at', { ascending: true }).limit(20);
  if (opts.soloId) q = q.eq('id', opts.soloId);
  const { data: pend } = await q;
  if (!(pend || []).length) return res;
  const { enviarTexto } = await import('../../whatsapp/kapso-api');
  const { registrarMensaje } = await import('../../whatsapp/espejo');
  for (const e of pend || []) {
    // Si el lead volvió a escribir después de que se propuso, esta respuesta ya no aplica.
    const { data: nuevo } = await supabase.from('ti_eventos').select('id').eq('contact_id', e.contact_id).eq('tipo', 'wa_entrante').gt('ocurrio_at', e.created_at).limit(1);
    if ((nuevo || []).length && !opts.soloId) { await supabase.from('ti_envios').update({ estado: 'reemplazado', updated_at: ahora.toISOString() }).eq('id', e.id); continue; }
    try {
      const r: any = await enviarTexto(e.telefono, e.mensaje);
      const wamid = r?.messages?.[0]?.id || null;
      if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: e.telefono, direccion: 'saliente', tipo: 'text', cuerpo: e.mensaje, status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, estado_agente: (e.salida as any)?.estado || null } });
      await supabase.from('ti_envios').update({ estado: 'enviado', enviado_at: ahora.toISOString(), kapso_message_id: wamid, updated_at: ahora.toISOString() }).eq('id', e.id);
      await log({ accion: 'agente_envio', contact_id: e.contact_id, contenido: e.mensaje, razon: (e.salida as any)?.objetivo, detalle: { envio_id: e.id, editado: !!e.editado_por, wamid } });
      await supabase.from('contacts').update({ last_contact_at: ahora.toISOString() }).eq('id', e.contact_id);
      res.enviados++;
    } catch (err: any) {
      await supabase.from('ti_envios').update({ estado: 'fallido', error: String(err?.message || err).slice(0, 300), updated_at: ahora.toISOString() }).eq('id', e.id);
      await log({ accion: 'agente_error', contact_id: e.contact_id, razon: `envío: ${err?.message || err}`, contenido: e.mensaje });
      res.fallidos++;
    }
  }
  return res;
}
