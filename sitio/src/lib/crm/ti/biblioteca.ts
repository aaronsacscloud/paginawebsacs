/** HIGIENE DE LA BIBLIOTECA y RESULTADO DEL LEAD (3-sep). */
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey } from '../../ai/client';
import { leerConfig } from './motor';

/** Duplicados (pulida casi igual) → el más viejo queda «duplicado»; promos vencidas mencionadas → «caducado». */
export async function higieneBiblioteca() {
  const res: any = { duplicados: 0, caducados: 0 };
  const { data: ap } = await supabase.from('ia_ejemplos').select('id, pulida, created_at').eq('estado_rev', 'aprobado').order('created_at', { ascending: false }).limit(400);
  const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const bigr = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const sim = (a: string, b: string) => { const A = norm(a), B = norm(b); if (!A || !B) return 0; if (A === B) return 1; const ga = bigr(A), gb = bigr(B); let inter = 0; for (const [g, n] of ga) inter += Math.min(n, gb.get(g) || 0); return (2 * inter) / Math.max(1, A.length + B.length - 2); };
  const lista = ap || []; const dup: string[] = [];
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) { if (dup.includes(lista[j].id)) continue; if (Math.abs(String(lista[i].pulida || '').length - String(lista[j].pulida || '').length) > 80) continue; if (sim(lista[i].pulida, lista[j].pulida) >= 0.92) dup.push(lista[j].id); }
  if (dup.length) { await supabase.from('ia_ejemplos').update({ estado_rev: 'duplicado', revisado_at: new Date().toISOString() }).in('id', dup); res.duplicados = dup.length; }
  // Promos vencidas: si la respuesta menciona una palabra clave de una promo cuya fecha ya pasó, caduca.
  const cfg: any = await leerConfig();
  const vencidas = (cfg.promociones || []).filter((p: any) => p.vence && Date.parse(p.vence) < Date.now() - 86400e3);
  for (const p of vencidas) {
    const palabras: string[] = (p.palabras || []).filter((w: string) => w && w.length >= 4);
    if (!palabras.length) continue;
    const { data: con } = await supabase.from('ia_ejemplos').select('id, pulida').eq('estado_rev', 'aprobado').or(palabras.map(w => `pulida.ilike.%${w.replace(/[%_]/g, '')}%`).join(',')).limit(100);
    const ids = (con || []).map(x => x.id);
    if (ids.length) { await supabase.from('ia_ejemplos').update({ estado_rev: 'caducado', revisado_at: new Date().toISOString(), por_que: `CADUCADO: mencionaba la promo «${p.nombre}» vencida el ${p.vence}` }).in('id', ids); res.caducados += ids.length; }
  }
  return res;
}

/** Dudosos y propuestos con más de N días sin que nadie los revise: el curador (Sonnet) decide con razón. Máximo por noche. */
export async function curarPendientes(dias = 7, max = 20) {
  if (!hasApiKey()) return { curados: 0, motivo: 'sin_api_key' };
  const { data: pend } = await supabase.from('ia_ejemplos').select('id, estado, situacion, mensaje_lead, respuesta, pulida, por_que, fuente').in('estado_rev', ['dudoso', 'propuesta']).lt('created_at', new Date(Date.now() - dias * 86400e3).toISOString()).order('created_at', { ascending: true }).limit(max);
  const res = { curados: 0, aprobados: 0, rechazados: 0, costo: 0 };
  for (const e of pend || []) {
    try {
      const r = await anthropic.messages.create({ model: MODELS.sonnet, max_tokens: 220, messages: [{ role: 'user', content: `Eres el curador de la biblioteca de ejemplos del agente SDR de Sacs (WhatsApp, tiendas de moda en México). Un ejemplo lleva ${dias}+ días sin que una persona lo revise. Decide si vale como ejemplo a IMITAR.\nEtapa: ${e.estado}. Situación: ${e.situacion || ''}. Lead: «${String(e.mensaje_lead || '').slice(0, 300)}». Respuesta: «${String(e.pulida || e.respuesta || '').slice(0, 600)}». Notas: ${String(e.por_que || '').slice(0, 300)}.\nCriterios: corta (≤4 líneas), una sola pregunta, sin admiraciones ni emojis, sin listas ni negritas, cifras solo si las pidió, siguiente paso natural, verdad hoy (sin promos con fecha). Si es una respuesta humana que rompe alguno de esos criterios pero el FONDO es bueno, recházala igual (el agente imita la forma).\nResponde SOLO JSON: {"decision":"aprobar|rechazar","razon":"1 línea"}` }] });
      const t = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      const m = t.match(/\{[\s\S]*\}/); const j = m ? JSON.parse(m[0]) : {};
      const ok = j.decision === 'aprobar';
      await supabase.from('ia_ejemplos').update({ estado_rev: ok ? 'aprobado' : 'rechazado', revisado_at: new Date().toISOString(), por_que: `${String(e.por_que || '')}\nCurador (${dias}d sin revisión): ${j.razon || ''}`.trim().slice(0, 1200) }).eq('id', e.id);
      res.curados++; if (ok) res.aprobados++; else res.rechazados++;
      res.costo += ((r.usage?.input_tokens || 0) * 3 + (r.usage?.output_tokens || 0) * 15) / 1e6;
    } catch { /* siguiente */ }
  }
  return res;
}

/** RESULTADO: ¿el lead contestó en 48 h? ¿agendó en 7 días? Para calificaciones (enviadas) y envíos del agente. */
export async function medirResultados() {
  const ahora = Date.now();
  const res = { calificaciones: 0, envios: 0 };
  const medir = async (contactId: string | null, conversationId: string | null, desde: string) => {
    if (!contactId) return null;
    const t = Date.parse(desde); if (!(ahora - t >= 48 * 3600e3)) return null;   // todavía no cumple 48 h: se mide mañana
    const { data: ent } = await supabase.from('ti_eventos').select('ocurrio_at').eq('contact_id', contactId).eq('tipo', 'wa_entrante').gt('ocurrio_at', desde).lt('ocurrio_at', new Date(t + 48 * 3600e3).toISOString()).order('ocurrio_at', { ascending: true }).limit(1);
    const primero = ent?.[0]?.ocurrio_at || null;
    const { data: bk } = await supabase.from('bookings').select('id').eq('contact_id', contactId).gt('created_at', desde).lt('created_at', new Date(t + 7 * 86400e3).toISOString()).limit(1);
    return { respondio_48h: !!primero, respondio_min: primero ? Math.round((Date.parse(primero) - t) / 60e3) : null, agendo_7d: (bk || []).length > 0, definitivo_agenda: ahora - t >= 7 * 86400e3, medido_at: new Date().toISOString() };
  };
  const { data: cal } = await supabase.from('ti_calificaciones').select('id, contact_id, conversation_id, created_at, decision, resultado').in('decision', ['enviar', 'modificar']).or('resultado.is.null,resultado->>definitivo_agenda.eq.false').gte('created_at', new Date(ahora - 12 * 86400e3).toISOString()).limit(300);
  for (const c of cal || []) { const r = await medir(c.contact_id, c.conversation_id, c.created_at); if (r) { await supabase.from('ti_calificaciones').update({ resultado: r }).eq('id', c.id); res.calificaciones++; } }
  const { data: env } = await supabase.from('ti_envios').select('id, contact_id, conversation_id, enviado_at, resultado').eq('estado', 'enviado').not('enviado_at', 'is', null).or('resultado.is.null,resultado->>definitivo_agenda.eq.false').gte('enviado_at', new Date(ahora - 12 * 86400e3).toISOString()).limit(400);
  for (const e of env || []) { const r = await medir(e.contact_id, e.conversation_id, e.enviado_at); if (r) { await supabase.from('ti_envios').update({ resultado: r }).eq('id', e.id); res.envios++; } }
  return res;
}

/** Resumen para la pantalla: tasa de respuesta a 48 h y de cita a 7 días, por tipo de decisión y por origen. */
export async function resumenResultados() {
  const { data: cal } = await supabase.from('ti_calificaciones').select('decision, resultado').not('resultado', 'is', null).order('created_at', { ascending: false }).limit(500);
  const { data: env } = await supabase.from('ti_envios').select('origen, resultado').not('resultado', 'is', null).order('enviado_at', { ascending: false }).limit(800);
  const tasa = (xs: any[], k: string) => xs.length ? Math.round(100 * xs.filter(x => x.resultado?.[k]).length / xs.length) : null;
  const porDecision: Record<string, any> = {};
  for (const d of ['enviar', 'modificar']) { const xs = (cal || []).filter(c => c.decision === d); porDecision[d] = { n: xs.length, responden_48h: tasa(xs, 'respondio_48h'), agendan_7d: tasa(xs.filter(x => x.resultado?.definitivo_agenda), 'agendo_7d') }; }
  const porOrigen: Record<string, any> = {};
  for (const e of env || []) { const k = e.origen || 'otro'; porOrigen[k] = porOrigen[k] || []; porOrigen[k].push(e); }
  return { por_decision: porDecision, por_origen: Object.fromEntries(Object.entries(porOrigen).map(([k, xs]) => [k, { n: xs.length, responden_48h: tasa(xs, 'respondio_48h'), agendan_7d: tasa(xs.filter((x: any) => x.resultado?.definitivo_agenda), 'agendo_7d') }])), total: { n: (env || []).length, responden_48h: tasa(env || [], 'respondio_48h'), agendan_7d: tasa((env || []).filter(x => x.resultado?.definitivo_agenda), 'agendo_7d') } };
}
