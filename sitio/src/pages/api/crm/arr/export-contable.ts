// GET /api/crm/arr/export-contable?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — CSV de
// pagos para el contador: fecha, cliente, plan, método, referencia, monto,
// IVA estimado (16%) y subtotal. Los montos se asumen CON IVA incluido (uso B2B
// MX); si tu captura es sin IVA, el contador ajusta con la columna base.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const IVA = 0.16;
const csvCell = (v: any) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export const GET: APIRoute = async ({ url }) => {
  const desde = url.searchParams.get('desde') || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const hasta = url.searchParams.get('hasta') || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.from('payments')
    .select('fecha, monto, metodo, referencia, periodo_cubierto, companies(nombre, sacs_account), subscriptions(nombre_plan, ciclo)')
    .gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }).limit(5000);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const header = ['Fecha', 'Cliente', 'Cuenta SACS', 'Plan', 'Ciclo', 'Método', 'Referencia', 'Periodo', 'Total (con IVA)', 'Subtotal', 'IVA 16%'];
  const rows = (data || []).map((p: any) => {
    const total = Number(p.monto || 0);
    const base = total / (1 + IVA);
    return [
      p.fecha, p.companies?.nombre || '', p.companies?.sacs_account || '',
      p.subscriptions?.nombre_plan || '', p.subscriptions?.ciclo || '',
      p.metodo || '', p.referencia || '', p.periodo_cubierto || '',
      total.toFixed(2), base.toFixed(2), (total - base).toFixed(2),
    ].map(csvCell).join(',');
  });
  const totalPeriodo = (data || []).reduce((a: number, p: any) => a + Number(p.monto || 0), 0);
  rows.push(''); rows.push(['', '', '', '', '', '', '', 'TOTAL', totalPeriodo.toFixed(2), (totalPeriodo / (1 + IVA)).toFixed(2), (totalPeriodo - totalPeriodo / (1 + IVA)).toFixed(2)].map(csvCell).join(','));

  const nota = csvCell('NOTA: los montos se asumen CON IVA (16%) incluido. Subtotal e IVA son estimados; si la captura fue sin IVA, ajustar.');
  const csv = '﻿' + [nota, header.join(','), ...rows].join('\n'); // BOM para Excel es-MX
  return new Response(csv, {
    status: 200,
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="pagos-sacs-${desde}-a-${hasta}.csv"` },
  });
};
