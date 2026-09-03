// TRABAJO INTELIGENTE · EL CICLO NOCTURNO (versión Vercel).
//
// El dueño decidió correrlo en Supabase Edge + pg_cron; mientras esas
// extensiones no estén instaladas, corre aquí (la llave ya vive en Vercel) con
// los mismos aprendices y la misma salida: PROPUESTAS con evidencia en
// ti_reglas (estado «propuesta») y avisos al dueño. Nada se automodifica en
// silencio, salvo la BAJADA de autonomía, que es automática por diseño.
//
//   1. Rampa: ¿el agente se ganó menos veto? ¿o se lo tiene que devolver?
//   2. «No era lead»: motivos que se repiten por fuente → exclusión propuesta.
//   3. Ángulos del reloj de silencio: cuál consigue respuesta.
//   4. Huecos de la wiki: lo que el agente no supo → adenda propuesta.
//   5. Métrica norte del día: citas agendadas por el agente vs. por humanos.
// Cron: 08:00 UTC diario (02:00 CDMX). También a mano con el secreto.
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
  const cfg: any = await leerConfig();
  const ahora = new Date();
  const hace = (d: number) => new Date(ahora.getTime() - d * D).toISOString();
  const res: any = { propuestas: [] as string[], avisos: 0 };

  // ── 1) RAMPA ──
  const { data: env14 } = await supabase.from('ti_envios').select('estado, editado_por, created_at').gte('created_at', hace(14)).in('estado', ['enviado', 'vetado']).limit(2000);
  const enviados = (env14 || []).filter(e => e.estado === 'enviado').length;
  const vetados = (env14 || []).filter(e => e.estado === 'vetado').length;
  const editados = (env14 || []).filter(e => e.editado_por).length;
  // Solo cuentan las correcciones a envíos REALES del agente (edición o «esto hubiera contestado yo» sobre un envío), no la calibración inicial.
  const { count: correcciones7 } = await supabase.from('ia_ejemplos').select('id', { count: 'exact', head: true }).eq('fuente', 'correccion_dueno').gte('created_at', hace(7)).or('por_que.ilike.%corrigió al agente%,por_que.ilike.El humano corrigió al agente%');
  const { count: vetos7 } = await supabase.from('ti_envios').select('id', { count: 'exact', head: true }).eq('estado', 'vetado').gte('updated_at', hace(7));
  const errores7 = (correcciones7 || 0) + (vetos7 || 0);
  const veto = Number(cfg.agente_veto_min ?? 10);
  res.rampa = { enviados14: enviados, vetados14: vetados, editados14: editados, errores7, veto_min: veto, modo: cfg.agente_modo || 'sombra' };
  if (veto === 0 && errores7 >= 2) {
    // BAJADA AUTOMÁTICA: dos correcciones en 7 días → vuelve la ventana de veto.
    const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
    await supabase.from('ti_config').update({ valor: { ...((data?.valor as any) || {}), agente_veto_min: 10 } }).eq('id', 1);
    await notificar({ clave: `rampa_baja:${ahora.toISOString().slice(0, 10)}`, tipo: 'ti_rampa', nivel: 'alerta', titulo: 'El agente vuelve a la ventana de veto de 10 min', detalle: `${errores7} correcciones en 7 días (vetos o «esto hubiera contestado yo»). Baja automática de N3 a N2.`, destino: 'trabajo' });
    res.rampa.bajada = true; res.avisos++;
  } else if (veto > 0 && (cfg.agente_modo === 'vivo') && enviados >= 30 && (vetados + editados) / Math.max(1, enviados + vetados) <= 0.10) {
    if (await proponer('rampa_subir', { id: 'agente_veto_0', accion: 'agente_veto_min', de: veto, a: 0 }, { enviados14: enviados, vetados14: vetados, editados14: editados, tasa: ((vetados + editados) / (enviados + vetados)).toFixed(3) })) {
      await notificar({ clave: `rampa_sube:${ahora.toISOString().slice(0, 10)}`, tipo: 'ti_rampa', nivel: 'info', titulo: 'Propuesta: el agente se ganó salir sin ventana de veto', detalle: `${enviados} envíos en 14 días con ${vetados} vetos y ${editados} ediciones (≤10 %). Apruébalo con: node scripts/ti-agente.mjs --veto 0`, destino: 'trabajo' });
      res.propuestas.push('rampa_subir'); res.avisos++;
    }
  }

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

  // ── 3) ÁNGULOS del reloj de silencio: ¿cuál consigue respuesta en 48 h? ──
  const { data: toques } = await supabase.from('ti_envios').select('contact_id, enviado_at, salida').eq('origen', 'silencio').eq('estado', 'enviado').gte('enviado_at', hace(30)).limit(1000);
  const porToque: Record<string, { n: number; resp: number }> = {};
  for (const t of toques || []) {
    const k = `toque${(t.salida as any)?.toque || '?'}`;
    porToque[k] = porToque[k] || { n: 0, resp: 0 }; porToque[k].n++;
    const { data: r } = await supabase.from('ti_eventos').select('id').eq('contact_id', t.contact_id).eq('tipo', 'wa_entrante').gt('ocurrio_at', t.enviado_at).lt('ocurrio_at', new Date(Date.parse(t.enviado_at) + 2 * D).toISOString()).limit(1);
    if ((r || []).length) porToque[k].resp++;
  }
  res.angulos = porToque;
  { const { data } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
    await supabase.from('ti_config').update({ valor: { ...((data?.valor as any) || {}), metricas_silencio: { at: ahora.toISOString(), porToque } } }).eq('id', 1); }

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
  const { data: corr14 } = await supabase.from('ia_ejemplos').select('estado, por_que, pulida').in('fuente', ['correccion_dueno', 'correccion_implicita']).gte('created_at', hace(14)).limit(200);
  const porEstado: Record<string, number> = {};
  for (const c of corr14 || []) porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
  for (const [est, n] of Object.entries(porEstado)) {
    if (n >= 3 && await proponer('regla_guion', { id: `estado:${est}:${ahora.toISOString().slice(0, 7)}`, estado: est, correcciones: n, muestras: (corr14 || []).filter(c => c.estado === est).slice(0, 3).map(c => c.pulida) }, { n }, 30)) {
      await notificar({ clave: `regla:${est}:${ahora.toISOString().slice(0, 10)}`, tipo: 'ti_regla', nivel: 'info', titulo: `${n} correcciones en «${est}» en 14 días: hay una regla que el guion no tiene`, detalle: 'Claude las lee y te propone la redacción de la regla en la próxima sesión; mientras, ya entran como ejemplos.', destino: 'trabajo' });
      res.propuestas.push(`regla_guion:${est}`); res.avisos++;
    }
  }

  // ── 4d) PARES AGENTE/HUMANO sin veredicto del dueño: el curador decide cuál enseñar (máx. 20 por noche).
  //       Si el dueño ya dio veredicto en el panel, se respeta; esto solo cubre los que nadie revisó en 24 h.
  res.pares = { revisados: 0, humano_mejor: 0, agente_mejor: 0 };
  if (hasApiKey()) {
    const { data: pares } = await supabase.from('ti_envios').select('id, contact_id, mensaje, humano_respuesta, salida, created_at')
      .not('humano_respuesta', 'is', null).is('veredicto_par', null).lt('created_at', hace(1)).order('created_at', { ascending: false }).limit(20);
    for (const p of pares || []) {
      try {
        const r = await anthropic.messages.create({
          model: MODELS.opus, max_tokens: 300,
          messages: [{ role: 'user', content: `Eres el curador del agente SDR de Sacscloud (retail de moda). Mismo turno, dos respuestas al lead. Lead dijo: «${String((p.salida as any)?.ultimo_mensaje || '').slice(0, 300)}». Estado del guion: ${(p.salida as any)?.estado || '?'}.\n\nA (agente): ${String(p.mensaje).slice(0, 600)}\n\nB (consultor humano): ${String(p.humano_respuesta).slice(0, 600)}\n\nCriterio: entender antes de vender, reflejar lo que dijo el lead, lenguaje del giro, corto y cálido, sin precios antes de conocer giro/tiendas, sin descuentos ni promesas, no solo un link, avanza hacia llamada o demo cuando toca. Responde SOLO JSON: {"mejor":"A|B|empate","razon":"una línea"}` }],
        });
        const t = (r.content.find(b => b.type === 'text') as any)?.text || '{}';
        const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
        const v = j.mejor === 'B' ? 'humano_mejor' : j.mejor === 'A' ? 'agente_mejor' : 'empate';
        await supabase.from('ti_envios').update({ veredicto_par: `curador:${v}` }).eq('id', p.id);
        await supabase.from('ia_ejemplos').update({ estado_rev: v === 'humano_mejor' ? 'aprobado' : 'rechazado', revisado_at: ahora.toISOString(), por_que: `Par agente/humano · envio:${p.id} · Curador: ${j.razon || ''}` }).eq('fuente', 'humano_antes').ilike('por_que', `%envio:${p.id}%`);
        res.pares.revisados++; if (v === 'humano_mejor') res.pares.humano_mejor++; if (v === 'agente_mejor') res.pares.agente_mejor++;
      } catch { /* siguiente par */ }
    }
  }

  // ── 4e) CALIFICACIÓN MASIVA: índice de vida de todos los leads activos + sugerencias de descalificar (F4) ──
  try { const { calificarLeads } = await import('../../../lib/crm/ti/agente'); res.calificacion = await calificarLeads(); } catch (e: any) { res.calificacion_error = String(e?.message || e); }

  // ── 4f) PRESUPUESTO DE IA (F5): aviso al 80 % del mes ──
  try { const { revisarPresupuesto } = await import('../../../lib/crm/ti/consumo'); res.presupuesto = await revisarPresupuesto(); } catch (e: any) { res.presupuesto_error = String(e?.message || e); }

  // ── 5) MÉTRICA NORTE: citas agendadas ayer, por quién ──
  const { data: citas } = await supabase.from('bookings').select('utm_source, estado').gte('created_at', hace(1)).limit(500);
  res.citas_ayer = { agente: (citas || []).filter(b => b.utm_source === 'agente_ia').length, humanas: (citas || []).filter(b => b.utm_source !== 'agente_ia').length };

  return json({ ok: true, ...res });
};
