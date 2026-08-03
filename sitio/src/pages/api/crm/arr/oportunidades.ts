// GET /api/crm/arr/oportunidades — todos los clientes con una SEÑAL (oportunidad
// de venta o riesgo), derivada de la actividad real de SACS (companies.actividad,
// que llena el cron cada 6h) → cero carga a SACS. Founder-only (middleware).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { computarSenales } from '../../../../lib/crm/senales';
import { cargarCatalogo } from '../../../../lib/crm/plan-modulos-db';

export const prerender = false;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET: APIRoute = async () => {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, nombre, sacs_account, plan, sucursales, mrr, arr, estado_cuenta, health_score, dias_sin_venta, ultima_venta_at, actividad, uso_sacs, subscriptions(estado, proxima_factura, arr, mrr, nombre_plan, ciclo)')
    .is('archived_at', null).range(0, 9999);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Una sola carga del catálogo plan→módulos para todas las empresas.
  const catalogo = await cargarCatalogo();

  const data = (companies || [])
    // Solo clientes con suscripción ACTIVA: uno ya cancelado no es candidato a
    // upsell (ej. auraactivewear salía con "Ampliar sucursales" y MRR $0).
    .filter((c: any) => (c.subscriptions || []).some((s: any) => s.estado === 'activa'))
    .map((c: any) => {
      const activas = (c.subscriptions || []).filter((s: any) => s.estado === 'activa');
      const senales = computarSenales(c, activas[0], { catalogo, subsActivas: activas });
      if (!senales.length) return null;
      const top = senales[0];
      return {
        company_id: c.id, nombre: c.nombre, sacs_account: c.sacs_account,
        plan: c.plan, health_score: c.health_score, dias_sin_venta: c.dias_sin_venta,
        mrr: r2(activas.reduce((a: number, s: any) => a + Number(s.mrr || 0), 0) || Number(c.mrr || 0)),
        arr: r2(activas.reduce((a: number, s: any) => a + Number(s.arr || 0), 0) || Number(c.arr || 0)),
        top_tipo: top.tipo, top_nivel: top.nivel, top_titulo: top.titulo, top_accion: top.accion,
        n_oportunidades: senales.filter(s => s.nivel === 'oportunidad').length,
        n_riesgos: senales.filter(s => s.nivel === 'riesgo').length,
        senales,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (b.senales[0].peso - a.senales[0].peso) || (b.arr - a.arr));

  const porTipo: Record<string, number> = {};
  (data as any[]).forEach(c => c.senales.forEach((s: any) => { porTipo[s.tipo] = (porTipo[s.tipo] || 0) + 1; }));

  const resumen = {
    total: data.length,
    oportunidades: (data as any[]).filter(c => c.n_oportunidades > 0).length,
    riesgos: (data as any[]).filter(c => c.n_riesgos > 0).length,
    arr_en_riesgo: r2((data as any[]).filter(c => c.n_riesgos > 0).reduce((a, c) => a + c.arr, 0)),
    por_tipo: porTipo,
  };
  return new Response(JSON.stringify({ data, resumen }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
