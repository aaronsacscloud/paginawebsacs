// Los pagos ÚNICOS de una cuenta, por año.
//
// El ARR mide lo que se repite. Esto mide lo que NO: plugins, personalizaciones,
// implementaciones, vitalicias. Es dinero real que entró y que hasta ahora no
// aparecía en ninguna pantalla —ARTIK pagó $119,764 y su ficha decía $0—.
//
// Se responde partido por AÑO y con la fecha de cada cobro a propósito: la
// pregunta que contesta esta pantalla no es "cuánto ha pagado" sino "¿esta
// cuenta crece por esta vía año con año?".
//
// GET ?company_id=
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { cotizacionEsUnico, categoriaDePartida, netoDePartida } from '../../../../lib/crm/pagos-unicos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const ANULADOS = ['anulado', 'cancelado', 'duplicado', 'reembolsado'];

export const GET: APIRoute = async ({ url }) => {
  const companyId = String(url.searchParams.get('company_id') || '');
  if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);

  const [{ data: pagos }, { data: subs }] = await Promise.all([
    supabase.from('payments')
      .select('id, fecha, monto, metodo, estado, quote_id, subscription_id')
      .eq('company_id', companyId).order('fecha', { ascending: false }).limit(500),
    supabase.from('subscriptions')
      .select('id, nombre_plan, ciclo, precio, total_pagado, fecha_inicio')
      .eq('company_id', companyId).limit(100),
  ]);

  const conCot = (pagos || []).filter(p => p.quote_id && !ANULADOS.includes(String(p.estado || '').toLowerCase()));
  const ids = [...new Set(conCot.map(p => p.quote_id))];
  const { data: cots } = ids.length
    ? await supabase.from('quotes').select('id, numero, items, descuento_global, descuento_tipo, total').in('id', ids)
    : { data: [] as any[] };
  const porId = new Map((cots || []).map((q: any) => [q.id, q]));

  // ── Los cobros por cotización que SÍ son únicos ──
  const unicos: any[] = [];
  for (const p of conCot) {
    const q = porId.get(p.quote_id);
    if (!q || !cotizacionEsUnico(q.items)) continue;
    const partidas = (Array.isArray(q.items) ? q.items : [])
      .filter((i: any) => Number(i?.monto) > 0)
      .map((i: any) => ({
        nombre: i.nombre,
        categoria: categoriaDePartida(i.nombre),
        lista: Math.round(Number(i.monto) || 0),
        neto: netoDePartida(Number(i.monto) || 0, q.descuento_global, q.descuento_tipo),
      }));
    unicos.push({
      id: p.id, fecha: p.fecha, monto: Number(p.monto || 0), metodo: p.metodo,
      quote_id: q.id, numero: q.numero, origen: 'cotizacion', partidas,
    });
  }

  // ── Las vitalicias: pago de una sola vez con forma de licencia ──
  // Se fechan con su pago si lo hay; si no, con el arranque de la licencia, que
  // es lo único que se sabe. Sin esto, una vitalicia de $206,480 no tendría año.
  const pagosDeSub = new Map<string, string>();
  for (const p of (pagos || [])) if (p.subscription_id && !pagosDeSub.has(p.subscription_id)) pagosDeSub.set(p.subscription_id, p.fecha);
  for (const s of (subs || [])) {
    const esVit = /vitalicia|unico|único/i.test(String(s.ciclo || s.nombre_plan || ''));
    if (!esVit || !(Number(s.total_pagado) > 0)) continue;
    unicos.push({
      id: s.id, fecha: pagosDeSub.get(s.id) || s.fecha_inicio, monto: Number(s.total_pagado),
      metodo: null, quote_id: null, numero: null, origen: 'vitalicia',
      partidas: [{ nombre: s.nombre_plan, categoria: 'plan', lista: Math.round(Number(s.precio) || 0), neto: Math.round(Number(s.total_pagado)) }],
    });
  }

  unicos.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  // ── Por año, con la variación contra el anterior ──
  const mapa = new Map<number, any[]>();
  for (const u of unicos) {
    const a = Number(String(u.fecha || '').slice(0, 4));
    if (!a) continue;
    if (!mapa.has(a)) mapa.set(a, []);
    mapa.get(a)!.push(u);
  }
  const anios = [...mapa.keys()].sort((a, b) => b - a);
  // Se rellenan los años sin cobros entre el primero y hoy: un hueco invisible
  // se lee como "no hubo datos", y lo que dice es "no se le vendió nada".
  const hoy = new Date().getFullYear();
  const desde = anios.length ? Math.min(...anios) : hoy;
  const serie: any[] = [];
  for (let a = hoy; a >= desde; a--) {
    const lista = mapa.get(a) || [];
    serie.push({ anio: a, total: lista.reduce((s, x) => s + x.monto, 0), pagos: lista });
  }
  for (let i = 0; i < serie.length; i++) {
    const previo = serie[i + 1];
    serie[i].previo = previo ? previo.total : null;
    serie[i].delta = previo ? serie[i].total - previo.total : null;
  }

  const anioActual = serie.find(s => s.anio === hoy) || { total: 0, pagos: [] };
  return json({
    total: unicos.reduce((s, x) => s + x.monto, 0),
    anio_actual: anioActual.total,
    n_anio_actual: anioActual.pagos.length,
    ultimo: unicos[0] || null,
    por_anio: serie,
  });
};
