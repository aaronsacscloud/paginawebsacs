// /api/crm/comisiones/reporte — mes a mes: qué se vendió, qué comisionó y qué falta por pagar.
//
// Los cortes contestan "¿cuánto se paga esta semana?". Esto contesta la otra
// pregunta, la que no tenía dónde mirarse: "¿cuánto llevo en el año, y de qué".
//
// Tres cortes de la misma cifra, porque cada uno responde algo distinto:
//   · por TIPO    — de dónde sale el dinero: licencias, plugins, servicios;
//   · por CORTE   — en qué pago viajó, y si ese pago ya salió;
//   · pagado / por pagar — lo cobrado contra lo que todavía se debe.
//
// ── Dos decisiones que cambian los números, dichas aquí para que nadie las
//    tenga que deducir de la tabla ──
//
// 1. El mes es el del PAGO DEL CLIENTE, no el del corte en que se liquidó. Un
//    cobro del 30 de septiembre que se paga en el corte del 6 de octubre cuenta
//    en septiembre. Así el reporte responde "cuánto generó ese mes de venta", y
//    cuadra contra los ingresos del mismo mes.
//
// 2. Por eso un corte puede aparecer en DOS meses: el del 31-ago al 06-sep
//    tiene líneas de agosto y de septiembre. En cada mes se muestra solo la
//    parte que le toca, no el total del corte. Sumar los cortes de un mes da el
//    mes, nunca el corte completo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { leerCiclo } from '../../../../lib/crm/comisiones.cortes';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Nombres que se entienden sin conocer el catálogo interno. */
const ETIQUETA: Record<string, string> = {
  plan: 'Licencias',
  plugin: 'Plugins',
  servicio: 'Servicios de arranque',
  personalizacion: 'Personalización',
  partner: 'Canal de partners',
  crm: 'Venta del CRM',
};
const nombreTipo = (c: string | null, tipo: string) =>
  tipo === 'override_partner' ? 'Override de partner' : (c ? ETIQUETA[c] || c : 'Sin SKU asignado');

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const etiquetaMes = (m: string) => {
  const [a, n] = m.split('-');
  return `${MES[Number(n) - 1]} ${a}`;
};

export const GET: APIRoute = async ({ url }) => {
  try {
    // Arranca donde arranca el módulo: antes de esa fecha las comisiones son
    // historia que todavía no se decide si se paga, y mezclarla aquí daría un
    // "por pagar" enorme que no corresponde a un compromiso real.
    const ciclo = await leerCiclo();
    const pedido = url.searchParams.get('desde');
    const desde = /^\d{4}-\d{2}$/.test(pedido || '')
      ? `${pedido}-01`
      : (ciclo.arrastrar_desde || '2026-09-01');

    const owner = url.searchParams.get('owner_id');

    let q = supabase.from('comision_lineas')
      .select('id, fecha, categoria, tipo, monto_bruto, base, monto, estado, corte_id, owner_id, sin_regla')
      .gte('fecha', desde)
      .neq('estado', 'cancelada')
      .order('fecha')
      .limit(20000);
    if (owner) q = q.eq('owner_id', owner);
    const { data: lineas, error } = await q;
    if (error) throw error;

    // Los cortes que tocan estas líneas, para poder decir en qué pago viajó
    // cada peso y si ese pago ya salió.
    const ids = [...new Set((lineas || []).map((l: any) => l.corte_id).filter(Boolean))] as string[];
    const corteDe = new Map<string, any>();
    if (ids.length) {
      const { data } = await supabase.from('comision_cortes')
        .select('id, desde, hasta, estado, paga_el, team_members(nombre)').in('id', ids);
      for (const c of data || []) corteDe.set(c.id, c);
    }

    const vacio = () => ({ lineas: 0, cobrado: 0, comision: 0, pagado: 0, por_pagar: 0 });
    const sumar = (a: any, l: any) => {
      const m = Number(l.monto || 0);
      a.lineas++;
      a.cobrado = r2(a.cobrado + Number(l.monto_bruto || 0));
      a.comision = r2(a.comision + m);
      // Pagado es el estado de la LÍNEA, no el del corte: es lo que marca que
      // el dinero salió, y sobrevive aunque el corte se borre después.
      if (l.estado === 'pagada') a.pagado = r2(a.pagado + m);
      else a.por_pagar = r2(a.por_pagar + m);
      return a;
    };

    const meses = new Map<string, any>();
    for (const l of (lineas || []) as any[]) {
      const mes = String(l.fecha).slice(0, 7);
      if (!meses.has(mes)) meses.set(mes, { mes, etiqueta: etiquetaMes(mes), ...vacio(), tipos: new Map(), cortes: new Map() });
      const M = meses.get(mes);
      sumar(M, l);

      const kt = `${l.tipo}:${l.categoria || ''}`;
      if (!M.tipos.has(kt)) M.tipos.set(kt, { clave: kt, etiqueta: nombreTipo(l.categoria, l.tipo), sin_tarifa: 0, ...vacio() });
      const T = sumar(M.tipos.get(kt), l);
      if (l.sin_regla) T.sin_tarifa++;

      // `null` es su propia categoría: lo que todavía no viaja en ningún corte.
      const kc = l.corte_id || 'sin_corte';
      if (!M.cortes.has(kc)) {
        const c = l.corte_id ? corteDe.get(l.corte_id) : null;
        M.cortes.set(kc, {
          id: l.corte_id, estado: c?.estado ?? null,
          periodo: c ? `${c.desde} → ${c.hasta}` : null,
          paga_el: c?.paga_el ?? null,
          consultor: c?.team_members?.nombre ?? null,
          ...vacio(),
        });
      }
      sumar(M.cortes.get(kc), l);
    }

    const lista = [...meses.values()]
      .sort((a, b) => (a.mes < b.mes ? 1 : -1))   // el mes más reciente primero
      .map(m => ({
        ...m,
        tipos: [...m.tipos.values()].sort((a: any, b: any) => b.comision - a.comision),
        cortes: [...m.cortes.values()].sort((a: any, b: any) => (a.periodo || 'zz') < (b.periodo || 'zz') ? -1 : 1),
      }));

    const totales = lista.reduce((a, m) => ({
      lineas: a.lineas + m.lineas,
      cobrado: r2(a.cobrado + m.cobrado),
      comision: r2(a.comision + m.comision),
      pagado: r2(a.pagado + m.pagado),
      por_pagar: r2(a.por_pagar + m.por_pagar),
    }), vacio());

    return json({ desde, meses: lista, totales, truncado: (lineas || []).length >= 20000 });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
