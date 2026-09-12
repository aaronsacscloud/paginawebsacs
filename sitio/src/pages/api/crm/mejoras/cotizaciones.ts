// Las cotizaciones de una cuenta, listas para ligarlas a una partida de
// Consultoría.
//
// La ficha ya guardaba `mejoras.quote_id`, pero nunca hubo campo para llenarla:
// 0 de 61 partidas la tenían. Esto es lo que alimenta ese campo.
//
// Devuelve cada cotización con sus partidas y, en cada partida, el monto NETO
// —el de lista menos el descuento global— porque es lo que de verdad entró: el
// «Plugin de bancos» de ARTIK dice $48,000 y se cobraron $40,800. Guardar el de
// lista haría que la suma de las entregas nunca cuadre con lo cobrado.
//
// También dice qué partida YA está tomada por otra mejora. Sin eso, dos
// entregas que salieron de un mismo cobro se llevan el monto completo cada una
// y la cuenta aparece pagando el doble (pasa en ARTIK: «Alertas de stock
// mínimo» y «Reportes automáticos por WhatsApp» salieron del mismo Plugin de
// gastos).
//
// GET ?company_id=
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { netoDePartida, baseDeCotizacion, categoriaDePartida } from '../../../../lib/crm/pagos-unicos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const NO_SON = ['plantilla', 'deleted'];

export const GET: APIRoute = async ({ url }) => {
  const companyId = String(url.searchParams.get('company_id') || '');
  if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);

  const [{ data: cots }, { data: usadas }, { data: pagos }] = await Promise.all([
    supabase.from('quotes')
      .select('id, numero, estado, total, created_at, pagado_fecha, items, descuento_global, descuento_tipo')
      .eq('company_id', companyId).not('estado', 'in', `(${NO_SON.join(',')})`)
      .order('created_at', { ascending: false }).limit(40),
    supabase.from('mejoras')
      .select('id, titulo, quote_id, quote_item, valor')
      .eq('company_id', companyId).is('archived_at', null).not('quote_id', 'is', null),
    /* Lo que de verdad ENTRÓ por cada cotización. Una cotización de $150,000
       que se está pagando en cinco partes lleva $30,000 cobrados, y hasta
       ahora Consultoría reportaba $0 porque solo miraba lo entregado. El
       dinero que ya entró no puede depender de si la entrega terminó. */
    supabase.from('payments').select('quote_id, monto, fecha')
      .eq('company_id', companyId).not('quote_id', 'is', null).neq('estado', 'reembolsado'),
  ]);

  const pagadoPorCot: Record<string, { monto: number; n: number; ultimo: string | null }> = {};
  for (const p of (pagos || [])) {
    const r = pagadoPorCot[p.quote_id] || (pagadoPorCot[p.quote_id] = { monto: 0, n: 0, ultimo: null });
    r.monto += Number(p.monto || 0);
    r.n++;
    if (!r.ultimo || String(p.fecha) > r.ultimo) r.ultimo = String(p.fecha).slice(0, 10);
  }

  // Quién ya usa cada partida, para poder avisarlo en el momento de elegir.
  const tomadas = new Map<string, any[]>();
  for (const m of (usadas || [])) {
    if (!m.quote_item) continue;
    const k = `${m.quote_id}|${m.quote_item}`;
    if (!tomadas.has(k)) tomadas.set(k, []);
    tomadas.get(k)!.push({ id: m.id, titulo: m.titulo, valor: Number(m.valor || 0) });
  }

  // Las pagadas primero: son las que se están capturando.
  const orden = (q: any) => (q.estado === 'paid' ? 0 : q.estado === 'accepted' ? 1 : 2);
  const lista = (cots || []).map((q: any) => ({
    id: q.id, numero: q.numero, estado: q.estado, total: Number(q.total || 0),
    fecha: q.created_at, pagado_fecha: q.pagado_fecha,
    pagado: Math.round(pagadoPorCot[q.id]?.monto || 0),
    pagos: pagadoPorCot[q.id]?.n || 0,
    ultimo_pago: pagadoPorCot[q.id]?.ultimo || null,
    // Lo que falta por entrar. Con cero pagos no es «falta todo»: es que
    // todavía no arranca el cobro, y eso se lee distinto.
    saldo: Math.max(0, Math.round(Number(q.total || 0) - (pagadoPorCot[q.id]?.monto || 0))),
    descuento: Number(q.descuento_global || 0), descuento_tipo: q.descuento_tipo || 'pct',
    partidas: (Array.isArray(q.items) ? q.items : [])
      .filter((i: any) => Number(i?.monto) > 0)
      .map((i: any, idx: number) => {
        // La llave es el NOMBRE, no el índice: reordenar la cotización no debe
        // mover el dinero de una entrega a otra.
        const clave = String(i.nombre || `#${idx}`);
        return {
          clave, nombre: i.nombre, categoria: categoriaDePartida(i.nombre),
          lista: Math.round(Number(i.monto) || 0),
          neto: netoDePartida(Number(i.monto) || 0, q.descuento_global, q.descuento_tipo, baseDeCotizacion(q.items)),
          tomada: tomadas.get(`${q.id}|${clave}`) || [],
        };
      }),
  })).sort((a: any, b: any) => orden(a) - orden(b) || String(b.fecha).localeCompare(String(a.fecha)));

  return json({ cotizaciones: lista });
};
