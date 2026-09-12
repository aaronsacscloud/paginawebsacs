// GET /api/crm/consultoria/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//
// El reporte del CONSULTOR, no el del cliente. Contesta una sola pregunta:
// «¿qué produjeron mis juntas de esta semana?» — cuántas di, qué salió de ellas
// y cuánto dinero movieron.
//
// El periodo se mide por la FECHA DE LA JUNTA, no por cuándo se capturó la
// minuta: la conversación pasó el martes aunque el renglón se haya escrito el
// viernes, y si se cuenta por captura, una semana sin juntas sale llena y una
// semana de seis juntas sale vacía.
//
// El dinero de consultoría es SOLO el que cuelga de una idea (`mejoras.quote_id`):
// cotizado y pagado. No se atribuye por ventana de tiempo — que una cuenta
// compre algo dentro del mes siguiente a su junta no lo vuelve resultado de la
// consultoría, y el dueño lo dijo claro: las ventas no se adjudican aquí.
//
// Lo que sí se hace con las cotizaciones sueltas de esas cuentas es ofrecerlas
// para LIGARLAS: si salió de la junta, se liga y entonces sí cuenta. Es la única
// forma honesta de que el número crezca.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const dia = (d: Date) => d.toISOString().slice(0, 10);
/** Cuánto se mira hacia atrás para ofrecer cotizaciones sueltas que ligar. */
const VENTANA_LIGAR = 45;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const hoy = new Date();
  // Por omisión, la semana en curso de lunes a domingo: es como se cuenta el
  // trabajo de la semana, no los últimos siete días corridos.
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const desde = url.searchParams.get('desde') || dia(lunes);
  const hasta = url.searchParams.get('hasta') || dia(hoy);

  // ── Las juntas que SÍ pasaron ──
  // `agendada` y `confirmada` son promesas; una junta que no se dio no produjo
  // nada y contarla sería inflar el numerador del rendimiento.
  const { data: juntas, error } = await supabase.from('bookings')
    .select('id, fecha, asunto, estado, company_id, consultor_id, minuta, invitee_empresa, event_types(nombre)')
    .gte('fecha', desde).lte('fecha', hasta)
    .in('estado', ['asistio', 'confirmada'])
    .order('fecha', { ascending: true });
  if (error) return json({ error: error.message }, 500);

  const idsJunta = (juntas || []).map((j: any) => j.id);
  const cuentas = [...new Set((juntas || []).map((j: any) => j.company_id).filter(Boolean))];

  // ── Qué salió de esas juntas ──
  const { data: salidas } = idsJunta.length
    ? await supabase.from('mejoras')
        .select('id, titulo, tipo, categoria, estado, cobro, valor, valor_lista, quote_id, booking_id, company_id, fecha_entrega, created_at, companies(nombre, nombre_comercial)')
        .in('booking_id', idsJunta).is('archived_at', null)
    : { data: [] as any[] };

  // Lo que se levantó en el periodo SIN junta de por medio: lo que el cliente
  // pidió por WhatsApp o salió de soporte. Cuenta como trabajo, pero no como
  // rendimiento de una junta.
  const { data: sueltas } = await supabase.from('mejoras')
    .select('id, titulo, tipo, estado, origen, company_id, created_at, companies(nombre, nombre_comercial)')
    .gte('created_at', desde).lte('created_at', hasta + 'T23:59:59')
    .is('booking_id', null).is('archived_at', null);

  const cuenta = (m: any) => m?.companies?.nombre_comercial || m?.companies?.nombre || 'Sin cuenta';
  /* `bookings` no declara la llave a `companies`, así que el nombre de la
     cuenta se resuelve con una consulta aparte en vez de con un join. */
  const { data: nombres } = cuentas.length
    ? await supabase.from('companies').select('id, nombre, nombre_comercial').in('id', cuentas)
    : { data: [] as any[] };
  const nomCuenta = new Map((nombres || []).map((c: any) => [c.id, c.nombre_comercial || c.nombre]));
  const cuentaJunta = (j: any) => nomCuenta.get(j.company_id) || j?.invitee_empresa || 'Sin cuenta';
  const S = salidas || [];

  // ── Entregado en el periodo: lo que se cerró, con su cobro ──
  const { data: entregado } = await supabase.from('mejoras')
    .select('id, titulo, tipo, cobro, valor, valor_lista, company_id, fecha_entrega, url, companies(nombre, nombre_comercial)')
    .gte('fecha_entrega', desde).lte('fecha_entrega', hasta)
    .eq('estado', 'entregada').is('archived_at', null);
  const E = entregado || [];

  // ── El dinero: solo lo que cuelga de una idea ──
  const { data: ligas } = await supabase.from('mejoras')
    .select('id, quote_id, titulo, company_id').not('quote_id', 'is', null);
  const porQuote = new Map((ligas || []).map((l: any) => [l.quote_id, l]));
  const idsLigados = [...porQuote.keys()];

  // Cotizado en el periodo: la cotización nació aquí y cuelga de una idea.
  const { data: qLigadas } = idsLigados.length
    ? await supabase.from('quotes')
        .select('id, numero, total, estado, created_at, pagado_fecha, company_id, companies(nombre, nombre_comercial)')
        .in('id', idsLigados)
        .not('estado', 'in', '("deleted")')
    : { data: [] as any[] };

  const mapQ = (q: any) => ({
    id: q.id, numero: q.numero, total: Number(q.total || 0), estado: q.estado,
    fecha: String(q.created_at).slice(0, 10),
    pagado_fecha: q.pagado_fecha ? String(q.pagado_fecha).slice(0, 10) : null,
    cuenta: q.companies?.nombre_comercial || q.companies?.nombre || 'Sin cuenta',
    idea: porQuote.get(q.id)?.titulo || null,
  });
  const enRango = (f?: string | null) => !!f && f >= desde && f <= hasta;
  const todasLig = (qLigadas || []).map(mapQ);
  const cotizado = todasLig.filter(q => enRango(q.fecha));
  // Pagado se cuenta por la FECHA DE PAGO, no por la de la cotización: el dinero
  // entra el día que entra, aunque se haya cotizado el mes pasado.
  const pagado = todasLig.filter(q => enRango(q.pagado_fecha));

  /* Cotizaciones de estas cuentas que NO cuelgan de ninguna idea. No se cuentan
     como resultado: se ofrecen para ligar. Si salió de la junta, se liga y
     entonces sí cuenta; si no, se deja en paz. */
  const desdeLigar = dia(new Date(Date.parse(desde + 'T12:00:00') - VENTANA_LIGAR * 86400000));
  const { data: qSueltas } = cuentas.length
    ? await supabase.from('quotes')
        .select('id, numero, total, estado, created_at, pagado_fecha, company_id, companies(nombre, nombre_comercial)')
        .in('company_id', cuentas)
        .gte('created_at', desdeLigar).lte('created_at', hasta + 'T23:59:59')
        .not('estado', 'in', '("deleted")')
    : { data: [] as any[] };
  const sinLigar = (qSueltas || []).filter((q: any) => !porQuote.has(q.id)).map(mapQ);

  const suma = (xs: any[]) => Math.round(xs.reduce((a, q) => a + q.total, 0));
  const cortesias = E.filter((m: any) => m.cobro === 'cortesia');

  // ── La conversión de la idea: el número del consultor ──
  // De todo lo que se capturó como idea, cuánto llegó a cotización. Es lo que
  // separa una libreta de ocurrencias de un embudo.
  const { data: todasIdeas } = await supabase.from('mejoras')
    .select('id, quote_id, estado, created_at').is('archived_at', null)
    .in('estado', ['idea', 'cotizada', 'en_proceso', 'entregada']);
  const ideasHist = (todasIdeas || []);
  const cotizadas = ideasHist.filter((m: any) => m.quote_id).length;

  /* ── Lo que queda por venderle a cada cuenta ──
     No es el radar de actividad (eso vive en su módulo y depende de la salud,
     que aquí no pinta nada): son las ideas que TÚ capturaste en las juntas y
     que todavía no tienen cotización. Es el pendiente comercial de consultoría,
     y por cuenta se lee de un vistazo dónde está la venta más fácil. */
  const { data: ideasVivas } = await supabase.from('mejoras')
    .select('id, titulo, valor, company_id, created_at, companies(nombre, nombre_comercial)')
    .eq('estado', 'idea').is('quote_id', null).is('archived_at', null);
  const porCuentaIdeas: Record<string, any> = {};
  for (const m of ideasVivas || []) {
    const k = (m as any).company_id || 'sin';
    const nom = (m as any).companies?.nombre_comercial || (m as any).companies?.nombre || 'Sin cuenta';
    porCuentaIdeas[k] = porCuentaIdeas[k] || { company_id: k, cuenta: nom, n: 0, valor: 0, ejemplos: [] as string[] };
    porCuentaIdeas[k].n++;
    porCuentaIdeas[k].valor += Number((m as any).valor || 0);
    if (porCuentaIdeas[k].ejemplos.length < 3) porCuentaIdeas[k].ejemplos.push((m as any).titulo);
  }
  const ideasPorVender = Object.values(porCuentaIdeas).sort((a: any, b: any) => b.n - a.n).slice(0, 8);

  // ── Cuentas que no he tocado ──
  // Una cuenta activa sin junta en dos meses es la que se pierde sin avisar.
  const { data: activas } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, arr, subscriptions(estado)')
    .is('archived_at', null).range(0, 999);
  const { data: juntasRecientes } = await supabase.from('bookings')
    .select('company_id, fecha')
    .gte('fecha', dia(new Date(Date.now() - 60 * 86400000)))
    .in('estado', ['asistio', 'confirmada', 'agendada']);
  const vistas = new Set((juntasRecientes || []).map((b: any) => b.company_id).filter(Boolean));
  const sinTocar = (activas || [])
    .filter((c: any) => (c.subscriptions || []).some((s: any) => s.estado === 'activa') && !vistas.has(c.id))
    .map((c: any) => ({ id: c.id, nombre: c.nombre_comercial || c.nombre, arr: Number(c.arr || 0) }))
    .sort((a: any, b: any) => b.arr - a.arr)
    .slice(0, 8);

  const porTipo = (t: string) => S.filter((m: any) => m.tipo === t).length;
  const juntasConSalida = new Set(S.map((m: any) => m.booking_id)).size;

  return json({
    periodo: { desde, hasta },
    juntas: (juntas || []).map((j: any) => ({
      id: j.id, fecha: j.fecha, asunto: j.asunto || j.event_types?.nombre || 'Reunión',
      cuenta: cuentaJunta(j), company_id: j.company_id,
      conMinuta: !!(j.minuta && Object.values(j.minuta).some((v: any) => String(v || '').trim())),
      salidas: S.filter((m: any) => m.booking_id === j.id).length,
    })),
    totales: {
      juntas: (juntas || []).length,
      cuentas: cuentas.length,
      salidas: S.length,
      bugs: porTipo('falla'),
      mejoras: porTipo('mejora'),
      capacitaciones: porTipo('capacitacion'),
      ideas: S.filter((m: any) => m.estado === 'idea').length,
      juntasConSalida,
      juntasSinMinuta: (juntas || []).filter((j: any) => !(j.minuta && Object.values(j.minuta).some((v: any) => String(v || '').trim()))).length,
      sueltas: (sueltas || []).length,
      entregadas: E.length,
    },
    dinero: {
      cotizado, pagado, sinLigar,
      total_cotizado: suma(cotizado),
      total_pagado: suma(pagado),
      total_sin_ligar: suma(sinLigar),
      cortesias: cortesias.length,
      cortesia_valor: Math.round(cortesias.reduce((a: number, m: any) => a + Number(m.valor_lista || 0), 0)),
    },
    conversion: { ideas: ideasHist.length, cotizadas, pct: ideasHist.length ? Math.round(cotizadas / ideasHist.length * 100) : 0 },
    ideas: S.filter((m: any) => m.estado === 'idea').map((m: any) => ({
      id: m.id, titulo: m.titulo, cuenta: cuenta(m), valor: Number(m.valor || 0), company_id: m.company_id,
    })),
    entregado: E.map((m: any) => ({
      id: m.id, titulo: m.titulo, tipo: m.tipo, cobro: m.cobro, cuenta: cuenta(m),
      fecha: m.fecha_entrega, valor: Number(m.valor || 0), valor_lista: Number(m.valor_lista || 0), video: !!m.url,
    })),
    ideasPorVender,
    sinTocar,
  });
};
