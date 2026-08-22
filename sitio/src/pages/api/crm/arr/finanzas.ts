// GET /api/crm/arr/finanzas — la salud del ingreso recurrente, para leerla.
//
// Este endpoint NO sirve para cobrar ni conciliar: eso vive en Cobranza y
// Pagos. Aquí solo se mide: cuánto entra, cuánto se queda, cuánto se va y a
// qué velocidad. Es lo que se le enseña a un inversionista y lo que sirve para
// decidir, no para operar.
//
// Tres decisiones que cambian los números y conviene tener a la vista:
//
//  · El ARR se cuenta con las suscripciones ACTIVAS y no vitalicias. Una
//    vitalicia es pago único: sumarla al recurrente infla el ARR con dinero
//    que no se vuelve a cobrar.
//  · El puente (nuevo / expansión / contracción / baja) sale del ledger
//    `mrr_movements`, que empezó a llenarse en mayo de 2026. Antes de esa
//    fecha solo se puede reconstruir altas y bajas por su fecha: no hay
//    expansiones ni contracciones registradas y el endpoint lo DICE en vez de
//    inventarlas.
//  · Los pagos únicos —plugins, personalizaciones, implementaciones— no son
//    ARR, pero sí son ingreso de la cuenta. Van aparte, nunca sumados.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const r0 = (n: number) => Math.round(Number(n) || 0);
const num = (v: any) => Number(v) || 0;
const mesDe = (d?: string | null) => String(d || '').slice(0, 7);
/** YYYY-MM del mes n meses atrás (o adelante con n positivo). */
function mesMas(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export const GET: APIRoute = async ({ url }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const mesHoy = hoy.slice(0, 7);
  // El periodo por el que se pregunta. Por omisión, los últimos 12 meses.
  const desde = (url.searchParams.get('desde') || mesMas(mesHoy, -11)).slice(0, 7);
  const hasta = (url.searchParams.get('hasta') || mesHoy).slice(0, 7);

  const [subsRes, movRes, pagosRes, goalsRes] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, company_id, quote_id, nombre_plan, ciclo, estado, arr, mrr, precio, fecha_inicio, proxima_factura, monto_proximo, cancelada_at, razon_cancelacion, companies(id, nombre)')
      .limit(3000),
    supabase.from('mrr_movements').select('fecha, tipo, mrr_delta, company_id').limit(5000),
    // Todos los pagos, no solo los que no traen suscripción: la diferencia
    // entre recurrente y no recurrente NO es de dónde cuelga el pago, es QUÉ
    // se vendió. El primer pago de una licencia anual va colgado de su
    // cotización y contarlo como "pago único" infla los extras.
    supabase.from('payments')
      .select('id, monto, fecha, estado, company_id, subscription_id, quote_id, clasificacion, quotes(company_id, items)')
      .limit(4000),
    supabase.from('crm_goals').select('*'),
  ]);
  if (subsRes.error) return new Response(JSON.stringify({ error: subsRes.error.message }), { status: 500 });

  const subs = subsRes.data || [];
  const movs = (movRes.data || []).filter((m: any) => m.fecha);
  const pagosTodos = (pagosRes.data || []).filter((p: any) => p.estado !== 'reembolsado');
  const cicloDeSub: Record<string, string> = {};
  (subsRes.data || []).forEach((s: any) => { cicloDeSub[s.id] = s.ciclo; });

  /* ── Qué es un pago NO RECURRENTE ──
     No es "el que no tiene suscripción": el primer pago de una licencia anual
     va colgado de su cotización y contarlo como extra infla la cifra. Es el
     pago cuyo CONCEPTO no se vuelve a cobrar:
       · una licencia vitalicia (se paga una vez y ya),
       · o una cotización que NO vende ningún plan —plugins, personalizaciones,
         implementaciones, desarrollos a la medida—.
     Un pago sin cotización ni suscripción no se puede clasificar y NO se
     cuenta: aparece en los pendientes para que alguien lo ligue. */
  /* Qué licencia nació de cada cotización: es la señal más fuerte de que ese
     pago era recurrente, más fuerte que el tipo del renglón —que se captura a
     mano y a veces trae la licencia escrita como "extra"—. */
  const cicloPorCotizacion: Record<string, string> = {};
  (subsRes.data || []).forEach((s: any) => { if (s.quote_id) cicloPorCotizacion[s.quote_id] = s.ciclo; });

  /* Y el último recurso: leer el concepto. "Renovación Plan Controla" y
     "Licencia Fideliza 3 Sucursales" se capturaron como renglón extra y sin
     esto entrarían como pago único —dos casos reales de julio, $80,427 mal
     clasificados—. */
  const SUENA_A_LICENCIA = /(licencia|renovaci[oó]n|plan\b|suscrip|mensualidad|anualidad|vende|controla|fideliza|automatiza)/i;

  const esNoRecurrente = (p: any) => {
    // Lo que alguien clasificó a mano manda sobre lo que se puede deducir.
    if (p.clasificacion === 'unico') return true;
    if (p.clasificacion === 'recurrente') return false;

    // Colgado de una licencia: vitalicia es pago único, el resto es recurrente.
    if (p.subscription_id) return cicloDeSub[p.subscription_id] === 'vitalicia';

    const its = Array.isArray(p.quotes?.items) ? p.quotes.items : null;
    if (!its) return false;                       // sin origen: no se clasifica

    // De esa cotización nació una licencia: manda su ciclo.
    const cicloNacido = p.quote_id ? cicloPorCotizacion[p.quote_id] : null;
    if (cicloNacido) return cicloNacido === 'vitalicia';

    if (its.some((i: any) => i.tipo === 'plan')) return false;   // vendió plan
    // Nadie marcó el renglón como plan, pero el concepto lo dice.
    if (its.some((i: any) => SUENA_A_LICENCIA.test(String(i.nombre || i.titulo || '')))) return false;
    return true;
  };
  const sinOrigen = pagosTodos.filter((p: any) => !p.subscription_id && !p.quotes && !p.clasificacion);
  const pagos = pagosTodos.filter(esNoRecurrente);

  // Recurrente = activas que no son vitalicias.
  const recurrentes = subs.filter((s: any) => s.ciclo !== 'vitalicia');
  const activas = recurrentes.filter((s: any) => s.estado === 'activa');
  const arrActivo = activas.reduce((a: number, s: any) => a + num(s.arr), 0);
  const clientes = new Set(activas.map((s: any) => s.company_id).filter(Boolean)).size;

  // ── El ARR al cierre de un mes ────────────────────────────────────────────
  // Una suscripción cuenta en el mes M si ya había empezado y todavía no se
  // había cancelado. Reconstruirlo así permite tener serie histórica aunque el
  // ledger sea reciente.
  const arrAlCierre = (mes: string) => {
    const fin = mesMas(mes, 1) + '-01';
    return recurrentes.reduce((a: number, s: any) => {
      const ini = String(s.fecha_inicio || '').slice(0, 10);
      if (!ini || ini >= fin) return a;
      const can = s.cancelada_at ? String(s.cancelada_at).slice(0, 10) : null;
      if (can && can < mes + '-01') return a;
      return a + num(s.arr);
    }, 0);
  };

  // ── Serie mensual: ARR, altas, bajas y pagos únicos ───────────────────────
  const serie: any[] = [];
  for (let m = desde; m <= hasta; m = mesMas(m, 1)) {
    const altas = recurrentes.filter((s: any) => mesDe(s.fecha_inicio) === m);
    const bajas = recurrentes.filter((s: any) => s.cancelada_at && mesDe(s.cancelada_at) === m);
    const unicos = pagos.filter((p: any) => mesDe(p.fecha) === m);
    serie.push({
      mes: m,
      arr: r0(arrAlCierre(m)),
      altas: altas.length,
      arr_altas: r0(altas.reduce((a: number, s: any) => a + num(s.arr), 0)),
      bajas: bajas.length,
      arr_bajas: r0(bajas.reduce((a: number, s: any) => a + num(s.arr), 0)),
      unicos: unicos.length,
      monto_unicos: r0(unicos.reduce((a: number, p: any) => a + num(p.monto), 0)),
    });
    if (serie.length > 60) break;   // tope de seguridad
  }

  // ── El puente del mes en curso, del ledger ────────────────────────────────
  // mrr_delta es MENSUAL: se anualiza para hablar en ARR, que es la moneda de
  // esta pantalla.
  const delMes = movs.filter((m: any) => mesDe(m.fecha) === mesHoy);
  const porTipo = (t: string) => r0(delMes.filter((m: any) => m.tipo === t).reduce((a: number, m: any) => a + num(m.mrr_delta), 0) * 12);
  const puente = {
    nuevo: porTipo('new'),
    expansion: porTipo('expansion'),
    reactivacion: porTipo('reactivation'),
    contraccion: porTipo('contraction'),
    baja: porTipo('churn'),
  };
  const ganado = puente.nuevo + puente.expansion + puente.reactivacion;
  const perdido = puente.contraccion + puente.baja;          // ya vienen negativos
  const neto = ganado + perdido;
  // El ledger empezó en mayo de 2026: antes de esa fecha el puente estaría
  // incompleto y decirlo es parte del dato.
  const ledgerDesde = movs.length ? movs.map((m: any) => mesDe(m.fecha)).sort()[0] : null;

  /* ── Quién entró y quién se fue este mes ──
     El KPI dice cuánto; esto dice a quién. Sin nombres, "+$64,012" no se puede
     verificar ni contar en una junta. */
  const nombreDe = (s: any) => s.companies?.nombre || 'Cuenta sin nombre';
  const ganadasMes = recurrentes
    .filter((s: any) => mesDe(s.fecha_inicio) === mesHoy)
    .map((s: any) => ({ id: s.id, company_id: s.company_id, nombre: nombreDe(s), plan: s.nombre_plan, ciclo: s.ciclo, arr: r0(num(s.arr)), fecha: String(s.fecha_inicio).slice(0, 10) }))
    .sort((a: any, b: any) => b.arr - a.arr);
  const perdidasMes = recurrentes
    .filter((s: any) => s.cancelada_at && mesDe(s.cancelada_at) === mesHoy)
    .map((s: any) => ({ id: s.id, company_id: s.company_id, nombre: nombreDe(s), plan: s.nombre_plan, ciclo: s.ciclo, arr: r0(num(s.arr)), fecha: String(s.cancelada_at).slice(0, 10), motivo: s.razon_cancelacion || null }))
    .sort((a: any, b: any) => b.arr - a.arr);

  // ── Calidad del ingreso ───────────────────────────────────────────────────
  const arrInicioMes = r0(arrAlCierre(mesMas(mesHoy, -1)));
  const canceladasMes = recurrentes.filter((s: any) => s.cancelada_at && mesDe(s.cancelada_at) === mesHoy).length;
  const clientesInicio = new Set(
    recurrentes.filter((s: any) => {
      const ini = String(s.fecha_inicio || '').slice(0, 10);
      const can = s.cancelada_at ? String(s.cancelada_at).slice(0, 10) : null;
      return ini && ini < mesHoy + '-01' && (!can || can >= mesHoy + '-01');
    }).map((s: any) => s.company_id).filter(Boolean)
  ).size;

  const arrOrden = activas.map((s: any) => num(s.arr)).sort((a: number, b: number) => a - b);
  const mediana = arrOrden.length ? arrOrden[Math.floor(arrOrden.length / 2)] : 0;
  const churnClientes = clientesInicio ? (canceladasMes / clientesInicio) * 100 : 0;

  const calidad = {
    // NRR y GRR sobre la base con la que arrancó el mes: NRR incluye
    // expansiones, GRR no. La diferencia entre las dos dice si las cuentas
    // vivas compensan lo que se pierde.
    nrr: arrInicioMes ? r0(((arrInicioMes + puente.expansion + puente.contraccion + puente.baja) / arrInicioMes) * 1000) / 10 : null,
    grr: arrInicioMes ? r0(((arrInicioMes + puente.contraccion + puente.baja) / arrInicioMes) * 1000) / 10 : null,
    quick_ratio: Math.abs(perdido) > 0 ? r0((ganado / Math.abs(perdido)) * 10) / 10 : null,
    churn_clientes: r0(churnClientes * 10) / 10,
    vida_media_anios: churnClientes > 0 ? r0((100 / churnClientes / 12) * 10) / 10 : null,
    arpa: activas.length ? r0(arrActivo / clientes) : 0,
    mediana: r0(mediana),
  };

  // ── Anual vs mensual, y por plan ──────────────────────────────────────────
  const porCiclo = ['anual', 'mensual'].map(c => {
    const l = activas.filter((s: any) => s.ciclo === c);
    return { ciclo: c, n: l.length, arr: r0(l.reduce((a: number, s: any) => a + num(s.arr), 0)) };
  });
  const vitalicias = subs.filter((s: any) => s.ciclo === 'vitalicia');

  const clave = (n: string) => {
    const t = String(n || '').toLowerCase();
    for (const p of ['fideliza', 'automatiza', 'controla', 'vende']) if (t.includes(p)) return p;
    return 'otro';
  };
  const planes: Record<string, { n: number; arr: number }> = {};
  activas.forEach((s: any) => {
    const k = clave(s.nombre_plan);
    planes[k] = planes[k] || { n: 0, arr: 0 };
    planes[k].n++; planes[k].arr += num(s.arr);
  });
  const porPlan = Object.entries(planes)
    .map(([plan, v]) => ({ plan, n: v.n, arr: r0(v.arr), ticket: v.n ? r0(v.arr / v.n) : 0 }))
    .sort((a, b) => b.arr - a.arr);

  // ── Cuentas: recurrente + pagos únicos ────────────────────────────────────
  // El pago único se atribuye a la empresa del pago o, si no la trae, a la de
  // su cotización. Sin ninguna de las dos no se puede atribuir y se reporta en
  // los pendientes.
  const nombrePorId: Record<string, string> = {};
  subs.forEach((s: any) => { if (s.company_id && s.companies?.nombre) nombrePorId[s.company_id] = s.companies.nombre; });

  const extras: Record<string, { monto: number; n: number }> = {};
  let unicosSinCliente = 0, montoSinCliente = 0;
  pagos.forEach((p: any) => {
    const cid = p.company_id || p.quotes?.company_id || null;
    if (!cid) { unicosSinCliente++; montoSinCliente += num(p.monto); return; }
    extras[cid] = extras[cid] || { monto: 0, n: 0 };
    extras[cid].monto += num(p.monto); extras[cid].n++;
  });

  const arrPorCuenta: Record<string, number> = {};
  activas.forEach((s: any) => { if (s.company_id) arrPorCuenta[s.company_id] = (arrPorCuenta[s.company_id] || 0) + num(s.arr); });

  const totalUnicos = r0(pagos.reduce((a: number, p: any) => a + num(p.monto), 0));

  /* ── Los pagos únicos, medidos en serio ──
     No son ARR y nunca deben sumarse a él, pero son la otra mitad de lo que
     produce una cuenta: plugins, personalizaciones, implementaciones, vitalicias.
     Tres preguntas que esta parte tiene que contestar:
       · ¿cuánto entró de extras en el periodo?
       · ¿quién compra extras y cada cuánto? (el que ya compró dos veces es el
         que va a comprar la tercera)
       · ¿en qué meses del año se compran? (para saber cuándo ofrecer) */
  const vitaliciasIds = new Set(subs.filter((s: any) => s.ciclo === 'vitalicia').map((s: any) => s.id));
  const pagosVitalicios = pagos.filter((p: any) => p.subscription_id && vitaliciasIds.has(p.subscription_id));
  const vitaliciasMonto = r0(pagosVitalicios.reduce((a: number, p: any) => a + num(p.monto), 0));

  // Estacionalidad: en qué mes del año se compran extras. Con dos años de
  // datos esto deja de ser anécdota y se vuelve calendario comercial.
  const porMesAnio: Record<number, { n: number; monto: number }> = {};
  pagos.forEach((p: any) => {
    const m = Number(String(p.fecha || '').slice(5, 7));
    if (!m) return;
    porMesAnio[m] = porMesAnio[m] || { n: 0, monto: 0 };
    porMesAnio[m].n++; porMesAnio[m].monto += num(p.monto);
  });
  const estacionalidad = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1, n: porMesAnio[i + 1]?.n || 0, monto: r0(porMesAnio[i + 1]?.monto || 0),
  }));

  /* Cotizaciones marcadas como pagadas SIN pago capturado. El panel mide el
     dinero desde `payments` —lo que de verdad entró— y no desde el estado de la
     cotización, que lo pone una persona. Cuando las dos fuentes no cuadran, la
     cifra de extras sale corta y nadie se entera: pasó con una de $44,505. */
  const { data: cotsPaid } = await supabase.from('quotes')
    .select('id, numero, empresa, total, company_id').eq('estado', 'paid').limit(500);
  const cobradoPorCot: Record<string, number> = {};
  const { data: pagosCot } = await supabase.from('payments')
    .select('quote_id, monto, estado').not('quote_id', 'is', null).limit(3000);
  (pagosCot || []).filter((p: any) => p.estado !== 'reembolsado')
    .forEach((p: any) => { cobradoPorCot[p.quote_id] = (cobradoPorCot[p.quote_id] || 0) + num(p.monto); });
  const descuadres = (cotsPaid || [])
    .map((q: any) => ({ id: q.id, numero: q.numero, empresa: q.empresa, company_id: q.company_id, total: r0(num(q.total)), cobrado: r0(cobradoPorCot[q.id] || 0) }))
    .filter(q => q.cobrado < q.total - 1)
    .sort((a, b) => (b.total - b.cobrado) - (a.total - a.cobrado));
  const faltaCapturar = r0(descuadres.reduce((a, q) => a + (q.total - q.cobrado), 0));

  // Los nombres que faltan: una cuenta que compró un plugin y nunca tuvo
  // licencia no aparece en `subs`, y salía como "Cuenta sin nombre" con su
  // dinero al lado — que es justo el caso que esta vista existe para mostrar.
  const faltan = Object.keys(extras).filter(cid => !nombrePorId[cid]);
  if (faltan.length) {
    const { data: comps } = await supabase.from('companies').select('id, nombre').in('id', faltan.slice(0, 200));
    (comps || []).forEach((c: any) => { nombrePorId[c.id] = c.nombre; });
  }

  // Cuándo fue la última vez que una cuenta compró un extra: con eso se sabe
  // a quién tocarle la puerta, que es la pregunta que sigue al número.
  const ultimoExtra: Record<string, string> = {};
  pagos.forEach((p: any) => {
    const cid = p.company_id || p.quotes?.company_id; if (!cid) return;
    const f = String(p.fecha || '').slice(0, 10);
    if (!ultimoExtra[cid] || f > ultimoExtra[cid]) ultimoExtra[cid] = f;
  });

  const cuentas = Object.keys({ ...extras, ...arrPorCuenta })
    .map(cid => ({
      company_id: cid,
      nombre: nombrePorId[cid] || 'Cuenta sin nombre',
      arr: r0(arrPorCuenta[cid] || 0),
      unicos: r0(extras[cid]?.monto || 0),
      n_unicos: extras[cid]?.n || 0,
      total: r0((arrPorCuenta[cid] || 0) + (extras[cid]?.monto || 0)),
      ultimo_extra: ultimoExtra[cid] || null,
      // Cuánto pesa lo no recurrente en esa cuenta: un 50% dice que el cliente
      // compra desarrollo, no solo licencia, y eso cambia cómo se le vende.
      pct_unicos: (arrPorCuenta[cid] || 0) + (extras[cid]?.monto || 0) > 0
        ? r0(((extras[cid]?.monto || 0) / ((arrPorCuenta[cid] || 0) + (extras[cid]?.monto || 0))) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);


  // ── Concentración ─────────────────────────────────────────────────────────
  const top = cuentas.filter(c => c.arr > 0).sort((a, b) => b.arr - a.arr).slice(0, 5);
  const concentracion = {
    top: top.map(c => ({ ...c, pct: arrActivo ? r0((c.arr / arrActivo) * 1000) / 10 : 0 })),
    top5_pct: arrActivo ? r0((top.reduce((a, c) => a + c.arr, 0) / arrActivo) * 1000) / 10 : 0,
  };

  // ── Renovaciones por venir ────────────────────────────────────────────────
  const renovaciones: Record<string, { n: number; monto: number }> = {};
  activas.forEach((s: any) => {
    const f = String(s.proxima_factura || '').slice(0, 10);
    if (!f || f < hoy) return;
    const m = f.slice(0, 7);
    renovaciones[m] = renovaciones[m] || { n: 0, monto: 0 };
    renovaciones[m].n++; renovaciones[m].monto += num(s.monto_proximo ?? s.precio);
  });
  const calendario = Object.entries(renovaciones)
    .map(([mes, v]) => ({ mes, n: v.n, monto: r0(v.monto) }))
    .sort((a, b) => a.mes.localeCompare(b.mes)).slice(0, 12);

  // ── Cohortes ──────────────────────────────────────────────────────────────
  const primeraPorCuenta: Record<string, string> = {};
  recurrentes.forEach((s: any) => {
    const f = mesDe(s.fecha_inicio);
    if (!f || !s.company_id) return;
    if (!primeraPorCuenta[s.company_id] || f < primeraPorCuenta[s.company_id]) primeraPorCuenta[s.company_id] = f;
  });
  const vivas = new Set(activas.map((s: any) => s.company_id));
  const coh: Record<string, { n: number; vivos: number }> = {};
  Object.entries(primeraPorCuenta).forEach(([cid, mes]) => {
    coh[mes] = coh[mes] || { n: 0, vivos: 0 };
    coh[mes].n++; if (vivas.has(cid)) coh[mes].vivos++;
  });
  const cohortes = Object.entries(coh)
    .map(([mes, v]) => ({ mes, n: v.n, vivos: v.vivos, pct: v.n ? r0((v.vivos / v.n) * 100) : 0 }))
    .filter(c => c.mes >= mesMas(mesHoy, -18))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  /* ── ARR que se está perdiendo de contar ──
     Una cotización pagada con plan recurrente TIENE que producir una
     suscripción: es el momento en que un lead se vuelve ARR. Cuando no la
     produjo, ese dinero no aparece en ninguna cifra de esta pantalla —y es la
     fuga más cara, porque son ventas que ya se cobraron. */
  const { data: cotsPagadas } = await supabase.from('quotes')
    .select('id, numero, empresa, total, items, company_id, created_at')
    .eq('estado', 'paid').limit(500);
  const idsConSub = new Set(subs.map((s: any) => s.quote_id).filter(Boolean));
  const sinSub = (cotsPagadas || []).filter((q: any) => {
    if (idsConSub.has(q.id)) return false;
    const its = Array.isArray(q.items) ? q.items : [];
    // Solo cuenta si vendió un PLAN recurrente: una cotización de plugins o de
    // una implementación no genera ARR y no debería aparecer como faltante.
    return its.some((i: any) => i.tipo === 'plan' && (i.periodo === 'anual' || i.periodo === 'mensual'));
  });
  const arrNoContado = sinSub.reduce((a: number, q: any) => {
    const its = Array.isArray(q.items) ? q.items : [];
    return a + its.filter((i: any) => i.tipo === 'plan')
      .reduce((b: number, i: any) => b + (i.periodo === 'mensual' ? num(i.subtotal) * 12 : num(i.subtotal)), 0);
  }, 0);

  // ── Datos por completar ───────────────────────────────────────────────────
  // No es una lista de errores: es captura pendiente que LIMITA lo que este
  // panel puede decir. Cada uno explica qué se deja de poder calcular.
  const canceladas = recurrentes.filter((s: any) => s.estado === 'cancelada');
  const montoSinOrigen = r0(sinOrigen.reduce((a: number, p: any) => a + num(p.monto), 0));
  const pendientes = [
    {
      id: 'pagos_sin_origen', n: sinOrigen.length,
      titulo: 'Pagos sin cotización ni licencia',
      limita: `${'$' + montoSinOrigen.toLocaleString('es-MX')} que no se pueden clasificar como recurrente o único, así que no entran en ninguna de las dos cifras.`,
      nivel: 'alto',
    },
    {
      id: 'cotizacion_sin_sub', n: sinSub.length,
      titulo: 'Cotizaciones pagadas que no generaron licencia',
      limita: `${'$' + r0(arrNoContado).toLocaleString('es-MX')} de ARR vendido y cobrado que no está contado en ninguna cifra de esta pantalla.`,
      nivel: 'alto',
    },
    {
      id: 'bajas_sin_motivo', n: canceladas.filter((s: any) => !s.razon_cancelacion).length,
      titulo: 'Bajas sin motivo',
      limita: 'Sin el motivo no se puede construir la tarjeta de por qué nos dejan, que es lo único que dice qué arreglar.',
      nivel: 'alto',
    },
    {
      id: 'plan_no_reconocido', n: activas.filter((s: any) => clave(s.nombre_plan) === 'otro').length,
      titulo: 'Licencias fuera del catálogo',
      limita: 'Con el nombre escrito a mano no se agrupan por plan ni se comparan tickets.',
      nivel: 'medio',
    },
    {
      id: 'pagos_sin_cliente', n: unicosSinCliente,
      titulo: 'Pagos sin cliente',
      limita: `${'$' + r0(montoSinCliente).toLocaleString('es-MX')} que no se pueden atribuir a ninguna cuenta.`,
      nivel: 'alto',
    },
    {
      id: 'sin_fecha_inicio', n: recurrentes.filter((s: any) => !s.fecha_inicio).length,
      titulo: 'Suscripciones sin fecha de inicio',
      limita: 'No entran en las cohortes ni en el cálculo de vida media del cliente.',
      nivel: 'medio',
    },
    {
      id: 'sin_proxima_factura', n: activas.filter((s: any) => !s.proxima_factura).length,
      titulo: 'Activas sin próxima factura',
      limita: 'No aparecen en el calendario de renovaciones: su ARR se da por seguro sin fecha que lo respalde.',
      nivel: 'medio',
    },
  ].filter(p => p.n > 0);

  // ── Meta ──────────────────────────────────────────────────────────────────
  // La meta de ARR es anual y sin mes: las otras filas de crm_goals son metas
  // mensuales de otra cosa (ingresos, new ARR) y tomarlas aquí daría un
  // porcentaje contra la meta equivocada.
  const anio = new Date().getFullYear();
  const metaRow = (goalsRes.data || []).find((g: any) => g.tipo === 'arr' && g.anio === anio && !g.mes)
    || (goalsRes.data || []).find((g: any) => g.tipo === 'arr');
  const meta = metaRow ? { monto: num(metaRow.monto), anio: metaRow.anio, label: `Meta ARR ${metaRow.anio}` } : null;

  const arr12 = r0(arrAlCierre(mesMas(mesHoy, -12)));

  return new Response(JSON.stringify({
    generado: new Date().toISOString(),
    periodo: { desde, hasta },
    titular: {
      arr_activo: r0(arrActivo),
      subs_activas: activas.length,
      clientes,
      arr_hace_12m: arr12,
      crecimiento_12m_pct: arr12 ? r0(((arrActivo - arr12) / arr12) * 1000) / 10 : null,
      ganado, perdido, neto,
      bajas_mes: canceladasMes,
      // Cuánto de lo vendido se lo comió el churn. Es la lectura que el neto
      // esconde: +$14,004 se ve bien hasta que se sabe que se vendieron $64,020.
      churn_come_pct: ganado > 0 ? r0((Math.abs(perdido) / ganado) * 100) : null,
      meta,
      meta_pct: meta?.monto ? r0((arrActivo / meta.monto) * 1000) / 10 : null,
    },
    detalle: { ganadas: ganadasMes, perdidas: perdidasMes },
    puente: { ...puente, ganado, perdido, neto, arr_inicio: arrInicioMes, arr_fin: r0(arrActivo), ledger_desde: ledgerDesde },
    calidad,
    serie,
    ciclos: { por_ciclo: porCiclo, vitalicias: vitalicias.length, mrr_mensual: r0(activas.filter((s: any) => s.ciclo === 'mensual').reduce((a: number, s: any) => a + num(s.mrr), 0)) },
    planes: porPlan,
    cuentas: cuentas.slice(0, 40),
    unicos: {
      total: totalUnicos, n: pagos.length,
      sin_cliente: unicosSinCliente, monto_sin_cliente: r0(montoSinCliente),
      sin_origen: { n: sinOrigen.length, monto: montoSinOrigen },
      vitalicias: { n: pagosVitalicios.length, monto: vitaliciasMonto, licencias: vitaliciasIds.size },
      estacionalidad,
      // Cuentas que ya compraron extras más de una vez: la señal más barata de
      // quién va a volver a comprar.
      recurrentes_extra: Object.entries(extras).filter(([, v]) => v.n >= 2)
        .map(([cid, v]) => ({ company_id: cid, nombre: nombrePorId[cid] || 'Cuenta sin nombre', n: v.n, monto: r0(v.monto), ticket: r0(v.monto / v.n) }))
        .sort((a, b) => b.monto - a.monto),
    },
    descuadres: { n: descuadres.length, falta: faltaCapturar, lista: descuadres.slice(0, 20) },
    concentracion,
    calendario,
    cohortes,
    pendientes,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
