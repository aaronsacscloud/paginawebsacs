// El CORTE: agrupar lo de la semana, dejarlo cerrable, enviable y pagable.
//
// El ciclo del marco es lunes→viernes y se paga el lunes siguiente. Esta lib
// tiene tres trabajos y ninguno más:
//
//   1. calcular qué semana toca cortar,
//   2. armar (o refrescar) el corte de cada persona,
//   3. cuadrar el total: líneas + ajustes.
//
// Las reglas duras, que son las que evitan pagar dos veces o perder dinero:
//
//   · Un corte PAGADO no se toca. Nunca. Ni el cron ni un botón.
//   · Un corte CERRADO ya se envió: no absorbe líneas ni ajustes nuevos. Lo que
//     llegue después va al siguiente, que es justo lo que se quiere.
//   · Una línea solo puede estar en UN corte. Si ya está en uno cerrado o
//     pagado, ningún corte nuevo se la lleva.
//   · Un ajuste sin corte está PENDIENTE y lo absorbe el siguiente corte de esa
//     persona. Así nada se cae entre dos semanas.
import { supabase } from '../supabase';
import { r2, ESTADOS_CONGELADOS } from './comisiones.lib';

export type EstadoCorte = 'abierto' | 'cerrado' | 'pagado';

/** Estados de corte que ya no admiten cambios de contenido. */
export const CORTES_FIRMES: EstadoCorte[] = ['cerrado', 'pagado'];

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

const masDias = (fecha: string, n: number) => {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/**
 * La semana que ya cerró: lunes a viernes.
 *
 * Se ancla al viernes más reciente que YA PASÓ —hoy mismo si hoy es viernes— y
 * retrocede cuatro días. Así el resultado es el mismo si el cron corre el lunes
 * a las 4 am o si alguien aprieta el botón el miércoles: el corte pagable es el
 * de la semana cerrada, no "los últimos siete días".
 */
export function semanaCerrada(hoy = new Date()): { desde: string; hasta: string; paga_el: string } {
  const base = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  const atras = (base.getUTCDay() - 5 + 7) % 7;      // 0=dom … 5=vie
  const vie = new Date(base); vie.setUTCDate(vie.getUTCDate() - atras);
  const hasta = iso(vie);
  return { desde: masDias(hasta, -4), hasta, paga_el: masDias(hasta, 3) };
}

/** El lunes siguiente a una fecha de cierre (para un corte manual). */
export function lunesSiguiente(hasta: string): string {
  const d = new Date(hasta + 'T12:00:00Z');
  const faltan = (8 - d.getUTCDay()) % 7 || 7;       // siempre el PRÓXIMO lunes
  return masDias(hasta, faltan);
}

export type ResultadoCortes = {
  desde: string; hasta: string; paga_el: string;
  automatico: boolean;
  cortes: { id: string; owner_id: string; nombre: string; lineas: number; total: number; estado: EstadoCorte; nuevo: boolean }[];
  omitidos: { owner_id: string; nombre: string; motivo: string }[];
  ajustes_absorbidos: number;
  errores: string[];
};

/**
 * Arma los cortes de un rango. Idempotente: correrlo dos veces sobre la misma
 * semana refresca el mismo corte en vez de duplicarlo.
 */
export async function generarCortes(
  desde: string, hasta: string,
  opts: { automatico?: boolean; paga_el?: string; owner_id?: string } = {},
): Promise<ResultadoCortes> {
  const automatico = opts.automatico !== false;
  const paga_el = opts.paga_el || lunesSiguiente(hasta);
  const res: ResultadoCortes = {
    desde, hasta, paga_el, automatico, cortes: [], omitidos: [], ajustes_absorbidos: 0, errores: [],
  };

  // ── Líneas del rango que todavía pueden entrar a un corte ──
  // Se excluyen las canceladas (no son dinero) y las que ya viajan en un corte
  // firme: una linea no puede pagarse dos veces.
  let q = supabase.from('comision_lineas')
    .select('id, owner_id, monto, estado, corte_id, team_members!comision_lineas_owner_id_fkey(nombre)')
    .gte('fecha', desde).lte('fecha', hasta)
    .neq('estado', 'cancelada')
    .limit(20000);
  if (opts.owner_id) q = q.eq('owner_id', opts.owner_id);
  const { data: lineas, error } = await q;
  if (error) { res.errores.push(error.message); return res; }

  // Cortes firmes ya existentes, para saber qué líneas están comprometidas.
  const idsCorte = [...new Set((lineas || []).map((l: any) => l.corte_id).filter(Boolean))] as string[];
  const firmes = new Set<string>();
  if (idsCorte.length) {
    const { data } = await supabase.from('comision_cortes')
      .select('id, estado').in('id', idsCorte);
    for (const c of data || []) if (CORTES_FIRMES.includes(c.estado)) firmes.add(c.id);
  }

  const porDueno = new Map<string, { nombre: string; ids: string[]; monto: number }>();
  for (const l of (lineas || []) as any[]) {
    if (l.corte_id && firmes.has(l.corte_id)) continue;   // ya se pagó o se envió
    if (!porDueno.has(l.owner_id))
      porDueno.set(l.owner_id, { nombre: l.team_members?.nombre || '—', ids: [], monto: 0 });
    const g = porDueno.get(l.owner_id)!;
    g.ids.push(l.id);
    g.monto = r2(g.monto + Number(l.monto || 0));
  }

  // ── Ajustes pendientes: entran aunque esa persona no tenga líneas ──
  let qa = supabase.from('comision_ajustes')
    .select('id, owner_id, tipo, monto, team_members!comision_ajustes_owner_id_fkey(nombre)')
    .is('corte_id', null);
  if (opts.owner_id) qa = qa.eq('owner_id', opts.owner_id);
  const { data: pendientes } = await qa;
  const ajustesPorDueno = new Map<string, { ids: string[]; monto: number }>();
  for (const a of (pendientes || []) as any[]) {
    if (!ajustesPorDueno.has(a.owner_id)) ajustesPorDueno.set(a.owner_id, { ids: [], monto: 0 });
    const g = ajustesPorDueno.get(a.owner_id)!;
    g.ids.push(a.id);
    g.monto = r2(g.monto + (a.tipo === 'cargo' ? -1 : 1) * Number(a.monto || 0));
    if (!porDueno.has(a.owner_id))
      porDueno.set(a.owner_id, { nombre: (a as any).team_members?.nombre || '—', ids: [], monto: 0 });
  }

  // ── Un corte por persona ──
  for (const [owner_id, g] of porDueno) {
    const aj = ajustesPorDueno.get(owner_id) || { ids: [], monto: 0 };

    const { data: ya } = await supabase.from('comision_cortes')
      .select('id, estado').eq('owner_id', owner_id)
      .eq('desde', desde).eq('hasta', hasta).eq('automatico', automatico)
      .maybeSingle();

    if (ya && CORTES_FIRMES.includes(ya.estado)) {
      res.omitidos.push({ owner_id, nombre: g.nombre, motivo: `ya hay un corte ${ya.estado}` });
      continue;
    }

    const totales = {
      lineas: g.ids.length,
      monto_lineas: r2(g.monto),
      monto_ajustes: r2(aj.monto),
      total: r2(g.monto + aj.monto),
      paga_el, generado_at: new Date().toISOString(),
    };

    let corte_id = ya?.id;
    if (corte_id) {
      const { error: e } = await supabase.from('comision_cortes').update(totales).eq('id', corte_id);
      if (e) { res.errores.push(e.message); continue; }
    } else {
      const { data, error: e } = await supabase.from('comision_cortes')
        .insert({ owner_id, desde, hasta, automatico, estado: 'abierto', ...totales })
        .select('id').single();
      if (e) { res.errores.push(e.message); continue; }
      corte_id = data.id;
    }

    // Enganchar líneas y absorber ajustes pendientes.
    for (let i = 0; i < g.ids.length; i += 300) {
      await supabase.from('comision_lineas').update({ corte_id }).in('id', g.ids.slice(i, i + 300));
    }
    if (aj.ids.length) {
      await supabase.from('comision_ajustes').update({ corte_id }).in('id', aj.ids);
      res.ajustes_absorbidos += aj.ids.length;
    }

    res.cortes.push({
      id: corte_id!, owner_id, nombre: g.nombre,
      lineas: totales.lineas, total: totales.total, estado: 'abierto', nuevo: !ya,
    });
  }

  return res;
}

/**
 * Recalcula los totales de un corte a partir de lo que realmente cuelga de él.
 * Se llama después de agregar o quitar un ajuste: el total del corte es un
 * derivado, y dejarlo desincronizado es como se acaba pagando un número que no
 * corresponde con el detalle que se envió.
 */
export async function recalcularTotales(corte_id: string) {
  const [{ data: lineas }, { data: ajustes }] = await Promise.all([
    supabase.from('comision_lineas').select('monto, estado').eq('corte_id', corte_id),
    supabase.from('comision_ajustes').select('tipo, monto').eq('corte_id', corte_id),
  ]);
  const vivas = (lineas || []).filter((l: any) => l.estado !== 'cancelada');
  const monto_lineas = r2(vivas.reduce((a: number, l: any) => a + Number(l.monto || 0), 0));
  const monto_ajustes = r2((ajustes || []).reduce(
    (a: number, x: any) => a + (x.tipo === 'cargo' ? -1 : 1) * Number(x.monto || 0), 0));
  const patch = { lineas: vivas.length, monto_lineas, monto_ajustes, total: r2(monto_lineas + monto_ajustes) };
  await supabase.from('comision_cortes').update(patch).eq('id', corte_id);
  return patch;
}

/**
 * Pagos del rango que NO produjeron comisión para nadie, con su motivo.
 *
 * Es la lista que hace operable el corte: dinero que entró y que el cálculo no
 * supo repartir. Desde ahí se convierte en ajuste con un clic, en vez de
 * quedarse invisible hasta que alguien lo note en el banco.
 */
export async function pagosNoReconocidos(desde: string, hasta: string) {
  const { data: pagos } = await supabase.from('payments')
    .select('id, fecha, monto, referencia, metodo, company_id, ' +
            'companies(id, nombre, nombre_comercial, comision_owner_id), ' +
            'subscriptions(comision_owner_id, plan_id)')
    .gte('fecha', desde).lte('fecha', hasta)
    .or('estado.is.null,estado.not.in.(anulado,cancelado,duplicado)')
    .limit(5000);

  const ids = (pagos || []).map((p: any) => p.id);
  const conLinea = new Set<string>();
  const sinTarifa = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from('comision_lineas')
      .select('payment_id, sin_regla').in('payment_id', ids.slice(i, i + 300));
    for (const l of data || []) {
      conLinea.add(l.payment_id);
      if (l.sin_regla) sinTarifa.add(l.payment_id);
    }
  }
  // Pagos que ya se agregaron a mano: no se vuelven a ofrecer.
  const yaAjustados = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from('comision_ajustes')
      .select('payment_id').in('payment_id', ids.slice(i, i + 300));
    for (const a of data || []) if (a.payment_id) yaAjustados.add(a.payment_id);
  }

  return (pagos || []).filter((p: any) => {
    if (p.reembolsado === true) return false;
    if (yaAjustados.has(p.id)) return false;
    return !conLinea.has(p.id) || sinTarifa.has(p.id);
  }).map((p: any) => ({
    id: p.id, fecha: p.fecha, monto: Number(p.monto || 0),
    referencia: p.referencia, metodo: p.metodo, company_id: p.company_id,
    empresa: p.companies?.nombre_comercial || p.companies?.nombre || 'Sin empresa',
    motivo: !p.subscriptions?.comision_owner_id && !p.companies?.comision_owner_id
      ? 'sin consultor asignado'
      : sinTarifa.has(p.id) ? 'su SKU no tiene tarifa'
      : !p.subscriptions?.plan_id ? 'la suscripción no tiene SKU'
      : 'no generó línea',
  }));
}
