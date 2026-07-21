// GET /api/crm/arr/mrr-movimiento?meses=6 — movimiento de MRR por mes:
//   • nuevo  = MRR de suscripciones CREADAS ese mes.
//   • churn  = MRR de suscripciones CANCELADAS ese mes (cancelada_at).
//   • neto   = nuevo − churn.
// (Expansión/contracción requieren un historial de cambios de precio que hoy no se
//  guarda; se deja como siguiente paso.)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const r2 = (n: number) => Math.round(n * 100) / 100;
function json(o: any, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export const GET: APIRoute = async ({ url }) => {
  const nMeses = Math.min(Math.max(Number(url.searchParams.get('meses') || 6), 1), 24);
  try {
    const { data: subs, error } = await supabase.from('subscriptions').select('mrr, created_at, cancelada_at, estado');
    if (error) throw error;

    const hoy = new Date();
    const meses: { mes: string; nuevo: number; churn: number; neto: number }[] = [];
    for (let i = nMeses - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({ mes: d.toISOString().slice(0, 7), nuevo: 0, churn: 0, neto: 0 });
    }
    const idx = (iso: string) => meses.findIndex(m => (iso || '').slice(0, 7) === m.mes);

    for (const s of subs || []) {
      const mrr = Number(s.mrr) || 0;
      if (s.created_at) { const i = idx(s.created_at); if (i >= 0) meses[i].nuevo = r2(meses[i].nuevo + mrr); }
      if (s.cancelada_at) { const i = idx(s.cancelada_at); if (i >= 0) meses[i].churn = r2(meses[i].churn + mrr); }
    }
    meses.forEach(m => { m.neto = r2(m.nuevo - m.churn); });

    const totales = {
      nuevo: r2(meses.reduce((a, m) => a + m.nuevo, 0)),
      churn: r2(meses.reduce((a, m) => a + m.churn, 0)),
      neto: r2(meses.reduce((a, m) => a + m.neto, 0)),
    };
    return json({ meses, totales });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
