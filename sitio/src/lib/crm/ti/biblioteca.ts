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

/* ── EL MOMENTO DE LA OFERTA (3-sep): ofertas de demo/llamada del agente en 30 días, prematuras (sin giro+tiendas+necesidad)
   y qué pasó después (contestó en 48 h, agendó en 7 d). Se mide de noche y se guarda en cfg.metricas_ofertas. ── */
export async function medirOfertas() {
  const desde = new Date(Date.now() - 30 * 86400e3).toISOString();
  const { data: of } = await supabase.from('ia_log').select('contact_id, razon, detalle, created_at').eq('accion', 'oferta_siguiente_paso').gte('created_at', desde).order('created_at', { ascending: false }).limit(300);
  const lista = of || [];
  const ahora = Date.now();
  const res: any = { at: new Date().toISOString(), total_30d: lista.length, demo: lista.filter(x => x.razon === 'demo').length, llamada: lista.filter(x => x.razon === 'llamada').length, prematuras: lista.filter(x => (x.detalle as any)?.datos_completos === false).length, por_turno: {} as Record<string, number>, completas: { n: 0, responden: 0, agendan: 0 }, prematuras_res: { n: 0, responden: 0, agendan: 0 } };
  for (const x of lista) { const t = String(Math.min(9, Number((x.detalle as any)?.turno) || 0)); res.por_turno[t] = (res.por_turno[t] || 0) + 1; }
  res.pct_prematuras = lista.length ? Math.round(100 * res.prematuras / lista.length) : null;
  // Resultado: solo las que ya cumplieron 48 h (máx. 120 para no eternizar la corrida).
  for (const x of lista.filter(x => ahora - Date.parse(x.created_at) >= 48 * 3600e3).slice(0, 120)) {
    if (!x.contact_id) continue;
    const t = Date.parse(x.created_at);
    const [{ data: ent }, { data: bk }] = await Promise.all([
      supabase.from('ti_eventos').select('id').eq('contact_id', x.contact_id).eq('tipo', 'wa_entrante').gt('ocurrio_at', x.created_at).lt('ocurrio_at', new Date(t + 48 * 3600e3).toISOString()).limit(1),
      supabase.from('bookings').select('id').eq('contact_id', x.contact_id).gt('created_at', x.created_at).lt('created_at', new Date(t + 7 * 86400e3).toISOString()).limit(1),
    ]);
    const b = (x.detalle as any)?.datos_completos === false ? res.prematuras_res : res.completas;
    b.n++; if ((ent || []).length) b.responden++; if ((bk || []).length) b.agendan++;
  }
  for (const k of ['completas', 'prematuras_res']) { const b = res[k]; b.pct_responden = b.n ? Math.round(100 * b.responden / b.n) : null; b.pct_agendan = b.n ? Math.round(100 * b.agendan / b.n) : null; }
  const cfg: any = await leerConfig();
  await supabase.from('ti_config').update({ valor: { ...cfg, metricas_ofertas: res } }).eq('id', 1);
  return { total: res.total_30d, prematuras: res.prematuras, medidas: res.completas.n + res.prematuras_res.n };
}
export async function resumenOfertas() { const cfg: any = await leerConfig(); return cfg.metricas_ofertas || null; }

/** Rechazos de consultores por «momento» o «no entendió»: últimos 14 días vs los 14 anteriores. */
export async function rechazosPorMomento() {
  const MOT = ['No era el momento de mandar nada', 'No entendió lo que preguntó'];
  const d14 = new Date(Date.now() - 14 * 86400e3).toISOString(), d28 = new Date(Date.now() - 28 * 86400e3).toISOString();
  const [{ count: a }, { count: b }] = await Promise.all([
    supabase.from('ti_calificaciones').select('id', { count: 'exact', head: true }).eq('decision', 'rechazar').in('motivo', MOT).gte('created_at', d14),
    supabase.from('ti_calificaciones').select('id', { count: 'exact', head: true }).eq('decision', 'rechazar').in('motivo', MOT).gte('created_at', d28).lt('created_at', d14),
  ]);
  return { ultimos_14: a || 0, anteriores_14: b || 0 };
}

/* ── AUTOPSIA DE OPORTUNIDADES CERRADAS (3-sep): ganada, perdida o no-show → Opus lee la conversación completa y saca dónde se
   decidió, qué objeción hubo, qué mensaje la giró, en qué momento se ofreció la demo y con qué datos, y una lección. ── */
export async function autopsias(max = 5, dias = 2) {
  if (!hasApiKey()) return { hechas: 0, motivo: 'sin_api_key' };
  const hace2 = new Date(Date.now() - dias * 86400e3).toISOString();
  const casos: { clave: string; contact_id: string; resultado: 'ganada' | 'perdida' | 'no_show'; motivo?: string | null }[] = [];
  const { data: deals } = await supabase.from('deals').select('id, contact_id, stage, motivo_perdida, closed_at, updated_at').in('stage', ['cerrada_ganada', 'cerrada_perdida']).gte('updated_at', hace2).limit(20);
  for (const d of deals || []) if (d.contact_id) casos.push({ clave: `deal:${d.id}`, contact_id: d.contact_id, resultado: d.stage === 'cerrada_ganada' ? 'ganada' : 'perdida', motivo: d.motivo_perdida });
  const { data: bks } = await supabase.from('bookings').select('id, contact_id, estado, fecha').eq('estado', 'no_asistio').gte('fecha', new Date(Date.now() - (dias + 1) * 86400e3).toISOString().slice(0, 10)).limit(20);
  for (const b of bks || []) if (b.contact_id) casos.push({ clave: `booking:${b.id}`, contact_id: b.contact_id, resultado: 'no_show' });
  const res = { hechas: 0, ejemplos: 0, reglas: 0, costo: 0 };
  for (const c of casos) {
    if (res.hechas >= max) break;
    const { data: ya } = await supabase.from('ia_log').select('id').eq('accion', 'autopsia').filter('detalle->>clave', 'eq', c.clave).limit(1);
    if ((ya || []).length) continue;
    const { data: conv } = await supabase.from('wa_conversaciones').select('id').eq('contact_id', c.contact_id).order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
    if (!conv) continue;
    const { data: msjs } = await supabase.from('wa_mensajes').select('direccion, cuerpo, tipo, created_at, autor, metadata').eq('conversation_id', conv.id).is('borrado_at', null).order('created_at', { ascending: false }).limit(40);
    const hilo = (msjs || []).reverse().map((m, i) => `${i + 1}. ${m.direccion === 'entrante' ? 'LEAD' : (m.metadata as any)?.origen === 'agente' ? 'AGENTE' : 'CONSULTOR'} (${String(m.created_at).slice(5, 16).replace('T', ' ')}): ${m.tipo === 'text' || !m.tipo ? String(m.cuerpo || '').slice(0, 300) : `[${m.tipo}] ${String(m.cuerpo || '').slice(0, 120)}`}`).join('\n');
    if (hilo.length < 200) continue;
    try {
      const r = await anthropic.messages.create({ model: MODELS.opus, max_tokens: 700, messages: [{ role: 'user', content: `Autopsia de una oportunidad de Sacs (software para tiendas de moda, WhatsApp). Resultado final: ${c.resultado.toUpperCase()}${c.motivo ? ` (motivo registrado: ${c.motivo})` : ''}.\n\nCONVERSACIÓN:\n${hilo}\n\nAnaliza como director comercial. Responde SOLO JSON:\n{"donde_se_decidio":"nº de mensaje y por qué ahí","objecion":"la objeción real o vacío","mensaje_clave":"el texto NUESTRO que más ayudó (ganada) o más dañó (perdida/no_show), copiado literal, o vacío","momento_demo":{"mensaje":n|null,"tenia_datos":"qué sabíamos del negocio en ese punto","hubo_senal":true|false,"fue_prematuro":true|false},"leccion":"UNA regla operativa de 1-2 líneas que evitaría repetir lo malo o repetiría lo bueno","regla_para_el_guion":true|false}` }] });
      const t = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      const m = t.match(/\{[\s\S]*\}/); if (!m) continue; const j = JSON.parse(m[0]);
      res.costo += ((r.usage?.input_tokens || 0) * 15 + (r.usage?.output_tokens || 0) * 75) / 1e6;
      await supabase.from('ia_log').insert({ accion: 'autopsia', contact_id: c.contact_id, razon: c.resultado, detalle: { clave: c.clave, ...j } });
      if (j.mensaje_clave && String(j.mensaje_clave).length >= 20) {
        const leadAntes = (() => { const idx = (msjs || []).slice().reverse().findIndex(m => m.direccion !== 'entrante' && String(m.cuerpo || '').includes(String(j.mensaje_clave).slice(0, 40))); const prev = idx > 0 ? (msjs || []).slice().reverse().slice(0, idx).reverse().find(m => m.direccion === 'entrante') : null; return prev ? String(prev.cuerpo || '').slice(0, 300) : null; })();
        await supabase.from('ia_ejemplos').insert({ estado: c.resultado === 'ganada' ? 'proponiendo' : 'descubriendo', situacion: `AUTOPSIA ${c.resultado}: ${String(j.donde_se_decidio || '').slice(0, 200)}`, mensaje_lead: leadAntes, respuesta: String(j.mensaje_clave).slice(0, 1200), pulida: String(j.mensaje_clave).slice(0, 1200), por_que: `${c.resultado === 'ganada' ? 'CRITERIO' : 'EVITAR'}: ${String(j.leccion || '').slice(0, 300)}`, fuente: c.resultado === 'ganada' ? 'autopsia' : 'autopsia_perdida', contact_id: c.contact_id, conversation_id: conv.id, estado_rev: c.resultado === 'ganada' ? 'propuesta' : 'rechazado' }).then(() => {}, () => {});
        res.ejemplos++;
      }
      if (j.regla_para_el_guion && j.leccion) { const { proponerRegla } = await import('./guion-datos'); const p: any = await proponerRegla({ texto: String(j.leccion).slice(0, 400), etapa: null, origen: 'autopsia', evidencias: [`${c.resultado}: ${String(j.donde_se_decidio || '').slice(0, 160)}`, j.objecion ? `Objeción: ${String(j.objecion).slice(0, 160)}` : ''].filter(Boolean), nota: `Autopsia ${c.clave}` }); if (p.ok) res.reglas++; }
      res.hechas++;
    } catch { /* siguiente */ }
  }
  return res;
}
