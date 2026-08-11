// GET /api/revenue/quotes/proximos-pagos?meses=6
//
// Cuánto DEBERÍA entrar en los próximos meses según las parcialidades pactadas
// en las cotizaciones vivas, descontando lo ya abonado.
//
// Es la otra mitad de "pendiente de pago": ese dice cuánto falta, este dice
// CUÁNDO se comprometió a pagarlo. Un saldo sin fecha no se puede planear ni
// cobrar a tiempo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { parseMeta } from '../../../../lib/quotes/meta';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url }) => {
  const meses = Math.min(24, Math.max(1, Number(url.searchParams.get('meses')) || 6));

  const [{ data: quotes }, { data: pagos }] = await Promise.all([
    supabase.from('quotes').select('id, numero, empresa, total, estado, notas')
      .in('estado', ['sent', 'accepted', 'draft']).limit(1000),
    supabase.from('payments').select('quote_id, monto').not('quote_id', 'is', null).limit(5000),
  ]);

  const abonado = new Map<string, number>();
  for (const p of pagos || []) abonado.set(p.quote_id, (abonado.get(p.quote_id) || 0) + Number(p.monto || 0));

  const hoy = new Date().toISOString().slice(0, 10);
  const porMes: Record<string, { monto: number; parcialidades: number }> = {};
  const vencidas: any[] = [];
  const proximas: any[] = [];

  for (const q of quotes || []) {
    const { meta } = parseMeta(q.notas);
    const plan = Array.isArray(meta.plan_pagos) ? [...meta.plan_pagos].sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha))) : [];
    if (!plan.length) continue;
    // Lo abonado cubre las parcialidades en orden: sin recibo por parcialidad,
    // aplicar el dinero a la más vieja es la única regla que no inventa nada.
    let restante = abonado.get(q.id) || 0;
    for (const x of plan) {
      const monto = Number(x.monto || 0);
      const cubierto = Math.min(monto, Math.max(0, restante));
      restante -= cubierto;
      const falta = Math.round((monto - cubierto) * 100) / 100;
      if (falta <= 0.01) continue;
      const fila = { quote_id: q.id, numero: q.numero, empresa: q.empresa, concepto: x.concepto, fecha: x.fecha, monto: falta };
      if (String(x.fecha) < hoy) { vencidas.push(fila); continue; }
      const mes = String(x.fecha).slice(0, 7);
      porMes[mes] = porMes[mes] || { monto: 0, parcialidades: 0 };
      porMes[mes].monto += falta;
      porMes[mes].parcialidades++;
      proximas.push(fila);
    }
  }

  const lista = Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0])).slice(0, meses)
    .map(([mes, v]) => ({ mes, monto: Math.round(v.monto * 100) / 100, parcialidades: v.parcialidades }));

  return json({
    por_mes: lista,
    total_por_venir: Math.round(lista.reduce((a, x) => a + x.monto, 0) * 100) / 100,
    // Lo vencido va APARTE y primero: es dinero que ya se comprometió y no
    // llegó. Sumarlo al mes que viene lo escondería.
    vencidas: vencidas.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    total_vencido: Math.round(vencidas.reduce((a, x) => a + x.monto, 0) * 100) / 100,
    proximas: proximas.sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 50),
  });
};
