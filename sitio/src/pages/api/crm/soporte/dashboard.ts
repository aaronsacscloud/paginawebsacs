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

export const GET: APIRoute = async ({ url }) => {
  const dias = Math.min(120, Math.max(7, Number(url.searchParams.get('dias') || 30)));
  const { data, error } = await supabase.from('crm_soporte_tickets')
    .select('conversation_id, company_id, cuenta, estado, tema, sentimiento, asignado, abierto_at, primera_respuesta_at, resuelto_at, ultima_actividad_at, csat_score, reabierto_count')
    .limit(5000);
  if (error) return json({ error: error.message }, 500);
  const t = data || [];

  const cuenta = (k: string) => t.reduce((m: Record<string, number>, x: any) => { const v = x[k] || 'otros'; m[v] = (m[v] || 0) + 1; return m; }, {});
  const abiertos = t.filter((x: any) => ABIERTO.includes(x.estado));
  const resueltos = t.filter((x: any) => x.estado === 'resuelto' || x.estado === 'cerrado');

  // Estancados (abierto, sin actividad > 48 h).
  const corte = Date.now() - 48 * 3600_000;
  const estancados = abiertos.filter((x: any) => { const ref = x.ultima_actividad_at || x.abierto_at; return ref ? new Date(ref).getTime() < corte : false; });

  // SLA.
  const frt = resueltos.map((x: any) => horas(x.abierto_at, x.primera_respuesta_at)).filter((v): v is number => v != null && v >= 0);
  const res = resueltos.map((x: any) => horas(x.abierto_at, x.resuelto_at)).filter((v): v is number => v != null && v >= 0);
  const csats = t.map((x: any) => x.csat_score).filter((v: any) => v != null).map(Number);

  // Top temas (con etiqueta legible).
  const porTema = Object.entries(cuenta('tema')).map(([k, n]) => ({ tema: k, label: TEMA_LABEL[k] || k, n })).sort((a: any, b: any) => b.n - a.n);

  // Carga por agente.
  const porAgente = Object.entries(t.reduce((m: Record<string, any>, x: any) => {
    const a = x.asignado || 'Sin asignar'; m[a] = m[a] || { agente: a, abiertos: 0, total: 0 };
    m[a].total++; if (ABIERTO.includes(x.estado)) m[a].abiertos++; return m;
  }, {})).map(([, v]) => v).sort((a: any, b: any) => b.abiertos - a.abiertos);

  // Tendencia diaria (abiertos vs resueltos) últimos `dias`.
  const hoy = new Date(); const serie: Record<string, { dia: string; abiertos: number; resueltos: number }> = {};
  for (let i = dias - 1; i >= 0; i--) { const d = new Date(hoy.getTime() - i * 86400_000).toISOString().slice(0, 10); serie[d] = { dia: d, abiertos: 0, resueltos: 0 }; }
  for (const x of t) {
    const da = x.abierto_at ? x.abierto_at.slice(0, 10) : null; if (da && serie[da]) serie[da].abiertos++;
    const dr = x.resuelto_at ? x.resuelto_at.slice(0, 10) : null; if (dr && serie[dr]) serie[dr].resueltos++;
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
    por_sentimiento: cuenta('sentimiento'),
    por_tema: porTema,
    por_agente: porAgente,
    tendencia: Object.values(serie),
  });
};
