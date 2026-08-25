// CRM · Resumen de la relación con un contacto — SOLO cuando el usuario lo
// pide (botón en el panel), nunca automático: costaría tokens en cada carga y
// el usuario quiere control de cuándo se regenera.
//
// POST { contact_id } → lee TODO (mensajes de dos años, minutas, cotizaciones,
// suscripciones, actividad) y Claude lo condensa en la ficha de 30 segundos
// que se lee antes de una llamada. Queda guardado en contacts.resumen_ia.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { anthropic, MODELS } from '../../../../lib/ai/client';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const { contact_id } = await request.json().catch(() => ({} as any));
  if (!/^[0-9a-f-]{36}$/i.test(String(contact_id || ''))) return json({ error: 'Falta contact_id' }, 400);

  const { data: ct } = await supabase.from('contacts')
    .select('id, nombre, apellido, lifecycle_stage, company_id, created_at, proximo_paso, companies(nombre_comercial, plan, arr, estado_cuenta, giro, sucursales)')
    .eq('id', contact_id).maybeSingle();
  if (!ct) return json({ error: 'Contacto no encontrado' }, 404);
  const emp: any = ct.companies;

  // El material: mensajes (el inicio de la relación + lo reciente), minutas,
  // cotizaciones, suscripciones y actividad del CRM.
  const { data: convs } = await supabase.from('wa_conversaciones').select('id').eq('contact_id', contact_id);
  const convIds = (convs || []).map(c => c.id);
  let inicio: any[] = [], reciente: any[] = [], minutas: any[] = [];
  if (convIds.length) {
    const sel = 'direccion, cuerpo, transcript, tipo, created_at';
    const [{ data: ini }, { data: rec }, { data: lls }] = await Promise.all([
      supabase.from('wa_mensajes').select(sel).in('conversation_id', convIds).not('cuerpo', 'is', null).order('created_at', { ascending: true }).limit(60),
      supabase.from('wa_mensajes').select(sel).in('conversation_id', convIds).not('cuerpo', 'is', null).order('created_at', { ascending: false }).limit(240),
      supabase.from('wa_llamadas').select('minuta, siguiente_paso, ended_at').in('conversation_id', convIds).not('minuta', 'is', null).order('ended_at', { ascending: false }).limit(5),
    ]);
    inicio = ini || []; reciente = (rec || []).reverse(); minutas = lls || [];
  }
  const [{ data: quotes }, { data: acts }] = await Promise.all([
    supabase.from('quotes').select('numero, total, estado, created_at, vistas').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(10),
    supabase.from('activities').select('tipo, titulo, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(40),
  ]);

  const linea = (m: any) => `[${String(m.created_at).slice(0, 10)}] ${m.direccion === 'entrante' ? 'CLIENTE' : 'EQUIPO'}: ${(m.cuerpo || m.transcript || '').slice(0, 280)}`;
  const vistos = new Set(inicio.map(m => m.created_at));
  const charla = [...inicio, ...reciente.filter(m => !vistos.has(m.created_at))].map(linea).join('\n').slice(0, 60000);

  const prompt = `Eres el asistente del CRM de Sacscloud (punto de venta para comercios en México). Resume la relación completa con ${ct.nombre || 'este contacto'}${emp ? ` de ${emp.nombre_comercial}` : ''} — etapa: ${ct.lifecycle_stage}${emp?.arr ? ` · ARR $${emp.arr}` : ''}${emp?.giro ? ` · giro: ${emp.giro}` : ''} — para que un vendedor la entienda en 30 segundos antes de llamarle. Usa SOLO lo que está aquí; no inventes.

CONVERSACIÓN DE WHATSAPP (inicio de la relación y tramo reciente):
${charla || '(sin mensajes)'}

MINUTAS DE LLAMADAS:
${minutas.map(m => `[${String(m.ended_at).slice(0, 10)}] ${String(m.minuta).slice(0, 800)}`).join('\n') || '(sin llamadas con minuta)'}

COTIZACIONES: ${(quotes || []).map(q => `${q.numero || ''} $${q.total} ${q.estado}${q.vistas ? ` (abierta ×${q.vistas})` : ' (sin abrir)'}`).join(' · ') || 'ninguna'}
ACTIVIDAD DEL CRM: ${(acts || []).map(a => `[${String(a.created_at).slice(0, 10)}] ${a.titulo}`).join(' · ').slice(0, 3000) || 'nada'}

Responde SOLO un JSON válido:
{"resumen": "markdown con: ## Quién es (1-2 frases: negocio, tamaño, desde cuándo), ## La historia (qué ha pasado, con fechas y cifras literales), ## Qué le importa (dolores y motivaciones QUE ÉL DIJO), ## Riesgos o fricciones (quejas, promesas pendientes, silencios largos), ## Siguiente jugada (1-2 acciones concretas)", "titular": "UNA frase que capture el estado de la relación hoy"}`;

  try {
    const r = await anthropic.messages.create({ model: MODELS.sonnet, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] });
    const texto = (r.content[0] as any)?.text || '';
    const m = texto.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    const resumen = String(parsed?.resumen || '').trim();
    const titular = String(parsed?.titular || '').trim();
    if (!resumen) return json({ error: 'El modelo no devolvió resumen' }, 502);
    const cuerpo = (titular ? `**${titular}**\n\n` : '') + resumen;
    await supabase.from('contacts').update({ resumen_ia: cuerpo, resumen_ia_at: new Date().toISOString() }).eq('id', contact_id);
    return json({ ok: true, resumen: cuerpo, at: new Date().toISOString() });
  } catch (e: any) {
    return json({ error: `No se pudo generar: ${String(e?.message || e).slice(0, 200)}` }, 502);
  }
};
