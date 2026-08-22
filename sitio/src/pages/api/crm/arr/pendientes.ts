// GET/PUT /api/crm/arr/pendientes — completar los datos que faltan.
//
// El panel financiero solo puede afirmar lo que los datos sostienen. Cuando 19
// bajas no dicen por qué se fue el cliente, la pregunta "¿qué estamos haciendo
// mal?" no tiene respuesta. Este endpoint lista lo que falta y lo guarda desde
// la misma pantalla: mandar a alguien a buscar 19 cuentas de a una es la forma
// más segura de que no se haga nunca.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Los motivos de baja, en catálogo cerrado: en texto libre no se pueden contar. */
const MOTIVOS = [
  { v: 'precio', l: 'Precio' },
  { v: 'no_uso', l: 'No lo usaba' },
  { v: 'mal_servicio', l: 'Mal servicio o soporte' },
  { v: 'falta_funcion', l: 'Le faltaba una función' },
  { v: 'competencia', l: 'Se fue con la competencia' },
  { v: 'cerro', l: 'Cerró o dejó de operar' },
  { v: 'migracion', l: 'Migró a otro plan o cuenta' },
  { v: 'otro', l: 'Otro' },
];

const PLANES = [
  { v: 'Vende', l: 'Vende' }, { v: 'Controla', l: 'Controla' },
  { v: 'Fideliza', l: 'Fideliza y Multiplica' }, { v: 'Automatiza', l: 'Automatiza' },
  { v: 'Vitalicia', l: 'Vitalicia legacy (fuera de ARR)' },
  { v: 'A la medida', l: 'A la medida (no es del catálogo)' },
];

const fecha = (d: any) => (d ? String(d).slice(0, 10) : '');

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id') || '';

  if (id === 'bajas_sin_motivo') {
    const { data } = await supabase.from('subscriptions')
      .select('id, nombre_plan, arr, cancelada_at, companies(nombre)')
      .eq('estado', 'cancelada').is('razon_cancelacion', null)
      .order('cancelada_at', { ascending: false }).limit(200);
    return json({
      filas: (data || []).map((s: any) => ({
        id: s.id,
        titulo: s.companies?.nombre || 'Cuenta sin nombre',
        detalle: `${s.nombre_plan || 'sin plan'} · ${Math.round(Number(s.arr) || 0).toLocaleString('es-MX')} de ARR · baja el ${fecha(s.cancelada_at) || '—'}`,
        opciones: MOTIVOS,
      })),
    });
  }

  if (id === 'plan_no_reconocido') {
    const { data } = await supabase.from('subscriptions')
      .select('id, nombre_plan, ciclo, arr, companies(nombre)')
      .eq('estado', 'activa').neq('ciclo', 'vitalicia').limit(300);
    const fuera = (data || []).filter((s: any) => !/(vende|controla|fideliza|automatiza)/i.test(String(s.nombre_plan || '')));
    return json({
      filas: fuera.map((s: any) => ({
        id: s.id,
        titulo: s.companies?.nombre || 'Cuenta sin nombre',
        detalle: `hoy se llama "${s.nombre_plan || '(vacío)'}" · ${s.ciclo} · ${Math.round(Number(s.arr) || 0).toLocaleString('es-MX')} de ARR`,
        opciones: PLANES,
      })),
    });
  }

  if (id === 'sin_fecha_inicio') {
    const { data } = await supabase.from('subscriptions')
      .select('id, nombre_plan, ciclo, estado, created_at, companies(nombre)')
      .is('fecha_inicio', null).neq('ciclo', 'vitalicia').limit(200);
    return json({
      filas: (data || []).map((s: any) => ({
        id: s.id,
        titulo: s.companies?.nombre || 'Cuenta sin nombre',
        // La fecha de captura es la mejor pista de cuándo empezó, pero NO es
        // el dato: por eso se sugiere y se pide confirmar, no se escribe sola.
        detalle: `${s.nombre_plan || 'sin plan'} · ${s.estado} · se capturó el ${fecha(s.created_at)}`,
        tipo: 'fecha',
      })),
    });
  }

  if (id === 'sin_proxima_factura') {
    const { data } = await supabase.from('subscriptions')
      .select('id, nombre_plan, ciclo, fecha_inicio, companies(nombre)')
      .eq('estado', 'activa').is('proxima_factura', null).neq('ciclo', 'vitalicia').limit(200);
    return json({
      filas: (data || []).map((s: any) => ({
        id: s.id,
        titulo: s.companies?.nombre || 'Cuenta sin nombre',
        detalle: `${s.nombre_plan || 'sin plan'} · ${s.ciclo} · inició el ${fecha(s.fecha_inicio) || '—'}`,
        tipo: 'fecha',
      })),
    });
  }

  /* Cotizaciones pagadas que nunca produjeron licencia. Aquí no se pide un
     dato: se ofrece REPARAR — crear la suscripción que debió nacer al pagar,
     con el plan y el precio que la propia cotización ya tiene. */
  if (id === 'cotizacion_sin_sub') {
    const [cotsRes, subsRes] = await Promise.all([
      supabase.from('quotes').select('id, numero, empresa, total, items, company_id, created_at')
        .eq('estado', 'paid').order('created_at', { ascending: false }).limit(300),
      supabase.from('subscriptions').select('quote_id').not('quote_id', 'is', null).limit(3000),
    ]);
    const conSub = new Set((subsRes.data || []).map((s: any) => s.quote_id));
    const filas = (cotsRes.data || [])
      .filter((q: any) => !conSub.has(q.id))
      .map((q: any) => {
        const its = Array.isArray(q.items) ? q.items : [];
        const plan = its.find((i: any) => i.tipo === 'plan' && (i.periodo === 'anual' || i.periodo === 'mensual'));
        if (!plan) return null;
        const arr = plan.periodo === 'mensual' ? Number(plan.subtotal || 0) * 12 : Number(plan.subtotal || 0);
        return {
          id: q.id,
          titulo: `${q.numero} · ${q.empresa || 'sin empresa'}`,
          detalle: `${plan.nombre || 'plan'} ${plan.periodo} · ${Math.round(arr).toLocaleString('es-MX')} de ARR${q.company_id ? '' : ' · sin cliente ligado'}`,
          opciones: [{ v: 'crear', l: 'Crear la licencia que faltó' }, { v: 'ignorar', l: 'No corresponde (no es recurrente)' }],
        };
      }).filter(Boolean);
    return json({ filas });
  }

  if (id === 'pagos_sin_cliente') {
    const [pagosRes, compRes] = await Promise.all([
      supabase.from('payments').select('id, monto, fecha, metodo, referencia, numero_acuse, quote_id, quotes(company_id)')
        .is('subscription_id', null).is('company_id', null).order('fecha', { ascending: false }).limit(200),
      supabase.from('companies').select('id, nombre').order('nombre').limit(1000),
    ]);
    const opciones = (compRes.data || []).map((c: any) => ({ v: c.id, l: c.nombre }));
    const filas = (pagosRes.data || [])
      .filter((p: any) => !p.quotes?.company_id)
      .map((p: any) => ({
        id: p.id,
        titulo: `${Math.round(Number(p.monto) || 0).toLocaleString('es-MX')} · ${fecha(p.fecha)}`,
        detalle: `${p.metodo || 'sin método'}${p.numero_acuse ? ` · ${p.numero_acuse}` : ''}${p.referencia ? ` · ref ${p.referencia}` : ''}`,
        opciones,
      }));
    return json({ filas });
  }

  return json({ filas: [] });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b.id || '');
  const cambios: { id: string; valor: string }[] = Array.isArray(b.cambios) ? b.cambios : [];
  if (!id || !cambios.length) return json({ error: 'Nada que guardar.' }, 400);

  // Cada pendiente escribe UNA columna y solo esa. Un endpoint que acepte
  // "campo" desde el cuerpo sería un update arbitrario a la tabla.
  const DESTINO: Record<string, { tabla: string; campo: string; valida?: (v: string) => boolean }> = {
    bajas_sin_motivo: { tabla: 'subscriptions', campo: 'razon_cancelacion', valida: v => MOTIVOS.some(m => m.v === v) },
    plan_no_reconocido: { tabla: 'subscriptions', campo: 'nombre_plan', valida: v => PLANES.some(p => p.v === v) },
    sin_fecha_inicio: { tabla: 'subscriptions', campo: 'fecha_inicio', valida: v => /^\d{4}-\d{2}-\d{2}$/.test(v) },
    sin_proxima_factura: { tabla: 'subscriptions', campo: 'proxima_factura', valida: v => /^\d{4}-\d{2}-\d{2}$/.test(v) },
    pagos_sin_cliente: { tabla: 'payments', campo: 'company_id', valida: v => /^[0-9a-f-]{36}$/i.test(v) },
  };
  /* Reparar una cotización sin licencia no es escribir una columna: es crear
     la suscripción que debió nacer al pagar. Se arma con lo que la propia
     cotización ya dice —plan, ciclo, precio— y liga la empresa si falta, que
     es justo lo que impidió que naciera la primera vez. */
  if (id === 'cotizacion_sin_sub') {
    let creadas = 0; const omitidas: string[] = [];
    for (const c of cambios) {
      if (c.valor !== 'crear') { omitidas.push(c.id); continue; }
      const { data: q } = await supabase.from('quotes')
        .select('id, empresa, items, company_id, aceptado_fecha, created_at, partner_id').eq('id', c.id).maybeSingle();
      if (!q) { omitidas.push(c.id); continue; }

      let cid = q.company_id;
      if (!cid && String(q.empresa || '').trim()) {
        const nom = String(q.empresa).trim();
        const { data: co } = await supabase.from('companies').select('id').ilike('nombre', nom).limit(1).maybeSingle();
        cid = co?.id || null;
        if (!cid) {
          const { data: nueva } = await supabase.from('companies')
            .insert({ nombre: nom, estado_cuenta: 'activo' }).select('id').maybeSingle();
          cid = nueva?.id || null;
        }
        if (cid) await supabase.from('quotes').update({ company_id: cid }).eq('id', q.id);
      }
      if (!cid) { omitidas.push(c.id); continue; }

      const its = Array.isArray(q.items) ? q.items : [];
      const plan = its.find((i: any) => i.tipo === 'plan' && (i.periodo === 'anual' || i.periodo === 'mensual'));
      if (!plan) { omitidas.push(c.id); continue; }
      const precio = Number(plan.subtotal || 0);
      const mrr = plan.periodo === 'mensual' ? precio : precio / 12;
      // La fecha de inicio es la de la venta, no la de hoy: si no, la cohorte
      // y la vida media del cliente quedan mal para siempre.
      const inicio = String(q.aceptado_fecha || q.created_at || new Date().toISOString()).slice(0, 10);

      const { error } = await supabase.from('subscriptions').insert({
        company_id: cid, quote_id: q.id,
        nombre_plan: String(plan.titulo || plan.nombre || 'Licencia SACS').slice(0, 160),
        ciclo: plan.periodo, estado: 'activa', precio,
        mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100,
        fecha_inicio: inicio, monto_proximo: precio,
        ...(q.partner_id ? { partner_id: q.partner_id } : {}),
      });
      if (error) omitidas.push(c.id); else creadas++;
    }
    return json({ ok: creadas, fallos: omitidas.length, total: cambios.length });
  }

  const dest = DESTINO[id];
  if (!dest) return json({ error: 'Pendiente desconocido.' }, 400);

  let ok = 0; const fallos: string[] = [];
  for (const c of cambios) {
    if (dest.valida && !dest.valida(String(c.valor))) { fallos.push(c.id); continue; }
    // Al reconocer un plan se conserva el ciclo en el nombre: "Controla" a
    // secas perdería si era anual o mensual, que es dato de negocio.
    let valor: any = c.valor;
    if (id === 'plan_no_reconocido') {
      const { data: s } = await supabase.from('subscriptions').select('ciclo').eq('id', c.id).maybeSingle();
      const ciclo = s?.ciclo === 'mensual' ? 'Mensual' : s?.ciclo === 'anual' ? 'Anual' : '';
      valor = ciclo && c.valor !== 'A la medida' ? `${c.valor} ${ciclo}` : c.valor;
    }
    const { error } = await supabase.from(dest.tabla).update({ [dest.campo]: valor }).eq('id', c.id);
    if (error) fallos.push(c.id); else ok++;
  }
  return json({ ok, fallos: fallos.length, total: cambios.length });
};
