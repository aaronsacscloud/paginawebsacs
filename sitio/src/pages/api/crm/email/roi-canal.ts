// /api/crm/email/roi-canal — cuánto cuesta un cliente por canal.
//
// La única pregunta que decide dónde poner el siguiente peso. El CRM ya tiene
// las dos mitades y nunca las había juntado: la atribución (de qué canal vino
// cada contacto) y el dinero (qué suscripciones se activaron). Faltaba el
// gasto, que se captura a mano porque las APIs de anuncios exigen credenciales
// por plataforma y no vale la pena atarse a eso todavía.
//
// GET   → el reporte
// POST  → registrar lo que se gastó en un canal y periodo
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

/** Cómo se llama cada canal para una persona. */
const NOMBRE: Record<string, string> = {
  tiktok: 'TikTok Ads', google: 'Google', facebook: 'Facebook', instagram: 'Instagram',
  linkedin: 'LinkedIn', referido: 'Referidos', directo: 'Directo / orgánico',
};
const bonito = (c: string) => NOMBRE[c] || c;

export const GET: APIRoute = async ({ url }) => {
  const dias = Math.min(730, Math.max(30, Number(url.searchParams.get('dias')) || 180));
  const desde = new Date(Date.now() - dias * 86400000);
  const desdeISO = desde.toISOString();

  // 1 · De qué canal vino cada contacto.
  // Los LEADS se cuentan dentro de la ventana, pero el mapa empresa→canal se
  // construye con TODO el histórico: en B2B el contacto puede haber entrado
  // hace 200 días y la empresa firmar ayer. Acotarlo a la ventana descartaba
  // esa suscripción y subestimaba justo al canal de ciclo más largo.
  //
  // Y con orden ascendente: el comentario prometía "se queda el primero, el
  // que la trajo", pero sin `.order()` el primero era el que Postgres
  // devolviera — la UI afirmaba una regla que el código no cumplía.
  const { data: contactos } = await supabase.from('contacts')
    .select('id, company_id, utm_source, fuente, created_at, lifecycle_stage')
    .gte('created_at', desdeISO).is('archived_at', null)
    .order('created_at', { ascending: true }).limit(20000);

  const { data: historicos } = await supabase.from('contacts')
    .select('company_id, utm_source, fuente, created_at')
    .not('company_id', 'is', null).is('archived_at', null)
    .order('created_at', { ascending: true }).limit(20000);

  const canalDe = (c: any): string => {
    const u = String(c.utm_source || '').toLowerCase();
    if (u) return u.includes('tiktok') ? 'tiktok' : u.includes('goog') ? 'google'
      : u.includes('face') || u === 'fb' ? 'facebook' : u.includes('insta') ? 'instagram' : u;
    const f = String(c.fuente || '').toLowerCase();
    if (f.includes('tiktok')) return 'tiktok';
    if (f.includes('partner')) return 'referido';
    return 'directo';
  };

  const porCanal: Record<string, { leads: number; clientes: number; arr: number; empresas: Set<string> }> = {};
  const clientesPorCanal: Record<string, Set<string>> = {};
  const empresaCanal: Record<string, string> = {};
  // 1a · El mapa empresa→canal, con todo el histórico y en orden cronológico.
  for (const h of historicos || []) {
    if (h.company_id) empresaCanal[h.company_id] ||= canalDe(h);
  }
  // 1b · Los leads del periodo.
  for (const c of contactos || []) {
    const canal = canalDe(c);
    porCanal[canal] ||= { leads: 0, clientes: 0, arr: 0, empresas: new Set() };
    porCanal[canal].leads++;
    if (c.company_id) porCanal[canal].empresas.add(c.company_id);
  }
  // Un canal puede tener clientes sin leads nuevos en el periodo (firmó ahora,
  // entró antes): se asegura la fila para que su ARR no desaparezca.
  for (const canal of Object.values(empresaCanal)) {
    porCanal[canal] ||= { leads: 0, clientes: 0, arr: 0, empresas: new Set() };
  }

  // 2 · Qué suscripciones se activaron, y de qué canal era esa empresa.
  const empresas = Object.keys(empresaCanal);
  for (let i = 0; i < empresas.length; i += 400) {
    const { data: subs } = await supabase.from('subscriptions')
      .select('company_id, arr, estado, fecha_inicio')
      .in('company_id', empresas.slice(i, i + 400))
      .eq('estado', 'activa')
      .gte('fecha_inicio', desde.toISOString().slice(0, 10));
    for (const s of subs || []) {
      const canal = empresaCanal[s.company_id!];
      if (!canal || !porCanal[canal]) continue;
      // El ARR se SUMA por suscripción; los clientes se cuentan por EMPRESA.
      // Antes se hacía clientes++ por cada fila: 13 empresas tienen más de una
      // suscripción activa, así que la conversión salía inflada y el costo por
      // cliente subestimado.
      porCanal[canal].arr += Number(s.arr || 0);
      clientesPorCanal[canal] ||= new Set();
      clientesPorCanal[canal].add(s.company_id!);
    }
  }

  // 3 · Lo que se gastó.
  const { data: gastos } = await supabase.from('marketing_gastos')
    .select('canal, monto, periodo_inicio, periodo_fin')
    .gte('periodo_fin', desde.toISOString().slice(0, 10)).limit(2000);
  const gastoPorCanal: Record<string, number> = {};
  for (const g of gastos || []) {
    const c = String(g.canal || '').toLowerCase();
    gastoPorCanal[c] = (gastoPorCanal[c] || 0) + Number(g.monto || 0);
  }

  const filas = Object.entries(porCanal).map(([canal, v]) => {
    const gasto = gastoPorCanal[canal] || 0;
    return {
      canal, nombre: bonito(canal),
      leads: v.leads, clientes: (clientesPorCanal[canal]?.size || 0), arr: Math.round(v.arr), gasto: Math.round(gasto),
      // null cuando no hay gasto capturado: mejor un hueco visible que un cero
      // que se lee como "me salió gratis".
      costo_por_lead: gasto > 0 && v.leads ? Math.round(gasto / v.leads) : null,
      costo_por_cliente: gasto > 0 && clientesPorCanal[canal]?.size ? Math.round(gasto / clientesPorCanal[canal].size) : null,
      retorno: gasto > 0 ? Math.round((v.arr / gasto) * 10) / 10 : null,
      conversion_pct: v.leads ? Math.round(((clientesPorCanal[canal]?.size || 0) / v.leads) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.arr - a.arr);

  const totalGasto = filas.reduce((s, f) => s + f.gasto, 0);
  const totalArr = filas.reduce((s, f) => s + f.arr, 0);

  return json({
    periodo_dias: dias,
    canales: filas,
    total: {
      gasto: totalGasto, arr: totalArr,
      retorno: totalGasto > 0 ? Math.round((totalArr / totalGasto) * 10) / 10 : null,
      clientes: filas.reduce((s, f) => s + f.clientes, 0),
    },
    sin_gasto_capturado: filas.filter(f => f.gasto === 0 && f.canal !== 'directo' && f.canal !== 'referido').map(f => f.nombre),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const canal = String(b?.canal || '').trim().toLowerCase();
  const monto = Number(b?.monto);
  if (!canal) return json({ error: '¿De qué canal es el gasto?' }, 400);
  if (!Number.isFinite(monto) || monto <= 0) return json({ error: 'El monto debe ser mayor que cero.' }, 400);
  if (!b?.periodo_inicio || !b?.periodo_fin) return json({ error: 'Faltan las fechas del periodo.' }, 400);
  if (String(b.periodo_fin) < String(b.periodo_inicio)) return json({ error: 'El periodo termina antes de empezar.' }, 400);

  const { data, error } = await supabase.from('marketing_gastos').insert({
    canal, monto, periodo_inicio: b.periodo_inicio, periodo_fin: b.periodo_fin,
    campana: b.campana || null, nota: b.nota || null,
  }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ gasto: data }, 201);
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta el id.' }, 400);
  await supabase.from('marketing_gastos').delete().eq('id', id);
  return json({ ok: true });
};
