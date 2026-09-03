// Lo que UNA cuenta debe: el pendiente de cobro de sus cotizaciones.
//
// La ficha del cliente sabía decir cuánto genera al año (ARR), cuánto se le
// cotizó y sigue sobre la mesa, y cuánto se cayó. No sabía decir lo más
// concreto de los tres: cuánto DEBE hoy y para cuándo.
//
// El hueco tenía forma: una venta ganada de un solo golpe —una
// personalización, un desarrollo— no es ARR (no se renueva), no es «sobre la
// mesa» (ya se ganó) y no es una vitalicia. Se caía entre las cuatro tarjetas
// y desaparecía de la ficha justo cuando había dinero real esperando.
//
// GET ?company_id= → { total, vencido, lineas[] }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { planDeCotizacion } from '../../../../lib/quotes/plan.ts';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id') || '';
  if (!companyId) return json({ error: 'Falta la cuenta.' }, 400);

  // 'expired' entra a propósito: la vigencia caduca el PRECIO, no el cobro. Una
  // cotización aceptada que ya recibió un abono no deja de deberse porque su
  // vigencia pasó, y dejarla fuera la borra justo cuando hay algo que cobrar.
  const { data: cots, error } = await supabase.from('quotes')
    .select('id, numero, total, estado, notas, aceptado_fecha, created_at')
    .eq('company_id', companyId).in('estado', ['accepted', 'expired'])
    .order('created_at', { ascending: false }).limit(50);
  if (error) return json({ error: error.message }, 500);
  if (!cots?.length) return json({ total: 0, vencido: 0, lineas: [] });

  const ids = cots.map(q => q.id);
  const { data: pagos } = await supabase.from('payments')
    .select('quote_id, monto').in('quote_id', ids).neq('estado', 'reembolsado');
  const abonado = new Map<string, number>();
  for (const p of pagos || []) abonado.set(p.quote_id, (abonado.get(p.quote_id) || 0) + Number(p.monto || 0));

  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const lineas: any[] = [];
  for (const q of cots) {
    const ab = abonado.get(q.id) || 0;
    const plan = planDeCotizacion(q, ab, hoy);
    if (plan.length) {
      // Con plan, lo que se debe son las exhibiciones pendientes, cada una con
      // su fecha: es la diferencia entre «debe $150,000» y «le toca pagar
      // $30,000 el 15». Reclamar el total de algo ya pactado a plazos es la
      // forma más rápida de perder la conversación.
      for (const x of plan) {
        if (x.estado !== 'pendiente') continue;
        lineas.push({
          quote_id: q.id, numero: q.numero, concepto: x.concepto,
          detalle: `${x.numero} de ${x.total}`, fecha: x.fecha,
          monto: x.monto, vencida: x.vencida, tipo: 'parcialidad',
        });
      }
      continue;
    }
    // Sin plan: se debe el saldo, de una sola vez.
    const falta = Math.round((Number(q.total || 0) - ab) * 100) / 100;
    if (falta <= 0.01) continue;
    lineas.push({
      quote_id: q.id, numero: q.numero, concepto: 'Saldo de la cotización',
      detalle: ab > 0 ? `lleva ${ab} de ${Number(q.total || 0)}` : null,
      fecha: String(q.aceptado_fecha || q.created_at).slice(0, 10),
      monto: falta, vencida: false, tipo: 'saldo',
    });
  }

  lineas.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  return json({
    total: lineas.reduce((s, x) => s + x.monto, 0),
    vencido: lineas.filter(x => x.vencida).reduce((s, x) => s + x.monto, 0),
    lineas,
  });
};
