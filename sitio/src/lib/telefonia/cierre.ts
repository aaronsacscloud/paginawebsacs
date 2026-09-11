// LLAMADAS INTELIGENTES · El CIERRE CON IA (decisión del dueño, 11-sep-2026).
//
// Al colgar con una persona, la cabina daba 8 s para picar un chip y escribir
// un apunte, y la minuta llegaba después a la conversación sin regresar al
// item. Aquí la IA lee lo que se transcribió en vivo (las dos pistas) y deja
// TODO propuesto y, si nadie lo toca, hecho:
//   1. Resultado, apunte y siguiente paso.
//   2. Los COMPROMISOS con fecha («te marco el jueves a las 4», «vemos la demo
//      el martes»): se crean como reunión del CRM (bookings) con su evento de
//      Google Calendar, y la llamada además vuelve a la lista con hora.
//   3. Los DATOS que dijo (tiendas, giro, correo, puesto…): se llenan los
//      campos vacíos y se corrigen los que contradijo (datos-lead decide con la
//      confianza).
//   4. Lo que se PROMETIÓ MANDAR («te paso la info de facturación»): se busca
//      en `tel_conocimiento`; si ya se contestó antes, se arma el PDF y sale
//      por WhatsApp (mensaje normal si hay ventana de 24 h, plantilla si no, y
//      si no hay ni plantilla se queda esperando a que escriba). Si no hay con
//      qué, la cabina le pregunta al vendedor y lo que conteste se guarda para
//      la próxima.
import { supabase } from '../supabase';
import { anthropic, MODELS, hasApiKey } from '../ai/client';
import { dialogoOido, type Oido } from './oidos';
import { telefonoWhatsApp } from '../telefono';
import { aplicarDatos, CAMPOS_LEAD, type DatoLead } from '../crm/ti/datos-lead';
import { enviarMediaLink, enviarPlantilla, conLinea } from '../whatsapp/kapso-api';
import { ventanaEnLinea } from '../whatsapp/linea';
import { createCalendarEvent } from '../google-calendar';
import { marcarAgendado } from '../crm/estatus-live';
import { envioPDF, guardarEnvioPDF } from './envio-pdf';
import { zonaDeLada, ladaDe, instanteEnZona, fechaHoraEn } from './zonas';

const ahora = () => new Date().toISOString();
export const RESULTADOS_CIERRE = ['contesto', 'volver_llamar', 'dieron_datos', 'no_interesa', 'buzon'];
const TIPOS_REUNION: Record<string, string> = { demo: 'demo', seguimiento: 'seguimiento', cotizacion: 'cotizacion', 'llamada-discovery': 'llamada-discovery' };
const ESPERA_PROPUESTA_MS = 20000;   // si la IA no contesta en 20 s, el cierre sigue sin ella
const COLGADO_MS = 2 * 60000;        // un cierre a medias más viejo que esto se rescata

/** Fecha y hora de un compromiso como instante, en la hora DEL CONTACTO (su zona por la lada: «a las 10» en Tijuana son las 12 del centro), o null si no es real, ya pasó o está a más de 90 días. */
function instanteCompromiso(fecha: string, hora: string, zona = 'America/Mexico_City'): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const [h, mi] = hora.split(':').map(Number);
  if (h > 23 || mi > 59) return null;
  if (Number.isNaN(new Date(`${fecha}T12:00:00Z`).getTime()) || new Date(`${fecha}T12:00:00Z`).toISOString().slice(0, 10) !== fecha) return null;   // 2026-02-30 rueda de mes
  const d = instanteEnZona(fecha, hora, zona);
  const dt = d.getTime() - Date.now();
  return dt > 5 * 60000 && dt < 90 * 86400e3 ? d : null;
}

export type Compromiso = { tipo: 'llamada' | 'reunion'; fecha: string; hora: string; duracion_min?: number; motivo?: string; reunion_tipo?: string; confianza?: number };
export type Envio = { id?: string; tema: string; detalle?: string; conocimiento_id?: string | null; estado?: string };
export type Propuesta = {
  resultado: string; nota: string; siguiente_paso: string; no_llamar?: boolean; no_llamar_evidencia?: string;
  compromisos: Compromiso[]; datos: DatoLead[]; envios: Envio[]; etapa?: string | null;
};

const primerNombre = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || '';

/** Hoy en CDMX, con día de la semana: «el jueves» depende de qué día es. */
function hoyCdmx() {
  const d = new Date();
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const dia = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long' }).format(d);
  const hora = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { fecha, dia, hora };
}

/* ────────────────────────────────────────────────────────────────────────
   1 · PROPONER: la IA lee la llamada y deja la propuesta en el item.
   ──────────────────────────────────────────────────────────────────────── */
export async function proponerCierre(itemId: string): Promise<Propuesta | null> {
  // Candado: solo un latido lo propone.
  const { data: it } = await supabase.from('tel_sesion_items').update({ cierre_estado: 'proponiendo', updated_at: ahora() })
    .eq('id', itemId).is('cierre_estado', null).select('*').maybeSingle();
  if (!it) return null;
  try {
    const oido: Oido[] = Array.isArray(it.oido) ? it.oido : [];
    const dialogo = dialogoOido(oido);
    const delContacto = oido.filter(o => o.final && o.quien !== 'vendedor').map(o => o.texto).join(' ');
    if (!hasApiKey() || delContacto.trim().length < 25) {
      await supabase.from('tel_sesion_items').update({ cierre_estado: 'sin_datos', cierre_ia: { motivo: !hasApiKey() ? 'sin llave de IA' : 'la transcripción no alcanzó', generado_at: ahora() }, updated_at: ahora() }).eq('id', itemId);
      return null;
    }

    const { data: s } = await supabase.from('tel_sesiones').select('presentacion_nombre, presentacion_motivo, owner_id').eq('id', it.sesion_id).maybeSingle();
    const { data: c } = it.contact_id ? await supabase.from('contacts').select('nombre, apellido, email, puesto, giro, sucursales_interes, plan_interes, lifecycle_stage, companies(nombre, nombre_comercial, giro, sucursales, ciudad)').eq('id', it.contact_id).maybeSingle() : { data: null as any };
    const { data: conocimiento } = await supabase.from('tel_conocimiento').select('id, tema, claves').eq('estado', 'activo').order('veces_usado', { ascending: false }).limit(80);
    const hoy = hoyCdmx();
    const emp: any = c?.companies;

    const prompt = `Eres el asistente de cierre de llamadas del CRM de Sacs (software para tiendas de moda en México). Un vendedor acaba de colgar. Abajo va la TRANSCRIPCIÓN EN VIVO (imperfecta: es reconocimiento de voz) con quién dijo qué.
Tu trabajo: dejar la llamada cerrada en el CRM. Responde SOLO un JSON válido con esta forma exacta:
{
 "resultado": "contesto|volver_llamar|dieron_datos|no_interesa|buzon",
 "nota": "2 a 4 renglones: qué quería, qué se le dijo, cómo quedó. En español neutro, sin adornos.",
 "siguiente_paso": "UNA frase imperativa con lo que sigue",
 "no_llamar": false,
 "no_llamar_evidencia": "cita textual de dónde lo pidió, o vacío",
 "compromisos": [{"tipo":"llamada|reunion","fecha":"YYYY-MM-DD","hora":"HH:MM","duracion_min":15,"motivo":"…","reunion_tipo":"demo|seguimiento|cotizacion|llamada-discovery","confianza":0.0-1.0}],
 "datos": [{"campo":"…","valor":"…","confianza":0.0-1.0,"evidencia":"cita textual corta","corrige":false}],
 "envios": [{"tema":"…","detalle":"qué pidió exactamente","conocimiento_id":"uuid o null"}],
 "etapa": "lead_calificado|null"
}
REGLAS:
- "resultado": volver_llamar si pidió que se le marque después; dieron_datos si dio datos pero no hubo compromiso; no_interesa si lo dijo claramente; buzon si en realidad era una grabadora; si no, contesto.
- "compromisos": SOLO los que tengan fecha u hora dichas o deducibles («el jueves», «mañana a las 4», «la otra semana» = mismo día de la semana + 7). Hoy es ${hoy.dia} ${hoy.fecha}, ${hoy.hora} (hora del centro de México). Si dijo hora sin fecha, es hoy si aún no pasa y mañana si ya pasó. Sin hora: 10:00. «Te marco» = llamada (15 min, reunion_tipo llamada-discovery); «vemos el sistema / una demo / me lo enseñas» = reunion (60 min, demo). Fines de semana pasan al lunes. Nada de compromisos vagos («luego te busco»).
- "datos": solo lo dicho EXPLÍCITAMENTE. Campos posibles: ${CAMPOS_LEAD.join(', ')}. «sucursales» es un número; «empresa» es el nombre de su marca/tienda; «giro» qué vende. Si CONTRADICE lo que el CRM tiene, "corrige": true.
- "envios": TODO lo que el vendedor prometió mandar (información, precios, un PDF, un video, una liga, cómo funciona algo). Si el tema coincide con uno de LO QUE YA SABEMOS RESPONDER, pon su id en conocimiento_id; si no, null.
- "etapa": lead_calificado solo si quedó claro que es dueño/decisor de una tienda de moda con interés real; si no, null.
- "no_llamar": true solo si pidió que no se le vuelva a llamar, y entonces "no_llamar_evidencia" trae sus palabras.

LO QUE EL CRM YA TIENE: contacto «${[c?.nombre, c?.apellido].filter(Boolean).join(' ') || it.nombre || '?'}», puesto ${c?.puesto || '?'}, correo ${c?.email || 'ninguno'}, giro ${c?.giro || emp?.giro || '?'}, tiendas ${c?.sucursales_interes ?? emp?.sucursales ?? '?'}, empresa ${emp?.nombre_comercial || emp?.nombre || it.empresa || '?'}, ciudad ${emp?.ciudad || '?'}, etapa ${c?.lifecycle_stage || '?'}.
QUIÉN LLAMÓ: ${s?.presentacion_nombre || 'el vendedor'}${s?.presentacion_motivo ? ` (${s.presentacion_motivo})` : ''}.
LO QUE YA SABEMOS RESPONDER (id · tema · palabras clave):
${(conocimiento || []).map(k => `${k.id} · ${k.tema} · ${(k.claves || []).join(', ')}`).join('\n') || '(nada todavía)'}

TRANSCRIPCIÓN:
${dialogo.slice(0, 9000)}`;

    const r = await anthropic.messages.create({ model: MODELS.sonnet, max_tokens: 1400, messages: [{ role: 'user', content: prompt }] }, { timeout: ESPERA_PROPUESTA_MS - 2000, maxRetries: 0 });
    const texto = (r.content[0] as any)?.text || '';
    const m = texto.match(/\{[\s\S]*\}/);
    const p: any = m ? JSON.parse(m[0]) : null;
    if (!p) throw new Error('la IA no devolvió JSON');

    const conocidos = new Set((conocimiento || []).map(k => k.id));
    const propuesta: Propuesta = {
      resultado: RESULTADOS_CIERRE.includes(String(p.resultado)) ? String(p.resultado) : 'contesto',
      nota: String(p.nota || '').slice(0, 1500),
      siguiente_paso: String(p.siguiente_paso || '').slice(0, 300),
      // No llamar es para siempre: solo con sus palabras como evidencia (la voz mal transcrita no basta).
      no_llamar: p.no_llamar === true && String(p.no_llamar_evidencia || '').trim().length > 10,
      no_llamar_evidencia: String(p.no_llamar_evidencia || '').slice(0, 200),
      // Compromisos: fecha real, en el futuro y a menos de 90 días. Una fecha del pasado volvería a marcar al contacto al instante.
      compromisos: (Array.isArray(p.compromisos) ? p.compromisos : []).filter((x: any) => x && instanteCompromiso(String(x.fecha), String(x.hora), zonaDeLada(it.lada || ladaDe(it.telefono))) && Number(x.confianza ?? 1) >= 0.6)
        .map((x: any) => ({ tipo: x.tipo === 'reunion' ? 'reunion' : 'llamada', fecha: x.fecha, hora: x.hora, duracion_min: Math.min(Math.max(Number(x.duracion_min) || (x.tipo === 'reunion' ? 60 : 15), 15), 240), motivo: String(x.motivo || '').slice(0, 200), reunion_tipo: TIPOS_REUNION[String(x.reunion_tipo)] || (x.tipo === 'reunion' ? 'demo' : 'llamada-discovery'), confianza: Number(x.confianza ?? 1) })).slice(0, 3),
      datos: (Array.isArray(p.datos) ? p.datos : []).filter((d: any) => d && (CAMPOS_LEAD as readonly string[]).includes(String(d.campo)) && String(d.valor || '').trim()).slice(0, 12),
      envios: (Array.isArray(p.envios) ? p.envios : []).filter((e: any) => e && String(e.tema || '').trim())
        .map((e: any) => ({ tema: String(e.tema).slice(0, 120), detalle: String(e.detalle || '').slice(0, 300), conocimiento_id: conocidos.has(String(e.conocimiento_id)) ? String(e.conocimiento_id) : null })).slice(0, 5),
      etapa: p.etapa === 'lead_calificado' ? 'lead_calificado' : null,
    };

    // Los envíos nacen como filas: «listo» si ya sabemos qué mandar, «falta» si hay que preguntarle al vendedor.
    const tel = telefonoWhatsApp(it.telefono) || it.telefono;
    const filas = propuesta.envios.map(e => ({ item_id: it.id, contact_id: it.contact_id, conversation_id: it.conversation_id, telefono: tel, tema: e.tema, detalle: e.detalle || null, conocimiento_id: e.conocimiento_id, estado: e.conocimiento_id ? 'listo' : 'falta' }));
    const { data: creados } = filas.length ? await supabase.from('tel_envios').insert(filas).select('id, tema, estado, conocimiento_id') : { data: [] as any[] };
    propuesta.envios = (creados || []).map(x => ({ id: x.id, tema: x.tema, estado: x.estado, conocimiento_id: x.conocimiento_id }));

    await supabase.from('tel_sesion_items').update({ cierre_estado: 'propuesto', cierre_ia: { propuesta, generado_at: ahora() }, updated_at: ahora() }).eq('id', itemId);
    return propuesta;
  } catch (e: any) {
    await supabase.from('tel_sesion_items').update({ cierre_estado: 'sin_datos', cierre_ia: { motivo: String(e?.message || e).slice(0, 200), generado_at: ahora() }, updated_at: ahora() }).eq('id', itemId);
    return null;
  }
}

/** ¿Puede la sesión seguir sola? No mientras la IA piensa (tope 20 s) ni mientras haya preguntas abiertas para el vendedor. */
export function cierreListo(it: any): boolean {
  const est = it?.cierre_estado;
  if (!est || est === 'proponiendo') return Date.now() - new Date(it.terminado_at || 0).getTime() > ESPERA_PROPUESTA_MS;
  if (est === 'propuesto') {
    // Con preguntas abiertas para el vendedor se espera, pero no para siempre: a los 90 s lo abierto se vuelve tarea.
    const abiertas = (it.cierre_ia?.propuesta?.envios || []).some((e: any) => e.estado === 'falta');
    if (!abiertas) return true;
    const desdePropuesta = Date.now() - new Date(it.cierre_ia?.generado_at || 0).getTime();
    // Si el vendedor está escribiendo (la cabina late cada ~20 s mientras hay texto), se le espera; nunca más de 5 min.
    const escribiendo = it.cierre_ia?.escribiendo_at && Date.now() - new Date(it.cierre_ia.escribiendo_at).getTime() < 45000;
    if (escribiendo) return desdePropuesta > 5 * 60000;
    return desdePropuesta > 90000;
  }
  return true;
}

/* ────────────────────────────────────────────────────────────────────────
   2 · APLICAR: lo propuesto se vuelve hechos en el CRM.
   ──────────────────────────────────────────────────────────────────────── */
export async function aplicarCierre(itemId: string, o: { userId?: string | null; autor?: string | null; ajustes?: { resultado?: string; nota?: string }; rescate?: boolean } = {}): Promise<{ ok: boolean; hecho: string[] }> {
  // Candado: solo uno aplica. En rescate también se retoma un «aplicando» que se quedó a medias (cada paso es idempotente).
  const { data: it } = await supabase.from('tel_sesion_items').update({ cierre_estado: 'aplicando', updated_at: ahora() })
    .eq('id', itemId).in('cierre_estado', o.rescate ? ['propuesto', 'aplicando'] : ['propuesto']).select('*').maybeSingle();
  if (!it) return { ok: false, hecho: [] };
  const p: Propuesta = it.cierre_ia?.propuesta;
  const hecho: string[] = [];
  const t = ahora();
  try {
    // ── Resultado y apunte (lo que el vendedor ajustó manda) ──────────────
    // El apunte del vendedor (si escribió) ya está en la conversación por el API; aquí va el de la IA.
    const resultado = o.ajustes?.resultado || it.resultado || p.resultado;
    const notaIA = [p.nota, p.siguiente_paso ? `Siguiente paso: ${p.siguiente_paso}` : null].filter(Boolean).join('\n');
    const notaVendedor = o.ajustes?.nota || it.nota || '';
    await supabase.from('tel_sesion_items').update({ resultado, nota: [notaVendedor, notaIA].filter(Boolean).join('\n— IA —\n'), updated_at: t }).eq('id', itemId);
    if (it.call_sid) await supabase.from('wa_llamadas').update({ resultado, siguiente_paso: p.siguiente_paso || null }).eq('call_id', it.call_sid);
    const { data: notaYa } = it.conversation_id && notaIA ? await supabase.from('wa_notas').select('id').eq('conversation_id', it.conversation_id).contains('metadata', { sesion_item: itemId }).limit(1).maybeSingle() : { data: null };
    if (it.conversation_id && notaIA && !notaYa) {
      await supabase.from('wa_notas').insert({
        conversation_id: it.conversation_id, contact_id: it.contact_id || null, autor: 'Cierre con IA',
        texto: `📝 **Cierre de la llamada**\n\n${notaIA}`,
        metadata: { tipo: 'nota_llamada', nota_llamada: it.call_sid || null, sesion_item: itemId, autor_id: o.userId || null, ia: true },
      }).then(() => {}, () => {});
    }
    hecho.push('apunte');
    if (it.contact_id) {
      const upC: any = { updated_at: t };
      if (p.siguiente_paso) upC.proximo_paso = p.siguiente_paso.slice(0, 300);
      if (p.no_llamar) upC.no_llamar = true;
      await supabase.from('contacts').update(upC).eq('id', it.contact_id);
      if (p.no_llamar) {
        await supabase.from('activities').insert({ contact_id: it.contact_id, tipo: 'opt_out', titulo: 'Pidió que no se le llame (en la llamada)', descripcion: p.no_llamar_evidencia || null, automatico: true, metadata: { regla: 'cierre_llamada', actor: 'ia', sesion_item: itemId } }).then(() => {}, () => {});
        hecho.push('no volver a llamar');
      }
    }

    // ── Datos dichos → campos del CRM (datos-lead decide llenar/corregir) ──
    if (it.contact_id && p.datos?.length) {
      const { cambios } = await aplicarDatos(it.contact_id, p.datos, { fuente: 'llamada', conversation_id: it.conversation_id });
      if (cambios.length) hecho.push(`${cambios.length} dato${cambios.length > 1 ? 's' : ''}: ${cambios.map(c => c.campo).join(', ')}`);
    }
    // ── Etapa: solo se sube, nunca se baja ────────────────────────────────
    if (it.contact_id && p.etapa === 'lead_calificado') {
      const { data: c } = await supabase.from('contacts').select('lifecycle_stage').eq('id', it.contact_id).maybeSingle();
      if (c?.lifecycle_stage === 'lead') {
        await supabase.from('contacts').update({ lifecycle_stage: 'lead_calificado', updated_at: t }).eq('id', it.contact_id);
        await supabase.from('activities').insert({ contact_id: it.contact_id, tipo: 'etapa_cambio', titulo: 'Calificado en la llamada', automatico: true, metadata: { regla: 'cierre_llamada', actor: 'ia' } }).then(() => {}, () => {});
        hecho.push('etapa: lead calificado');
      }
    }

    // ── Compromisos → reunión + Google Calendar + la lista ────────────────
    for (const cp of p.compromisos || []) {
      const r = await crearCompromiso(it, cp, o.userId || null);
      if (r) hecho.push(r);
    }

    // ── Envíos listos → PDF + WhatsApp ────────────────────────────────────
    const { data: envios } = await supabase.from('tel_envios').select('*').eq('item_id', itemId).in('estado', ['listo', 'falta']);
    for (const e of envios || []) {
      if (e.estado === 'listo') { const r = await mandarEnvio(e.id); if (r) hecho.push(r); }
      else {
        // Nadie contestó qué mandar: queda como tarea para que no se pierda.
        await supabase.from('tel_envios').update({ estado: 'omitido', motivo: 'sin respuesta del vendedor; quedó como tarea', updated_at: t }).eq('id', e.id);
        await tareaMandarAMano(e, null, `En la llamada quedaste de mandárselo${e.detalle ? `: «${e.detalle}»` : ''}. Nadie dijo qué mandar.`, o.userId || null);
        hecho.push(`tarea: mandar ${e.tema}`);
      }
    }

    await cerrarItem(itemId, { aplicado_at: ahora(), hecho, por: o.userId ? 'vendedor' : 'auto' });
    return { ok: true, hecho };
  } catch (e: any) {
    await cerrarItem(itemId, { aplicado_at: ahora(), hecho, error: String(e?.message || e).slice(0, 200) });
    return { ok: false, hecho };
  }
}

/** Cierra sobre el `cierre_ia` FRESCO: los envíos ya escribieron ahí sus estados y la foto del claim los pisaría. */
async function cerrarItem(itemId: string, extra: Record<string, any>) {
  const { data: fresh } = await supabase.from('tel_sesion_items').select('cierre_ia').eq('id', itemId).maybeSingle();
  await supabase.from('tel_sesion_items').update({ cierre_estado: 'aplicado', cierre_ia: { ...(fresh?.cierre_ia || {}), ...extra }, updated_at: ahora() }).eq('id', itemId);
}

/** Rescate: cierres que se quedaron a medias (la IA tardó más que la espera, o la función murió aplicando). Lo llama el latido; barato y acotado. */
let ultimoRescate = 0;
export async function rescatarCierres(): Promise<void> {
  if (Date.now() - ultimoRescate < 30000) return;
  ultimoRescate = Date.now();
  try {
    const viejo = new Date(Date.now() - COLGADO_MS).toISOString();
    const { data } = await supabase.from('tel_sesion_items').select('id, cierre_estado').eq('estado', 'hecho').in('cierre_estado', ['proponiendo', 'propuesto', 'aplicando']).lt('updated_at', viejo).order('updated_at').limit(5);
    for (const it of data || []) {
      if (it.cierre_estado === 'proponiendo') {
        // La IA nunca contestó (o murió la función): se vuelve a pedir una vez.
        await supabase.from('tel_sesion_items').update({ cierre_estado: null, updated_at: ahora() }).eq('id', it.id).eq('cierre_estado', 'proponiendo');
        const p = await proponerCierre(it.id);
        if (!p) continue;
      }
      await aplicarCierre(it.id, { userId: null, rescate: true });
    }
    // Y los PDF que esperaban a que el cliente escribiera y nunca escribió: al vendedor, a mano.
    const { data: viejos } = await supabase.from('tel_envios').select('*').eq('estado', 'pendiente_ventana').lt('created_at', new Date(Date.now() - 7 * 86400e3).toISOString()).limit(5);
    for (const e of viejos || []) await caducarEnvio(e);
  } catch { /* el latido no se detiene por esto */ }
}

async function caducarEnvio(e: any) {
  const { data: ok } = await supabase.from('tel_envios').update({ estado: 'omitido', motivo: 'pasaron más de 7 días esperando respuesta', updated_at: ahora() }).eq('id', e.id).eq('estado', 'pendiente_ventana').select('id').maybeSingle();
  if (ok) { await marcarEnvioEnItem(e.item_id, e.id, 'omitido'); await tareaMandarAMano(e, e.pdf_url || null, 'Pasaron 7 días sin que contestara el aviso: el PDF no salió solo.'); }
}

/** Una reunión del CRM (con Google Calendar si el host lo tiene conectado) y, si es llamada, la vuelta a la lista con hora. */
async function crearCompromiso(it: any, cp: Compromiso, userId: string | null): Promise<string | null> {
  const { data: s } = await supabase.from('tel_sesiones').select('owner_id').eq('id', it.sesion_id).maybeSingle();
  const hostId = s?.owner_id || userId;
  if (!hostId) return null;
  const { data: tipo } = await supabase.from('event_types').select('id, nombre, duracion_minutos').eq('slug', cp.reunion_tipo || (cp.tipo === 'reunion' ? 'demo' : 'llamada-discovery')).maybeSingle();
  if (!tipo) return null;
  // La hora que dijo el contacto es en SU zona; la reunión se guarda en la del vendedor (centro), que es la que ve la agenda.
  const zonaContacto = zonaDeLada(it.lada || ladaDe(it.telefono));
  const cuando = instanteCompromiso(cp.fecha, cp.hora, zonaContacto);
  if (!cuando) return null;
  const { fecha, hora } = fechaHoraEn('America/Mexico_City', cuando);
  const dur = Math.min(Math.max(Number(cp.duracion_min) || tipo.duracion_minutos || 30, 15), 240);
  const [h, mi] = hora.split(':').map(Number);
  const finMin = Math.min(h * 60 + mi + dur, 23 * 60 + 59);   // nunca pasa de medianoche: el fin no puede ir antes del inicio
  const horaFin = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
  const suHora = zonaContacto === 'America/Mexico_City' || hora === cp.hora ? '' : ` (${cp.hora} de allá)`;
  const { data: c } = it.contact_id ? await supabase.from('contacts').select('email, nombre, apellido').eq('id', it.contact_id).maybeSingle() : { data: null as any };
  const nombre = [c?.nombre, c?.apellido].filter(Boolean).join(' ') || it.nombre || it.telefono;
  const asunto = cp.tipo === 'llamada' ? `Llamada con ${primerNombre(nombre)}${cp.motivo ? `: ${cp.motivo}` : ''}` : `${tipo.nombre} con ${primerNombre(nombre)}${cp.motivo ? `: ${cp.motivo}` : ''}`;

  // Idempotencia: la misma persona, misma fecha y hora, no se agenda dos veces.
  const { data: ya } = await supabase.from('bookings').select('id').eq('contact_id', it.contact_id || '00000000-0000-0000-0000-000000000000').eq('fecha', fecha).eq('hora_inicio', hora).limit(1).maybeSingle();
  if (ya) return null;

  const { data: bk, error: errBk } = await supabase.from('bookings').insert({
    event_type_id: tipo.id, host_id: hostId, consultor_id: hostId, fecha, hora_inicio: hora, hora_fin: horaFin,
    timezone_host: 'America/Mexico_City', timezone_invitado: zonaContacto,
    invitee_nombre: nombre, invitee_email: c?.email || null, invitee_empresa: it.empresa || null, invitee_notas: cp.motivo || null,
    company_id: it.company_id || null, contact_id: it.contact_id || null, asunto, estado: 'agendada', origen: 'llamada',
    estado_hist: [{ estado: 'agendada', at: ahora(), por: 'Cierre con IA' }],
  }).select('id').maybeSingle();
  if (!bk) return `no se pudo agendar ${cp.tipo === 'llamada' ? 'la llamada' : tipo.nombre.toLowerCase()} del ${fecha}: ${errBk?.message || 'error al guardar'}`;

  let google = '';
  try {
    const { data: conexion } = await supabase.from('calendar_connections').select('email').eq('team_member_id', hostId).eq('provider', 'google').eq('activo', true).maybeSingle();
    if (conexion) {
      const ev = await createCalendarEvent(hostId, { summary: asunto, description: [it.empresa, cp.motivo, `Teléfono: ${it.telefono}`].filter(Boolean).join('\n'), startDateTime: `${fecha}T${hora}:00`, endDateTime: `${fecha}T${horaFin}:00`, timezone: 'America/Mexico_City', attendeeEmail: c?.email || undefined });
      if (ev?.eventId) { await supabase.from('bookings').update({ google_event_id: ev.eventId, google_meet_link: ev.meetLink || null }).eq('id', bk.id); google = ' (en Google Calendar)'; }
    }
  } catch { /* la reunión ya quedó en el CRM */ }

  if (it.contact_id) {
    await marcarAgendado(it.contact_id).catch(() => {});
    await supabase.from('contacts').update({ next_followup: fecha, updated_at: ahora() }).eq('id', it.contact_id);
    if (cp.tipo === 'reunion') {
      const { data: cl } = await supabase.from('contacts').select('lifecycle_stage').eq('id', it.contact_id).maybeSingle();
      if (cl && ['lead', 'lead_calificado'].includes(cl.lifecycle_stage)) {
        await supabase.from('contacts').update({ lifecycle_stage: 'oportunidad' }).eq('id', it.contact_id);
        await supabase.from('activities').insert({ contact_id: it.contact_id, tipo: 'etapa_cambio', titulo: 'Promovido a Oportunidad: agendó reunión en la llamada', automatico: true, metadata: { regla: 'booking_creado', actor: 'ia' } }).then(() => {}, () => {});
      }
    }
  }
  if (cp.tipo === 'llamada') {
    // Vuelve a la lista a esa hora (si la sesión sigue viva la marca sola) y a Mi día del vendedor.
    const { reprogramar } = await import('./marcador');
    await reprogramar(it, 0, cp.motivo || 'lo pidió en la llamada', cuando);
    await supabase.from('ti_tareas').insert({
      contact_id: it.contact_id, company_id: it.company_id, owner_id: hostId, familia: 'llamar', tipo: 'llamada', prioridad: 1, vence_at: cuando.toISOString(), origen: 'evento',
      payload: { instruccion: `${primerNombre(nombre)}: le prometiste llamarle a las ${hora}${suHora}`, porque: cp.motivo ? `Quedaron en: ${cp.motivo}.` : 'Lo pidió en la llamada.', nombre, whatsapp: it.telefono, booking_id: bk.id, resultados: { contesto: 'Contestó', buzon: 'Buzón', no_contesto: 'No contestó', reagendar: 'Pidió otra hora' } },
    }).then(() => {}, () => {});
  }
  return `${cp.tipo === 'llamada' ? 'llamada' : tipo.nombre.toLowerCase()} el ${fecha} a las ${hora}${suHora}${google}`;
}

/* ────────────────────────────────────────────────────────────────────────
   3 · ENVÍOS: lo prometido sale por WhatsApp, con su PDF.
   ──────────────────────────────────────────────────────────────────────── */

/** El vendedor contestó qué mandar: se guarda para la próxima y se manda ahora. */
export async function responderEnvio(envioId: string, texto: string, o: { userId?: string | null; autor?: string | null } = {}): Promise<{ ok: boolean; motivo: string }> {
  const { data: e } = await supabase.from('tel_envios').select('*').eq('id', envioId).maybeSingle();
  if (!e) return { ok: false, motivo: 'no existe el envío' };
  if (!['falta', 'omitido', 'sin_via', 'fallo'].includes(e.estado)) return { ok: false, motivo: e.estado === 'enviado' ? 'ese ya se mandó' : 'ese envío ya va en camino' };
  const cuerpo = String(texto || '').trim();
  if (cuerpo.length < 10) return { ok: false, motivo: 'escribe al menos una línea' };
  const claves = Array.from(new Set(`${e.tema} ${e.detalle || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{4,}/g) || [])).slice(0, 12);
  // Candado: si dos pestañas contestan a la vez, solo la primera se lleva el envío (la segunda ve otro estado y se retira).
  const { data: mio } = await supabase.from('tel_envios').update({ estado: 'listo', updated_at: ahora() }).eq('id', envioId).eq('estado', e.estado).select('id');
  if (!mio?.length) return { ok: false, motivo: 'ese envío ya lo contestó alguien más' };
  const { data: k } = await supabase.from('tel_conocimiento').insert({ tema: e.tema, claves, texto: cuerpo, origen: 'vendedor', estado: 'activo' }).select('id').maybeSingle();
  await supabase.from('tel_envios').update({ conocimiento_id: k?.id || null, updated_at: ahora() }).eq('id', envioId);
  // Se refleja en la propuesta del item para que la cabina deje de preguntar.
  if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'listo');
  const r = await mandarEnvio(envioId);
  return { ok: !!r, motivo: r || 'no se pudo mandar' };
}

export async function omitirEnvio(envioId: string): Promise<void> {
  const { data: e } = await supabase.from('tel_envios').update({ estado: 'omitido', motivo: 'el vendedor dijo que no', updated_at: ahora() }).eq('id', envioId).select('item_id').maybeSingle();
  if (e?.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'omitido');
}

async function marcarEnvioEnItem(itemId: string, envioId: string, estado: string) {
  const { data: it } = await supabase.from('tel_sesion_items').select('cierre_ia').eq('id', itemId).maybeSingle();
  const ci = it?.cierre_ia;
  if (!ci?.propuesta?.envios) return;
  ci.propuesta.envios = ci.propuesta.envios.map((x: any) => x.id === envioId ? { ...x, estado } : x);
  await supabase.from('tel_sesion_items').update({ cierre_ia: ci, updated_at: ahora() }).eq('id', itemId);
}

/** Arma el PDF (si aún no) y decide por dónde sale. Devuelve una frase de lo que pasó, o null si falló. */
export async function mandarEnvio(envioId: string): Promise<string | null> {
  const { data: e } = await supabase.from('tel_envios').select('*').eq('id', envioId).maybeSingle();
  if (!e || !['listo', 'pendiente_ventana'].includes(e.estado)) return null;
  const t = ahora();
  // Candado: el latido, el vendedor y el webhook pueden querer mandar el mismo a la vez; solo uno lo reclama.
  const { data: mio } = await supabase.from('tel_envios').update({ estado: 'enviando', updated_at: t }).eq('id', envioId).eq('estado', e.estado).select('id').maybeSingle();
  if (!mio) return null;
  try {
    const { data: k } = e.conocimiento_id ? await supabase.from('tel_conocimiento').select('id, tema, texto, pdf_url, veces_usado').eq('id', e.conocimiento_id).maybeSingle() : { data: null as any };
    if (!k?.texto && !k?.pdf_url) {
      await supabase.from('tel_envios').update({ estado: 'fallo', motivo: 'el tema no tiene contenido', updated_at: t }).eq('id', envioId);
      if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'fallo');
      await tareaMandarAMano(e, null, 'El tema guardado no tiene texto ni PDF: mándalo a mano.');
      return null;
    }

    // Quién es, para el PDF y el mensaje.
    let conv: any = null, nombre = '', empresa: string | null = null, vendedor: string | null = null;
    if (e.conversation_id) {
      const { data } = await supabase.from('wa_conversaciones').select('id, telefono, phone_number_id, ventanas, ultimo_entrante_at, contacts(nombre, apellido), companies(nombre, nombre_comercial)').eq('id', e.conversation_id).maybeSingle();
      conv = data;
    } else if (e.contact_id) {
      const { data } = await supabase.from('wa_conversaciones').select('id, telefono, phone_number_id, ventanas, ultimo_entrante_at, contacts(nombre, apellido), companies(nombre, nombre_comercial)').eq('contact_id', e.contact_id).order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
      conv = data;
    }
    const c: any = conv?.contacts, em: any = conv?.companies;
    nombre = [c?.nombre, c?.apellido].filter(Boolean).join(' ');
    empresa = em?.nombre_comercial || em?.nombre || null;
    if (e.item_id) {
      const { data: it } = await supabase.from('tel_sesion_items').select('nombre, empresa, sesion_id, tel_sesiones(presentacion_nombre)').eq('id', e.item_id).maybeSingle();
      nombre = nombre || it?.nombre || '';
      empresa = empresa || it?.empresa || null;
      vendedor = (it as any)?.tel_sesiones?.presentacion_nombre || null;
    }

    let url: string = e.pdf_url || '';
    if (!url) {
      if (k.pdf_url) url = String(k.pdf_url);
      else {
        const buf = await envioPDF({ tema: k.tema || e.tema, para: nombre || null, empresa, de: vendedor, cuerpo: k.texto });
        url = await guardarEnvioPDF(envioId, buf);
      }
      await supabase.from('tel_envios').update({ pdf_url: url, updated_at: t }).eq('id', envioId);
    }
    const tel = telefonoWhatsApp(conv?.telefono || e.telefono);
    if (!tel) {
      await supabase.from('tel_envios').update({ estado: 'sin_via', motivo: 'el teléfono no sirve para WhatsApp', updated_at: t }).eq('id', envioId);
      if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'sin_via');
      await tareaMandarAMano(e, url, 'El teléfono no sirve para WhatsApp: mándalo por otro medio.');
      return null;
    }
    const primer = primerNombre(nombre) || 'qué tal';
    const archivo = `${String(k.tema || e.tema).replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g, '').slice(0, 60).trim() || 'Informacion'} - Sacscloud.pdf`;
    const mensaje = e.texto || `Hola ${primer}, como quedamos en la llamada, aquí te dejo ${String(k.tema || e.tema).toLowerCase()}. Cualquier duda, con gusto.`;
    const ventana = conv ? ventanaEnLinea(conv, conv.phone_number_id) : { abierta: false, expira_at: null };
    let estado = 'enviado', motivo = 'se mandó por WhatsApp';
    // La línea se fija solo para este envío (conLinea restaura el contexto: el webhook que nos llama sigue con el suyo).
    await conLinea({ contexto: 'cliente', origen: 'telefonia' }, async () => {
      if (ventana.abierta) {
        await enviarMediaLink(tel, 'document', url, archivo, mensaje);
        return;
      }
      const { data: cfg } = await supabase.from('wa_config').select('minuta_envio_plantilla_doc, minuta_envio_plantilla_aviso').eq('id', 1).maybeSingle();
      const aprobada = async (n?: string | null) => { if (!n) return false; const { data } = await supabase.from('wa_plantillas').select('status').eq('nombre', n).order('status').limit(1).maybeSingle(); return String((data as any)?.status || '').toUpperCase() === 'APPROVED'; };
      if (await aprobada(cfg?.minuta_envio_plantilla_doc)) {
        await enviarPlantilla(tel, String(cfg!.minuta_envio_plantilla_doc), 'es_MX', [primer], { headerMedia: { tipo: 'document', link: url, filename: archivo } });
        motivo = 'se mandó con plantilla (fuera de la ventana de 24 h)';
      } else if (e.estado !== 'pendiente_ventana' && await aprobada(cfg?.minuta_envio_plantilla_aviso)) {
        await enviarPlantilla(tel, String(cfg!.minuta_envio_plantilla_aviso), 'es_MX', [primer]);
        estado = 'pendiente_ventana'; motivo = 'se le avisó con plantilla; el PDF sale en cuanto conteste';
      } else if (e.estado === 'pendiente_ventana') {
        estado = 'pendiente_ventana'; motivo = 'sigue esperando a que escriba';
      } else {
        estado = 'sin_via'; motivo = 'fuera de la ventana de 24 h y sin plantilla aprobada: hay que mandarlo a mano';
      }
    });
    if (estado === 'pendiente_ventana' && e.estado === 'pendiente_ventana') {
      await supabase.from('tel_envios').update({ estado: 'pendiente_ventana', updated_at: t }).eq('id', envioId);   // se suelta el candado, sigue esperando
      return null;
    }
    await supabase.from('tel_envios').update({ estado, motivo, enviado_at: estado === 'enviado' ? t : null, updated_at: t }).eq('id', envioId);
    if (estado === 'enviado' && k?.id) await supabase.from('tel_conocimiento').update({ veces_usado: Number(k.veces_usado || 0) + 1, updated_at: t }).eq('id', k.id);
    if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, estado);
    if (estado === 'sin_via') await tareaMandarAMano(e, url, motivo);
    return `${e.tema}: ${motivo}`;
  } catch (err: any) {
    const motivo = String(err?.message || err).slice(0, 200);
    await supabase.from('tel_envios').update({ estado: 'fallo', motivo, updated_at: t }).eq('id', envioId);
    if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'fallo');
    const { data: e2 } = await supabase.from('tel_envios').select('pdf_url').eq('id', envioId).maybeSingle();
    await tareaMandarAMano(e, e2?.pdf_url || null, `No se pudo mandar por WhatsApp (${motivo}).`);
    return null;
  }
}

/** No salió por WhatsApp: el vendedor lo manda a mano desde Mi día, con el PDF ya armado.
 *  Va como tipo `responder` (familia avanzar): `wa_libre` está filtrado en la torre y en Mi día desde el 3-sep y nadie lo vería. */
async function tareaMandarAMano(e: any, url: string | null, motivo: string, userId?: string | null) {
  if (!e.item_id) return;
  const { data: ya } = await supabase.from('ti_tareas').select('id').eq('estado', 'pendiente').contains('payload', { envio_id: e.id }).limit(1).maybeSingle();
  if (ya) return;
  const { data: it } = await supabase.from('tel_sesion_items').select('contact_id, company_id, nombre, telefono, tel_sesiones(owner_id)').eq('id', e.item_id).maybeSingle();
  const primer = primerNombre(it?.nombre) || '';
  await supabase.from('ti_tareas').insert({
    contact_id: it?.contact_id || null, company_id: it?.company_id || null, owner_id: (it as any)?.tel_sesiones?.owner_id || userId || null, familia: 'avanzar', tipo: 'responder', prioridad: 2, vence_at: ahora(), origen: 'evento',
    payload: {
      instruccion: `${primer || 'El contacto'}: mandarle ${e.tema}${url ? ' (PDF listo)' : ''}`, porque: motivo, nombre: it?.nombre, whatsapp: it?.telefono, pdf_url: url, envio_id: e.id, tema: e.tema, detalle: e.detalle || null,
      mensaje: `Hola${primer ? ` ${primer}` : ''}, como quedamos en la llamada, aquí te dejo ${String(e.tema).toLowerCase()}.${url ? ` ${url}` : ''} Cualquier duda, con gusto.`,
    },
  }).then(() => {}, () => {});
}

/** Al escribir el cliente se abre la ventana: salen los PDF que quedaron esperando. Lo llama el webhook. Nunca lanza. */
export async function entregarEnviosPendientes(conversationId: string): Promise<number> {
  try {
    const { data } = await supabase.from('tel_envios').select('*').eq('conversation_id', conversationId).eq('estado', 'pendiente_ventana').order('created_at', { ascending: true }).limit(3);
    let n = 0;
    for (const e of data || []) {
      if (Date.now() - Date.parse(e.created_at) > 7 * 86400e3) { await caducarEnvio(e); continue; }
      if (await mandarEnvio(e.id)) n++;
    }
    return n;
  } catch { return 0; }
}
