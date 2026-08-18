// Bajas de un mes, agrupadas por motivo.
//
// El conteo suelto no enseña nada: "se fueron 3" no se puede accionar, "3 por
// precio" sí. Vive aparte de /cobranza para que la sección de ARR pueda pedirlo
// sin arrastrar toda la cartera vencida.
//
// GET ?mes=YYYY-MM (por defecto, el mes en curso)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const num = (x: any) => Number(x || 0);

export const GET: APIRoute = async ({ url }) => {
  const mes = (url.searchParams.get('mes') || new Date().toISOString().slice(0, 7)).slice(0, 7);
  const ini = mes + '-01';
  const [y, m] = mes.split('-').map(Number);
  const fin = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);   // primer día del siguiente

  const [{ data: subs }, { data: comps }] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, company_id, nombre_plan, ciclo, precio, arr, mrr, razon_cancelacion, cancelada_at')
      .eq('estado', 'cancelada').gte('cancelada_at', ini).lt('cancelada_at', fin),
    supabase.from('companies').select('id, nombre, nombre_comercial'),
  ]);
  const emp = Object.fromEntries((comps || []).map((c: any) => [c.id, c.nombre_comercial || c.nombre]));

  const filas = (subs || []).map((s: any) => ({
    id: s.id, company_id: s.company_id, cliente: emp[s.company_id] || 'Cuenta',
    plan: s.nombre_plan, ciclo: s.ciclo, fecha: String(s.cancelada_at || '').slice(0, 10),
    arr: Math.round(num(s.arr) || (s.ciclo === 'mensual' ? num(s.mrr) * 12 : num(s.precio))),
    // Sin motivo se dice "sin motivo registrado", no se esconde: es justo lo
    // que hay que dejar de hacer.
    motivo: String(s.razon_cancelacion || '').trim() || 'sin motivo registrado',
  })).sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha)));

  const agrupa: Record<string, { motivo: string; n: number; arr: number }> = {};
  filas.forEach((f: any) => {
    const k = f.motivo.toLowerCase().slice(0, 60);
    agrupa[k] = agrupa[k] || { motivo: f.motivo, n: 0, arr: 0 };
    agrupa[k].n++; agrupa[k].arr += f.arr;
  });

  return json({
    mes, n: filas.length,
    arr: filas.reduce((a: number, f: any) => a + f.arr, 0),
    motivos: Object.values(agrupa).sort((a, b) => b.arr - a.arr),
    filas,
  });
};
