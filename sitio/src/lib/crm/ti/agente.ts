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
import { horariosParaDemo, horariosTexto, agendarDemo, proximaCita, citaTexto } from './agenda-agente';

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
export async function decidirTurno(contactId: string, nota?: string): Promise<{ salida: SalidaAgente | null; costo: number; conversationId: string | null; telefono: string | null; motivo?: string }> {
  if (!hasApiKey()) return { salida: null, costo: 0, conversationId: null, telefono: null, motivo: 'sin_api_key' };
  const [{ msjs, conversationId, telefono }, { data: c }, { data: perfil }] = await Promise.all([
    charla(contactId),
    supabase.from('contacts').select('id, nombre, giro, sucursales_interes, lifecycle_stage, fuente, propiedades, whatsapp, email, company_id').eq('id', contactId).maybeSingle(),
    supabase.from('ti_perfil').select('etapa_interes, canales, mejor_hora_wa, ultima_respuesta_at, senales, silenciar_ia').eq('contact_id', contactId).maybeSingle(),
  ]);
  if (!c || !msjs.length) return { salida: null, costo: 0, conversationId, telefono, motivo: 'sin_conversacion' };
  const texto = msjs.map(m => `${m.direccion === 'entrante' ? 'LEAD' : 'NOSOTROS'} (${String(m.created_at).slice(0, 16).replace('T', ' ')}): ${m.tipo === 'audio' ? (m.transcript ? '[audio] ' + m.transcript : '[audio sin transcripción]') : String(m.cuerpo || `[${m.tipo}]`).slice(0, 500)}`).join('\n');
  const ultimo = [...msjs].reverse().find(m => m.direccion === 'entrante');
  const memoria = memoriaConversacion(msjs, c.nombre);
  const [horarios, cita, pagina] = await Promise.all([
    horariosParaDemo({ mejorHora: perfil?.mejor_hora_wa ?? null }).catch(() => []),
    proximaCita(contactId).catch(() => null),
    leerPaginaDelLead(contactId, msjs).catch(() => ''),
  ]);
  const agenda = `${citaTexto(cita)}\n${horariosTexto(horarios)}\nCORREO EN EL CRM: ${c.email || 'ninguno (pídelo antes de agendar)'}`.trim();
  const ctx = contextoParaLead({ giroCrm: c.giro || null, conversacion: texto, ultimoMensaje: ultimo?.cuerpo || ultimo?.transcript || '' });
  const crm = `LO QUE EL CRM SABE: nombre «${c.nombre || '?'}», etapa ${c.lifecycle_stage}, giro ${c.giro || 'desconocido'}, tiendas ${c.sucursales_interes ?? 'desconocido'}, fuente ${c.fuente || 'desconocida'}`
    + (perfil ? `; interés estimado ${perfil.etapa_interes || '?'}; última respuesta ${perfil.ultima_respuesta_at ? String(perfil.ultima_respuesta_at).slice(0, 10) : 'n/a'}.` : '.');
  const r = await anthropic.messages.create({
    model: MODELS.opus, max_tokens: 1800,
    system: `${GUION_AGENTE}\n\nLO QUE SABES (general):\n${WIKI_COMERCIAL}\n\nLO QUE SABES DE ESTE LEAD Y SU GIRO:\n${ctx.texto}\n\nLÍMITES:\n${LIMITES_COPILOTO}${await ejemplosAprobados()}`,
    messages: [{ role: 'user', content: `${crm}\n\n${memoria}\n\nAGENDA:\n${agenda}${pagina ? `\n\n${pagina}` : ''}${nota ? `\n\n${nota}` : ''}\n\nCONVERSACIÓN (lo más reciente al final${nota ? '' : '; el último mensaje es del lead y te toca decidir'}):\n\n${texto}\n\n${SALIDA_AGENTE}` }],
  });
  const t = (r.content.find(b => b.type === 'text') as any)?.text || '{}';
  const costo = calculateCost(MODELS.opus, r.usage as any).cost_usd;
  let salida: any = null;
  try { salida = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { salida = null; }
  if (salida) {
    salida.ultimo_mensaje = String(ultimo?.cuerpo || ultimo?.transcript || '').slice(0, 300);
    // La acción de agendar solo vale si el horario existe de verdad en la lista ofrecida.
    if (salida.accion?.tipo === 'agendar') {
      const ok = horarios.some(h => h.fecha === salida.accion.fecha && h.hora === String(salida.accion.hora || '').slice(0, 5));
      if (!ok) { salida.accion = { tipo: 'ninguna', rechazada: 'horario fuera de la lista real' }; }
      else salida.accion.email = salida.accion.email || c.email || null;
    }
  }
  return { salida, costo: Number(costo) || 0, conversationId, telefono: telefono || c.whatsapp || null, motivo: salida ? undefined : 'json_invalido' };
}

/** Si el lead mandó su página o sus redes, el agente la LEE (una vez, se
 *  guarda en el perfil) y le habla de su negocio, no de «tu tienda». */
async function leerPaginaDelLead(contactId: string, msjs: any[]): Promise<string> {
  const urls = msjs.filter(m => m.direccion === 'entrante').flatMap(m => String(m.cuerpo || '').match(/https?:\/\/[^\s)]+|(?:www\.)?[a-z0-9-]+\.(?:com|mx|com\.mx|shop|store|net)(?:\/[^\s)]*)?/gi) || [])
    .map(u => u.startsWith('http') ? u : 'https://' + u).filter(u => !/sacscloud|wa\.me|whatsapp|instagram\.com\/p\/|meet\.google/i.test(u));
  if (!urls.length) return '';
  const url = urls[urls.length - 1];
  const { data: p } = await supabase.from('ti_perfil').select('investigacion').eq('contact_id', contactId).maybeSingle();
  const prev: any = p?.investigacion || null;
  if (prev?.url === url && prev?.resumen) return `LO QUE DICE SU PÁGINA (${url}): ${prev.resumen}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SacsBot/1.0)' } });
    const html = await r.text();
    const title = (html.match(/<title[^>]*>([^<]{3,120})<\/title>/i) || [])[1] || '';
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,300})["']/i) || [])[1] || '';
    const cuerpo = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500);
    const resumen = [title && `Título: ${title}`, desc && `Descripción: ${desc}`, `Texto: ${cuerpo.slice(0, 700)}`].filter(Boolean).join(' · ');
    await supabase.from('ti_perfil').upsert({ contact_id: contactId, investigacion: { url, resumen, at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: 'contact_id' });
    return `LO QUE DICE SU PÁGINA (${url}) — úsalo para hablar de SU negocio con sus palabras: ${resumen}`;
  } catch { return ''; }
}

/** Lo que un humano recordaría antes de escribir: si ya se presentó, si ya saludó
 *  hoy, cuántas veces usó el nombre, hace cuánto habló cada quien. Determinista,
 *  para que el modelo no lo adivine. */
function memoriaConversacion(msjs: any[], nombre: string | null): string {
  const ahora = Date.now();
  const nuestros = msjs.filter(m => m.direccion === 'saliente');
  const suyos = msjs.filter(m => m.direccion === 'entrante');
  const horas = (iso?: string) => iso ? Math.round((ahora - Date.parse(iso)) / 36e5) : null;
  const ultNos = horas(nuestros.at(-1)?.created_at), ultEl = horas(suyos.at(-1)?.created_at);
  const textoNos = nuestros.map(m => String(m.cuerpo || '')).join(' \n ');
  const presentado = /equipo de sacs|soy .{0,30}de sacs|asesor(a)? de sacs/i.test(textoNos);
  const primer = String(nombre || '').trim().split(/\s+/)[0];
  const recientes = nuestros.slice(-4);
  const nombreVeces = primer ? recientes.filter(m => new RegExp(`\\b${primer}\\b`, 'i').test(String(m.cuerpo || ''))).length : 0;
  const saludoHoy = recientes.some(m => /^\s*(¡?hola|buen[oa]s? (d[ií]as|tardes|noches)|qué tal|buen d[ií]a)/i.test(String(m.cuerpo || '')) && (horas(m.created_at) ?? 99) < 14);
  const audioPedido = recientes.filter(m => /audio/i.test(String(m.cuerpo || ''))).length;
  const preguntasNuestras = nuestros.slice(-6).map(m => String(m.cuerpo || '')).filter(t => t.includes('?')).slice(-3).map(t => '«' + t.slice(0, 90).replace(/\n/g, ' ') + '»');
  return `MEMORIA DE ESTA CONVERSACIÓN (úsala, no la adivines):
- ${presentado ? 'Ya nos presentamos: NO vuelvas a decir «soy del equipo de Sacs».' : 'Todavía no nos presentamos: hazlo una sola vez, corto.'}
- ${saludoHoy ? 'Ya saludamos hoy: NO empieces con «Hola» ni «Qué tal»; continúa la plática.' : 'No hemos saludado hoy: puedes abrir con un saludo breve.'}
- Su nombre (${primer || '—'}) va ${nombreVeces} veces en nuestros últimos ${recientes.length} mensajes${nombreVeces >= 1 ? ': NO lo uses en este' : ''}.
- ${audioPedido ? `Ya le pedimos audio ${audioPedido} vez/veces: no lo repitas.` : 'Aún no le hemos ofrecido contarlo por audio.'}
- Nuestro último mensaje fue hace ${ultNos ?? '—'} h; el suyo hace ${ultEl ?? '—'} h.${preguntasNuestras.length ? `\n- Preguntas que ya hicimos (no las repitas): ${preguntasNuestras.join(' ')}` : ''}`;
}

/** ICP + calidad de la conversación: decide cuánto insistir. Determinista. */
export async function evaluarLead(contactId: string): Promise<{ icp: 'alto' | 'medio' | 'bajo'; conversacion: number; razones: string[] }> {
  const [{ data: c }, { data: p }, { data: evs }] = await Promise.all([
    supabase.from('contacts').select('giro, sucursales_interes, fuente, referrer_partner_id, propiedades').eq('id', contactId).maybeSingle(),
    supabase.from('ti_perfil').select('score_valor, score_probabilidad, etapa_interes, canales, intenciones').eq('contact_id', contactId).maybeSingle(),
    supabase.from('ti_eventos').select('tipo, payload').eq('contact_id', contactId).in('tipo', ['wa_entrante', 'cotizacion_vista', 'cita_creada']).limit(200),
  ]);
  const razones: string[] = [];
  const { detectarGiro } = await import('./conocimiento/giros.ts');
  const intenciones: any[] = Array.isArray(p?.intenciones) ? p!.intenciones : [];
  const giroTxt = [c?.giro, ...intenciones.filter(i => i.campo === 'giro').map(i => i.valor)].filter(Boolean).join(' ');
  const giro = detectarGiro(giroTxt);
  const tiendas = Number(c?.sucursales_interes) || Number(intenciones.find(i => i.campo === 'sucursales')?.valor) || 0;
  let icpPts = 0;
  if (giro) { icpPts += 2; razones.push(`giro de moda: ${giro.nombre}`); } else if (giroTxt) { icpPts -= 2; razones.push(`giro fuera de moda: ${giroTxt.slice(0, 30)}`); } else razones.push('giro desconocido');
  if (tiendas >= 3) { icpPts += 2; razones.push(`${tiendas} tiendas`); } else if (tiendas >= 1) { icpPts += 1; razones.push(`${tiendas} tienda(s)`); }
  if (c?.referrer_partner_id) { icpPts += 1; razones.push('viene de partner'); }
  const respuestas = (evs || []).filter(e => e.tipo === 'wa_entrante').length;
  const largas = (evs || []).filter(e => e.tipo === 'wa_entrante' && String((e.payload as any)?.texto || '').length > 40).length;
  const senal = (evs || []).some(e => e.tipo === 'cotizacion_vista' || e.tipo === 'cita_creada');
  let conv = Math.min(100, respuestas * 12 + largas * 10 + (intenciones.length ? 15 : 0) + (senal ? 25 : 0) + (p?.etapa_interes === 'decidiendo' ? 20 : p?.etapa_interes === 'evaluando' ? 10 : 0));
  razones.push(`${respuestas} respuestas, ${largas} con contenido${senal ? ', con señal (cotización/cita)' : ''}`);
  const icp: 'alto' | 'medio' | 'bajo' = icpPts >= 3 ? 'alto' : icpPts >= 1 ? 'medio' : 'bajo';
  return { icp, conversacion: conv, razones };
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
    supabase.from('ti_perfil').select('contact_id, silenciar_ia, do_not_contact_hasta, agente_estado').in('contact_id', ids),
    supabase.from('ti_envios').select('id, contact_id, created_at').in('contact_id', ids).eq('estado', 'pendiente'),
  ]);
  const porC: Record<string, any> = {}; for (const c of cs || []) porC[c.id] = c;
  const porP: Record<string, any> = {}; for (const p of perf || []) porP[p.contact_id] = p;

  for (const cid of ids) {
    const c = porC[cid]; const p = porP[cid];
    if (!c || c.archived_at || (c.propiedades as any)?.demo_ti) { res.saltados++; continue; }
    if (!['lead', 'oportunidad'].includes(c.lifecycle_stage)) { res.saltados++; continue; }   // clientes: no es asunto del SDR
    if (p?.silenciar_ia || (p?.do_not_contact_hasta && Date.parse(p.do_not_contact_hasta) > ahora.getTime())) { res.saltados++; continue; }
    // Un lead que escribe reinicia su reloj de silencio; si venía de nutrición, se reactiva.
    await supabase.from('ti_perfil').upsert({ contact_id: cid, agente_estado: { ciclo: 1, toque: 0, reactivado_at: (p?.agente_estado as any)?.cerrado ? ahora.toISOString() : undefined }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
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
      // LEAD CALIENTE: interés alto en una conversación madura → el consultor se entera ahora, no en el digest.
      if (s.interes?.nivel === 'alto' && ['proponiendo', 'agendada'].includes(s.estado)) await avisarLeadCaliente(cid, s);
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

/** Lead caliente: aviso urgente al consultor (una vez por día por lead). */
async function avisarLeadCaliente(contactId: string, s: SalidaAgente) {
  const { data: ya } = await supabase.from('ia_log').select('id').eq('contact_id', contactId).eq('accion', 'lead_caliente').gt('created_at', new Date(Date.now() - 86400e3).toISOString()).limit(1);
  if ((ya || []).length) return;
  const { data: c } = await supabase.from('contacts').select('nombre, company_id').eq('id', contactId).maybeSingle();
  const { notificar } = await import('../notificaciones');
  await notificar({ clave: `lead_caliente:${contactId}:${new Date().toISOString().slice(0, 10)}`, tipo: 'lead_caliente', nivel: 'urgente', titulo: `${String(c?.nombre || 'Un lead').split(/\s+/)[0]} está caliente: ${s.interes?.razon || 'interés alto'}`, detalle: `Estado ${s.estado}. Último mensaje: «${s.ultimo_mensaje || ''}». El agente ya le contestó; si puedes, llámale hoy.`, company_id: c?.company_id || null, destino: 'trabajo', metadata: { contact_id: contactId, estado: s.estado } });
  await log({ accion: 'lead_caliente', contact_id: contactId, razon: s.interes?.razon || 'interés alto' });
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
  // MODO SOMBRA (default): el agente decide y deja rastro, pero NO manda. Se
  // pasa a vivo con scripts/ti-agente.mjs --modo vivo.
  const { permitido } = await import('../../whatsapp/permisos');
  const vivoPermitido = await permitido('agente_sdr');
  if (((cfg.agente_modo || 'sombra') === 'sombra' || !vivoPermitido) && !opts.forzar) {
    const { data: som } = await supabase.from('ti_envios').update({ estado: 'sombra', updated_at: ahora.toISOString() })
      .eq('estado', 'pendiente').lte('sale_at', ahora.toISOString()).select('id');
    return { agente: 'sombra', sombra: (som || []).length };
  }
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
      // La ACCIÓN viaja con el mensaje y se ejecuta al salir (así el veto también la detiene).
      let mensaje = e.mensaje;
      const acc: any = (e.salida as any)?.accion;
      if (acc?.tipo === 'agendar' && acc.fecha && acc.hora) {
        const { data: c } = await supabase.from('contacts').select('nombre, email, giro, sucursales_interes, referrer_partner_id, companies(nombre)').eq('id', e.contact_id).maybeSingle();
        const email = acc.email || c?.email;
        if (!email) { mensaje = mensaje; await log({ accion: 'agente_error', contact_id: e.contact_id, razon: 'agendar sin correo: se mandó el mensaje sin crear la cita' }); }
        else {
          const r = await agendarDemo({ nombre: c?.nombre || 'Lead', email, whatsapp: e.telefono, fecha: acc.fecha, hora: acc.hora, empresa: (c as any)?.companies?.nombre || null, giro: c?.giro || null, sucursales: c?.sucursales_interes || null, partnerId: c?.referrer_partner_id || null, notas: `Agendada por el agente SDR. Objetivo: ${(e.salida as any)?.objetivo || ''}` });
          if (!r.ok) {
            const otros = await horariosParaDemo({ max: 2 }).catch(() => []);
            mensaje = r.ocupado
              ? `Ese horario se acaba de ocupar, una disculpa. ${otros.length ? `¿Te queda ${otros.map(h => h.etiqueta).join(' o ')}?` : 'Dime qué día y si prefieres mañana o tarde, y te confirmo.'}`
              : 'No pude dejar apartado ese horario ahora mismo; ya le avisé al consultor para que te lo confirme hoy.';
            await log({ accion: 'agente_agenda_fallo', contact_id: e.contact_id, razon: r.error, detalle: acc });
            if (!r.ocupado) await escalarAlHumano(e.contact_id, { ...(e.salida as any), escalar: { si: true, motivo: `no se pudo agendar: ${r.error}` } });
          } else {
            await log({ accion: 'agente_agendo', contact_id: e.contact_id, razon: `${acc.fecha} ${acc.hora}`, detalle: { booking_id: r.booking?.id || null } });
            await supabase.from('ti_perfil').upsert({ contact_id: e.contact_id, agente_estado: { ciclo: 1, toque: 0, agendada_at: ahora.toISOString() }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
          }
        }
      } else if (acc?.tipo === 'confirmar_asistencia' && e.conversation_id) {
        const { confirmoAsistencia } = await import('../../scheduling/reagendar-wa');
        await confirmoAsistencia(e.conversation_id, e.telefono).catch(() => false);
      }
      const r: any = await enviarTexto(e.telefono, mensaje);
      const wamid = r?.messages?.[0]?.id || null;
      if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: e.telefono, direccion: 'saliente', tipo: 'text', cuerpo: mensaje, status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, estado_agente: (e.salida as any)?.estado || null } });
      await supabase.from('ti_envios').update({ estado: 'enviado', enviado_at: ahora.toISOString(), kapso_message_id: wamid, mensaje, updated_at: ahora.toISOString() }).eq('id', e.id);
      await log({ accion: 'agente_envio', contact_id: e.contact_id, contenido: mensaje, razon: (e.salida as any)?.objetivo, detalle: { envio_id: e.id, editado: !!e.editado_por, wamid } });
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


/* ══ EL RELOJ DE SILENCIO (decidido 2026-09-02) ══
   3 toques (≈20 h · día 3 · día 7) con ángulo distinto → llamada humana de
   rescate (día 8) → tarjeta «¿Seguimos o lo dejamos?» (día 9). «Que siga»
   abre otro ciclo con el espacio ×2. El estado vive en ti_perfil.agente_estado. */
const H = 3600e3;
const OFFSETS_H = [20, 72, 168];            // toques 1..3 desde el último envío nuestro sin respuesta
const LLAMADA_H = 192, TARJETA_H = 216;     // día 8 y día 9
export const MOTIVOS_NO_ERA_LEAD: Record<string, string> = {
  proveedor: 'Proveedor o vendedor (nos quiere vender algo)',
  cliente: 'Cliente actual o su empleado (va a soporte)',
  no_moda: 'No es de moda (gym, restaurante, servicio…)',
  ruido: 'Spam, número equivocado o candidato',
  otro: 'Otro (explícalo)',
};

function mult(ciclo: number) { return Math.pow(2, Math.max(0, (ciclo || 1) - 1)); }

export async function tocarSilencios(): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.agente_activo !== true) return { silencio: 'apagado' };
  const sombra = (cfg.agente_modo || 'sombra') === 'sombra';
  const ahora = new Date();
  const res: any = { toques: 0, sin_ventana: 0, llamadas: 0, tarjetas: 0, revisados: 0 };
  const { esHorarioLaboral, horaLocal, RESULTADOS_LLAMADA_L } = await import('./reglas');
  if (!esHorarioLaboral(ahora, cfg)) return { ...res, silencio: 'fuera_de_horario' };

  // Universo: el último envío del agente por lead (enviado), sin respuesta después.
  const { data: envs } = await supabase.from('ti_envios').select('contact_id, conversation_id, telefono, enviado_at')
    .eq('estado', 'enviado').gt('enviado_at', new Date(ahora.getTime() - 60 * 86400e3).toISOString()).order('enviado_at', { ascending: false }).limit(500);
  const ultimo: Record<string, any> = {};
  for (const e of envs || []) if (e.contact_id && !ultimo[e.contact_id]) ultimo[e.contact_id] = e;
  const ids = Object.keys(ultimo);
  if (!ids.length) return res;
  const [{ data: cs }, { data: perf }] = await Promise.all([
    supabase.from('contacts').select('id, nombre, whatsapp, owner_id, company_id, lifecycle_stage, propiedades, archived_at').in('id', ids),
    supabase.from('ti_perfil').select('contact_id, silenciar_ia, mejor_hora_wa, agente_estado, score_probabilidad, etapa_interes').in('contact_id', ids),
  ]);
  const porC: Record<string, any> = {}; for (const c of cs || []) porC[c.id] = c;
  const porP: Record<string, any> = {}; for (const p of perf || []) porP[p.contact_id] = p;

  for (const cid of ids) {
    const c = porC[cid], p = porP[cid] || {}, st: any = { ciclo: 1, toque: 0, ...(p.agente_estado || {}) };
    if (!c || c.archived_at || (c.propiedades as any)?.demo_ti || !['lead', 'oportunidad'].includes(c.lifecycle_stage) || p.silenciar_ia) continue;
    if (st.cerrado || (st.pausa_hasta && Date.parse(st.pausa_hasta) > ahora.getTime())) continue;
    res.revisados++;
    const base = Date.parse(st.base_at || ultimo[cid].enviado_at);
    // ¿Respondió después del último envío? Entonces no hay silencio (proponerRespuestas ya lo atiende).
    const { data: resp } = await supabase.from('ti_eventos').select('id').eq('contact_id', cid).eq('tipo', 'wa_entrante').gt('ocurrio_at', new Date(base).toISOString()).limit(1);
    if ((resp || []).length) continue;
    const horas = (ahora.getTime() - base) / H;
    const m = mult(st.ciclo);
    // La mejor hora del lead: si hoy todavía no llega, se espera (dentro del horario).
    if (p.mejor_hora_wa != null && horaLocal(ahora) < p.mejor_hora_wa && p.mejor_hora_wa < cfg.horario.fin) continue;
    // Un solo toque frío por día.
    if (st.ultimo_toque_at && ahora.getTime() - Date.parse(st.ultimo_toque_at) < 20 * H) continue;
    const guardar = async (cambios: any) => supabase.from('ti_perfil').upsert({ contact_id: cid, agente_estado: { ...st, ...cambios }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });

    // Antes del primer toque (y en cada ciclo) se evalúa: ICP + calidad de la conversación deciden
    // cuánto insistir: ICP bajo y charla pobre → 1 toque y a la tarjeta; medio → 2; alto → 3 + llamada.
    if (!st.eval || st.eval.ciclo !== st.ciclo) {
      const ev = await evaluarLead(cid);
      st.eval = { ...ev, ciclo: st.ciclo };
      await guardar({ eval: st.eval });
    }
    const maxToques = st.eval.icp === 'bajo' && st.eval.conversacion < 30 ? 1 : st.eval.icp === 'bajo' || st.eval.conversacion < 30 ? 2 : 3;
    if (st.toque >= maxToques && st.toque < 3) st.toque = 3; // salta al final del ciclo
    if (st.toque < 3 && horas >= OFFSETS_H[st.toque] * m) {
      // ¿Ventana de 24 h abierta? (último mensaje del lead hace menos de 24 h)
      const { data: ult } = await supabase.from('ti_eventos').select('ocurrio_at').eq('contact_id', cid).eq('tipo', 'wa_entrante').order('ocurrio_at', { ascending: false }).limit(1);
      const ventana = (ult || []).length && ahora.getTime() - Date.parse(ult![0].ocurrio_at) < 24 * H;
      if (!ventana) {
        // Fuera de ventana hacen falta plantillas (paso 4: marketing → 10 min → utility). Hasta entonces se registra y no se cuenta como toque.
        res.sin_ventana++;
        await log({ accion: 'silencio_sin_plantilla', contact_id: cid, razon: `toque ${st.toque + 1} del ciclo ${st.ciclo} requiere plantilla`, detalle: { horas: Math.round(horas) } });
        await guardar({ base_at: new Date(base).toISOString(), ultimo_intento_at: ahora.toISOString() });
        continue;
      }
      const nota = `TOQUE DE SILENCIO ${st.toque + 1} de ${maxToques} (ciclo ${st.ciclo}; ICP ${st.eval.icp}, conversación ${st.eval.conversacion}/100: ${st.eval.razones.join(', ')}): el lead NO ha respondido desde hace ${Math.round(horas)} h a tu último mensaje. Escribe un toque corto con un ÁNGULO DISTINTO a los ya usados: ${(st.angulos || []).join(' · ') || 'ninguno'}. Toque 1 = pregunta fácil de opciones + caso del giro; toque 2 = un valor concreto para su giro; toque 3 = último ángulo + «¿lo dejamos aquí?» honesto. responder=true salvo que haya razón para callar.`;
      const d = await decidirTurno(cid, nota);
      if (!d.salida || !d.salida.mensaje) { await log({ accion: 'agente_error', contact_id: cid, razon: d.motivo || 'silencio sin mensaje' }); continue; }
      const ventanaMin = Math.max(0, Number(cfg.agente_veto_min ?? 10));
      await supabase.from('ti_envios').insert({ contact_id: cid, conversation_id: ultimo[cid].conversation_id, telefono: ultimo[cid].telefono, origen: 'silencio', estado: 'pendiente', mensaje: d.salida.mensaje.trim(), salida: { ...d.salida, toque: st.toque + 1, ciclo: st.ciclo }, sale_at: new Date(ahora.getTime() + ventanaMin * MS_MIN).toISOString(), modelo: MODELS.opus, costo_usd: d.costo });
      await guardar({ base_at: new Date(base).toISOString(), toque: st.toque + 1, ultimo_toque_at: ahora.toISOString(), angulos: [...(st.angulos || []), d.salida.objetivo].slice(-9) });
      await log({ accion: 'agente_toque_silencio', contact_id: cid, contenido: d.salida.mensaje, razon: `toque ${st.toque + 1}/3 ciclo ${st.ciclo}`, costo: d.costo });
      res.toques++;
      continue;
    }
    if (st.toque >= 3 && !st.llamada_at && horas >= LLAMADA_H * m && st.eval?.icp === 'bajo') {
      // ICP bajo: no se gasta la llamada humana; la tarjeta decide.
      await guardar({ llamada_at: ahora.toISOString(), llamada_omitida: 'icp_bajo' });
      continue;
    }
    if (st.toque >= 3 && !st.llamada_at && horas >= LLAMADA_H * m) {
      if (!sombra) {
        const n = String(c.nombre || 'el lead').split(/\s+/)[0];
        await supabase.from('ti_tareas').insert({ contact_id: cid, company_id: c.company_id, owner_id: c.owner_id, familia: 'contactar', tipo: 'llamada', prioridad: 3, vence_at: ahora.toISOString(), origen: 'reloj', payload: {
          instruccion: `Llámale a ${n} — el agente le escribió 3 veces sin respuesta`, porque: 'Tres toques del agente con ángulos distintos y silencio: la voz es lo único que falta antes de decidir si seguimos.',
          nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'silencio_llamada', sujeto: `c${st.ciclo}`, tipo_llamada: 'Llamada de rescate', resultados: RESULTADOS_LLAMADA_L,
          hechos: [['Toques del agente', '3', 'sin respuesta', 'ambar'], ['Silencio', `${Math.round(horas / 24)} días`, 'desde el último mensaje nuestro'], ['Interés estimado', p.etapa_interes || '—', `prob. ${Math.round((p.score_probabilidad || 0) * 100)}%`]],
        } });
      }
      await guardar({ llamada_at: ahora.toISOString() });
      await log({ accion: 'silencio_llamada_humana', contact_id: cid, razon: sombra ? 'sombra: no se creó la tarea' : 'tarea de rescate creada' });
      res.llamadas++;
      continue;
    }
    if (st.llamada_at && !st.tarjeta_id && horas >= TARJETA_H * m) {
      const propuesta = st.eval?.icp === 'alto' && (st.eval?.conversacion || 0) >= 30 ? 'seguir' : 'descalificar';
      if (sombra) { await guardar({ tarjeta_id: 'sombra', tarjeta_at: ahora.toISOString() }); await log({ accion: 'silencio_tarjeta', contact_id: cid, razon: `sombra · propuesta ${propuesta}` }); res.tarjetas++; continue; }
      const n = String(c.nombre || 'el lead').split(/\s+/)[0];
      const { data: t } = await supabase.from('ti_tareas').insert({ contact_id: cid, company_id: c.company_id, owner_id: c.owner_id, familia: 'decidir', tipo: 'veredicto', prioridad: 4, vence_at: ahora.toISOString(), origen: 'reloj', payload: {
        instruccion: `${n}: ¿seguimos o lo dejamos?`, porque: 'El agente le escribió tres veces con ángulos distintos, tú le llamaste, y sigue en silencio. Si no decides en 48 h, se aplica la propuesta del agente.',
        nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'silencio_agente', sujeto: `c${st.ciclo}`, ciclo: st.ciclo, propuesta,
        hechos: [['Toques + llamada', '3 + 1', 'sin respuesta', 'ambar'], ['Silencio', `${Math.round(horas / 24)} días`, `ciclo ${st.ciclo}`], ['El agente propone', propuesta === 'seguir' ? 'Seguir' : 'A nutrición', propuesta === 'seguir' ? 'hubo señal de interés' : 'sin señal de interés', 'morado']],
        evidencia: [`Ángulos usados: ${(st.angulos || []).join(' · ') || '—'}.`, `ICP ${st.eval?.icp || '—'} · conversación ${st.eval?.conversacion ?? '—'}/100 (${(st.eval?.razones || []).join(', ')}).`, `Interés estimado: ${p.etapa_interes || '—'}.`],
        resultados: { seguir: 'Que siga (otro ciclo, más espaciado)', descalificar: 'A nutrición (el agente termina)', no_era_lead: 'No era lead (di por qué)', pausar: 'Pausar hasta una fecha' },
        motivos_no_era_lead: MOTIVOS_NO_ERA_LEAD,
      } }).select('id').single();
      await guardar({ tarjeta_id: t?.id || 'creada', tarjeta_at: ahora.toISOString() });
      await log({ accion: 'silencio_tarjeta', contact_id: cid, razon: `tarjeta creada · propuesta ${propuesta}` });
      res.tarjetas++;
    }
  }
  // 48 h sin decisión: se aplica la propuesta del agente.
  const { data: viejas } = await supabase.from('ti_tareas').select('*').eq('estado', 'pendiente').eq('tipo', 'veredicto')
    .filter('payload->>reloj', 'eq', 'silencio_agente').lt('created_at', new Date(ahora.getTime() - 48 * H).toISOString()).limit(20);
  for (const t of viejas || []) {
    const r = (t.payload as any)?.propuesta || 'descalificar';
    await aplicarVeredictoSilencio(t, r, { automatica: true }, null);
    await supabase.from('ti_tareas').update({ estado: 'hecha', resultado: r, resultado_detalle: { automatica: true, razon: '48 h sin decisión: se aplicó la propuesta del agente' }, hecho_at: ahora.toISOString(), updated_at: ahora.toISOString() }).eq('id', t.id);
    res.automaticas = (res.automaticas || 0) + 1;
  }
  return res;
}

/** La decisión de la tarjeta (humana o automática) ejecutada sobre el lead. */
export async function aplicarVeredictoSilencio(tarea: any, resultado: string, detalle: any, userId: string | null) {
  const cid = tarea.contact_id; const ahora = new Date().toISOString();
  const { data: p } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', cid).maybeSingle();
  const st: any = { ciclo: 1, toque: 0, ...((p?.agente_estado as any) || {}) };
  const guardar = (cambios: any, extra: any = {}) => supabase.from('ti_perfil').upsert({ contact_id: cid, agente_estado: { ...st, ...cambios }, updated_at: ahora, ...extra }, { onConflict: 'contact_id' });
  if (resultado === 'seguir') {
    await guardar({ ciclo: (st.ciclo || 1) + 1, toque: 0, base_at: ahora, llamada_at: null, tarjeta_id: null, tarjeta_at: null, cerrado: null });
    await log({ accion: 'silencio_decision', contact_id: cid, razon: `seguir → ciclo ${(st.ciclo || 1) + 1}`, detalle: { ...detalle, por: userId } });
  } else if (resultado === 'descalificar') {
    await guardar({ cerrado: 'nutricion', cerrado_at: ahora });
    await supabase.from('contacts').update({ estatus_lead: 'sin_respuesta', estatus_lead_at: ahora }).eq('id', cid).in('estatus_lead', ['nuevo', 'contactado', 'respondio']);
    await supabase.from('ti_cadencias').update({ estado: 'terminada', terminada_motivo: 'descalificado', updated_at: ahora }).eq('contact_id', cid).neq('estado', 'terminada');
    await log({ accion: 'silencio_decision', contact_id: cid, razon: 'descalificar → nutrición (el agente termina; vuelve si el lead da señal)', detalle: { ...detalle, por: userId } });
  } else if (resultado === 'no_era_lead') {
    const motivo = String(detalle?.motivo || 'otro'), texto = String(detalle?.texto || '').slice(0, 300);
    const { data: c } = await supabase.from('contacts').select('propiedades, fuente, utm_source').eq('id', cid).maybeSingle();
    await guardar({ cerrado: 'no_era_lead', cerrado_at: ahora, motivo }, { silenciar_ia: true });
    await supabase.from('contacts').update({ estatus_lead: 'descartado', estatus_lead_at: ahora, descarte_categoria: `no_era_lead:${motivo}`, propiedades: { ...((c?.propiedades as any) || {}), no_era_lead: { motivo, texto, at: ahora, por: userId } } }).eq('id', cid);
    await supabase.from('ti_cadencias').update({ estado: 'terminada', terminada_motivo: 'descalificado', updated_at: ahora }).eq('contact_id', cid).neq('estado', 'terminada');
    await supabase.from('crm_secuencia_miembros').update({ detenida_at: ahora, motivo: 'no_era_lead' }).eq('contact_id', cid).is('detenida_at', null);
    await supabase.from('ti_tareas').update({ estado: 'retirada', retirada_causa: 'no_era_lead', updated_at: ahora }).eq('contact_id', cid).eq('estado', 'pendiente').neq('id', tarea.id);
    // La lección: motivo + fuente, para que el analista nocturno proponga exclusiones cuando se repita.
    await log({ accion: 'no_era_lead', contact_id: cid, razon: motivo, contenido: texto || null, detalle: { fuente: c?.fuente, utm_source: c?.utm_source, por: userId, ...detalle } });
  } else if (resultado === 'pausar') {
    const hasta = detalle?.hasta ? new Date(detalle.hasta).toISOString() : new Date(Date.now() + 14 * 86400e3).toISOString();
    await guardar({ pausa_hasta: hasta, tarjeta_id: null, tarjeta_at: null, llamada_at: null, toque: 0, base_at: hasta });
    await log({ accion: 'silencio_decision', contact_id: cid, razon: `pausar hasta ${hasta.slice(0, 10)}`, detalle: { ...detalle, por: userId } });
  }
  return { ok: true };
}


/* ══ CITAS: no-show y cancelación (paso 3) ══
   El evento cae en ti_eventos (cita_no_asistio / cita_cancelada); el agente
   escribe sin reproche y ofrece horarios nuevos o la liga. Segunda vez
   seguida → lo pasa al consultor. */
export async function atenderCitas(): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.agente_activo !== true || !hasApiKey()) return { citas: 'apagado' };
  const ahora = new Date();
  const desde = new Date(Math.max(Date.parse(cfg.agente_citas_marca || 0) || 0, ahora.getTime() - 6 * 3600e3)).toISOString();
  const res: any = { atendidas: 0, saltadas: 0 };
  const { data: evs } = await supabase.from('ti_eventos').select('contact_id, tipo, ocurrio_at, payload').in('tipo', ['cita_no_asistio', 'cita_cancelada']).gt('ocurrio_at', desde).not('contact_id', 'is', null).limit(30);
  for (const e of evs || []) {
    const cid = e.contact_id;
    const [{ data: c }, { data: p }, { data: previos }] = await Promise.all([
      supabase.from('contacts').select('lifecycle_stage, propiedades, archived_at').eq('id', cid).maybeSingle(),
      supabase.from('ti_perfil').select('silenciar_ia').eq('contact_id', cid).maybeSingle(),
      supabase.from('ti_eventos').select('id').eq('contact_id', cid).in('tipo', ['cita_no_asistio', 'cita_cancelada']).lt('ocurrio_at', e.ocurrio_at).gt('ocurrio_at', new Date(ahora.getTime() - 45 * 86400e3).toISOString()).limit(2),
    ]);
    if (!c || c.archived_at || (c.propiedades as any)?.demo_ti || p?.silenciar_ia || !['lead', 'oportunidad'].includes(c.lifecycle_stage)) { res.saltadas++; continue; }
    const { data: ya } = await supabase.from('ti_envios').select('id').eq('contact_id', cid).eq('origen', 'cita').gt('created_at', e.ocurrio_at).limit(1);
    if ((ya || []).length) { res.saltadas++; continue; }
    const segunda = (previos || []).length >= 1;
    const nota = e.tipo === 'cita_no_asistio'
      ? `EL LEAD NO LLEGÓ a su cita (${(e.payload as any)?.fecha || ''}). ${segunda ? 'Es la SEGUNDA vez seguida: escribe con calidez, pregunta si sigue interesado y qué día le acomoda a él, y devuelve escalar.si=true para que el consultor lo tome.' : 'Escribe sin reproche (se cruzan cosas), y ofrece DOS horarios de la lista real o la liga de reagendar.'}`
      : `EL LEAD CANCELÓ su cita (${(e.payload as any)?.fecha || ''}). Escribe con calidez, sin presión: ofrece dos horarios nuevos o pregunta qué día le acomoda; si dice que ya no, respeta y pregunta qué cambió.`;
    try {
      const d = await decidirTurno(cid, nota);
      if (!d.salida?.mensaje || !d.telefono) { res.saltadas++; continue; }
      if (d.salida.escalar?.si) await escalarAlHumano(cid, d.salida);
      const ventana = Math.max(0, Number(cfg.agente_veto_min ?? 10));
      await supabase.from('ti_envios').insert({ contact_id: cid, conversation_id: d.conversationId, telefono: d.telefono, origen: 'cita', estado: 'pendiente', mensaje: d.salida.mensaje.trim(), salida: { ...d.salida, evento: e.tipo }, sale_at: new Date(ahora.getTime() + ventana * MS_MIN).toISOString(), modelo: MODELS.opus, costo_usd: d.costo });
      await log({ accion: 'agente_cita', contact_id: cid, razon: e.tipo, contenido: d.salida.mensaje, costo: d.costo });
      res.atendidas++;
    } catch (err: any) { await log({ accion: 'agente_error', contact_id: cid, razon: `cita: ${err?.message || err}` }); }
  }
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  await supabase.from('ti_config').update({ valor: { ...((data?.valor as any) || {}), agente_citas_marca: ahora.toISOString() } }).eq('id', 1);
  return res;
}
