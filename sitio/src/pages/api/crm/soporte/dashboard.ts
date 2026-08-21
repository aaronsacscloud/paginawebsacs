// SOPORTE · Dashboard global (founder-only por middleware). Agrega
// crm_soporte_tickets: volumen por estado/tema/sentimiento, SLA (primera
// respuesta y resolución), CSAT, tickets sin ligar, carga por agente y
// tendencia diaria. Todo en JS (volumen de cientos, no millones).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { TEMA_LABEL } from '../../../../lib/soporte/clasificar';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const ABIERTO = ['abierto', 'en_curso', 'pausado'];
const horas = (a?: string | null, b?: string | null) => (a && b) ? (new Date(b).getTime() - new Date(a).getTime()) / 3600_000 : null;
const prom = (xs: number[]) => xs.length ? Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10 : null;

// PostgREST corta en 1000 filas EN ESTE PROYECTO (max_rows=1000): un .limit()
// mayor subcuenta en silencio. Paginamos para no falsear los agregados.
async function leerTodos(): Promise<any[]> {
  const cols = 'conversation_id, company_id, cuenta, estado, tema, sentimiento, asignado, abierto_at, primera_respuesta_at, resuelto_at, ultima_actividad_at, csat_score, reabierto_count';
  const out: any[] = [];
  for (let off = 0; off < 200000; off += 1000) {
    const { data, error } = await supabase.from('crm_soporte_tickets').select(cols).order('conversation_id').range(off, off + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const GET: APIRoute = async ({ url }) => {
  const dias = Math.min(120, Math.max(7, Number(url.searchParams.get('dias') || 30)));
  let t: any[];
  try { t = await leerTodos(); } catch (e: any) { return json({ error: e?.message || 'Error al leer tickets' }, 500); }

  // Conteo por campo con default configurable (sentimiento null = 'neutral', no
  // un bucket 'otros' que no existe en esa dimensión).
  const cuentaCon = (k: string, def: string) => t.reduce((m: Record<string, number>, x: any) => { const v = x[k] || def; m[v] = (m[v] || 0) + 1; return m; }, {} as Record<string, number>);
  const cuenta = (k: string) => cuentaCon(k, 'otros');
  const abiertos = t.filter((x: any) => ABIERTO.includes(x.estado));
  const resueltos = t.filter((x: any) => x.estado === 'resuelto' || x.estado === 'cerrado');

  // Estancados (abierto, sin actividad > 48 h).
  const corte = Date.now() - 48 * 3600_000;
  const estancados = abiertos.filter((x: any) => { const ref = x.ultima_actividad_at || x.abierto_at; return ref ? new Date(ref).getTime() < corte : false; });
  const estancadoIds = new Set(estancados.map((x: any) => x.conversation_id));

  // SLA. FRT = tiempo a la 1ª respuesta sobre CUALQUIER ticket que ya la tuvo
  // (resuelto o no), no solo los resueltos — si no, sesga el indicador.
  const frt = t.filter((x: any) => x.primera_respuesta_at).map((x: any) => horas(x.abierto_at, x.primera_respuesta_at)).filter((v): v is number => v != null && v >= 0);
  const res = resueltos.map((x: any) => horas(x.abierto_at, x.resuelto_at)).filter((v): v is number => v != null && v >= 0);
  const csats = t.map((x: any) => x.csat_score).filter((v: any) => v != null).map(Number);

  // Top temas (con etiqueta legible).
  const porTema = Object.entries(cuenta('tema')).map(([k, n]) => ({ tema: k, label: TEMA_LABEL[k] || k, n })).sort((a: any, b: any) => b.n - a.n);

  // Carga por agente.
  const porAgente = Object.entries(t.reduce((m: Record<string, any>, x: any) => {
    const a = x.asignado || 'Sin asignar'; m[a] = m[a] || { agente: a, abiertos: 0, total: 0 };
    m[a].total++; if (ABIERTO.includes(x.estado)) m[a].abiertos++; return m;
  }, {})).map(([, v]) => v).sort((a: any, b: any) => b.abiertos - a.abiertos);

  // ── Clientes que más piden atención ───────────────────────────────────
  // Ranking por volumen EN LA VENTANA elegida, no histórico: un cliente con 20
  // tickets de hace medio año no está pidiendo atención hoy. Manda la ÚLTIMA
  // ACTIVIDAD sobre la apertura — un hilo viejo que sigue vivo sí cuenta.
  // Los tickets sin company_id se agrupan por la cuenta SACS cruda para que no
  // desaparezcan del ranking mientras el backfill los liga.
  const cortePeriodo = Date.now() - dias * 86400_000;
  const acum = new Map<string, any>();
  for (const x of t) {
    const cta = (x.cuenta || '').trim().toLowerCase();
    const key = x.company_id || `cuenta:${cta || 'sin-identificar'}`;
    let c = acum.get(key);
    if (!c) {
      c = { company_id: x.company_id || null, cuenta: x.cuenta || null, nombre: null, plan: null, estado_cuenta: null,
            n: 0, total: 0, abiertos: 0, estancados: 0, urgentes: 0, ultimo: null as string | null, temas: {} as Record<string, number> };
      acum.set(key, c);
    }
    const ref = x.ultima_actividad_at || x.abierto_at || null;
    c.total++;
    if (ref && (!c.ultimo || ref > c.ultimo)) c.ultimo = ref;
    if (ABIERTO.includes(x.estado)) c.abiertos++;
    if (estancadoIds.has(x.conversation_id)) c.estancados++;
    if (!ref || new Date(ref).getTime() < cortePeriodo) continue;
    c.n++;
    if (x.sentimiento === 'urgente' || x.sentimiento === 'negativo') c.urgentes++;
    const tm = x.tema || 'otros';
    c.temas[tm] = (c.temas[tm] || 0) + 1;
  }
  const topClientes = [...acum.values()]
    .filter((c: any) => c.n > 0)
    .sort((a: any, b: any) => b.n - a.n || b.abiertos - a.abiertos || b.urgentes - a.urgentes)
    .slice(0, 25)
    .map((c: any) => {
      const tema = Object.entries(c.temas).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || null;
      const { temas, ...resto } = c;
      return { ...resto, tema, tema_label: tema ? (TEMA_LABEL[tema] || tema) : null };
    });

  // Los nombres, en UNA consulta por los ids del top (no una por cliente).
  const idsTop = topClientes.map((c: any) => c.company_id).filter(Boolean) as string[];
  if (idsTop.length) {
    const { data: emp } = await supabase.from('companies').select('id, nombre, nombre_comercial, plan, estado_cuenta').in('id', idsTop);
    const porId = new Map((emp || []).map((e: any) => [e.id, e]));
    for (const c of topClientes as any[]) {
      const e = c.company_id ? porId.get(c.company_id) : null;
      if (!e) continue;
      c.nombre = e.nombre_comercial || e.nombre || null;
      c.plan = e.plan || null;
      c.estado_cuenta = e.estado_cuenta || null;
    }
  }

  // Tendencia diaria (abiertos vs resueltos) últimos `dias`, en DÍA DE MÉXICO
  // (CDMX = UTC−6): sin esto, un ticket de la tarde/noche cae en el día UTC
  // siguiente y la curva queda corrida para el negocio mexicano.
  const diaMx = (iso?: string | null) => iso ? new Date(new Date(iso).getTime() - 6 * 3600_000).toISOString().slice(0, 10) : null;
  const serie: Record<string, { dia: string; abiertos: number; resueltos: number }> = {};
  const ahoraMx = Date.now() - 6 * 3600_000;
  for (let i = dias - 1; i >= 0; i--) { const d = new Date(ahoraMx - i * 86400_000).toISOString().slice(0, 10); serie[d] = { dia: d, abiertos: 0, resueltos: 0 }; }
  for (const x of t) {
    const da = diaMx(x.abierto_at); if (da && serie[da]) serie[da].abiertos++;
    const dr = diaMx(x.resuelto_at); if (dr && serie[dr]) serie[dr].resueltos++;
  }

  return json({
    totales: {
      total: t.length, abiertos: abiertos.length, resueltos: resueltos.length,
      en_curso: t.filter((x: any) => x.estado === 'en_curso').length,
      estancados: estancados.length,
      sin_ligar: t.filter((x: any) => !x.company_id).length,
      reabiertos: t.filter((x: any) => (x.reabierto_count || 0) > 0).length,
    },
    sla: {
      frt_promedio_horas: prom(frt), resolucion_promedio_horas: prom(res),
      csat_promedio: csats.length ? Math.round((csats.reduce((s, v) => s + v, 0) / csats.length) * 10) / 10 : null,
      csat_n: csats.length,
    },
    por_estado: cuenta('estado'),
    por_sentimiento: cuentaCon('sentimiento', 'neutral'),
    por_tema: porTema,
    por_agente: porAgente,
    top_clientes: topClientes,
    periodo_dias: dias,
    tendencia: Object.values(serie),
  });
};
