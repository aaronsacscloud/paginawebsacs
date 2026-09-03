// TRABAJO INTELIGENTE · EL CICLO NOCTURNO (versión Vercel).
//
// El dueño decidió correrlo en Supabase Edge + pg_cron; mientras esas
// extensiones no estén instaladas, corre aquí (la llave ya vive en Vercel) con
// los mismos aprendices y la misma salida: PROPUESTAS con evidencia en
// ti_reglas (estado «propuesta») y avisos al dueño. Nada se automodifica en
// silencio, salvo la BAJADA de autonomía, que es automática por diseño.
//
//   1. Paridad de Seguimiento (la rampa del veto quedó redundante el 3-sep).
//   2. «No era lead»: motivos que se repiten por fuente → exclusión propuesta.
//   3. (retirado 3-sep: los ángulos se miden como RESULTADO real en ti-curador)
//   4. Huecos de la wiki: lo que el agente no supo → adenda propuesta.
//   5. Métrica norte del día: citas agendadas por el agente vs. por humanos.
// Cron: 08:00 UTC diario (02:00 CDMX). Los pasos pesados (curador, calificación masiva, pruebas de reglas,
// resultados, higiene) van en ti-curador a las 08:25 UTC. Cada corrida queda en ti_corridas.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { leerConfig } from '../../../lib/crm/ti/motor';
import { anthropic, MODELS, hasApiKey } from '../../../lib/ai/client';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const D = 86400e3;

async function proponer(clave: string, valor: any, evidencia: any, dedupeDias = 14) {
  // La memoria de decisiones: lo rechazado no se vuelve a proponer sin evidencia nueva; lo ya propuesto no se duplica.
  const { data: prev } = await supabase.from('ti_reglas').select('id, estado, created_at').eq('clave', clave).filter('valor->>id', 'eq', String(valor.id || '')).order('created_at', { ascending: false }).limit(1);
  const p = prev?.[0];
  if (p && (p.estado === 'propuesta' || p.estado === 'activa')) return false;
  if (p && p.estado === 'retirada' && Date.now() - Date.parse(p.created_at) < dedupeDias * D) return false;
  await supabase.from('ti_reglas').insert({ clave, valor, evidencia, estado: 'propuesta' });
  return true;
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const { correr } = await import('../../../lib/crm/ti/corridas');
  const corrida = await correr('ti-aprender', { todo: () => cuerpo() });
  return json({ ok: corrida.ok, duracion_ms: corrida.duracion_ms, ...(corrida.pasos.todo?.res || {}), error: corrida.pasos.todo?.error });
};

async function cuerpo() {
  const cfg: any = await leerConfig();
  const ahora = new Date();
  const hace = (d: number) => new Date(ahora.getTime() - d * D).toISOString();
  const res: any = { propuestas: [] as string[], avisos: 0 };

  // ── 1) PARIDAD (sustituye a la rampa del veto, redundante desde Seguimiento 3-sep) ──
  try { const { revisarParidad } = await import('../../../lib/crm/ti/seguimiento'); const p = await revisarParidad(); res.paridad = { promedio: p.paridad.promedio, n: p.paridad.n, lista: p.lista, modo: p.paridad.modo }; } catch (e: any) { res.paridad_error = String(e?.message || e); }

  // ── 2) «NO ERA LEAD» por fuente ──
  const { data: nel } = await supabase.from('ia_log').select('razon, detalle, contact_id').eq('accion', 'no_era_lead').gte('created_at', hace(30)).limit(500);
  const porFuente: Record<string, { n: number; motivos: Record<string, number> }> = {};
  for (const r of nel || []) {
    const f = String((r.detalle as any)?.utm_source || (r.detalle as any)?.fuente || 'sin_fuente');
    porFuente[f] = porFuente[f] || { n: 0, motivos: {} };
    porFuente[f].n++; porFuente[f].motivos[r.razon || 'otro'] = (porFuente[f].motivos[r.razon || 'otro'] || 0) + 1;
  }
  res.no_era_lead = porFuente;
  for (const [f, v] of Object.entries(porFuente)) {
    if (v.n < 3) continue;
    const { count: total } = await supabase.from('contacts').select('id', { count: 'exact', head: true }).or(`utm_source.eq.${f},fuente.eq.${f}`).gte('created_at', hace(30));
    const tasa = v.n / Math.max(1, total || 0);
    if (tasa >= 0.3 && await proponer('exclusion_fuente', { id: `fuente:${f}`, fuente: f, motivos: v.motivos }, { no_era_lead: v.n, leads_30d: total, tasa: tasa.toFixed(2) })) {
      await notificar({ clave: `exclusion:${f}:${ahora.toISOString().slice(0, 10)}`, tipo: 'ti_regla', nivel: 'info', titulo: `La fuente «${f}» trae ${Math.round(tasa * 100)} % de «no era lead»`, detalle: `${v.n} de ${total} en 30 días (${Object.entries(v.motivos).map(([k, n]) => `${k}: ${n}`).join(', ')}). Propuesta: filtrarla o cambiar el primer mensaje. Queda en ti_reglas como propuesta.`, destino: 'trabajo' });
      res.propuestas.push(`exclusion_fuente:${f}`); res.avisos++;
    }
  }

  // ── 4) HUECOS DE LA WIKI: lo que el agente escaló por no saber ──
  const { data: huecos } = await supabase.from('ia_log').select('razon, contact_id').eq('accion', 'agente_calla').ilike('razon', '%wiki%').gte('created_at', hace(7)).limit(200);
  res.huecos_wiki = (huecos || []).length;
  if ((huecos || []).length >= 2) {
    const ejemplos = (huecos || []).slice(0, 8).map(h => h.razon);
    if (await proponer('adenda_wiki', { id: `semana:${ahora.toISOString().slice(0, 10)}`, ejemplos }, { veces: (huecos || []).length }, 7)) {
      await notificar({ clave: `adenda:${ahora.toISOString().slice(0, 10)}`, tipo: 'ti_regla', nivel: 'info', titulo: `${(huecos || []).length} preguntas que la wiki no cubrió esta semana`, detalle: ejemplos.join(' · ').slice(0, 900), destino: 'trabajo' });
      res.propuestas.push('adenda_wiki'); res.avisos++;
    }
  }

  // ── 4b) CORRECCIONES IMPLÍCITAS: el humano escribió justo después del agente sin que el lead
  //       hubiera contestado → probablemente corrigió. Entra como ejemplo DUDOSO (el curador o el dueño deciden).
  const { data: envs } = await supabase.from('ti_envios').select('id, contact_id, conversation_id, enviado_at, mensaje, salida').eq('estado', 'enviado').gte('enviado_at', hace(2)).limit(300);
  res.correcciones_implicitas = 0;
  for (const e of envs || []) {
    if (!e.contact_id) continue;
    const { data: yaHay } = await supabase.from('ia_ejemplos').select('id').eq('fuente', 'correccion_implicita').filter('por_que', 'ilike', `%envio:${e.id}%`).limit(1);
    if ((yaHay || []).length) continue;
    const { data: sig } = await supabase.from('ti_eventos').select('tipo, actor, payload, ocurrio_at').eq('contact_id', e.contact_id).in('tipo', ['wa_entrante', 'wa_saliente']).gt('ocurrio_at', e.enviado_at).order('ocurrio_at', { ascending: true }).limit(1);
    const n = sig?.[0];
    if (!n || n.tipo !== 'wa_saliente' || n.actor !== 'humano') continue;
    if (Date.parse(n.ocurrio_at) - Date.parse(e.enviado_at) > 45 * 60e3) continue;
    const texto = String((n.payload as any)?.texto || '').trim();
    if (texto.length < 12) continue;
    await supabase.from('ia_ejemplos').insert({
      estado: (e.salida as any)?.estado || 'descubriendo', situacion: `El humano escribió ${Math.round((Date.parse(n.ocurrio_at) - Date.parse(e.enviado_at)) / 60e3)} min después del agente, sin respuesta del lead en medio (corrección implícita)`,
      mensaje_lead: (e.salida as any)?.ultimo_mensaje || null, respuesta: texto, pulida: texto,
      por_que: `Corrección implícita · envio:${e.id} · el agente había dicho: ${String(e.mensaje).slice(0, 200)}`,
      fuente: 'correccion_implicita', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'dudoso',
    });
    res.correcciones_implicitas++;
  }
  if (res.correcciones_implicitas) { await notificar({ clave: `impl:${ahora.toISOString().slice(0, 10)}`, tipo: 'ti_regla', nivel: 'info', titulo: `${res.correcciones_implicitas} correcciones implícitas al agente`, detalle: 'Escribiste después del agente sin que el lead contestara. Quedaron como ejemplos dudosos para que confirmes cuáles enseñar.', destino: 'trabajo' }); res.avisos++; }

  // ── 4c) PATRÓN → REGLA: si un mismo tipo de corrección se repite 3 veces en 14 días, se propone como regla del guion, no solo como ejemplos. ──
  const { data: corr14 } = await supabase.from('ia_ejemplos').select('estado, por_que, pulida').in('fuente', ['correccion_dueno', 'correccion_implicita', 'rechazo_consultor']).gte('created_at', hace(14)).limit(200);
  const porEstado: Record<string, number> = {};
  for (const c of corr14 || []) porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
  for (const [est, n] of Object.entries(porEstado)) {
    if (n >= 3 && await proponer('regla_guion', { id: `estado:${est}:${ahora.toISOString().slice(0, 7)}`, estado: est, correcciones: n, muestras: (corr14 || []).filter(c => c.estado === est).slice(0, 3).map(c => c.pulida) }, { n }, 30)) {
      await notificar({ clave: `regla:${est}:${ahora.toISOString().slice(0, 10)}`, tipo: 'ti_regla', nivel: 'info', titulo: `${n} correcciones en «${est}» en 14 días: hay una regla que el guion no tiene`, detalle: 'Claude las lee y te propone la redacción de la regla en la próxima sesión; mientras, ya entran como ejemplos.', destino: 'trabajo' });
      res.propuestas.push(`regla_guion:${est}`); res.avisos++;
    }
  }
  // 4c-bis) Las propuestas sin texto se REDACTAN con Opus (1-2 líneas + evidencias) para que aparezcan en la Torre y en Seguimiento → Reglas.
  try { const { redactarPropuestasPendientes } = await import('../../../lib/crm/ti/guion-datos'); res.reglas_redactadas = await redactarPropuestasPendientes(4); } catch (e: any) { res.reglas_error = String(e?.message || e); }

  // 4d/4e/4f (curador de pares, calificación masiva, presupuesto) viven en /api/cron/ti-curador desde el 3-sep: son los pasos pesados.

  // ── 5) MÉTRICA NORTE: citas agendadas ayer, por quién ──
  const { data: citas } = await supabase.from('bookings').select('utm_source, estado').gte('created_at', hace(1)).limit(500);
  res.citas_ayer = { agente: (citas || []).filter(b => b.utm_source === 'agente_ia').length, humanas: (citas || []).filter(b => b.utm_source !== 'agente_ia').length };

  return res;
}
