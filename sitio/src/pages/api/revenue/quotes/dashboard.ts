// GET /api/revenue/quotes/dashboard?mes=2026-07&segmento=todos
//
// Todo el dashboard en una sola llamada. Se lee la tabla completa y se calcula
// en memoria a propósito: son decenas de cotizaciones, no millones, y la mitad
// de lo que hace falta —aperturas, plan de parcialidades, motivo de rechazo—
// vive dentro del JSON de `notas`, donde SQL no puede filtrar sin volverse
// ilegible. El día que esto pase de unos miles de filas, lo que toca es un
// resumen nocturno, no exprimir esta consulta.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { parseMeta } from '../../../../lib/quotes/meta';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const PERDIDA = ['expired', 'rejected'];
const GANADA = ['paid'];

// mes 'YYYY-MM' → [inicio, fin) en ISO
const rangoMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  const ini = new Date(Date.UTC(a, m - 1, 1));
  const fin = new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 1));
  return [ini.toISOString(), fin.toISOString()];
};
const mesAnterior = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};
const mesDe = (iso: string) => String(iso || '').slice(0, 7);
const dinero = (n: number) => Math.round(n || 0);

export const GET: APIRoute = async ({ url }) => {
  const hoy = new Date();
  const mes = url.searchParams.get('mes') || `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
  const segmento = url.searchParams.get('segmento') || 'todos';

  const [{ data: qs }, { data: pagos }, { data: cos }] = await Promise.all([
    supabase.from('quotes')
      .select('id, numero, empresa, total, estado, created_at, pagado_fecha, aceptado_fecha, rechazado_fecha, vigencia, company_id, origen_cotizante, notas')
      .not('estado', 'eq', 'plantilla').order('created_at', { ascending: false }).limit(3000),
    supabase.from('payments').select('quote_id, monto, fecha, metodo, referencia').limit(5000),
    supabase.from('companies').select('id, estado_cuenta').limit(3000),
  ]);

  const estadoPorCuenta = new Map((cos || []).map((c: any) => [c.id, c.estado_cuenta]));
  const pagadoPorQuote = new Map<string, number>();
  const pagosPorQuote = new Map<string, any[]>();
  for (const p of pagos || []) {
    if (!p.quote_id) continue;   // pagos de suscripción: no son de una cotización
    pagadoPorQuote.set(p.quote_id, (pagadoPorQuote.get(p.quote_id) || 0) + Number(p.monto || 0));
    pagosPorQuote.set(p.quote_id, [...(pagosPorQuote.get(p.quote_id) || []), p]);
  }

  // Origen: el congelado manda. Solo si falta —cotizaciones anteriores a que
  // existiera el campo— se deduce del estado que tiene el cliente HOY, y eso se
  // marca como estimado: no es lo que era ese día, es lo único que queda.
  const filas = (qs || []).filter((q: any) => q.estado !== 'deleted').map((q: any) => {
    const { meta } = parseMeta(q.notas || '');
    let origen = q.origen_cotizante as string | null;
    let estimado = false;
    if (!origen) {
      estimado = true;
      const ec = q.company_id ? estadoPorCuenta.get(q.company_id) : null;
      origen = !q.company_id ? 'sin_ligar' : ec === 'activo' ? 'cliente' : (ec === 'cancelado' || ec === 'vencido') ? 'excliente' : 'lead';
    }
    return {
      id: q.id, numero: q.numero, empresa: q.empresa, total: Number(q.total || 0), estado: q.estado,
      created_at: q.created_at, pagado_fecha: q.pagado_fecha, aceptado_fecha: q.aceptado_fecha,
      company_id: q.company_id, origen, origen_estimado: estimado,
      vistas: Number(meta?.views || 0),
      abonado: pagadoPorQuote.get(q.id) || 0,
      pagos: pagosPorQuote.get(q.id) || [],
      plan: Array.isArray(meta?.plan_pagos) ? meta.plan_pagos : [],
      motivo_rechazo: meta?.motivo_rechazo || null,
    };
  });

  // ── Las no ligadas salen del análisis ──
  // Una cotización sin cliente ni lead detrás no puede decir de dónde viene el
  // dinero ni de quién depende el periodo: en vez de inventar una categoría
  // gris que nadie puede accionar, se excluyen y se reportan aparte para que
  // el total siga cuadrando con la lista.
  const sinLigar = filas.filter(f => f.origen === 'sin_ligar');
  const ligadas = filas.filter(f => f.origen !== 'sin_ligar');
  // Un excliente sigue siendo un cliente para esta lectura: compró antes.
  const norm = (o: string) => (o === 'excliente' ? 'cliente' : o);
  const delSegmento = (f: any) => segmento === 'todos' || norm(f.origen) === segmento;
  const base = ligadas.filter(delSegmento);

  // ── KPIs del periodo, contra el periodo anterior ──
  const kpisDe = (m: string) => {
    const [ini, fin] = rangoMes(m);
    const delMes = base.filter(f => f.created_at >= ini && f.created_at < fin);
    // ── Cobrado = lo que de verdad ENTRÓ ese mes ──
    // Antes se sumaba el TOTAL de las cotizaciones marcadas como pagadas, lo
    // que ignoraba los anticipos y contaba de más: una cotización de $7,777 con
    // un abono de $3,888 aportaba $0 (no está "pagada") y una pagada en dos
    // exhibiciones cargaba todo al mes de la última. Ahora se suman los pagos,
    // cada uno en su mes: anticipos, parcialidades y liquidaciones.
    const pagosMes = base.flatMap(f => (f.pagos || [])
      .filter((p: any) => mesDe(p.fecha) === m)
      .map((p: any) => ({ ...p, numero: f.numero, empresa: f.empresa, quote_id: f.id, estado_quote: f.estado })));
    const cobradoMes = pagosMes;
    const cerradas = delMes.filter(f => GANADA.includes(f.estado)).length;
    const resueltas = delMes.filter(f => GANADA.includes(f.estado) || PERDIDA.includes(f.estado)).length;
    // Días a cobro: solo de las que se liquidaron en el mes; una parcialidad
    // suelta no dice cuánto tardó el trato en cerrarse.
    const liquidadas = base.filter(f => f.pagado_fecha && mesDe(f.pagado_fecha) === m);
    const dias = liquidadas.filter(f => f.pagado_fecha && f.created_at)
      .map(f => (new Date(f.pagado_fecha).getTime() - new Date(f.created_at).getTime()) / 86400000)
      .filter(d => d >= 0);
    return {
      cotizado: dinero(delMes.reduce((a, f) => a + f.total, 0)),
      cobrado: dinero(cobradoMes.reduce((a: number, p: any) => a + Number(p.monto || 0), 0)),
      cobrado_detalle: pagosMes.map((p: any) => ({
        numero: p.numero, empresa: p.empresa, monto: dinero(Number(p.monto || 0)), fecha: p.fecha,
        metodo: p.metodo || null, referencia: p.referencia || null,
        // Anticipo o liquidación: es la diferencia que el usuario pidió ver.
        tipo: p.estado_quote === 'paid' ? 'liquidación' : 'anticipo',
      })),
      cotizado_detalle: delMes.map(f => ({ numero: f.numero, empresa: f.empresa, monto: f.total, estado: f.estado })),
      // Contra las que ya se resolvieron, no contra todas: las que siguen vivas
      // todavía no ganaron ni perdieron, y meterlas hunde el número sin razón.
      cierre: resueltas ? Math.round((cerradas / resueltas) * 100) : 0,
      dias: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null,
      n: delMes.length,
    };
  };
  const act = kpisDe(mes);
  const ant = kpisDe(mesAnterior(mes));

  // ── Aperturas antes de comprar ──
  // Las de 0 aperturas que aparecen como pagadas se cerraron fuera del sistema
  // y se marcaron a mano; se cuentan aparte para no leerlas como "compró sin
  // abrir", que es la conclusión contraria a la verdadera.
  const conVistas = base.filter(f => f.estado !== 'draft');
  const prom = (arr: any[]) => arr.length ? Math.round((arr.reduce((a, f) => a + f.vistas, 0) / arr.length) * 10) / 10 : 0;
  const rangos = [
    { rango: '0', min: 0, max: 0 }, { rango: '1 a 3', min: 1, max: 3 }, { rango: '4 a 7', min: 4, max: 7 },
    { rango: '8 a 14', min: 8, max: 14 }, { rango: '15 o más', min: 15, max: 1e9 },
  ].map(r => {
    const en = conVistas.filter(f => f.vistas >= r.min && f.vistas <= r.max);
    return { rango: r.rango, total: en.length, cerradas: en.filter(f => GANADA.includes(f.estado) || f.estado === 'accepted').length };
  });
  // El umbral es el primer rango (saltándose el de cero) donde alguien cerró.
  const primeroQueCierra = rangos.slice(1).find(r => r.cerradas > 0);
  const umbral = primeroQueCierra ? Number(String(primeroQueCierra.rango).match(/\d+/)?.[0] || 4) : 4;
  const calientes = base
    .filter(f => ['sent', 'accepted'].includes(f.estado) && f.vistas >= umbral)
    .sort((a, b) => b.vistas - a.vistas).slice(0, 5)
    .map(f => ({ id: f.id, numero: f.numero, empresa: f.empresa, vistas: f.vistas, total: f.total }));

  // ── Mes a mes: cotizado contra cobrado ──
  const meses: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 - i, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const mensual = meses.map(m => {
    const [ini, fin] = rangoMes(m);
    return {
      mes: m,
      cotizado: dinero(base.filter(f => f.created_at >= ini && f.created_at < fin).reduce((a, f) => a + f.total, 0)),
      // Mismo criterio que el KPI: el dinero que entró ese mes, sin importar
      // cuándo se cotizó ni si la cotización ya quedó liquidada.
      cobrado: dinero(base.reduce((a, f) => a + (f.pagos || [])
        .filter((p: any) => mesDe(p.fecha) === m).reduce((x: number, p: any) => x + Number(p.monto || 0), 0), 0)),
    };
  });

  // ── Clientes contra leads (sobre TODO el histórico, no solo el mes) ──
  const bloque = (o: string) => {
    const en = ligadas.filter(f => norm(f.origen) === o);
    const ganadas = en.filter(f => GANADA.includes(f.estado));
    const resueltas = en.filter(f => GANADA.includes(f.estado) || PERDIDA.includes(f.estado)).length;
    return {
      n: en.length, cotizado: dinero(en.reduce((a, f) => a + f.total, 0)),
      cobrado: dinero(ganadas.reduce((a, f) => a + f.total, 0)),
      cierre: resueltas ? Math.round((ganadas.length / resueltas) * 100) : 0,
      ticket: en.length ? dinero(en.reduce((a, f) => a + f.total, 0) / en.length) : 0,
      estimados: en.filter(f => f.origen_estimado).length,
    };
  };
  // Dos orígenes y nada más: cliente (incluye exclientes, que ya compraron) y
  // lead. El cobrado del bloque se mide con PAGOS del periodo, no con el total
  // de las ganadas: cotizar no es cobrar.
  const bloqueCobrado = (o: string) => base.filter(f => norm(f.origen) === o)
    .reduce((a, f) => a + (f.pagos || []).filter((p: any) => mesDe(p.fecha) === mes).reduce((x: number, p: any) => x + Number(p.monto || 0), 0), 0);
  const origenes = {
    cliente: { ...bloque('cliente'), cobrado_periodo: dinero(bloqueCobrado('cliente')) },
    lead: { ...bloque('lead'), cobrado_periodo: dinero(bloqueCobrado('lead')) },
  };

  // ── Lo próximo en cobrar: parcialidades pactadas dentro de la cotización ──
  // Se cubren en orden de fecha con lo que ya entró: sin recibo por parcialidad,
  // aplicar el dinero a la más vieja es la única regla que no inventa nada.
  const hoyStr = new Date().toISOString().slice(0, 10);
  const pendientes: any[] = [];
  const soloPropuestas: any[] = [];
  for (const f of base) {
    if (!f.plan.length || GANADA.includes(f.estado)) continue;
    // ── Un plan de pagos no es dinero comprometido ──
    // Mientras la cotización no esté confirmada ni tenga un peso encima, esas
    // parcialidades son una PROPUESTA: el cliente todavía puede no comprar.
    // Contarlas junto a las que ya se están pagando inflaba la cobranza con
    // dinero que nadie prometió — el monto cotizado ya está en "Cotizado".
    const enCurso = f.abonado > 0 || f.estado === 'accepted';
    if (!enCurso) {
      soloPropuestas.push({
        numero: f.numero, empresa: f.empresa, estado: f.estado,
        monto: dinero(f.plan.reduce((a: number, p: any) => a + Number(p.monto || 0), 0)),
        parcialidades: f.plan.length,
      });
      continue;
    }
    let restante = f.abonado;
    for (const p of [...f.plan].sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)))) {
      const monto = Number(p.monto || 0);
      const cubierto = Math.min(monto, Math.max(0, restante));
      restante -= cubierto;
      if (cubierto >= monto - 0.01) continue;
      pendientes.push({
        quote_id: f.id, numero: f.numero, empresa: f.empresa, fecha: p.fecha,
        monto: dinero(monto - cubierto), vencida: String(p.fecha) < hoyStr,
        indice: f.plan.indexOf(p) + 1, de: f.plan.length,
      });
    }
  }
  pendientes.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const mesHoy = hoyStr.slice(0, 7);
  const proximos = {
    este_mes: dinero(pendientes.filter(p => mesDe(p.fecha) === mesHoy).reduce((a, p) => a + p.monto, 0)),
    comprometido: dinero(pendientes.reduce((a, p) => a + p.monto, 0)),
    con_plan: base.filter(f => f.plan.length > 0 && (f.abonado > 0 || f.estado === 'accepted')).length,
    filas: pendientes.slice(0, 6),
    // Se reportan aparte, no se esconden: son cobranza POTENCIAL y hay que
    // poder verla, pero fuera del número comprometido.
    propuestas: soloPropuestas,
    propuestas_monto: dinero(soloPropuestas.reduce((a, p) => a + p.monto, 0)),
  };

  // ── Por qué se pierden ──
  const perdidas = base.filter(f => PERDIDA.includes(f.estado));
  const porMotivo = new Map<string, { n: number; monto: number }>();
  for (const f of perdidas) {
    // Vencer sin que nadie conteste no es un motivo capturado, pero es el más
    // frecuente y el más accionable: se nombra explícitamente.
    const k = f.estado === 'expired' ? 'Sin respuesta (venció)' : (f.motivo_rechazo || 'Rechazada sin motivo capturado');
    const cur = porMotivo.get(k) || { n: 0, monto: 0 };
    cur.n++; cur.monto += f.total;
    porMotivo.set(k, cur);
  }
  const motivos = [...porMotivo.entries()].map(([motivo, v]) => ({ motivo, ...v, monto: dinero(v.monto) }))
    .sort((a, b) => b.monto - a.monto);
  const silencio = perdidas.filter(f => f.estado === 'expired');

  // ═══ Serie diaria acumulada: el mes contra el anterior ═══
  // Un acumulado dice si vas adelante o atrás del ritmo; un total no.
  const serieDe = (m: string) => {
    const [a, mm] = m.split('-').map(Number);
    const ultimo = new Date(Date.UTC(a, mm, 0)).getUTCDate();
    const porDia: number[] = Array(ultimo).fill(0);
    base.forEach(f => (f.pagos || []).forEach((p: any) => {
      if (mesDe(p.fecha) !== m) return;
      const d = Number(String(p.fecha).slice(8, 10));
      if (d >= 1 && d <= ultimo) porDia[d - 1] += Number(p.monto || 0);
    }));
    let acc = 0;
    return porDia.map(v => (acc += v, dinero(acc)));
  };

  // ═══ Dónde se queda el dinero ═══
  // Del cotizado del mes, cuánto se perdió en cada paso. Cada caída con nombre.
  const [iniM, finM] = rangoMes(mes);
  const delMesW = base.filter(f => f.created_at >= iniM && f.created_at < finM);
  const cotizadoW = delMesW.reduce((a, f) => a + f.total, 0);
  const sinAbrir = delMesW.filter(f => f.vistas === 0 && !GANADA.includes(f.estado)).reduce((a, f) => a + f.total, 0);
  const sinRespuesta = delMesW.filter(f => f.vistas > 0 && ['sent', 'draft'].includes(f.estado)).reduce((a, f) => a + f.total, 0);
  const aceptadoSinPagar = delMesW.filter(f => f.estado === 'accepted').reduce((a, f) => a + (f.total - f.abonado), 0);
  const cobradoDelMes = base.reduce((a, f) => a + (f.pagos || [])
    .filter((p: any) => mesDe(p.fecha) === mes).reduce((x: number, p: any) => x + Number(p.monto || 0), 0), 0);

  // ═══ De cuántos clientes depende ═══
  const porCliente: Record<string, { cliente: string; company_id: string | null; origen: string; cotizado: number; cobrado: number; n: number; dias: number[]; estado: string }> = {};
  base.forEach(f => {
    const k = f.company_id || f.empresa || f.id;
    porCliente[k] = porCliente[k] || { cliente: f.empresa || 'Sin nombre', company_id: f.company_id, origen: norm(f.origen), cotizado: 0, cobrado: 0, n: 0, dias: [], estado: f.estado };
    const r = porCliente[k];
    if (f.created_at >= iniM && f.created_at < finM) { r.cotizado += f.total; r.n++; }
    r.cobrado += (f.pagos || []).filter((p: any) => mesDe(p.fecha) === mes).reduce((x: number, p: any) => x + Number(p.monto || 0), 0);
    if (f.pagado_fecha && f.created_at) {
      const d = (new Date(f.pagado_fecha).getTime() - new Date(f.created_at).getTime()) / 86400000;
      if (d >= 0) r.dias.push(Math.round(d));
    }
  });
  const clientes = Object.values(porCliente).filter(c => c.cotizado > 0 || c.cobrado > 0)
    .map(c => ({ ...c, dias: c.dias.length ? Math.round(c.dias.reduce((a, b) => a + b, 0) / c.dias.length) : null }))
    .sort((a, b) => b.cotizado - a.cotizado);
  const top4 = clientes.slice(0, 4);
  const restoConc = clientes.slice(4).reduce((a, c) => a + c.cotizado, 0);
  const totalConc = clientes.reduce((a, c) => a + c.cotizado, 0);

  // ═══ Cuándo leen ═══
  // Cada apertura registrada, por día de la semana y hora. Es el dato que ya se
  // guardaba y nunca se había mirado: dice cuándo mandar y cuándo llamar.
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  (qs || []).forEach((q: any) => {
    const { meta } = parseMeta(q.notas || '');
    (meta?.timeline || []).forEach((t: any) => {
      if (t.event !== 'viewed' || !t.at) return;
      const d = new Date(t.at);
      if (isNaN(d.getTime())) return;
      // Hora de México: los eventos se guardan en UTC.
      const mx = new Date(d.getTime() - 6 * 3600000);
      heat[(mx.getUTCDay() + 6) % 7][mx.getUTCHours()]++;
    });
  });

  // ═══ Lo que ya está comprometido ═══
  const hoyISO = new Date().toISOString().slice(0, 10);
  const comprometido: Record<string, { monto: number; n: number }> = {};
  base.forEach(f => {
    if (GANADA.includes(f.estado) || (!f.abonado && f.estado !== 'accepted')) return;
    let restante = f.abonado;
    [...f.plan].sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha))).forEach((x: any) => {
      const monto = Number(x.monto || 0);
      const cubierto = Math.min(monto, Math.max(0, restante));
      restante -= cubierto;
      const falta = monto - cubierto;
      if (falta <= 0.01 || String(x.fecha) < hoyISO) return;
      const k = String(x.fecha).slice(0, 7);
      comprometido[k] = comprometido[k] || { monto: 0, n: 0 };
      comprometido[k].monto += falta; comprometido[k].n++;
    });
  });

  return json({
    mes, mes_anterior: mesAnterior(mes), segmento,
    serie: { actual: serieDe(mes), anterior: serieDe(mesAnterior(mes)) },
    fuga: {
      cotizado: dinero(cotizadoW), sin_abrir: dinero(sinAbrir), sin_respuesta: dinero(sinRespuesta),
      aceptado_sin_pagar: dinero(aceptadoSinPagar), cobrado: dinero(cobradoDelMes),
    },
    concentracion: {
      total: dinero(totalConc),
      top: top4.map(c => ({ cliente: c.cliente, company_id: c.company_id, monto: dinero(c.cotizado), pct: totalConc > 0 ? Math.round((c.cotizado / totalConc) * 100) : 0 })),
      resto: dinero(restoConc), resto_n: Math.max(0, clientes.length - 4),
      pct_top: totalConc > 0 ? Math.round((top4.reduce((a, c) => a + c.cotizado, 0) / totalConc) * 100) : 0,
    },
    clientes: clientes.slice(0, 12).map(c => ({
      cliente: c.cliente, company_id: c.company_id, origen: c.origen,
      cotizado: dinero(c.cotizado), cobrado: dinero(c.cobrado), n: c.n, dias: c.dias, estado: c.estado,
    })),
    heat,
    comprometido: Object.entries(comprometido).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 4)
      .map(([m, v]) => ({ mes: m, monto: dinero(v.monto), n: v.n })),
    sin_ligar: { n: sinLigar.length, monto: dinero(sinLigar.reduce((a, f) => a + f.total, 0)) },
    kpis: {
      cotizado: { valor: act.cotizado, anterior: ant.cotizado, detalle: act.cotizado_detalle },
      cobrado: { valor: act.cobrado, anterior: ant.cobrado, detalle: act.cobrado_detalle },
      cierre: { valor: act.cierre, anterior: ant.cierre },
      dias: { valor: act.dias, anterior: ant.dias },
    },
    aperturas: {
      pagadas: prom(conVistas.filter(f => GANADA.includes(f.estado))),
      perdidas: prom(conVistas.filter(f => PERDIDA.includes(f.estado))),
      umbral, rangos, calientes,
      // Las ventas marcadas a mano, para poder decirlo en pantalla.
      cerradas_sin_abrir: conVistas.filter(f => f.vistas === 0 && GANADA.includes(f.estado)).length,
    },
    mensual,
    origenes,
    proximos,
    perdidas: {
      n: perdidas.length, total: dinero(perdidas.reduce((a, f) => a + f.total, 0)),
      motivos: motivos.slice(0, 6),
      silencio_n: silencio.length,
      silencio_monto: dinero(silencio.reduce((a, f) => a + f.total, 0)),
    },
    conteos: {
      todos: ligadas.length,
      cliente: ligadas.filter(f => norm(f.origen) === 'cliente').length,
      lead: ligadas.filter(f => norm(f.origen) === 'lead').length,
    },
  });
};
