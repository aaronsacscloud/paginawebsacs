// CHURN · el tablero: de qué nos morimos y qué tanto recuperamos.
//
// El dinero NO se suma contando casos: sale del ledger de MRR, que es la
// contabilidad. Contar casos y sumar sus montos daría un número parecido pero
// distinto al de la ARR, y dos cifras que deberían ser la misma cifra son la
// forma más rápida de que nadie confíe en ninguna.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { MOTIVO, ETAPA } from '../../../../lib/crm/churn.reglas';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const meses = Math.min(parseInt(url.searchParams.get('meses') || '6'), 24);

  const { data: casos } = await supabase.from('churn_casos')
    .select('etapa, motivo_categoria, mrr_perdido, resultado, detectado_at, cerrado_at, gracia_acuerdo, gracia_mrr, fecha_estimada');

  // ── De qué nos morimos: por categoría, ordenado por DINERO, no por conteo.
  // Cinco casos chicos importan menos que uno grande, y el orden lo tiene que
  // decir lo que duele.
  const porMotivo: Record<string, { n: number; mrr: number }> = {};
  const embudo: Record<string, number> = {};
  let tiempoTotal = 0, tiempoN = 0, recuperados = 0, cerrados = 0;

  for (const c of casos || []) {
    embudo[c.etapa] = (embudo[c.etapa] || 0) + 1;
    const k = c.motivo_categoria || 'sin_clasificar';
    porMotivo[k] = porMotivo[k] || { n: 0, mrr: 0 };
    porMotivo[k].n++; porMotivo[k].mrr += Number(c.mrr_perdido || 0);

    if (c.cerrado_at) {
      cerrados++;
      if (c.resultado === 'recuperado') recuperados++;
      /* El tiempo de rescate SOLO se promedia sobre fechas reales. 22 de los
         35 históricos vinieron de Excel sin fecha de cancelación; meterlos en
         el promedio lo volvería un número inventado con cara de dato. */
      if (!c.fecha_estimada && c.detectado_at) {
        tiempoTotal += (Date.parse(c.cerrado_at) - Date.parse(c.detectado_at)) / 86400000;
        tiempoN++;
      }
    }
  }

  // ── El dinero, del ledger ──
  const desde = new Date(); desde.setMonth(desde.getMonth() - (meses - 1)); desde.setDate(1);
  const { data: mov } = await supabase.from('mrr_movements')
    .select('fecha, tipo, mrr_delta').gte('fecha', desde.toISOString().slice(0, 10))
    .in('tipo', ['churn', 'reactivation']);
  const porMes: Record<string, { perdido: number; recuperado: number }> = {};
  for (const m of mov || []) {
    const mes = String(m.fecha).slice(0, 7);
    porMes[mes] = porMes[mes] || { perdido: 0, recuperado: 0 };
    if (m.tipo === 'churn') porMes[mes].perdido += Math.abs(Number(m.mrr_delta || 0));
    else porMes[mes].recuperado += Math.abs(Number(m.mrr_delta || 0));
  }

  // ── Qué acuerdos de gracia funcionan ──
  const porAcuerdo: Record<string, { n: number; ok: number }> = {};
  for (const c of casos || []) {
    if (!c.gracia_acuerdo || !c.cerrado_at) continue;
    const k = String(c.gracia_acuerdo).slice(0, 60);
    porAcuerdo[k] = porAcuerdo[k] || { n: 0, ok: 0 };
    porAcuerdo[k].n++;
    if (c.resultado === 'recuperado') porAcuerdo[k].ok++;
  }

  return json({
    embudo: Object.entries(embudo).map(([id, n]) => ({ id, l: ETAPA(id as any).l, n })),
    motivos: Object.entries(porMotivo)
      .map(([id, v]) => ({ id, l: id === 'sin_clasificar' ? 'Sin clasificar' : MOTIVO(id), ...v, mrr: Math.round(v.mrr) }))
      .sort((a, b) => b.mrr - a.mrr),
    meses: Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, perdido: Math.round(v.perdido), recuperado: Math.round(v.recuperado) })),
    acuerdos: Object.entries(porAcuerdo).map(([l, v]) => ({ l, ...v })).sort((a, b) => b.n - a.n),
    resumen: {
      cerrados, recuperados,
      tasa: cerrados ? Math.round((recuperados / cerrados) * 100) : null,
      dias_promedio: tiempoN ? Math.round(tiempoTotal / tiempoN) : null,
      // Se dice sobre cuántos se calculó: un promedio sin su n es un rumor.
      dias_base: tiempoN,
    },
  });
};
