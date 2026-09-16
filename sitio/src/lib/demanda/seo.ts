// DEMAND ENGINE · qué dicen los datos de Search Console.
//
// Las reglas que convierten un montón de filas en cosas que se pueden hacer.
// Ninguna usa modelo: son comparaciones de ventanas y umbrales, así que corren
// todos los días por centavos.
//
// Una distinción que atraviesa todo el archivo y que en este negocio importa
// más que cualquier umbral: **marca contra no-marca**. Una búsqueda de
// «sacscloud iniciar sesión» es un cliente que ya paga entrando a trabajar;
// una de «software para tienda de ropa» es demanda nueva. Sumarlas en un solo
// número de «tráfico orgánico» esconde exactamente lo que este motor existe
// para arreglar.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { umbral } from './config';
import { diaCdmx } from './fechas';
import type { Config, ResultadoHandler } from './tipos';

/** Lo que cuenta como búsqueda de marca, incluidos los errores de dedo que la
 *  gente comete al teclearla. */
export const ES_MARCA = /sacs|sacloud|sasc|saacs|sac\b/i;

export type Movimiento = {
  tipo: string; severidad: number; query?: string; pagina?: string;
  datos: Record<string, any>; titulo: string;
};

const ventana = (dias: number, desplazamiento = 0) => {
  const f = (d: number) => { const x = new Date(); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0, 10); };
  return { desde: f(dias + desplazamiento + 3), hasta: f(desplazamiento + 3) };
};

export async function detectarMovimientos(cfg: Config): Promise<Movimiento[]> {
  const movs: Movimiento[] = [];
  const impMin = umbral(cfg, 'gsc_impresiones_min', 50);
  const desde = umbral(cfg, 'seo_posicion_desde', 4);
  const hasta = umbral(cfg, 'seo_posicion_hasta', 20);

  const act = ventana(28), ant = ventana(28, 28);

  const { data, error } = await supabase.rpc('de_gsc_comparar', {
    a_desde: act.desde, a_hasta: act.hasta, b_desde: ant.desde, b_hasta: ant.hasta,
  });
  if (error) throw new Error(`no se pudo comparar ventanas: ${error.message}`);

  for (const q of data || []) {
    const marca = ES_MARCA.test(q.query);
    const impr = Number(q.impresiones_a || 0);
    const pos = Number(q.posicion_a || 0);
    const ctr = impr > 0 ? Number(q.clics_a || 0) / impr : 0;

    // ── La ventana de oportunidad: se ve pero no se entra ──────────────────
    // Una consulta en posición 4-20 ya la considera Google relevante para
    // nosotros; subirla es trabajo de contenido, no de empezar de cero.
    if (!marca && impr >= impMin && pos >= desde && pos <= hasta) {
      movs.push({
        tipo: 'posicion_media', severidad: Math.min(100, Math.round(impr / 10 + (20 - pos) * 2)),
        query: q.query, pagina: q.pagina_a,
        titulo: `«${q.query}» está en posición ${pos.toFixed(1)} con ${impr} impresiones`,
        datos: { posicion: pos, impresiones: impr, clics: q.clics_a, ctr },
      });
    }

    // ── Se ve mucho y no le dan clic ───────────────────────────────────────
    // Solo tiene sentido en las primeras posiciones: un CTR bajo en la
    // posición 30 no es un problema de título, es que nadie llega tan abajo.
    if (!marca && impr >= impMin * 2 && pos <= 10 && ctr < 0.02) {
      movs.push({
        tipo: 'ctr_bajo', severidad: Math.min(100, Math.round(impr / 20 + 30)),
        query: q.query, pagina: q.pagina_a,
        titulo: `«${q.query}» sale en posición ${pos.toFixed(1)} y casi nadie entra (${(ctr * 100).toFixed(1)}% de clics)`,
        datos: { posicion: pos, impresiones: impr, ctr },
      });
    }

    // ── Cayó ───────────────────────────────────────────────────────────────
    const caida = Number(q.posicion_a || 0) - Number(q.posicion_b || 0);
    if (impr >= impMin && q.posicion_b && caida >= umbral(cfg, 'caida_posicion_alerta', 3)) {
      movs.push({
        tipo: 'caida_posicion', severidad: Math.min(100, Math.round(caida * 8 + impr / 30)),
        query: q.query, pagina: q.pagina_a,
        titulo: `«${q.query}» bajó de la posición ${Number(q.posicion_b).toFixed(1)} a la ${pos.toFixed(1)}`,
        datos: { antes: q.posicion_b, ahora: pos, impresiones: impr, marca },
      });
    }

    // ── Apareció algo nuevo ────────────────────────────────────────────────
    if (!marca && !q.impresiones_b && impr >= impMin) {
      movs.push({
        tipo: 'consulta_nueva', severidad: Math.min(100, Math.round(impr / 5)),
        query: q.query, pagina: q.pagina_a,
        titulo: `«${q.query}» empezó a aparecer: ${impr} impresiones`,
        datos: { impresiones: impr, posicion: pos },
      });
    }
  }

  return movs.sort((a, b) => b.severidad - a.severidad);
}

/** La foto que dice si el motor está sirviendo para algo. */
export async function medirLineaBase(): Promise<Record<string, number>> {
  const { data } = await supabase.rpc('de_gsc_resumen_marca', { dias: 28 });
  const r = (data || [])[0] || {};
  const clicsMarca = Number(r.clics_marca || 0), clicsSin = Number(r.clics_sin_marca || 0);
  const total = clicsMarca + clicsSin;

  const metricas: Record<string, number> = {
    clics_totales: total,
    clics_marca: clicsMarca,
    clics_sin_marca: clicsSin,
    // ESTE es el número del objetivo: qué parte del tráfico viene de gente que
    // NO nos conocía. Arranca casi en cero, y por eso existe este motor.
    pct_sin_marca: total > 0 ? Math.round((clicsSin / total) * 1000) / 10 : 0,
    impresiones_sin_marca: Number(r.impresiones_sin_marca || 0),
    consultas_sin_marca: Number(r.consultas_sin_marca || 0),
  };

  const fecha = diaCdmx();
  for (const [metrica, valor] of Object.entries(metricas)) {
    await supabase.from('de_metricas_diarias').upsert(
      { fecha, metrica, dimension: 'buscadores', valor_dim: 'todo', valor },
      { onConflict: 'fecha,metrica,dimension,valor_dim' });
  }
  return metricas;
}

registrar('detectar.seo', async (a, ctx): Promise<ResultadoHandler> => {
  const base = await medirLineaBase();
  const movs = await detectarMovimientos(ctx.cfg);

  // Cada movimiento es un problema abierto, con clave estable: la misma
  // consulta atascada tres semanas es UN asunto, no veintiún avisos.
  let nuevos = 0;
  for (const m of movs.slice(0, 200)) {
    const clave = `${m.tipo}:${m.query || m.pagina}`;
    const { data } = await supabase.from('de_issues').upsert({
      clave_idem: clave, tipo: m.tipo,
      severidad: m.severidad >= 70 ? 'alta' : m.severidad >= 40 ? 'media' : 'baja',
      url: m.pagina || null,
      detalle: { titulo: m.titulo, query: m.query, ...m.datos },
      estado: 'abierto', visto_ultima: new Date().toISOString(),
    }, { onConflict: 'clave_idem' }).select('id, detectado_at');
    if (data?.[0] && data[0].detectado_at >= new Date(Date.now() - 60_000).toISOString()) nuevos++;
  }

  return {
    ok: true,
    resumen: `${base.pct_sin_marca}% del tráfico es de gente que no nos conocía · ${movs.length} movimientos${nuevos ? `, ${nuevos} nuevos` : ''}`,
    datos: { linea_base: base, movimientos: movs.length, por_tipo: movs.reduce((m: any, x) => ({ ...m, [x.tipo]: (m[x.tipo] || 0) + 1 }), {}) },
  };
});
