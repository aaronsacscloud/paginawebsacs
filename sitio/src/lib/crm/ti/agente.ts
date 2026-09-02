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
import { horariosParaDemo, horariosTexto, agendarDemo, proximaCita, citaTexto, etiquetaHorario, LIGA_AGENDA } from './agenda-agente';
import { notificar } from '../notificaciones';
import { aplicarDatos, extraerYAplicar, textoDelLead } from './datos-lead';
import { galeriaActiva, galeriaTexto, resolverImagen, resolverAdjuntos, contarUso, asegurarFormatoWhatsApp, marcarErrorImagen, TIPO_L } from './imagenes-agente';
import { asegurarPlantillas, parListo, paramAngulo } from './plantillas-agente';

const MS_MIN = 60e3;

/** CARRIL DE PRUEBAS (2-sep): teléfonos en cfg.agente_prueba_telefonos reciben el
 *  flujo COMPLETO en vivo aunque el agente esté en sombra, y su reloj de silencio
 *  corre acelerado (cfg.agente_prueba_factor: 60 = las horas se vuelven minutos).
 *  Así el dueño prueba cada flujo desde su propio WhatsApp sin tocar leads reales. */
const soloDigitos = (t: any) => String(t || '').replace(/\D/g, '');
export const esPrueba = (cfg: any, telefono?: string | null) => {
  const lista: string[] = Array.isArray(cfg?.agente_prueba_telefonos) ? cfg.agente_prueba_telefonos : [];
  const t = soloDigitos(telefono); if (!t) return false;
  return lista.some(x => { const d = soloDigitos(x); return d && (t.endsWith(d.slice(-10)) || d.endsWith(t.slice(-10))); });
};
export const factorPrueba = (cfg: any) => Math.max(1, Number(cfg?.agente_prueba_factor) || 60);

export type SalidaAgente = {
  imagen?: { id: string; url?: string; nombre?: string; por_que?: string } | null;
  adjuntos?: { id: string; tipo: 'image' | 'document' | 'video'; url: string; nombre: string; por_que?: string }[];
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
  let q = supabase.from('ia_ejemplos').select('estado, situacion, pulida, fuente, por_que, imagen_id, adjuntos').eq('estado_rev', 'aprobado').order('created_at', { ascending: false }).limit(60);
  const { data } = await q;
  if (!(data || []).length) return '';
  // Las correcciones del dueño primero (máxima prioridad), luego el resto del estado actual, luego lo demás.
  const orden = (e: any) => (e.fuente === 'correccion_dueno' ? 0 : 1) + (estado && e.estado === estado ? 0 : 2);
  const lista = (data || []).sort((a, b) => orden(a) - orden(b)).slice(0, 24);
  return '\n\nEJEMPLOS APROBADOS POR EL DUEÑO (así se contesta; imita el criterio, no el texto):\n'
    + lista.map(e => { const m = String(e.por_que || '').match(/^CRITERIO:\s*([^\n]+)/); const ev = String(e.por_que || '').match(/^EVITAR:\s*([^\n]+)/m); const partes = partirMensaje(e.pulida || ''); return `[${e.estado}] Lead: ${e.situacion}\nNosotros${partes.length > 1 ? ` (${partes.length} mensajes seguidos)` : ''}: ${partes.length > 1 ? partes.map((p, i) => `\n  Mensaje ${i + 1}: ${p}`).join('') : e.pulida}${m ? `\nCriterio del dueño: ${m[1].trim()}` : ''}${ev ? `\nEvitar: ${ev[1].trim()}` : ''}${Array.isArray(e.adjuntos) && e.adjuntos.length ? `\n(con adjuntos: ${e.adjuntos.map((a: any) => `${TIPO_L[a.tipo as 'image'] || a.tipo} «${a.nombre}» [${a.id}]`).join(', ')})` : e.imagen_id ? `\n(con imagen de la galería: ${e.imagen_id})` : ''}`; }).join('\n---\n');
}

/** Divisor para partir una respuesta en varios mensajes de WhatsApp: una línea con --- */
export const DIVISOR_MENSAJES = /\n[ \t]*-{3,}[ \t]*\n/;
export const partirMensaje = (texto: string) => String(texto || '').split(DIVISOR_MENSAJES).map(t => t.trim()).filter(Boolean);

/**
 * REESCRIBIR CON EL CRITERIO DEL DUEÑO (pestaña Aprendizaje): el dueño corrige, pone la regla y lo que
 * hay que evitar, y el agente vuelve a escribir ESE momento para demostrar que lo entendió. Devuelve la
 * nueva versión y, en una línea, qué cambió. No envía nada.
 */
export async function reescribirRespuesta(o: { contactId?: string | null; estado?: string | null; mensajeLead?: string | null; situacion?: string | null; original?: string | null; versionDueno?: string | null; criterio?: string | null; evitar?: string | null; enDos?: boolean; adjuntos?: { nombre: string; tipo: string }[] }): Promise<{ mensaje: string | null; que_cambie: string; costo: number }> {
  if (!hasApiKey()) return { mensaje: null, que_cambie: 'Sin API key', costo: 0 };
  let c: any = null, historia = '';
  if (o.contactId) {
    const r = await supabase.from('contacts').select('id, nombre, giro, sucursales_interes, lifecycle_stage, email, propiedades, companies(nombre)').eq('id', o.contactId).maybeSingle(); c = r.data;
    const { msjs } = await charla(o.contactId, 24).catch(() => ({ msjs: [] as any[] }));
    historia = msjs.slice(-12).map((m: any) => `${m.direccion === 'entrante' ? 'LEAD' : 'NOSOTROS'}: ${(m.transcript || m.cuerpo || `[${m.tipo}]`).slice(0, 300)}`).join('\n');
  }
  const ctx = contextoParaLead({ giroCrm: c?.giro || null, conversacion: historia, ultimoMensaje: o.mensajeLead || '' });
  const galeria = await galeriaActiva().catch(() => []);
  const system = `${GUION_AGENTE}\n\nLO QUE SABES (general):\n${WIKI_COMERCIAL}\n\nLO QUE SABES DE ESTE LEAD Y SU GIRO:\n${ctx.texto}\n\nLÍMITES:\n${LIMITES_COPILOTO}${await ejemplosAprobados(o.estado || undefined)}${galeriaTexto(galeria, c?.giro)}`;
  const user = `EJERCICIO DE ENTRENAMIENTO CON EL DUEÑO. Vas a REESCRIBIR una respuesta tuya de un momento concreto, aplicando su criterio. No es una conversación en vivo: no saludes, no inventes datos, no agendes.
${c ? `LEAD: «${c.nombre || '?'}», giro ${c.giro || 'desconocido'}, tiendas ${c.sucursales_interes ?? '?'}, etapa ${c.lifecycle_stage}.` : ''}
${historia ? `ÚLTIMOS MENSAJES DE LA CONVERSACIÓN (contexto):\n${historia}\n` : ''}
EL MOMENTO: el lead dijo «${String(o.mensajeLead || o.situacion || '').slice(0, 600)}».${o.situacion ? ` Qué buscabas: ${o.situacion}` : ''}
TU RESPUESTA ORIGINAL: «${String(o.original || '').slice(0, 1200)}»
${o.versionDueno && o.versionDueno !== o.original ? `LA VERSIÓN QUE ESCRIBIÓ EL DUEÑO (referencia de tono y contenido; no la copies literal, entiéndela): «${String(o.versionDueno).slice(0, 1200)}»` : ''}
${o.criterio ? `REGLA QUE DEBES APLICAR (del dueño): ${o.criterio}` : ''}
${o.evitar ? `LO QUE HAY QUE EVITAR (del dueño): ${o.evitar}` : ''}
${o.enDos ? 'FORMATO: en DOS mensajes de WhatsApp (el primero con la respuesta, el segundo con el siguiente paso o la pregunta), separados por una línea que contenga solo ---.' : 'FORMATO: un solo mensaje de WhatsApp.'}
${o.adjuntos?.length ? `ADJUNTOS QUE EL DUEÑO ELIGIÓ PARA ESTE MOMENTO: ${o.adjuntos.map(a => `${a.tipo} «${a.nombre}»`).join(', ')} (el texto debe entenderse sin ellos y puede referirlos con naturalidad).` : ''}
Devuelve SOLO JSON: {"mensaje": "la respuesta final tal como saldría por WhatsApp", "que_cambie": "en UNA línea, qué cambiaste respecto a la original y por qué (así el dueño ve que entendiste su criterio)"}`;
  let r: any;
  try { r = await anthropic.messages.create({ model: MODELS.opus, max_tokens: 1200, system, messages: [{ role: 'user', content: user }] }); }
  catch (e: any) { const m = String(e?.error?.error?.message || e?.message || e); await avisarSiSinCredito(m); throw new Error(m); }
  const t = (r.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
  const costo = calculateCost(MODELS.opus, r.usage as any).cost_usd;
  let out: any = null;
  try { out = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { out = null; }
  await log({ accion: 'agente_reescribe', contact_id: o.contactId || null, contenido: out?.mensaje || null, razon: o.criterio || undefined, costo: Number(costo) || 0, detalle: { evitar: o.evitar || null, en_dos: !!o.enDos, que_cambie: out?.que_cambie || null } });
  return { mensaje: out?.mensaje ? String(out.mensaje).trim() : null, que_cambie: String(out?.que_cambie || '').trim(), costo: Number(costo) || 0 };
}

/** Un turno del agente para un contacto: lee, decide, no envía. */
export async function decidirTurno(contactId: string, nota?: string): Promise<{ salida: SalidaAgente | null; costo: number; conversationId: string | null; telefono: string | null; motivo?: string }> {
  if (!hasApiKey()) return { salida: null, costo: 0, conversationId: null, telefono: null, motivo: 'sin_api_key' };
  const [{ msjs, conversationId, telefono }, { data: c }, { data: perfil }] = await Promise.all([
    charla(contactId),
    supabase.from('contacts').select('id, nombre, apellido, giro, sucursales_interes, lifecycle_stage, fuente, propiedades, whatsapp, email, company_id, puesto, companies(nombre, nombre_comercial, ciudad, sitio_web, sucursales, giro)').eq('id', contactId).maybeSingle(),
    supabase.from('ti_perfil').select('etapa_interes, canales, mejor_hora_wa, ultima_respuesta_at, senales, silenciar_ia, agente_estado').eq('contact_id', contactId).maybeSingle(),
  ]);
  if (!c || !msjs.length) return { salida: null, costo: 0, conversationId, telefono, motivo: 'sin_conversacion' };
  const texto = msjs.map(m => `${m.direccion === 'entrante' ? 'LEAD' : 'NOSOTROS'} (${String(m.created_at).slice(0, 16).replace('T', ' ')}): ${m.tipo === 'audio' ? (m.transcript ? '[audio] ' + m.transcript : '[audio sin transcripción]') : String(m.cuerpo || `[${m.tipo}]`).slice(0, 500)}`).join('\n');
  const ultimo = [...msjs].reverse().find(m => m.direccion === 'entrante');
  // LA RÁFAGA: todo lo que el lead mandó desde nuestra última respuesta. Varios mensajes seguidos son UN turno:
  // se leen juntos y se contestan todos (regla del dueño, 2026-09-02).
  const textoDe = (m: any) => m.tipo === 'audio' ? (m.transcript ? '[audio] ' + m.transcript : '[audio sin transcripción]') : String(m.cuerpo || `[${m.tipo}]`);
  const idxUltSal = msjs.map(m => m.direccion).lastIndexOf('saliente');
  const rafaga = msjs.slice(idxUltSal + 1).filter(m => m.direccion === 'entrante');
  const rafagaTxt = rafaga.length > 1 ? `\n\nEL LEAD MANDÓ ${rafaga.length} MENSAJES SEGUIDOS SIN RESPUESTA NUESTRA. Léelos como un solo turno y contesta TODO lo que preguntó o dijo, en su orden, en UNA sola respuesta; no ignores ninguno:\n${rafaga.map((m, i) => `${i + 1}. ${textoDe(m).slice(0, 300)}`).join('\n')}` : '';
  const memoria = memoriaConversacion(msjs, c.nombre);
  const [horarios, cita, pagina, galeria] = await Promise.all([
    horariosParaDemo({ mejorHora: perfil?.mejor_hora_wa ?? null }).catch(() => []),
    proximaCita(contactId).catch(() => null),
    leerPaginaDelLead(contactId, msjs).catch(() => ''),
    galeriaActiva().catch(() => []),
  ]);
  const pend: any = (perfil?.agente_estado as any)?.agenda_pendiente;
  const pendTxt = pend?.fecha && pend?.hora
    ? (pend.motivo === 'sin_correo'
      ? `AGENDA PENDIENTE: el lead YA ELIGIÓ ${etiquetaHorario(pend.fecha, pend.hora)} [${pend.fecha} ${pend.hora}] y solo falta su correo. Si en este mensaje lo da (o el CRM ya lo tiene), devuelve accion.tipo="agendar" con ESA fecha/hora y el correo, sin volver a ofrecer horarios. No lo saludes de nuevo.`
      : `AGENDA PENDIENTE: la cita de ${etiquetaHorario(pend.fecha, pend.hora)} [${pend.fecha} ${pend.hora}] falló por un error técnico NUESTRO; ya le pediste una disculpa y le ofreciste ese mismo horario u otros, más la liga de la agenda. Si ahora elige uno (incluido el mismo), devuelve accion.tipo="agendar" con esa fecha/hora y su correo. No la des por confirmada mientras no se agende.`)
    : '';
  const agenda = `${citaTexto(cita)}\n${pendTxt}\n${horariosTexto(horarios)}\nCORREO EN EL CRM: ${c.email || 'ninguno (pídelo antes de agendar)'}`.trim();
  const ctx = contextoParaLead({ giroCrm: c.giro || null, conversacion: texto, ultimoMensaje: ultimo?.cuerpo || ultimo?.transcript || '' });
  const co: any = (c as any).companies || null; const dl: any = (c.propiedades as any)?.datos_lead || {};
  const crm = `LO QUE EL CRM SABE: nombre «${c.nombre || '?'}${c.apellido ? ' ' + c.apellido : ''}», etapa ${c.lifecycle_stage}, giro ${c.giro || co?.giro || 'desconocido'}, tiendas ${c.sucursales_interes ?? co?.sucursales ?? 'desconocido'}, marca/tienda ${co?.nombre_comercial || co?.nombre || dl.empresa || 'desconocida'}, ciudad ${co?.ciudad || dl.ciudad || 'desconocida'}, web ${co?.sitio_web || dl.sitio_web || 'desconocida'}, correo ${c.email || 'ninguno'}, puesto ${c.puesto || 'desconocido'}, sistema actual ${dl.sistema_actual || 'desconocido'}, fuente ${c.fuente || 'desconocida'}. TEMAS YA ANOTADOS PARA LA REUNIÓN: ${(Array.isArray((c.propiedades as any)?.temas_reunion) ? (c.propiedades as any).temas_reunion.map((t: any) => t.tema).join(' · ') : '') || 'ninguno'}. Si el lead dice o corrige cualquiera de estos datos, repórtalo en "datos" (con corrige:true si cambia lo que el CRM tenía).`
    + (perfil ? `; interés estimado ${perfil.etapa_interes || '?'}; última respuesta ${perfil.ultima_respuesta_at ? String(perfil.ultima_respuesta_at).slice(0, 10) : 'n/a'}.` : '.');
  const r = await anthropic.messages.create({
    model: MODELS.opus, max_tokens: 1800,
    system: `${GUION_AGENTE}\n\nLO QUE SABES (general):\n${WIKI_COMERCIAL}\n\nLO QUE SABES DE ESTE LEAD Y SU GIRO:\n${ctx.texto}\n\nLÍMITES:\n${LIMITES_COPILOTO}${await ejemplosAprobados()}${galeriaTexto(galeria, c.giro)}`,
    messages: [{ role: 'user', content: `${crm}\n\n${memoria}\n\nAGENDA:\n${agenda}${pagina ? `\n\n${pagina}` : ''}${nota ? `\n\n${nota}` : ''}${rafagaTxt}\n\nCONVERSACIÓN (lo más reciente al final${nota ? '' : '; el último mensaje es del lead y te toca decidir'}):\n\n${texto}\n\n${SALIDA_AGENTE}` }],
  });
  const t = (r.content.find(b => b.type === 'text') as any)?.text || '{}';
  const costo = calculateCost(MODELS.opus, r.usage as any).cost_usd;
  let salida: any = null;
  try { salida = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { salida = null; }
  if (salida) {
    salida.ultimo_mensaje = (rafaga.length ? rafaga.map(textoDe).join(' ⏎ ') : String(ultimo?.cuerpo || ultimo?.transcript || '')).slice(0, 600);
    salida.ultimos_mensajes = rafaga.map(m => textoDe(m).slice(0, 300));
    // Los adjuntos solo valen si existen en la galería (máximo dos). `imagen` se conserva como el primero, por compatibilidad.
    salida.adjuntos = resolverAdjuntos(salida.adjuntos?.length ? salida.adjuntos : (salida.imagen?.id ? [salida.imagen] : []), galeria);
    const img = salida.adjuntos.find((a: any) => a.tipo === 'image');
    salida.imagen = img ? { id: img.id, url: img.url, nombre: img.nombre, por_que: img.por_que || '' } : null;
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
  // Al CRM: giro, tiendas, correo, nombre, marca, ciudad, web… (llena vacíos, corrige con evidencia, deja rastro). Ver datos-lead.ts.
  if (nuevos.length) {
    const { cambios } = await aplicarDatos(contactId, nuevos as any, { fuente: 'agente' }).catch(() => ({ cambios: [] as any[] }));
    if (cambios.length) await log({ accion: 'datos_lead', contact_id: contactId, razon: 'agente', detalle: { cambios: cambios.map((x: any) => ({ campo: x.campo, antes: x.antes, despues: x.despues })) } });
  }
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
  // Si el lead sigue escribiendo (último mensaje hace < 75 s), se espera al siguiente tick para leer la ráfaga
  // completa. La marca no avanza más allá de esos mensajes, para no perderlos.
  const ESPERA_RAFAGA_MS = 75e3;
  let marcaSegura = ahora.getTime();
  for (const cid of Object.keys(ultimoPor)) {
    const t = Date.parse(ultimoPor[cid]);
    if (ahora.getTime() - t < ESPERA_RAFAGA_MS) { res.esperando = (res.esperando || 0) + 1; marcaSegura = Math.min(marcaSegura, t - 1000); delete ultimoPor[cid]; }
  }
  const ids = Object.keys(ultimoPor);
  if (!ids.length) { await guardarMarca(new Date(marcaSegura)); return res; }

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
    const stPrev: any = (p?.agente_estado as any) || {};
    const reconecto = (stPrev.intentos || []).length > 0 || stPrev.fase === 'reconectar';
    await supabase.from('ti_perfil').upsert({ contact_id: cid, agente_estado: { ...stPrev, ciclo: 1, toque: 0, intentos: [], llamada_at: undefined, tarjeta_id: undefined, tarjeta_at: undefined, cerrado: undefined, pausa_hasta: undefined, fase: 'agendar', mensajes_agendar: reconecto ? 0 : (stPrev.mensajes_agendar || 0), reactivado_at: stPrev.cerrado ? ahora.toISOString() : stPrev.reactivado_at }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
    // ¿Un humano ya contestó después del último mensaje del lead? Entonces el agente calla.
    const { data: sal } = await supabase.from('ti_eventos').select('ocurrio_at, actor').eq('contact_id', cid)
      .in('tipo', ['wa_saliente']).gt('ocurrio_at', ultimoPor[cid]).limit(1);
    if ((sal || []).length) {
      // El consultor ya contestó: el agente calla, pero lo que el lead DIJO (giro, tiendas, correo, marca…) se guarda igual.
      res.saltados++;
      try {
        const desdeTxt = new Date(Date.parse(ultimoPor[cid]) - 6 * 3600e3).toISOString();
        const { texto, conversation_id } = await textoDelLead(cid, desdeTxt);
        if (texto) await extraerYAplicar(cid, texto, 'humano_respondio', conversation_id);
      } catch (err: any) { await log({ accion: 'agente_error', contact_id: cid, razon: `datos (humano contestó): ${err?.message || err}` }); }
      continue;
    }
    // Un solo pendiente por lead: el nuevo mensaje del lead reemplaza la propuesta anterior.
    const previos = (pend || []).filter(x => x.contact_id === cid);
    // Si ya hay un envío (pendiente o salido) posterior a su último mensaje, este mensaje ya se atendió (la marca puede volver atrás por una ráfaga).
    const { data: yaAtendido } = await supabase.from('ti_envios').select('id').eq('contact_id', cid).gt('created_at', ultimoPor[cid]).neq('estado', 'vetado').limit(1);
    if ((yaAtendido || []).length) { res.saltados++; continue; }
    try {
      const nAg = Number((p?.agente_estado as any)?.mensajes_agendar) || 0;
      const notaAg = nAg >= 2 && !(await proximaCita(cid).catch(() => null)) ? `ES TU TERCER MENSAJE desde que el lead reconectó y todavía no hay cita ni llamada: después de contestar lo que preguntó, propón DIRECTO la demo o una llamada de 10 minutos con dos horarios concretos de la lista real. Sin rodeos.` : undefined;
      const d = await decidirTurno(cid, notaAg);
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
      const { error: eIns } = await supabase.from('ti_envios').insert({
        contact_id: cid, conversation_id: d.conversationId, telefono: d.telefono, origen: 'respuesta', estado: 'pendiente',
        mensaje: s.mensaje.trim(), imagen_id: s.imagen?.id || null, imagen_url: s.imagen?.url || null, adjuntos: s.adjuntos || [], salida: s, sale_at: new Date(ahora.getTime() + ventana * MS_MIN).toISOString(), modelo: MODELS.opus, costo_usd: d.costo,
      });
      if (eIns) {
        // Índice único «un pendiente por lead»: otro tick se adelantó. No es error: se descarta esta copia.
        if (/23505|duplicate key/i.test(eIns.message)) { res.saltados++; await log({ accion: 'agente_duplicado_evitado', contact_id: cid, razon: 'otro tick ya dejó un pendiente para este lead' }); continue; }
        throw new Error(eIns.message);
      }
      await log({ accion: 'agente_propone', contact_id: cid, contenido: s.mensaje, costo: d.costo, razon: s.objetivo, detalle: { estado: s.estado, interes: s.interes, ventana_min: ventana } });
      res.propuestos++;
      await contarMensajeAgendar(cid, c, p, s).catch(() => {});
    } catch (e: any) { res.errores++; await log({ accion: 'agente_error', contact_id: cid, razon: String(e?.message || e) }); await avisarSiSinCredito(String(e?.message || e)); }
  }
  await guardarMarca(new Date(marcaSegura));
  return res;
}

/** FASE «AGENDAR»: desde que el lead reconectó, contamos nuestros mensajes; al tercero sin cita ni llamada
 *  aceptada, la decisión pasa a la tarjeta (propuesta según interés): seguir, nutrición o no era lead. */
async function contarMensajeAgendar(cid: string, c: any, p: any, s: SalidaAgente) {
  const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', cid).maybeSingle();
  const st: any = { ciclo: 1, toque: 0, ...((pf?.agente_estado as any) || {}) };
  if (st.fase !== 'agendar') return;
  const n = (Number(st.mensajes_agendar) || 0) + 1;
  const cita = await proximaCita(cid).catch(() => null);
  const cambios: any = { mensajes_agendar: n };
  if (!cita && n >= 3 && !st.tarjeta_agendar_id) {
    const propuesta = s.interes?.nivel === 'alto' ? 'seguir' : 'descalificar';
    const { data: cc } = await supabase.from('contacts').select('nombre, whatsapp, owner_id, company_id').eq('id', cid).maybeSingle();
    const nom = String(cc?.nombre || 'el lead').split(/\s+/)[0];
    const { data: t } = await supabase.from('ti_tareas').insert({ contact_id: cid, company_id: cc?.company_id || null, owner_id: cc?.owner_id || null, familia: 'decidir', tipo: 'veredicto', prioridad: 3, vence_at: new Date().toISOString(), origen: 'reloj', payload: {
      instruccion: `${nom}: responde pero no agenda — ¿seguimos, lo llamas o lo dejamos?`, porque: 'Reconectó y ya van tres mensajes nuestros con respuesta, pero no acepta demo ni llamada. Si no decides en 48 h, se aplica la propuesta del agente.',
      nombre: cc?.nombre, whatsapp: cc?.whatsapp, reloj: 'silencio_agente', sujeto: `agendar-c${st.ciclo}`, ciclo: st.ciclo, propuesta,
      hechos: [['Mensajes desde que reconectó', String(n), 'con respuesta, sin cita', 'ambar'], ['Interés estimado', s.interes?.nivel || '—', s.interes?.razon || ''], ['El agente propone', propuesta === 'seguir' ? 'Seguir' : 'A nutrición', '']],
      evidencia: [`Último objetivo del agente: ${s.objetivo || '—'}.`, `Último mensaje del lead: «${String(s.ultimo_mensaje || '').slice(0, 160)}».`],
      resultados: { seguir: 'Que siga (el agente insiste con otro ángulo)', descalificar: 'A nutrición (el agente termina)', no_era_lead: 'No era lead (di por qué)', pausar: 'Pausar hasta una fecha' },
      motivos_no_era_lead: MOTIVOS_NO_ERA_LEAD,
    } }).select('id').single();
    cambios.tarjeta_agendar_id = t?.id || 'creada';
    await log({ accion: 'agendar_tarjeta', contact_id: cid, razon: `3 mensajes con respuesta sin cita · propuesta ${propuesta}` });
  }
  await supabase.from('ti_perfil').upsert({ contact_id: cid, agente_estado: { ...st, ...cambios }, updated_at: new Date().toISOString() }, { onConflict: 'contact_id' });
}

async function guardarMarca(ahora: Date) {
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  await supabase.from('ti_config').update({ valor: { ...((data?.valor as any) || {}), agente_marca: ahora.toISOString() } }).eq('id', 1);
}

/** ¿Un HUMANO (no el agente) le escribió al lead después de que nació esta propuesta?
 *  Si sí, la propuesta no sale (nunca dos voces) y el par agente/humano se guarda
 *  como material de aprendizaje y de revisión. */
async function humanoContestoDespues(e: { conversation_id: string | null; contact_id: string | null; created_at: string }): Promise<{ texto: string; at: string } | null> {
  if (!e.conversation_id) return null;
  const { data } = await supabase.from('wa_mensajes').select('cuerpo, created_at, metadata, autor')
    .eq('conversation_id', e.conversation_id).eq('direccion', 'saliente').gt('created_at', e.created_at).is('borrado_at', null)
    .order('created_at', { ascending: true }).limit(5);
  const h = (data || []).find(m => (m.metadata as any)?.origen !== 'agente' && m.autor !== 'Agenda');
  return h ? { texto: String(h.cuerpo || '').trim(), at: h.created_at } : null;
}

async function guardarParHumano(e: any, h: { texto: string; at: string }, motivo: 'humano_respondio' | 'sombra') {
  await supabase.from('ti_envios').update({ estado: motivo, humano_respuesta: h.texto, humano_at: h.at, updated_at: new Date().toISOString() }).eq('id', e.id);
  if (h.texto.length >= 8) {
    await supabase.from('ia_ejemplos').insert({
      estado: (e.salida as any)?.estado || 'descubriendo',
      situacion: motivo === 'humano_respondio' ? 'El consultor contestó antes de que saliera la sugerencia del agente' : 'En sombra: el consultor contestó este turno; el agente había propuesto otra cosa',
      mensaje_lead: (e.salida as any)?.ultimo_mensaje || null, respuesta: h.texto, pulida: h.texto,
      por_que: `Par agente/humano · envio:${e.id} · el agente había propuesto: ${String(e.mensaje).slice(0, 300)}`,
      fuente: 'humano_antes', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'dudoso',
    });
  }
  await log({ accion: 'agente_superado_por_humano', contact_id: e.contact_id, razon: motivo, contenido: h.texto, detalle: { envio_id: e.id, propuesta: e.mensaje } });
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

/** Cuando la cita queda, lo que el reloj de silencio tenía en cola para ese lead ya no aplica. */
async function callarSilencioPendiente(contactId: string, motivo: string) {
  await supabase.from('ti_envios').update({ estado: 'vetado', motivo_veto: motivo, updated_at: new Date().toISOString() }).eq('contact_id', contactId).eq('estado', 'pendiente').eq('origen', 'silencio');
}

/** Aviso del SISTEMA en la campana del CRM (pestaña «Sistema»): qué pasó y qué hacer, con clic al hilo. */
async function avisoSistema(o: { tipo: string; nivel: 'info' | 'alerta' | 'urgente'; clave: string; titulo: string; detalle: string; que_hacer: string; contact_id?: string | null; conversation_id?: string | null; extra?: any }) {
  await notificar({ clave: o.clave, tipo: o.tipo, nivel: o.nivel, titulo: o.titulo, detalle: o.detalle, metadata: { origen: 'agente', que_hacer: o.que_hacer, contact_id: o.contact_id || null, conversation_id: o.conversation_id || null, ...(o.extra || {}) } }).catch(() => false);
}

/** Si la API de IA rechaza por saldo/facturación, el agente queda mudo: aviso urgente en la pestaña Sistema (uno por día). */
async function avisarSiSinCredito(msg: string) {
  if (!/credit balance|billing|insufficient_quota|quota exceeded|payment required|402/i.test(msg)) return;
  await avisoSistema({ tipo: 'sistema_ia_sin_credito', nivel: 'urgente', clave: `sistema_ia_sin_credito:${new Date().toISOString().slice(0, 10)}`, titulo: 'El agente no puede pensar: la cuenta de Anthropic se quedó sin crédito', detalle: `La API respondió: ${msg.slice(0, 160)}. Mientras tanto NO se proponen respuestas ni se reescriben ejemplos; los leads que escriban quedan sin contestar por el agente.`, que_hacer: 'Entra a console.anthropic.com → Plans & Billing y recarga crédito (o activa auto-recarga). El agente retoma solo en el siguiente tick.' });
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
  const enSombra = ((cfg.agente_modo || 'sombra') === 'sombra' || !vivoPermitido) && !opts.forzar;
  if (enSombra) {
    // Los teléfonos de PRUEBA sí salen; el resto se marca sombra.
    const { data: due } = await supabase.from('ti_envios').select('id, telefono, conversation_id, contact_id, created_at, mensaje, salida').eq('estado', 'pendiente').lte('sale_at', ahora.toISOString()).limit(50);
    for (const e of (due || []).filter(x => !esPrueba(cfg, x.telefono))) {
      // En sombra la comparación es gratis: si el humano contestó este turno, el par se guarda.
      const h = await humanoContestoDespues(e);
      if (h) await guardarParHumano(e, h, 'sombra');
      else await supabase.from('ti_envios').update({ estado: 'sombra', updated_at: ahora.toISOString() }).eq('id', e.id);
    }
    const noPrueba = (due || []).filter(e => !esPrueba(cfg, e.telefono)).map(e => e.id);
    if (!(due || []).some(e => esPrueba(cfg, e.telefono))) return { agente: 'sombra', sombra: noPrueba.length };
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
    // Si un HUMANO ya le contestó, el agente calla: nunca dos voces. Y el par se guarda para aprender.
    const h = await humanoContestoDespues(e);
    if (h && !opts.soloId) { await guardarParHumano(e, h, 'humano_respondio'); continue; }
    // ¿La AGENDA cambió después de que nació esta propuesta (el lead movió, creó o canceló la cita él mismo)?
    // Entonces la propuesta ya no habla de la realidad: se retira y el agente vuelve a decidir con la cita vigente.
    if (e.contact_id && (e.salida as any)?.estado && !(e.salida as any)?.reconsiderado) {
      const { data: bk } = await supabase.from('bookings').select('id').eq('contact_id', e.contact_id).or(`created_at.gt.${e.created_at},updated_at.gt.${e.created_at}`).limit(1);
      if ((bk || []).length) {
        await supabase.from('ti_envios').update({ estado: 'reemplazado', motivo_veto: 'la agenda cambió después de la propuesta', updated_at: ahora.toISOString() }).eq('id', e.id);
        await log({ accion: 'agente_reconsidera', contact_id: e.contact_id, razon: 'la cita cambió después de la propuesta', detalle: { envio_id: e.id } });
        try {
          const d = await decidirTurno(e.contact_id, 'LA AGENDA CAMBIÓ después de tu propuesta anterior: el lead movió, creó o canceló la cita por su cuenta. Mira la CITA VIGENTE de arriba y responde a su último mensaje de acuerdo con eso; si ya la movió él, confírmasela con día y hora, sin ofrecer horarios ni pedirle nada más. No lo saludes de nuevo.');
          if (d.salida?.mensaje && d.salida.responder && d.telefono) {
            await supabase.from('ti_envios').insert({ contact_id: e.contact_id, conversation_id: d.conversationId, telefono: d.telefono, origen: e.origen, estado: 'pendiente', mensaje: d.salida.mensaje.trim(), imagen_id: d.salida.imagen?.id || null, imagen_url: d.salida.imagen?.url || null, adjuntos: d.salida.adjuntos || [], salida: { ...d.salida, reconsiderado: true }, sale_at: new Date(ahora.getTime() + Math.max(0, Number(cfg.agente_veto_min ?? 10)) * MS_MIN).toISOString(), modelo: MODELS.opus, costo_usd: d.costo });
          }
        } catch (err: any) { await log({ accion: 'agente_error', contact_id: e.contact_id, razon: `reconsiderar: ${err?.message || err}` }); }
        continue;
      }
    }
    try {
      // La ACCIÓN viaja con el mensaje y se ejecuta al salir (así el veto también la detiene).
      let mensaje = e.mensaje;
      const acc: any = (e.salida as any)?.accion;
      if (acc?.tipo === 'agendar' && acc.fecha && acc.hora) {
        const { data: c } = await supabase.from('contacts').select('nombre, email, giro, sucursales_interes, referrer_partner_id, companies(nombre)').eq('id', e.contact_id).maybeSingle();
        const email = String(acc.email || c?.email || '').trim().toLowerCase();
        const etiqueta = etiquetaHorario(acc.fecha, acc.hora);
        const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', e.contact_id).maybeSingle();
        const st: any = { ciclo: 1, toque: 0, ...((pf?.agente_estado as any) || {}) };
        const guardarSt = (cambios: any) => supabase.from('ti_perfil').upsert({ contact_id: e.contact_id, agente_estado: { ...st, ...cambios }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          // Sin correo NO hay cita (la invitación y el Meet viajan por correo). Se pide, y el horario elegido se recuerda.
          mensaje = `Para mandarte la invitación con la liga de la videollamada necesito tu correo, ¿me lo pasas? En cuanto lo tenga te dejo apartado el ${etiqueta}.`;
          await guardarSt({ agenda_pendiente: { fecha: acc.fecha, hora: acc.hora, motivo: 'sin_correo', desde: ahora.toISOString() } });
          await log({ accion: 'agente_agenda_sin_correo', contact_id: e.contact_id, razon: `${acc.fecha} ${acc.hora}`, detalle: { email_dado: acc.email || null } });
        } else {
          const r = await agendarDemo({ nombre: c?.nombre || 'Lead', email, whatsapp: e.telefono, fecha: acc.fecha, hora: acc.hora, contactId: e.contact_id, empresa: (c as any)?.companies?.nombre || null, giro: c?.giro || null, sucursales: c?.sucursales_interes || null, partnerId: c?.referrer_partner_id || null, notas: `Agendada por el agente SDR. Objetivo: ${(e.salida as any)?.objetivo || ''}` });
          if (!r.ok && r.ocupado) {
            const otros = await horariosParaDemo({ max: 2 }).catch(() => []);
            mensaje = `Ese horario se acaba de ocupar, una disculpa. ${otros.length ? `¿Te queda ${otros.map(h => h.etiqueta).join(' o ')}?` : 'Dime qué día y si prefieres mañana o tarde, y te confirmo.'}`;
            await guardarSt({ agenda_pendiente: null });
            await log({ accion: 'agente_agenda_ocupado', contact_id: e.contact_id, razon: r.error, detalle: acc });
          } else if (!r.ok) {
            // Error NUESTRO (5xx, timeout). Decisión del dueño: se rectifica con naturalidad (los humanos también se equivocan),
            // se le dan horarios para que ÉL elija —el mismo u otros— y la liga de la agenda. Por detrás: tarea P1 con el
            // error crudo, aviso en la pestaña Sistema de la campana, y reintentarAgendas() por si no contesta.
            const otros = (await horariosParaDemo({ max: 3 }).catch(() => [])).filter(h => !(h.fecha === acc.fecha && h.hora === acc.hora)).slice(0, 2);
            mensaje = `Perdón, se me trabó el sistema al apartar el ${etiqueta}, cosas que pasan. ¿Lo dejamos en ese mismo horario${otros.length ? `, o te acomoda mejor ${otros.map(h => h.etiqueta).join(' o ')}` : ''}? Y si prefieres apartarlo tú directo, aquí está la agenda: ${LIGA_AGENDA}`;
            await guardarSt({ agenda_pendiente: { fecha: acc.fecha, hora: acc.hora, email, motivo: 'error', intentos: 1, error: String(r.error || '').slice(0, 200), desde: ahora.toISOString() } });
            await log({ accion: 'agente_agenda_fallo', contact_id: e.contact_id, razon: r.error, detalle: { ...acc, intentos: r.intentos } });
            await escalarAlHumano(e.contact_id, { ...(e.salida as any), escalar: { si: true, motivo: `no se pudo agendar ${etiqueta}: ${r.error}` } });
            await avisoSistema({ tipo: 'sistema_agenda_fallo', nivel: 'urgente', clave: `sistema_agenda_fallo:${e.contact_id}:${acc.fecha}T${acc.hora}`, titulo: `El agente no pudo agendar a ${c?.nombre || 'un lead'} (${etiqueta})`, detalle: `Error: ${String(r.error || '').slice(0, 140)}. Ya le pidió disculpas, le ofreció horarios y la liga; el sistema reintenta a los 3, 15 y 60 min si no contesta.`, que_hacer: 'Abre el hilo. Si en 1 h el lead no eligió horario ni el reintento lo logró, confírmale tú la cita.', contact_id: e.contact_id, conversation_id: e.conversation_id, extra: { error: r.error, fecha: acc.fecha, hora: acc.hora } });
          } else {
            await log({ accion: 'agente_agendo', contact_id: e.contact_id, razon: `${acc.fecha} ${acc.hora}`, detalle: { booking_id: r.booking?.id || null, sin_meet: !!r.sinMeet, intentos: r.intentos } });
            await supabase.from('ti_perfil').upsert({ contact_id: e.contact_id, agente_estado: { ciclo: 1, toque: 0, agendada_at: ahora.toISOString() }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
            await callarSilencioPendiente(e.contact_id, 'la cita ya quedó agendada');
            if (r.sinMeet) {
              // La cita existe pero Google Calendar no dio liga: no se promete lo que no hay.
              mensaje = `${mensaje}\n\nLa liga de la videollamada te la mando por aquí en un momento.`;
              await escalarAlHumano(e.contact_id, { ...(e.salida as any), escalar: { si: true, motivo: `cita ${etiqueta} creada SIN liga de Meet (Google Calendar falló): mándale la liga` } });
              await avisoSistema({ tipo: 'sistema_agenda_sin_meet', nivel: 'urgente', clave: `sistema_agenda_sin_meet:${r.booking?.id || e.contact_id}`, titulo: `Cita de ${c?.nombre || 'un lead'} sin liga de Meet (${etiqueta})`, detalle: 'La cita se creó, pero Google Calendar no devolvió la liga de la videollamada. El agente le dijo al lead que se la manda en un momento.', que_hacer: 'Crea el evento en tu calendario y mándale la liga de Meet por el hilo.', contact_id: e.contact_id, conversation_id: e.conversation_id, extra: { booking_id: r.booking?.id || null } });
            }
          }
        }
      } else if (acc?.tipo === 'confirmar_asistencia' && e.conversation_id) {
        const { confirmoAsistencia } = await import('../../scheduling/reagendar-wa');
        await confirmoAsistencia(e.conversation_id, e.telefono).catch(() => false);
      }
      let r: any, plantillaUsada: string | null = null;
      if (e.plantilla) {
        const { enviarPlantilla } = await import('../../whatsapp/kapso-api');
        const pl = e.plantilla as any;
        plantillaUsada = pl.marketing || pl.utility;
        r = await enviarPlantilla(e.telefono, plantillaUsada!, 'es_MX', pl.params || []);
        mensaje = `[plantilla ${plantillaUsada}] ${pl.params?.[1] || mensaje}`;
      } else if (((e as any).adjuntos || []).length || (e as any).imagen_url) {
        // Con adjuntos (imagen / PDF / video, máximo dos). El texto va como pie del primero si cabe (≤1024) y el
        // primero es imagen o video; si no, primero el texto y luego los adjuntos. Cada pieza se espeja en el inbox.
        const { enviarMediaLink } = await import('../../whatsapp/kapso-api');
        let adjuntos: any[] = Array.isArray((e as any).adjuntos) && (e as any).adjuntos.length ? (e as any).adjuntos : [{ id: (e as any).imagen_id, tipo: 'image', url: (e as any).imagen_url, nombre: 'Imagen' }];
        // WhatsApp solo acepta JPG/PNG en imagen: lo demás se convierte y la galería se corrige.
        for (const a of adjuntos) {
          if (a.tipo === 'image' && !/\.(jpe?g|png)(\?|$)/i.test(String(a.url))) {
            const f = await asegurarFormatoWhatsApp(String(a.url));
            if (!f.error) { a.url = f.url; if (a.id && f.convertida) await supabase.from('ia_imagenes').update({ url: f.url }).eq('id', a.id); }
          }
        }
        const primero = adjuntos[0];
        const partesTxt = partirMensaje(mensaje);
        if (partesTxt.length > 1) {
          for (let k = 0; k < partesTxt.length; k++) { const rk = await enviarTexto(e.telefono, partesTxt[k]); const wk = rk?.messages?.[0]?.id || null; if (wk) await registrarMensaje({ kapsoMessageId: wk, telefono: e.telefono, direccion: 'saliente', tipo: 'text', cuerpo: partesTxt[k], status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, parte: k + 1, partes: partesTxt.length } }); }
          mensaje = '';
        }
        const pieEnPrimero = !!mensaje && mensaje.length <= 1024 && (primero.tipo === 'image' || primero.tipo === 'video');
        const espejo = async (wm: string | null, a: any, cuerpo: string | null) => { if (wm) await registrarMensaje({ kapsoMessageId: wm, telefono: e.telefono, direccion: 'saliente', tipo: a.tipo === 'document' ? 'document' : a.tipo, cuerpo, mediaUrl: a.url, status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, estado_agente: (e.salida as any)?.estado || null, recurso_id: a.id || null, nombre: a.nombre } }); };
        if (!pieEnPrimero && mensaje) {
          r = await enviarTexto(e.telefono, mensaje);
          const w1 = r?.messages?.[0]?.id || null;
          if (w1) await registrarMensaje({ kapsoMessageId: w1, telefono: e.telefono, direccion: 'saliente', tipo: 'text', cuerpo: mensaje, status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, estado_agente: (e.salida as any)?.estado || null } });
        }
        let ultimo: any = null;
        for (let k = 0; k < adjuntos.length; k++) {
          const a = adjuntos[k];
          const caption = k === 0 && pieEnPrimero ? mensaje : undefined;
          const nombreDoc = a.tipo === 'document' ? `${String(a.nombre || 'documento').replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]+/g, '').slice(0, 60)}${/\.pdf$/i.test(a.url) && !/\.pdf$/i.test(a.nombre || '') ? '.pdf' : ''}` : undefined;
          ultimo = await enviarMediaLink(e.telefono, a.tipo, a.url, nombreDoc, caption).catch((err: any) => ({ error: String(err?.message || err) }));
          const wk = ultimo?.messages?.[0]?.id || null;
          if (k === 0 && pieEnPrimero) { r = ultimo; await espejo(wk, a, mensaje); } else await espejo(wk, a, null);
          await contarUso(a.id);
        }
        if (!pieEnPrimero) mensaje = mensaje; else r = r || ultimo;
        if (!r) r = ultimo;
        if (pieEnPrimero) { /* el espejo del primero ya lleva el texto */ mensaje = ''; }
      } else if (partirMensaje(mensaje).length > 1) {
        // Dos (o más) mensajes seguidos, separados por --- : cada uno se manda y se espeja por separado.
        const partes = partirMensaje(mensaje);
        for (let k = 0; k < partes.length; k++) {
          r = await enviarTexto(e.telefono, partes[k]);
          const wk = r?.messages?.[0]?.id || null;
          if (wk) await registrarMensaje({ kapsoMessageId: wk, telefono: e.telefono, direccion: 'saliente', tipo: 'text', cuerpo: partes[k], status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, parte: k + 1, partes: partes.length, estado_agente: (e.salida as any)?.estado || null } });
        }
        mensaje = '';
      } else {
        r = await enviarTexto(e.telefono, mensaje);
      }
      const wamid = r?.messages?.[0]?.id || null;
      const conAdjuntos = ((e as any).adjuntos || []).length || (e as any).imagen_url || !mensaje;
      if (wamid && !conAdjuntos) await registrarMensaje({ kapsoMessageId: wamid, telefono: e.telefono, direccion: 'saliente', tipo: 'text', cuerpo: mensaje, status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, estado_agente: (e.salida as any)?.estado || null } });
      if (!mensaje) mensaje = e.mensaje;
      await supabase.from('ti_envios').update({ estado: 'enviado', enviado_at: ahora.toISOString(), kapso_message_id: wamid, mensaje, updated_at: ahora.toISOString(),
        // Marketing primero: a los 10 min se revisa si Meta la entregó; si no, sale la utility.
        ...(e.plantilla && (e.plantilla as any).marketing && plantillaUsada === (e.plantilla as any).marketing ? { fallback_at: new Date(ahora.getTime() + 10 * MS_MIN).toISOString(), fallback_estado: 'pendiente' } : {}) }).eq('id', e.id);
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

/* ══ EL CICLO DE CONTACTO (decisión del dueño, 2026-09-02) ══
   Un INTENTO válido es un mensaje real en horario (texto dentro de la ventana de 24 h) o una plantilla
   que WhatsApp marcó ENTREGADA (delivered/read). Entre intentos: al menos un día y en franja distinta
   (mañana / mediodía / tarde) para buscar el momento en que sí lee. Tres intentos válidos sin respuesta →
   llamada humana (ICP medio/alto) → sugerencia de descalificar (tarjeta; con rampa). Si RESPONDE, el ciclo
   se reinicia y el objetivo pasa a agendar demo o llamada en los siguientes tres mensajes nuestros. */
const franjaDe = (d: Date) => { const h = (d.getUTCHours() - 6 + 24) % 24; return h < 12 ? 'mañana' : h < 15 ? 'mediodía' : 'tarde'; };
type Intento = { at: string; tipo: 'texto' | 'plantilla'; franja: string; envio_id?: string | null; valido?: boolean | null };
/** Revisa cada intento: texto enviado = válido; plantilla = válida solo si WhatsApp la entregó; fallida o sin entregar en 24 h = no cuenta. */
async function validarIntentos(intentos: Intento[], ahora: Date): Promise<Intento[]> {
  const out: Intento[] = [];
  for (const i of intentos || []) {
    if (i.valido === true || i.valido === false) { out.push(i); continue; }
    if (!i.envio_id) { out.push({ ...i, valido: i.tipo === 'texto' }); continue; }
    const { data: e } = await supabase.from('ti_envios').select('estado, kapso_message_id, plantilla, fallback_estado').eq('id', i.envio_id).maybeSingle();
    if (!e) { out.push({ ...i, valido: false }); continue; }
    if (e.estado === 'vetado' || e.estado === 'reemplazado' || e.estado === 'fallido') { out.push({ ...i, valido: false }); continue; }
    if (e.estado !== 'enviado') { out.push({ ...i, valido: null }); continue; }           // todavía pendiente
    if (i.tipo === 'texto' || !e.plantilla) { out.push({ ...i, valido: true }); continue; }
    const { data: m } = e.kapso_message_id ? await supabase.from('wa_mensajes').select('status').eq('kapso_message_id', e.kapso_message_id).maybeSingle() : { data: null as any };
    const st = String(m?.status || '');
    if (st === 'delivered' || st === 'read') out.push({ ...i, valido: true });
    else if (st === 'failed' || e.fallback_estado === 'agotado') out.push({ ...i, valido: false });
    else if (ahora.getTime() - Date.parse(i.at) > 24 * H) out.push({ ...i, valido: false });   // «sent» sin entregar un día: no llegó
    else out.push({ ...i, valido: null });
  }
  return out;
}

export async function tocarSilencios(): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.agente_activo !== true) return { silencio: 'apagado' };
  const sombraGlobal = (cfg.agente_modo || 'sombra') === 'sombra';
  const ahora = new Date();
  const res: any = { toques: 0, sin_ventana: 0, llamadas: 0, tarjetas: 0, revisados: 0 };
  const { esHorarioLaboral, horaLocal, RESULTADOS_LLAMADA_L } = await import('./reglas');
  const laboral = esHorarioLaboral(ahora, cfg);

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
    // Una cita atorada por error nuestro la lleva reintentarAgendas; un lead CON cita vigente lo llevan los recordatorios. Aquí no se le insiste.
    if (st.agenda_pendiente?.motivo === 'error') continue;
    // Con cita vigente NO hay toques de silencio (decisión S3): lo llevan los recordatorios; si el lead pregunta, se le contesta normal.
    if (await proximaCita(cid).catch(() => null)) { res.con_cita = (res.con_cita || 0) + 1; continue; }
    const prueba = esPrueba(cfg, ultimo[cid].telefono);
    const sombra = sombraGlobal && !prueba;          // los de prueba viven el flujo completo
    if (!laboral && !prueba) continue;                // fuera de horario solo se mueven las pruebas
    const acel = prueba ? factorPrueba(cfg) : 1;      // reloj acelerado: horas → minutos
    res.revisados++;
    const base = Date.parse(st.base_at || ultimo[cid].enviado_at);
    // ¿Respondió después del último envío? Entonces no hay silencio (proponerRespuestas ya lo atiende).
    const { data: resp } = await supabase.from('ti_eventos').select('id').eq('contact_id', cid).eq('tipo', 'wa_entrante').gt('ocurrio_at', new Date(base).toISOString()).limit(1);
    if ((resp || []).length) continue;
    const horas = (ahora.getTime() - base) / H * acel;
    const m = mult(st.ciclo);
    const guardar = async (cambios: any) => supabase.from('ti_perfil').upsert({ contact_id: cid, agente_estado: { ...st, ...cambios }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
    // Intentos del ciclo: se revalidan (una plantilla cuenta solo cuando WhatsApp la entregó).
    const intentos: Intento[] = await validarIntentos(Array.isArray(st.intentos) ? st.intentos : [], ahora);
    if (JSON.stringify(intentos) !== JSON.stringify(st.intentos || [])) { st.intentos = intentos; await guardar({ intentos }); }
    const validos = intentos.filter(i => i.valido === true).length;
    const pendientesDeEntrega = intentos.filter(i => i.valido === null).length;
    st.toque = validos;                               // «toque» = intentos que sí llegaron
    const ultimoIntento = intentos[intentos.length - 1] || null;
    const desdeUltimoH = ultimoIntento ? (ahora.getTime() - Date.parse(ultimoIntento.at)) / H * acel : Infinity;
    // Reglas de espaciado: primer intento a las 20 h de nuestro último mensaje; los siguientes con ≥ 1 día
    // y en franja DISTINTA a la del anterior (en pruebas no se exige la franja). Nunca con una plantilla aún sin entregar.
    const franjaAhora = franjaDe(ahora);
    const puedeIntentar = intentos.length < 6 && pendientesDeEntrega === 0
      && (ultimoIntento ? desdeUltimoH >= 24 && (prueba || ultimoIntento.franja !== franjaAhora) : horas >= 20 * m);
    // La mejor hora del lead: si hoy todavía no llega, se espera (dentro del horario).
    if (!prueba && p.mejor_hora_wa != null && horaLocal(ahora) < p.mejor_hora_wa && p.mejor_hora_wa < cfg.horario.fin && !ultimoIntento) continue;

    // Antes del primer toque (y en cada ciclo) se evalúa: ICP + calidad de la conversación deciden
    // cuánto insistir: ICP bajo y charla pobre → 1 toque y a la tarjeta; medio → 2; alto → 3 + llamada.
    if (!st.eval || st.eval.ciclo !== st.ciclo) {
      const ev = await evaluarLead(cid);
      st.eval = { ...ev, ciclo: st.ciclo };
      await guardar({ eval: st.eval });
    }
    const maxToques = 3;                              // regla del dueño: tres intentos reales, sin importar el ICP
    if (validos < maxToques && puedeIntentar) {
      // ¿Ventana de 24 h abierta? (último mensaje del lead hace menos de 24 h)
      const { data: ult } = await supabase.from('ti_eventos').select('ocurrio_at').eq('contact_id', cid).eq('tipo', 'wa_entrante').order('ocurrio_at', { ascending: false }).limit(1);
      const ventana = (ult || []).length && ahora.getTime() - Date.parse(ult![0].ocurrio_at) < 24 * H;
      let par: { marketing: string | null; utility: string | null } | null = null;
      if (!ventana) {
        // Fuera de ventana solo salen PLANTILLAS: marketing primero, utility a los 10 min si Meta no la entregó.
        par = await parListo();
        if (!par) {
          res.sin_ventana++;
          await log({ accion: 'silencio_sin_plantilla', contact_id: cid, razon: `toque ${st.toque + 1} del ciclo ${st.ciclo}: las plantillas del agente aún no están aprobadas en Meta`, detalle: { horas: Math.round(horas) } });
          await guardar({ base_at: new Date(base).toISOString(), ultimo_intento_at: ahora.toISOString() });
          continue;
        }
      }
      const notaPlantilla = par ? ' ESTE TOQUE SALE COMO PLANTILLA: el mensaje debe ser UNA sola oración corta (máx. 200 caracteres), sin saludo ni nombre (la plantilla ya dice «Hola {nombre}»), que continúe la frase «Hola Ana, …»: el ángulo concreto para su giro.' : '';
      const nota = `TOQUE DE SILENCIO ${validos + 1} de ${maxToques} (intento ${intentos.length + 1}; franja ${franjaAhora}; ciclo ${st.ciclo}; ICP ${st.eval.icp}, conversación ${st.eval.conversacion}/100: ${st.eval.razones.join(', ')}): el lead NO ha respondido desde hace ${Math.round(horas)} h a tu último mensaje. Escribe un toque corto con un ÁNGULO DISTINTO a los ya usados: ${(st.angulos || []).join(' · ') || 'ninguno'}. Toque 1 = pregunta fácil de opciones + caso del giro; toque 2 = un valor concreto para su giro; toque 3 = último ángulo + «¿lo dejamos aquí?» honesto. responder=true salvo que haya razón para callar.${notaPlantilla}`;
      // Dos ticks del observador se pueden traslapar (cron + «enviar ya»/manual): si ya hay un toque de silencio
      // creado hace poco para este lead, este tick no mete otro (pasó: dos toques con 22 s de diferencia).
      const { data: reciente } = await supabase.from('ti_envios').select('id').eq('contact_id', cid).eq('origen', 'silencio').gt('created_at', new Date(ahora.getTime() - 30 * MS_MIN).toISOString()).limit(1);
      if ((reciente || []).length) continue;
      const d = await decidirTurno(cid, nota);
      if (!d.salida || !d.salida.mensaje) { await log({ accion: 'agente_error', contact_id: cid, razon: d.motivo || 'silencio sin mensaje' }); continue; }
      const ventanaMin = Math.max(0, Number(cfg.agente_veto_min ?? 10));
      const primer = String(c.nombre || 'Hola').trim().split(/\s+/)[0];
      const { data: envIns } = await supabase.from('ti_envios').insert({ contact_id: cid, conversation_id: ultimo[cid].conversation_id, telefono: ultimo[cid].telefono, origen: 'silencio', estado: 'pendiente', mensaje: d.salida.mensaje.trim(), imagen_id: d.salida.imagen?.id || null, imagen_url: d.salida.imagen?.url || null, adjuntos: d.salida.adjuntos || [], salida: { ...d.salida, toque: st.toque + 1, ciclo: st.ciclo }, sale_at: new Date(ahora.getTime() + ventanaMin * MS_MIN).toISOString(), modelo: MODELS.opus, costo_usd: d.costo,
        plantilla: par ? { marketing: par.marketing, utility: par.utility, params: [primer, paramAngulo(d.salida.mensaje)] } : null }).select('id').maybeSingle();
      const intento: Intento = { at: ahora.toISOString(), tipo: par ? 'plantilla' : 'texto', franja: franjaAhora, envio_id: envIns?.id || null, valido: null };
      await guardar({ base_at: new Date(base).toISOString(), intentos: [...intentos, intento], ultimo_toque_at: ahora.toISOString(), fase: 'reconectar', angulos: [...(st.angulos || []), d.salida.objetivo].slice(-9) });
      await log({ accion: 'agente_toque_silencio', contact_id: cid, contenido: d.salida.mensaje, razon: `intento ${intentos.length + 1} (${par ? 'plantilla' : 'texto'}, ${franjaAhora}) · válidos ${validos}/3 · ciclo ${st.ciclo}`, costo: d.costo });
      res.toques++;
      continue;
    }
    if (validos >= 3 && !st.llamada_at && desdeUltimoH >= 24 && st.eval?.icp === 'bajo') {
      // ICP bajo: no se gasta la llamada humana; la tarjeta decide.
      await guardar({ llamada_at: ahora.toISOString(), llamada_omitida: 'icp_bajo' });
      continue;
    }
    if (validos >= 3 && !st.llamada_at && desdeUltimoH >= 24) {
      if (!sombra) {
        const n = String(c.nombre || 'el lead').split(/\s+/)[0];
        await supabase.from('ti_tareas').insert({ contact_id: cid, company_id: c.company_id, owner_id: c.owner_id, familia: 'contactar', tipo: 'llamada', prioridad: 3, vence_at: ahora.toISOString(), origen: 'reloj', payload: {
          instruccion: `Llámale a ${n} — tres intentos reales del agente sin respuesta`, porque: `Tres intentos que sí llegaron (${intentos.filter(i => i.valido).map(i => i.tipo + ' ' + i.franja).join(', ')}) en días y franjas distintas, y silencio: la voz es lo único que falta antes de decidir si seguimos.`,
          nombre: c.nombre, whatsapp: c.whatsapp, reloj: 'silencio_llamada', sujeto: `c${st.ciclo}`, tipo_llamada: 'Llamada de rescate', resultados: RESULTADOS_LLAMADA_L,
          hechos: [['Toques del agente', '3', 'sin respuesta', 'ambar'], ['Silencio', `${Math.round(horas / 24)} días`, 'desde el último mensaje nuestro'], ['Interés estimado', p.etapa_interes || '—', `prob. ${Math.round((p.score_probabilidad || 0) * 100)}%`]],
        } });
      }
      await guardar({ llamada_at: ahora.toISOString() });
      await log({ accion: 'silencio_llamada_humana', contact_id: cid, razon: sombra ? 'sombra: no se creó la tarea' : 'tarea de rescate creada' });
      res.llamadas++;
      continue;
    }
    if (st.llamada_at && !st.tarjeta_id && (ahora.getTime() - Date.parse(st.llamada_at)) / H * acel >= 24) {
      const propuesta = st.eval?.icp === 'alto' && (st.eval?.conversacion || 0) >= 30 ? 'seguir' : 'descalificar';
      if (sombra) { await guardar({ tarjeta_id: 'sombra', tarjeta_at: ahora.toISOString() }); await log({ accion: 'silencio_tarjeta', contact_id: cid, razon: `sombra · propuesta ${propuesta}` }); res.tarjetas++; continue; }
      const n = String(c.nombre || 'el lead').split(/\s+/)[0];
      const { data: t } = await supabase.from('ti_tareas').insert({ contact_id: cid, company_id: c.company_id, owner_id: c.owner_id, familia: 'decidir', tipo: 'veredicto', prioridad: 4, vence_at: ahora.toISOString(), origen: 'reloj', payload: {
        instruccion: `${n}: ¿seguimos o lo dejamos?`, porque: 'Tres intentos reales (textos en horario o plantillas entregadas) en días y franjas distintas, la llamada, y sigue en silencio. Si no decides en 48 h, se aplica la propuesta del agente.',
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
    await guardar({ ciclo: (st.ciclo || 1) + 1, toque: 0, intentos: [], base_at: ahora, llamada_at: null, tarjeta_id: null, tarjeta_at: null, cerrado: null });
    await log({ accion: 'silencio_decision', contact_id: cid, razon: `seguir → ciclo ${(st.ciclo || 1) + 1}`, detalle: { ...detalle, por: userId } });
  } else if (resultado === 'descalificar') {
    await guardar({ cerrado: 'nutricion', cerrado_at: ahora });
    // Ciclo de vida «descalificado: no respondió»; el estatus sin_respuesta es lo que la secuencia mecánica de nutrición lee (sin IA).
    await supabase.from('contacts').update({ estatus_lead: 'sin_respuesta', estatus_lead_at: ahora, lifecycle_stage: 'descalificado', descarte_categoria: 'no_respondio' }).eq('id', cid).in('lifecycle_stage', ['lead', 'lead_calificado', 'oportunidad']);
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
/** REINTENTAR AGENDAS: una cita que falló por error nuestro se vuelve a intentar sola (3 min, 15 min, 60 min).
 *  Si queda, el lead recibe la confirmación por WhatsApp y la tarea del consultor se cierra; si el horario ya
 *  se ocupó, se le ofrecen otros; a la tercera falla se deja en manos del consultor (la tarea P1 ya existe). */
export async function reintentarAgendas(): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.agente_activo !== true) return { reintentos: 'apagado' };
  const ahora = new Date();
  const res: any = { revisadas: 0, agendadas: 0, ocupadas: 0, fallidas: 0 };
  const { data: perfiles } = await supabase.from('ti_perfil').select('contact_id, agente_estado').filter('agente_estado->agenda_pendiente->>motivo', 'eq', 'error').limit(20);
  const ESPERA_MIN = [3, 15, 60];
  const { enviarTexto } = await import('../../whatsapp/kapso-api');
  const { registrarMensaje } = await import('../../whatsapp/espejo');
  for (const p of perfiles || []) {
    const st: any = { ciclo: 1, toque: 0, ...((p.agente_estado as any) || {}) };
    const pend = st.agenda_pendiente; if (!pend?.fecha || !pend?.hora) continue;
    const intentos = Number(pend.intentos) || 1;
    const espera = ESPERA_MIN[Math.min(intentos - 1, ESPERA_MIN.length - 1)] * MS_MIN;
    if (intentos > ESPERA_MIN.length || ahora.getTime() - Date.parse(pend.ultimo_at || pend.desde || 0) < espera) continue;
    res.revisadas++;
    const cid = p.contact_id;
    const { data: c } = await supabase.from('contacts').select('nombre, email, whatsapp, giro, sucursales_interes, referrer_partner_id, companies(nombre)').eq('id', cid).maybeSingle();
    const email = String(pend.email || c?.email || '').trim().toLowerCase();
    const telefono = String(c?.whatsapp || '').replace(/\D/g, '');
    const guardarSt = (cambios: any) => supabase.from('ti_perfil').upsert({ contact_id: cid, agente_estado: { ...st, ...cambios }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
    if (!c || !email || !telefono) { await guardarSt({ agenda_pendiente: null }); continue; }
    // En sombra solo se actúa con los números de prueba (misma regla que despacharEnvios).
    if ((cfg.agente_modo || 'sombra') === 'sombra' && !esPrueba(cfg, telefono)) continue;
    // Si el lead ya contestó (eligió otro horario, o lo que sea) la conversación manda: el reintento se retira.
    const [{ data: hablo }, cita] = await Promise.all([
      supabase.from('ti_eventos').select('id').eq('contact_id', cid).eq('tipo', 'wa_entrante').gt('ocurrio_at', pend.desde || ahora.toISOString()).limit(1),
      proximaCita(cid).catch(() => null),
    ]);
    if ((hablo || []).length || cita) { await guardarSt({ agenda_pendiente: null }); continue; }
    const etiqueta = etiquetaHorario(pend.fecha, pend.hora);
    const r = await agendarDemo({ nombre: c.nombre || 'Lead', email, whatsapp: telefono, fecha: pend.fecha, hora: pend.hora, contactId: cid, empresa: (c as any)?.companies?.nombre || null, giro: c.giro || null, sucursales: c.sucursales_interes || null, partnerId: c.referrer_partner_id || null, notas: 'Agendada por el agente SDR (reintento automático tras un error técnico)' });
    let texto: string | null = null;
    if (r.ok) {
      texto = `Ya se destrabó: te dejé apartado el ${etiqueta} que habías elegido. Te llega la invitación a ${email}${r.sinMeet ? ' y la liga de la videollamada te la mando por aquí en un momento' : ' con la liga de la videollamada'}. Si prefieres otro horario, dime y lo muevo.`;
      await guardarSt({ agenda_pendiente: null, agendada_at: ahora.toISOString() });
      await callarSilencioPendiente(cid, 'la cita ya quedó agendada (reintento)');
      await avisoSistema({ tipo: r.sinMeet ? 'sistema_agenda_sin_meet' : 'sistema_agenda_recuperada', nivel: r.sinMeet ? 'urgente' : 'info', clave: `sistema_agenda_recuperada:${r.booking?.id || cid}`, titulo: `Cita de ${c.nombre || 'un lead'} recuperada sola (${etiqueta})`, detalle: `El reintento ${intentos + 1} la dejó agendada y el lead ya recibió la confirmación por WhatsApp.${r.sinMeet ? ' Falta la liga de Meet.' : ''}`, que_hacer: r.sinMeet ? 'Mándale la liga de Meet por el hilo.' : 'Nada: la tarea que abrió el fallo ya se cerró.', contact_id: cid, extra: { booking_id: r.booking?.id || null } });
      await log({ accion: 'agente_agendo', contact_id: cid, razon: `${pend.fecha} ${pend.hora} (reintento ${intentos + 1})`, detalle: { booking_id: r.booking?.id || null, sin_meet: !!r.sinMeet, reintento: true } });
      // La tarea P1 que abrió el fallo ya no hace falta (salvo que falte la liga de Meet).
      if (!r.sinMeet) await supabase.from('ti_tareas').update({ estado: 'hecha', resultado: 'agendo_el_agente', resultado_detalle: { automatica: true, razon: `El reintento automático dejó la cita del ${etiqueta}` }, hecho_at: ahora.toISOString(), updated_at: ahora.toISOString() }).eq('contact_id', cid).eq('estado', 'pendiente').eq('tipo', 'responder').filter('payload->>escalado_por_agente', 'eq', 'true');
      res.agendadas++;
    } else if (r.ocupado) {
      const otros = await horariosParaDemo({ max: 2 }).catch(() => []);
      texto = `Ya pude revisar la agenda y el ${etiqueta} se ocupó mientras lo intentaba, una disculpa. ${otros.length ? `¿Te queda ${otros.map(h => h.etiqueta).join(' o ')}?` : 'Dime qué día y si prefieres mañana o tarde, y te confirmo.'}`;
      await guardarSt({ agenda_pendiente: null });
      await log({ accion: 'agente_agenda_ocupado', contact_id: cid, razon: r.error, detalle: { ...pend, reintento: true } });
      res.ocupadas++;
    } else {
      await guardarSt({ agenda_pendiente: { ...pend, intentos: intentos + 1, ultimo_at: ahora.toISOString(), error: String(r.error || '').slice(0, 200) } });
      await log({ accion: 'agente_agenda_fallo', contact_id: cid, razon: r.error, detalle: { ...pend, intentos: intentos + 1, reintento: true } });
      if (intentos + 1 >= ESPERA_MIN.length) await avisoSistema({ tipo: 'sistema_agenda_agotada', nivel: 'urgente', clave: `sistema_agenda_agotada:${cid}:${pend.fecha}T${pend.hora}`, titulo: `Sigue sin poder agendarse la cita de ${c.nombre || 'un lead'} (${etiqueta})`, detalle: `Tres reintentos y el mismo error: ${String(r.error || '').slice(0, 140)}.`, que_hacer: 'Confírmale tú la cita desde la agenda y revisa el error con soporte técnico.', contact_id: cid, extra: { error: r.error } });
      res.fallidas++;
    }
    if (texto) {
      try {
        const env = await enviarTexto(telefono, texto);
        const wamid = env?.messages?.[0]?.id || env?.id || env?.message_id || null;
        if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono, direccion: 'saliente', tipo: 'text', cuerpo: texto, status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', reintento_agenda: true } });
        await supabase.from('ti_envios').insert({ contact_id: cid, telefono, origen: 'agenda', estado: 'enviado', mensaje: texto, salida: { estado: 'agendando', accion: { tipo: 'agendar', ...pend }, reintento: true }, sale_at: ahora.toISOString(), enviado_at: ahora.toISOString(), kapso_message_id: wamid });
      } catch (err: any) { await log({ accion: 'agente_error', contact_id: cid, razon: `reintento agenda, no salió el aviso: ${err?.message || err}` }); }
    }
  }
  return res;
}

export async function atenderCitas(): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.agente_activo !== true || !hasApiKey()) return { citas: 'apagado' };
  const ahora = new Date();
  const desde = new Date(Math.max(Date.parse(cfg.agente_citas_marca || 0) || 0, ahora.getTime() - 6 * 3600e3)).toISOString();
  const res: any = { atendidas: 0, saltadas: 0 };
  const sombraGlobal = (cfg.agente_modo || 'sombra') === 'sombra';
  const { data: evs } = await supabase.from('ti_eventos').select('contact_id, tipo, ocurrio_at, payload').in('tipo', ['cita_no_asistio', 'cita_cancelada']).gt('ocurrio_at', desde).not('contact_id', 'is', null).limit(30);
  for (const e of evs || []) {
    const cid = e.contact_id;
    const [{ data: c }, { data: p }, { data: previos }] = await Promise.all([
      supabase.from('contacts').select('lifecycle_stage, propiedades, archived_at').eq('id', cid).maybeSingle(),
      supabase.from('ti_perfil').select('silenciar_ia').eq('contact_id', cid).maybeSingle(),
      supabase.from('ti_eventos').select('id').eq('contact_id', cid).in('tipo', ['cita_no_asistio', 'cita_cancelada']).lt('ocurrio_at', e.ocurrio_at).gt('ocurrio_at', new Date(ahora.getTime() - 45 * 86400e3).toISOString()).limit(2),
    ]);
    if (!c || c.archived_at || (c.propiedades as any)?.demo_ti || p?.silenciar_ia || !['lead', 'oportunidad'].includes(c.lifecycle_stage)) { res.saltadas++; continue; }
    // Si el lead MOVIÓ la cita él mismo (liga de reagendar), la vieja queda «cancelada» pero hay una nueva vigente: no es una cancelación.
    if (e.tipo === 'cita_cancelada' && await proximaCita(cid).catch(() => null)) { res.saltadas++; continue; }
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
      await supabase.from('ti_envios').insert({ contact_id: cid, conversation_id: d.conversationId, telefono: d.telefono, origen: 'cita', estado: 'pendiente', mensaje: d.salida.mensaje.trim(), imagen_id: d.salida.imagen?.id || null, imagen_url: d.salida.imagen?.url || null, adjuntos: d.salida.adjuntos || [], salida: { ...d.salida, evento: e.tipo }, sale_at: new Date(ahora.getTime() + ventana * MS_MIN).toISOString(), modelo: MODELS.opus, costo_usd: d.costo });
      await log({ accion: 'agente_cita', contact_id: cid, razon: e.tipo, contenido: d.salida.mensaje, costo: d.costo });
      res.atendidas++;
    } catch (err: any) { await log({ accion: 'agente_error', contact_id: cid, razon: `cita: ${err?.message || err}` }); }
  }
  const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  await supabase.from('ti_config').update({ valor: { ...((data?.valor as any) || {}), agente_citas_marca: ahora.toISOString() } }).eq('id', 1);
  return res;
}


/** Marketing → 10 min → utility: si Meta no entregó la plantilla de marketing (131049/130472, pausada…), sale la utility. */
export async function revisarFallbacks(): Promise<any> {
  const ahora = new Date();
  const res: any = { entregadas: 0, utility: 0, sin_utility: 0 };
  const { data: pend } = await supabase.from('ti_envios').select('id, contact_id, telefono, kapso_message_id, plantilla, enviado_at').eq('fallback_estado', 'pendiente').lte('fallback_at', ahora.toISOString()).limit(20);
  // IMAGEN RECHAZADA por WhatsApp después de aceptarla (p. ej. 131053 WebP): el lead se quedó sin el mensaje.
  // Sale el texto solo, la imagen deja de ofrecerse y el dueño lo ve en la pestaña Sistema.
  try {
    const { data: conImg } = await supabase.from('ti_envios').select('id, contact_id, conversation_id, telefono, kapso_message_id, mensaje, imagen_id, adjuntos, salida').eq('estado', 'enviado').or('imagen_url.not.is.null,adjuntos.neq.[]').gte('enviado_at', new Date(ahora.getTime() - 90 * MS_MIN).toISOString()).limit(30);
    for (const e of conImg || []) {
      if ((e.salida as any)?.imagen_reintento) continue;
      // Cualquier pieza espejada de este envío que WhatsApp haya rechazado.
      const { data: piezas } = await supabase.from('wa_mensajes').select('status, error, cuerpo, metadata').filter('metadata->>envio_id', 'eq', e.id).eq('direccion', 'saliente');
      const fallida = (piezas || []).find((x: any) => x.status === 'failed');
      if (!fallida) continue;
      const m = fallida as any;
      const textoPerdido = !!m.cuerpo; // la pieza rechazada llevaba el texto como pie
      const recursoId = m.metadata?.recurso_id || e.imagen_id;
      if (!textoPerdido) { await supabase.from('ti_envios').update({ salida: { ...((e.salida as any) || {}), imagen_reintento: true, imagen_error: m.error || null }, updated_at: ahora.toISOString() }).eq('id', e.id); await marcarErrorImagen(recursoId, m.error || 'rechazada por WhatsApp'); await log({ accion: 'imagen_fallo', contact_id: e.contact_id, razon: m.error || 'failed', detalle: { envio_id: e.id, recurso_id: recursoId, texto_perdido: false } }); await avisoSistema({ tipo: 'sistema_imagen_rechazada', nivel: 'alerta', clave: `sistema_imagen_rechazada:${e.id}`, titulo: 'WhatsApp rechazó un adjunto del agente', detalle: `${String(m.error || '').slice(0, 160)}. El texto sí llegó; el adjunto dejó de ofrecerse al agente.`, que_hacer: 'Súbelo de nuevo en un formato admitido desde Recursos del agente (Próximos envíos) y quita el que falló.', contact_id: e.contact_id, conversation_id: e.conversation_id, extra: { recurso_id: recursoId } }); continue; }
      const { enviarTexto } = await import('../../whatsapp/kapso-api');
      const { registrarMensaje } = await import('../../whatsapp/espejo');
      const r2: any = await enviarTexto(e.telefono, e.mensaje).catch(() => null);
      const w2 = r2?.messages?.[0]?.id || null;
      if (w2) await registrarMensaje({ kapsoMessageId: w2, telefono: e.telefono, direccion: 'saliente', tipo: 'text', cuerpo: e.mensaje, status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, reenvio_sin_imagen: true } });
      await supabase.from('ti_envios').update({ salida: { ...((e.salida as any) || {}), imagen_reintento: true, imagen_error: m.error || null }, updated_at: ahora.toISOString() }).eq('id', e.id);
      await marcarErrorImagen(recursoId, m.error || 'rechazada por WhatsApp');
      await log({ accion: 'imagen_fallo', contact_id: e.contact_id, razon: m.error || 'failed', detalle: { envio_id: e.id, recurso_id: recursoId, reenviado: !!w2 } });
      await avisoSistema({ tipo: 'sistema_imagen_rechazada', nivel: 'alerta', clave: `sistema_imagen_rechazada:${e.id}`, titulo: 'WhatsApp rechazó una imagen del agente', detalle: `${String(m.error || '').slice(0, 160)}. El texto ya salió solo${w2 ? '' : ' (no se pudo reenviar)'}; la imagen dejó de ofrecerse al agente.`, que_hacer: 'Sube la imagen en JPG o PNG desde la Galería del agente (Próximos envíos) y quita la que falló.', contact_id: e.contact_id, conversation_id: e.conversation_id, extra: { imagen_id: e.imagen_id } });
      res.imagen_reenviada = (res.imagen_reenviada || 0) + 1;
    }
  } catch (err: any) { res.imagen_error = String(err?.message || err); }
  if (!(pend || []).length) return res;
  const { enviarPlantilla } = await import('../../whatsapp/kapso-api');
  const { registrarMensaje } = await import('../../whatsapp/espejo');
  for (const e of pend || []) {
    const { data: m } = e.kapso_message_id ? await supabase.from('wa_mensajes').select('status, error').eq('kapso_message_id', e.kapso_message_id).maybeSingle() : { data: null as any };
    const fallo = m?.status === 'failed';
    const entregada = m && ['delivered', 'read'].includes(m.status);
    // Sin noticia en 30 min se da por entregada (Meta a veces no reporta delivered).
    const sinNoticia = !m || (!fallo && !entregada && ahora.getTime() - Date.parse(e.enviado_at) > 30 * MS_MIN);
    if (entregada || sinNoticia) { await supabase.from('ti_envios').update({ fallback_estado: 'entregada', updated_at: ahora.toISOString() }).eq('id', e.id); res.entregadas++; continue; }
    if (!fallo) continue; // todavía sin estado: se revisa en el siguiente tick
    const pl = e.plantilla as any;
    if (!pl?.utility) { await supabase.from('ti_envios').update({ fallback_estado: 'sin_utility', updated_at: ahora.toISOString() }).eq('id', e.id); res.sin_utility++; continue; }
    try {
      const r: any = await enviarPlantilla(e.telefono, pl.utility, 'es_MX', pl.params || []);
      const wamid = r?.messages?.[0]?.id || null;
      if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: e.telefono, direccion: 'saliente', tipo: 'template', cuerpo: `[plantilla ${pl.utility}] ${pl.params?.[1] || ''}`, status: 'sent', autor: 'Agente Sacs', metadata: { origen: 'agente', envio_id: e.id, plantilla: pl.utility, fallback_de: pl.marketing } });
      await supabase.from('ti_envios').update({ fallback_estado: 'utility_enviada', updated_at: ahora.toISOString() }).eq('id', e.id);
      await log({ accion: 'plantilla_fallback', contact_id: e.contact_id, razon: `marketing falló (${String(m?.error || '').slice(0, 60)}) → utility ${pl.utility}` });
      res.utility++;
    } catch (err: any) {
      await supabase.from('ti_envios').update({ fallback_estado: 'error', updated_at: ahora.toISOString() }).eq('id', e.id);
      await log({ accion: 'agente_error', contact_id: e.contact_id, razon: `fallback utility: ${err?.message || err}` });
    }
  }
  return res;
}
