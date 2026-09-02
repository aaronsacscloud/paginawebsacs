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
 * La semana que ya cerró: los SIETE días que terminan en el día de cierre.
 *
 * Se ancla al viernes más reciente que YA PASÓ —hoy mismo si hoy es viernes— y
 * retrocede seis días. Así el resultado es el mismo si el cron corre el lunes
 * a las 4 am o si alguien aprieta el botón el miércoles: el corte pagable es el
 * de la semana cerrada, no "los últimos siete días".
 *
 * Son SIETE y no cinco por una razón de dinero. El ciclo del marco se enuncia
 * "lunes a viernes", pero eso describe cuándo se TRABAJA, no qué días entra
 * dinero: un cargo automático o una transferencia caen en sábado igual que en
 * martes. Con la ventana de cinco días, sábado y domingo no pertenecían a
 * ninguna semana y sus líneas no entraban a ningún corte — al medirlo eran 31
 * líneas por $184,182 de comisión. La regla que lo evita: las ventanas de dos
 * semanas consecutivas tienen que EMBALDOSAR el calendario, sin huecos y sin
 * traslapes. El día de cierre y el de pago no cambian.
 */
export function semanaCerrada(
  hoy = new Date(),
  ciclo: { dia_cierre: number; dias_a_pago: number } = { dia_cierre: 5, dias_a_pago: 3 },
): { desde: string; hasta: string; paga_el: string } {
  const base = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  // getUTCDay da 0=domingo; el ciclo se guarda en ISO (1=lunes … 7=domingo).
  const dowIso = base.getUTCDay() === 0 ? 7 : base.getUTCDay();
  const atras = (dowIso - ciclo.dia_cierre + 7) % 7;
  const cierre = new Date(base); cierre.setUTCDate(cierre.getUTCDate() - atras);
  const hasta = iso(cierre);
  return { desde: masDias(hasta, -6), hasta, paga_el: masDias(hasta, ciclo.dias_a_pago) };
}

/**
 * El día y la hora en que el cron arma los cortes.
 *
 * Está en `vercel.json` como `0 11 * * 1` — lunes a las 11:00 UTC, que son las
 * 5:00 am de CDMX. Se repite aquí porque la pantalla tiene que poder decir
 * CUÁNDO se arma el corte que se está juntando, y leer el crontab desde el
 * navegador no es posible. Si se cambia allá, se cambia aquí.
 */
export const ARMADO = { dia_iso: 1, hora_utc: 11, hora: '5:00 am' };

const dowIso = (f: string) => { const d = new Date(f + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };

/**
 * Cuándo vuelve a correr el cron que arma los cortes.
 *
 * Si hoy es el día de armado pero la hora ya pasó, el de hoy YA corrió y toca
 * el de la semana entrante. Sin esa comprobación, el lunes por la tarde la
 * pantalla prometía un corte "para hoy" que ya se había hecho por la mañana.
 */
export function proximoArmado(hoy = new Date()): string {
  const h = iso(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())));
  const yaCorrioHoy = dowIso(h) === ARMADO.dia_iso && hoy.getUTCHours() >= ARMADO.hora_utc;
  if (dowIso(h) === ARMADO.dia_iso && !yaCorrioHoy) return h;
  for (let i = 1; i <= 7; i++) {
    const d = masDias(h, i);
    if (dowIso(d) === ARMADO.dia_iso) return d;
  }
  return masDias(h, 1);
}

/**
 * El corte que se está juntando: exactamente lo que armará el PRÓXIMO cron.
 *
 * Se define así —y no como "la semana siguiente a la cerrada"— porque entre el
 * viernes y el domingo esas dos cosas no son la misma: la semana que acaba de
 * cerrar todavía no se ha armado, y con la otra definición desaparecía de la
 * pantalla durante tres días, justo cuando ya está completa y es lo que se va a
 * pagar.
 *
 * Existe para poder ver el corte ANTES de que exista. Un tablero que solo
 * enseña lo ya generado obliga a esperar al lunes para saber cuánto se va a
 * pagar, y esa es la pregunta de todos los días.
 */
export function semanaEnCurso(
  hoy = new Date(),
  ciclo: { dia_cierre: number; dias_a_pago: number } = { dia_cierre: 5, dias_a_pago: 3 },
): { desde: string; hasta: string; paga_el: string; se_arma_el: string } {
  const se_arma_el = proximoArmado(hoy);
  const w = semanaCerrada(new Date(se_arma_el + 'T12:00:00Z'), ciclo);
  return { desde: w.desde, hasta: w.hasta, paga_el: w.paga_el, se_arma_el };
}

/** El ciclo configurado. Ante cualquier problema, el del marco: viernes → lunes. */
export async function leerCiclo(): Promise<{ dia_cierre: number; dias_a_pago: number; arrastrar_desde: string | null }> {
  const { data } = await supabase.from('comision_ciclo')
    .select('dia_cierre, dias_a_pago, arrastrar_desde').eq('id', true).maybeSingle();
  return {
    dia_cierre: Number(data?.dia_cierre ?? 5),
    dias_a_pago: Number(data?.dias_a_pago ?? 3),
    arrastrar_desde: data?.arrastrar_desde ?? null,
  };
}

/** Cuándo se paga un corte manual: los mismos días del ciclo tras su cierre. */
export function fechaDePago(hasta: string, dias_a_pago = 3): string {
  return masDias(hasta, dias_a_pago);
}

/**
 * Cuánto lleva el corte que todavía no existe.
 *
 * Aplica LAS MISMAS reglas que `generarCortes` —líneas del rango sin corte, las
 * rezagadas de semanas anteriores y los ajustes pendientes— porque si la
 * proyección y el corte real usaran criterios distintos, el lunes aparecería
 * otro número y la pantalla dejaría de servir para lo único que sirve: saber
 * cuánto se va a pagar antes de que se pague.
 *
 * No escribe nada.
 */
export async function proyeccionCorte(
  desde: string, hasta: string, arrastrar_desde?: string | null,
): Promise<{ owner_id: string; nombre: string; lineas: number; rezagadas: number; monto_lineas: number; monto_ajustes: number; total: number }[]> {
  const COLS = 'owner_id, monto, fecha, team_members!comision_lineas_owner_id_fkey(nombre)';
  const [{ data: dentro }, { data: rez }, { data: aj }] = await Promise.all([
    supabase.from('comision_lineas').select(COLS)
      .gte('fecha', desde).lte('fecha', hasta)
      .is('corte_id', null).neq('estado', 'cancelada').limit(20000),
    arrastrar_desde
      ? supabase.from('comision_lineas').select(COLS)
          .gte('fecha', arrastrar_desde).lt('fecha', desde)
          .is('corte_id', null).neq('estado', 'cancelada').limit(20000)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('comision_ajustes')
      .select('owner_id, tipo, monto, team_members!comision_ajustes_owner_id_fkey(nombre)')
      .is('corte_id', null),
  ]);

  const m = new Map<string, any>();
  const dame = (id: string, nombre: string) => {
    if (!m.has(id)) m.set(id, { owner_id: id, nombre, lineas: 0, rezagadas: 0, monto_lineas: 0, monto_ajustes: 0, total: 0 });
    return m.get(id);
  };
  for (const l of (dentro || []) as any[]) {
    const g = dame(l.owner_id, l.team_members?.nombre || '—');
    g.lineas++; g.monto_lineas = r2(g.monto_lineas + Number(l.monto || 0));
  }
  for (const l of (rez || []) as any[]) {
    const g = dame(l.owner_id, l.team_members?.nombre || '—');
    g.lineas++; g.rezagadas++; g.monto_lineas = r2(g.monto_lineas + Number(l.monto || 0));
  }
  for (const a of (aj || []) as any[]) {
    const g = dame(a.owner_id, (a as any).team_members?.nombre || '—');
    g.monto_ajustes = r2(g.monto_ajustes + (a.tipo === 'cargo' ? -1 : 1) * Number(a.monto || 0));
  }
  for (const g of m.values()) g.total = r2(g.monto_lineas + g.monto_ajustes);
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export type ResultadoCortes = {
  desde: string; hasta: string; paga_el: string;
  automatico: boolean;
  cortes: { id: string; owner_id: string; nombre: string; lineas: number; total: number; estado: EstadoCorte; nuevo: boolean }[];
  omitidos: { owner_id: string; nombre: string; motivo: string }[];
  ajustes_absorbidos: number;
  /** Líneas de semanas anteriores que este corte recogió (captura tardía). */
  rezagadas: number;
  monto_rezagado: number;
  /** Líneas del rango que NO entraron porque ya viajan en otro corte. */
  ya_cortadas: {
    total: number; monto: number;
    detalle: { cliente: string; fecha: string; monto: number; corte_id: string; estado: string; periodo: string }[];
  };
  errores: string[];
};

/**
 * Arma los cortes de un rango. Idempotente: correrlo dos veces sobre la misma
 * semana refresca el mismo corte en vez de duplicarlo.
 */
export async function generarCortes(
  desde: string, hasta: string,
  opts: { automatico?: boolean; paga_el?: string; owner_id?: string; arrastrar_desde?: string | null } = {},
): Promise<ResultadoCortes> {
  const automatico = opts.automatico !== false;
  const paga_el = opts.paga_el || fechaDePago(hasta);
  const res: ResultadoCortes = {
    desde, hasta, paga_el, automatico, cortes: [], omitidos: [],
    ajustes_absorbidos: 0, rezagadas: 0, monto_rezagado: 0,
    ya_cortadas: { total: 0, monto: 0, detalle: [] }, errores: [],
  };

  // ── Líneas del rango que todavía pueden entrar a un corte ──
  // Se excluyen las canceladas (no son dinero) y las que ya viajan en un corte
  // firme: una linea no puede pagarse dos veces.
  const COLS = 'id, owner_id, monto, estado, corte_id, fecha, team_members!comision_lineas_owner_id_fkey(nombre), companies(nombre, nombre_comercial)';
  let q = supabase.from('comision_lineas')
    .select(COLS)
    .gte('fecha', desde).lte('fecha', hasta)
    .neq('estado', 'cancelada')
    .limit(20000);
  if (opts.owner_id) q = q.eq('owner_id', opts.owner_id);
  const { data: lineas, error } = await q;
  if (error) { res.errores.push(error.message); return res; }

  // ── Rezagadas: líneas de semanas ANTERIORES que nunca entraron a un corte ──
  //
  // Un pago capturado tarde nace con la fecha en que entró el dinero, no en la
  // que se tecleó — que es lo correcto — pero para entonces el corte de esa
  // semana ya se cerró, y sin esto la línea se quedaba sin corte para siempre.
  // No es un caso de borde: 133 de los 183 pagos se capturaron más de una
  // semana después de su fecha. Se piden con `corte_id` vacío a propósito: una
  // línea que ya cuelga de un corte abierto es de ESE corte y no se le quita.
  const rezagadas: any[] = [];
  if (opts.arrastrar_desde) {
    let qr = supabase.from('comision_lineas')
      .select(COLS)
      .gte('fecha', opts.arrastrar_desde).lt('fecha', desde)
      .is('corte_id', null)
      .neq('estado', 'cancelada')
      .limit(20000);
    if (opts.owner_id) qr = qr.eq('owner_id', opts.owner_id);
    const { data, error: er } = await qr;
    if (er) res.errores.push(er.message);
    else rezagadas.push(...(data || []));
    res.rezagadas = rezagadas.length;
    res.monto_rezagado = r2(rezagadas.reduce((a, l) => a + Number(l.monto || 0), 0));
  }

  // ── Cortes a los que ya pertenece alguna de estas líneas ──
  //
  // Se leen TODOS, no solo los firmes. Antes solo protegían los cerrados y
  // pagados, así que un corte nuevo con periodo traslapado se LLEVABA las
  // líneas de un corte abierto: el corte viejo amanecía vacío y su total ya no
  // cuadraba con su propio detalle. Pasó de verdad.
  //
  // La regla es sencilla: una línea es de SU corte. El único que puede
  // conservarla es ese mismo —para que regenerar sea idempotente—; cualquier
  // otro la deja donde está y lo reporta.
  const idsCorte = [...new Set((lineas || []).map((l: any) => l.corte_id).filter(Boolean))] as string[];
  const corteDe = new Map<string, any>();
  if (idsCorte.length) {
    const { data } = await supabase.from('comision_cortes')
      .select('id, estado, desde, hasta').in('id', idsCorte);
    for (const c of data || []) corteDe.set(c.id, c);
  }

  // Se guardan enteras: el filtro por "ya está en otro corte" necesita saber
  // CUÁL es el corte de esta persona, y eso solo se resuelve más abajo.
  const porDueno = new Map<string, { nombre: string; filas: any[] }>();
  for (const l of [...((lineas || []) as any[]), ...rezagadas]) {
    if (!porDueno.has(l.owner_id))
      porDueno.set(l.owner_id, { nombre: l.team_members?.nombre || '—', filas: [] });
    porDueno.get(l.owner_id)!.filas.push(l);
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
      porDueno.set(a.owner_id, { nombre: (a as any).team_members?.nombre || '—', filas: [] });
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

    // Aquí se separa lo que de verdad entra de lo que YA está cobrado en otro
    // corte. Se reporta con nombre y monto: un total menor sin explicación es
    // justo lo que hace desconfiar del sistema.
    const ids: string[] = [];
    let monto = 0;
    for (const l of g.filas) {
      if (l.corte_id && l.corte_id !== ya?.id) {
        const c = corteDe.get(l.corte_id);
        res.ya_cortadas.total++;
        res.ya_cortadas.monto = r2(res.ya_cortadas.monto + Number(l.monto || 0));
        res.ya_cortadas.detalle.push({
          cliente: l.companies?.nombre_comercial || l.companies?.nombre || '—',
          fecha: l.fecha, monto: Number(l.monto || 0),
          corte_id: l.corte_id,
          estado: c?.estado || 'desconocido',
          periodo: c ? `${c.desde} → ${c.hasta}` : '—',
        });
        continue;
      }
      ids.push(l.id);
      monto = r2(monto + Number(l.monto || 0));
    }

    // Sin líneas nuevas ni ajustes, no se crea un corte vacío solo porque el
    // periodo se traslapó con otro.
    if (!ids.length && !aj.ids.length) {
      if (g.filas.length) res.omitidos.push({ owner_id, nombre: g.nombre, motivo: 'todo su periodo ya está en otro corte' });
      continue;
    }

    const totales = {
      lineas: ids.length,
      monto_lineas: r2(monto),
      monto_ajustes: r2(aj.monto),
      total: r2(monto + aj.monto),
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
    for (let i = 0; i < ids.length; i += 300) {
      await supabase.from('comision_lineas').update({ corte_id }).in('id', ids.slice(i, i + 300));
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
