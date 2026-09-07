// Lo que se aprende de VARIAS ferias juntas: el comparador (punto 4), el
// presupuesto anual con lo que se espera de vuelta (punto 5) y el fit medido
// (punto 9). Todo sale de embudoDe(), que ya sabe atribuir con ventana; aquí
// solo se junta y se compara.
import { supabase } from '../supabase';
import { embudoDe } from './eventos.lib';
import { roiPorCanal } from './roi-canal.lib';

export interface FilaComparador {
  edicion_id: string; edicion: string; evento_id: string; evento: string; slug: string;
  inicio: string; fin: string | null; anio: number; participacion: string; rol: string | null;
  presupuesto: number; costo: number; registros: number; contactados: number; demos: number; oportunidades: number; clientes: number; arr: number;
  costo_por_registro: number | null; costo_por_cliente: number | null; roi: number | null; conversion_pct: number | null;
}

/** Todas las ediciones vividas o por vivir, cada una con su embudo. */
export async function compararEdiciones(): Promise<FilaComparador[]> {
  const { data: eds } = await supabase.from('ev_ediciones')
    .select('id, nombre, inicio, fin, participacion, rol, presupuesto, evento_id, ev_eventos(nombre, slug)')
    .in('participacion', ['fuimos', 'vamos']).order('inicio', { ascending: false }).limit(200);
  const filas: FilaComparador[] = [];
  for (const e of (eds || []) as any[]) {
    const em = await embudoDe(e.id);
    filas.push({
      edicion_id: e.id, edicion: e.nombre, evento_id: e.evento_id, evento: e.ev_eventos?.nombre || '', slug: e.ev_eventos?.slug || '',
      inicio: e.inicio, fin: e.fin, anio: Number(String(e.inicio).slice(0, 4)), participacion: e.participacion, rol: e.rol,
      presupuesto: Number(e.presupuesto || 0), costo: em.costo, registros: em.registros, contactados: em.contactados, demos: em.demos,
      oportunidades: em.oportunidades, clientes: em.clientes, arr: em.arr,
      costo_por_registro: em.costo_por_registro, costo_por_cliente: em.costo_por_cliente, roi: em.roi,
      conversion_pct: em.registros ? Math.round((em.clientes / em.registros) * 1000) / 10 : null,
    });
  }
  return filas;
}

/** Conversión histórica registro→cliente de las ferias ya vividas (con registros). */
export function conversionHistorica(filas: FilaComparador[]) {
  const vividas = filas.filter(f => f.participacion === 'fuimos' && f.registros > 0);
  const reg = vividas.reduce((a, f) => a + f.registros, 0);
  const cli = vividas.reduce((a, f) => a + f.clientes, 0);
  const costo = vividas.reduce((a, f) => a + f.costo, 0);
  const arrPorCliente = cli ? vividas.reduce((a, f) => a + f.arr, 0) / cli : 0;
  return {
    ferias: vividas.length, registros: reg, clientes: cli,
    conversion: reg ? cli / reg : null,                       // 0.023 = 2.3 %
    registros_por_feria: vividas.length ? Math.round(reg / vividas.length) : null,
    costo_por_cliente: cli ? Math.round(costo / cli) : null,
    arr_por_cliente: Math.round(arrPorCliente),
  };
}

/** Punto 5: por año, lo que se va a gastar en las ferias "vamos" y lo que se espera de vuelta. */
export function planAnual(filas: FilaComparador[], metas: Record<string, { meta_registros?: number | null; meta_clientes?: number | null }> = {}) {
  const h = conversionHistorica(filas);
  const anios: Record<number, any> = {};
  for (const f of filas) {
    const a = anios[f.anio] ||= { anio: f.anio, ediciones: 0, vamos: 0, fuimos: 0, presupuesto: 0, gastado: 0, registros_esperados: 0, clientes_esperados: 0, clientes_reales: 0, arr_real: 0, arr_esperado: 0, filas: [] as any[] };
    a.ediciones++;
    if (f.participacion === 'vamos') {
      a.vamos++;
      const presupuesto = f.presupuesto || f.costo;
      const m = metas[f.edicion_id] || {};
      const regEsp = Number(m.meta_registros) || h.registros_por_feria || 0;
      const cliEsp = Number(m.meta_clientes) || (h.conversion != null ? Math.round(regEsp * h.conversion * 10) / 10 : 0);
      a.presupuesto += presupuesto; a.registros_esperados += regEsp; a.clientes_esperados += cliEsp; a.arr_esperado += cliEsp * h.arr_por_cliente;
      a.filas.push({ edicion_id: f.edicion_id, edicion: f.edicion, evento: f.evento, inicio: f.inicio, presupuesto, registros_esperados: regEsp, clientes_esperados: cliEsp, arr_esperado: Math.round(cliEsp * h.arr_por_cliente) });
    } else {
      a.fuimos++; a.gastado += f.costo; a.clientes_reales += f.clientes; a.arr_real += f.arr;
    }
  }
  return {
    historico: h,
    anios: Object.values(anios).sort((x: any, y: any) => y.anio - x.anio).map((a: any) => ({
      ...a, clientes_esperados: Math.round(a.clientes_esperados * 10) / 10, arr_esperado: Math.round(a.arr_esperado),
      costo_por_cliente_esperado: a.clientes_esperados ? Math.round(a.presupuesto / a.clientes_esperados) : null,
      roi_esperado: a.presupuesto > 0 ? Math.round(((a.arr_esperado - a.presupuesto) / a.presupuesto) * 100) : null,
    })),
  };
}

/** El costo por cliente de los otros canales, para ponerlo junto al del stand. */
export async function canalesParaComparar() {
  try {
    const r = await roiPorCanal(365);
    return r.canales.filter((c: any) => c.costo_por_cliente != null || c.clientes > 0).map((c: any) => ({ canal: c.canal, nombre: c.nombre, clientes: c.clientes, gasto: c.gasto, costo_por_cliente: c.costo_por_cliente, retorno: c.retorno }));
  } catch { return []; }
}

/**
 * Punto 9: fit medido. El fit que se investigó (fit_puntaje) es una opinión; este sale
 * de lo que pasó. Se calcula por evento con sus ediciones vividas que sí tuvieron
 * registros, y se guarda en ev_eventos.fit_medido con la nota que lo explica.
 *
 *   sin ediciones vividas con registros → null (no se opina)
 *   1 edición    → puntaje por clientes/registro y costo por cliente, pero se dice que es una sola
 *   2+ ediciones con 0 clientes → se BAJA a 2 y se dice por qué
 */
export async function recalcularFitMedido(filas?: FilaComparador[]) {
  const todas = filas || await compararEdiciones();
  const canales = await canalesParaComparar();
  const cacOtros = canales.filter(c => c.costo_por_cliente).map(c => c.costo_por_cliente as number);
  const cacRef = cacOtros.length ? Math.round(cacOtros.reduce((a, b) => a + b, 0) / cacOtros.length) : null;
  const porEvento = new Map<string, FilaComparador[]>();
  for (const f of todas) if (f.participacion === 'fuimos' && f.registros > 0) porEvento.set(f.evento_id, [...(porEvento.get(f.evento_id) || []), f]);
  const salida: { evento_id: string; fit_medido: number; nota: string }[] = [];
  for (const [evento_id, eds] of porEvento) {
    const registros = eds.reduce((a, f) => a + f.registros, 0);
    const clientes = eds.reduce((a, f) => a + f.clientes, 0);
    const demos = eds.reduce((a, f) => a + f.demos, 0);
    const costo = eds.reduce((a, f) => a + f.costo, 0);
    const cpc = clientes ? Math.round(costo / clientes) : null;
    let fit: number; let nota: string;
    const n = eds.length;
    if (clientes === 0) {
      if (n >= 2) { fit = 2; nota = `${n} ediciones, ${registros} registros y ningún cliente atribuido. Se baja el fit: el papel decía otra cosa.`; }
      else { fit = demos > 0 ? 5 : 4; nota = `Una sola edición: ${registros} registros, ${demos} demos y todavía ningún cliente. Sin veredicto hasta la segunda.`; }
    } else {
      const conv = clientes / registros;                  // 2 % es bueno en feria B2B
      let f = conv >= 0.05 ? 9 : conv >= 0.03 ? 8 : conv >= 0.02 ? 7 : conv >= 0.01 ? 6 : 5;
      if (cpc != null && cacRef) { if (cpc <= cacRef * 0.7) f = Math.min(10, f + 1); else if (cpc >= cacRef * 2) f = Math.max(1, f - 2); }
      fit = f;
      nota = `${clientes} cliente${clientes === 1 ? '' : 's'} de ${registros} registros (${Math.round(conv * 1000) / 10} %) en ${n} edici${n === 1 ? 'ón' : 'ones'}`
        + (cpc != null ? `; $${cpc.toLocaleString('es-MX')} por cliente` : '')
        + (cpc != null && cacRef ? ` contra $${cacRef.toLocaleString('es-MX')} promedio de los otros canales` : '') + '.';
    }
    salida.push({ evento_id, fit_medido: fit, nota });
    await supabase.from('ev_eventos').update({ fit_medido: fit, fit_medido_nota: nota, fit_medido_at: new Date().toISOString() }).eq('id', evento_id);
  }
  return salida;
}
