// Diario 8:00 CDMX: gastos que vencen en ≤ 3 días sin pagar, adeudos con cuota pendiente y cortes de comisión del lunes → Sistema.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { resumenMes, mesDe } from '../../../lib/crm/finanzas';
import { notificar } from '../../../lib/crm/notificaciones';
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  const m = mesDe(); const r = await resumenMes(m); const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const dias = (f: string) => Math.round((Date.parse(f) - Date.parse(hoy)) / 86400e3);
  const ult = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
  const vence = (d: any) => `${m}-${String(Math.min(Number(d) || ult, ult)).padStart(2, '0')}`;
  let n = 0;
  const aviso = async (clave: string, titulo: string, detalle: string, nivel: 'info' | 'alerta' | 'urgente' = 'alerta') => { const ok = await notificar({ clave, tipo: 'sistema_finanzas', nivel, titulo, detalle, metadata: { origen: 'finanzas', que_hacer: 'Finanzas → Gastos', url: '/admin/crm?tab=fin-gastos' } } as any).catch(() => false); if (ok) n++; };
  for (const g of r.gastos.lista) { if (g.pago || g.probable) continue; const f = vence(g.dia_cobro); const d = dias(f); if (d <= 3) await aviso(`fin_gasto:${g.id}:${m}`, d < 0 ? `Venció ${g.nombre} (${pesosTxt(g.monto)})` : d === 0 ? `Hoy vence ${g.nombre} (${pesosTxt(g.monto)})` : `${g.nombre} vence en ${d} día${d === 1 ? '' : 's'} (${pesosTxt(g.monto)})`, `Día de cobro ${g.dia_cobro || 'fin de mes'}. Márcalo pagado en Finanzas cuando salga.`, d <= 0 ? 'urgente' : 'alerta'); }
  for (const a of r.adeudos.lista) { if (a.toca_este_mes <= a.abonado_mes) continue; const f = vence(a.dia_pago); const d = dias(f); if (d <= 3) await aviso(`fin_adeudo:${a.id}:${m}`, `${a.nombre}: toca abonar ${pesosTxt(a.toca_este_mes - a.abonado_mes)}${d < 0 ? ' (ya venció)' : d === 0 ? ' hoy' : ` en ${d} días`}`, `Saldo ${pesosTxt(a.saldo)}${a.atraso > 0 ? ` · incluye ${pesosTxt(a.atraso)} atrasado` : ''}.`, d <= 0 ? 'urgente' : 'alerta'); }
  for (const c of r.comisiones.cortes) { if (c.pagado) continue; const d = dias(c.paga_el); if (d <= 1 && d >= -7) await aviso(`fin_corte:${c.id}`, `Comisión de ${c.vendedor}: ${pesosTxt(c.monto)} se paga ${d === 0 ? 'hoy' : d === 1 ? 'mañana' : c.paga_el}`, c.aceptado ? 'La vendedora ya aceptó el corte.' : 'El corte sigue abierto: ciérralo en Comisiones.'); }
  if ((r.atrasados?.lista || []).length) await aviso(`fin_atrasados:${m}`, `${r.atrasados.lista.length} gastos de meses anteriores sin pagar (${pesosTxt(r.atrasados.total)})`, 'Se juntaron en este mes. Márcalos pagados o quítalos.', 'urgente');
  return new Response(JSON.stringify({ ok: true, avisos: n }), { headers: { 'Content-Type': 'application/json' } });
};
const pesosTxt = (v: number) => '$' + Math.round(v || 0).toLocaleString('es-MX');
