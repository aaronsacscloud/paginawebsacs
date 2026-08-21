// SOPORTE · Dashboard global (founder-only por middleware). Agrega
// crm_soporte_tickets: volumen por estado/tema/sentimiento, SLA (primera
// respuesta y resolución), CSAT, tickets sin ligar, carga por agente, quién
// consume el soporte y tendencia. Todo en JS (volumen de cientos, no millones).
//
// PERIODO: `?dias=30` (atajo) o `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
// (personalizado). Todo se mide en DÍA DE MÉXICO (CDMX = UTC−6): sin esto un
// ticket de la tarde/noche cae en el día UTC siguiente y las curvas y los
// cortes quedan corridos para un negocio mexicano.
//
// FLUJO vs. EXISTENCIA: "entraron" y "resueltos" son del PERIODO y se comparan
// contra el periodo anterior de igual largo. "Sin resolver" es existencia viva
// de HOY — un pendiente no deja de serlo porque cambies el rango de fechas.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { TEMA_LABEL } from '../../../../lib/soporte/clasificar';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const ABIERTO = ['abierto', 'en_curso', 'pausado'];
const MX = 6 * 3600_000; // CDMX = UTC−6
const horas = (a?: string | null, b?: string | null) => (a && b) ? (new Date(b).getTime() - new Date(a).getTime()) / 3600_000 : null;
const prom = (xs: number[]) => xs.length ? Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10 : null;
const ts = (iso?: string | null) => iso ? new Date(iso).getTime() : null;
const diaMx = (iso?: string | null) => iso ? new Date(new Date(iso).getTime() - MX).toISOString().slice(0, 10) : null;

// PostgREST corta en 1000 filas EN ESTE PROYECTO (max_rows=1000): un .limit()
// mayor subcuenta en silencio. Paginamos para no falsear los agregados.
async function leerTodos(): Promise<any[]> {
  const cols = 'conversation_id, company_id, cuenta, estado, tema, sentimiento, asignado, abierto_at, primera_respuesta_at, resuelto_at, ultima_actividad_at, csat_score, csat_at, csat_campana_id, reabierto_count';
  const out: any[] = [];
  for (let off = 0; off < 200000; off += 1000) {
    const { data, error } = await supabase.from('crm_soporte_tickets').select(cols).order('conversation_id').range(off, off + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Resuelve el rango pedido a [inicio, fin) en milisegundos UTC, más su gemelo
 *  anterior de igual largo. Una fecha inválida o invertida cae al atajo de
 *  días: es preferible enseñar 30 días que un rango vacío sin explicación. */
function resolverPeriodo(url: URL) {
  const dstr = url.searchParams.get('desde'), hstr = url.searchParams.get('hasta');
  const valido = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  if (valido(dstr) && valido(hstr)) {
    // El día de México va de 00:00 CDMX (= 06:00 UTC) a 00:00 CDMX del siguiente.
    const ini = Date.parse(dstr + 'T00:00:00Z') + MX;
    const fin = Date.parse(hstr + 'T00:00:00Z') + MX + 86400_000; // `hasta` INCLUSIVE
    if (fin > ini) {
      const largo = fin - ini;
      const dias = Math.round(largo / 86400_000);
      // Un rango absurdo (años) reventaría la tendencia; se acota a 366 días.
      if (dias <= 366) return { ini, fin, dias, personalizado: true, desde: dstr!, hasta: hstr!, antIni: ini - largo, antFin: ini };
    }
  }
  const dias = Math.min(366, Math.max(1, Number(url.searchParams.get('dias') || 30)));
  // Cortamos en el ARRANQUE del día de México de hoy − (dias−1): así "30 días"
  // son 30 días naturales completos y no una ventana que se mueve por horas.
  const hoyMx = new Date(Date.now() - MX).toISOString().slice(0, 10);
  const fin = Date.parse(hoyMx + 'T00:00:00Z') + MX + 86400_000;
  const ini = fin - dias * 86400_000;
  return { ini, fin, dias, personalizado: false, desde: new Date(ini - 0).toISOString().slice(0, 10), hasta: hoyMx, antIni: ini - dias * 86400_000, antFin: ini };
}

export const GET: APIRoute = async ({ url }) => {
  const P = resolverPeriodo(url);
  let t: any[];
  try { t = await leerTodos(); } catch (e: any) { return json({ error: e?.message || 'Error al leer tickets' }, 500); }

  const dentro = (iso: string | null | undefined, a: number, b: number) => { const v = ts(iso); return v != null && v >= a && v < b; };

  // ── Existencia viva (no depende del rango) ──────────────────────────────
  const abiertos = t.filter((x: any) => ABIERTO.includes(x.estado));
  const corte48 = Date.now() - 48 * 3600_000;
  const estancados = abiertos.filter((x: any) => { const ref = ts(x.ultima_actividad_at || x.abierto_at); return ref != null && ref < corte48; });
  const estancadoIds = new Set(estancados.map((x: any) => x.conversation_id));
  const sinPrimeraRespuesta = abiertos.filter((x: any) => !x.primera_respuesta_at);

  // ── Flujo del periodo y su gemelo anterior ──────────────────────────────
  const flujo = (a: number, b: number) => {
    const entraron = t.filter((x: any) => dentro(x.abierto_at, a, b));
    const resueltos = t.filter((x: any) => dentro(x.resuelto_at, a, b));
    const frt = t.filter((x: any) => dentro(x.primera_respuesta_at, a, b))
      .map((x: any) => horas(x.abierto_at, x.primera_respuesta_at)).filter((v): v is number => v != null && v >= 0);
    const res = resueltos.map((x: any) => horas(x.abierto_at, x.resuelto_at)).filter((v): v is number => v != null && v >= 0);
    return {
      entraron: entraron.length, resueltos: resueltos.length,
      frt: prom(frt), frt_n: frt.length,
      resolucion: prom(res), resolucion_n: res.length,
    };
  };
  const hoy = flujo(P.ini, P.fin), ant = flujo(P.antIni, P.antFin);

  // ── Calificación de la atención (CSAT) ──────────────────────────────────
  // COHORTE = los tickets RESUELTOS en el periodo. Todo se mide sobre ella: el
  // embudo, la distribución y el promedio. Si el promedio saliera de un conjunto
  // y la cobertura de otro, un 4.8 sobre 3 respuestas se leería como un 4.8
  // sobre 149 — que es justo la mentira que la tarjeta debe impedir.
  //
  // La encuesta es la campaña Outbound "CSAT post-soporte" (5 caras, 1..5) que
  // el ERP muestra al cliente; `csat_campana_id` marca a quién se le preguntó y
  // `csat_score` quién contestó. Ver lib/soporte/csat.ts.
  const DETRACTOR = 2, PROMOTOR = 5;
  const csatDe = (a: number, b: number) => {
    const cohorte = t.filter((x: any) => dentro(x.resuelto_at, a, b));
    const conRespuesta = cohorte.filter((x: any) => x.csat_score != null);
    const notas = conRespuesta.map((x: any) => Number(x.csat_score)).filter((v) => v >= 1 && v <= 5);
    const dist: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const v of notas) dist[v] = (dist[v] || 0) + 1;
    return {
      cohorte, conRespuesta, dist, n: notas.length,
      promedio: notas.length ? Math.round((notas.reduce((s2, v) => s2 + v, 0) / notas.length) * 10) / 10 : null,
      promotores: notas.filter((v) => v >= PROMOTOR).length,
      detractores: notas.filter((v) => v <= DETRACTOR).length,
      preguntados: cohorte.filter((x: any) => x.csat_campana_id).length,
    };
  };
  const cs = csatDe(P.ini, P.fin), csAnt = csatDe(P.antIni, P.antFin);
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

  // A quién hay que llamar: cada 1 o 2 con nombre. El sistema ya levanta el
  // aviso y la tarea; aquí se ve la lista junta.
  const detractores = cs.conRespuesta
    .filter((x: any) => Number(x.csat_score) <= DETRACTOR)
    .sort((a: any, b: any) => Number(a.csat_score) - Number(b.csat_score) || String(b.csat_at || '').localeCompare(String(a.csat_at || '')))
    .slice(0, 12)
    .map((x: any) => ({
      conversation_id: x.conversation_id, company_id: x.company_id || null, cuenta: x.cuenta || null, nombre: null as string | null,
      score: Number(x.csat_score), tema_label: x.tema ? (TEMA_LABEL[x.tema] || x.tema) : null,
      fecha: x.csat_at || x.resuelto_at || null,
    }));

  // Conteo por campo con default configurable (sentimiento null = 'neutral', no
  // un bucket 'otros' que no existe en esa dimensión).
  const cuentaCon = (k: string, def: string, filas: any[]) => filas.reduce((m: Record<string, number>, x: any) => { const v = x[k] || def; m[v] = (m[v] || 0) + 1; return m; }, {} as Record<string, number>);

  // Los temas y el sentimiento describen LO QUE ENTRÓ en el periodo: mezclarlos
  // con el histórico hacía que mover el rango no cambiara nada.
  const delPeriodo = t.filter((x: any) => dentro(x.ultima_actividad_at || x.abierto_at, P.ini, P.fin));
  const porTema = Object.entries(cuentaCon('tema', 'otros', delPeriodo)).map(([k, n]) => ({ tema: k, label: TEMA_LABEL[k] || k, n })).sort((a: any, b: any) => b.n - a.n);

  // Carga por agente. `asignado` puede venir vacío de Intercom para TODO el
  // histórico; el front decide si vale la pena enseñar la tarjeta.
  const porAgente = Object.entries(t.reduce((m: Record<string, any>, x: any) => {
    const a = x.asignado || 'Sin asignar'; m[a] = m[a] || { agente: a, abiertos: 0, total: 0 };
    m[a].total++; if (ABIERTO.includes(x.estado)) m[a].abiertos++; return m;
  }, {})).map(([, v]) => v).sort((a: any, b: any) => b.abiertos - a.abiertos);
  const conAsignado = t.filter((x: any) => x.asignado).length;

  // ── Clientes que más piden atención ───────────────────────────────────────
  // Ranking por volumen EN EL PERIODO, no histórico: un cliente con 20 tickets
  // de hace medio año no está pidiendo atención hoy. Manda la ÚLTIMA ACTIVIDAD
  // sobre la apertura — un hilo viejo que sigue vivo sí cuenta. Los tickets sin
  // company_id se agrupan por la cuenta SACS cruda para que no desaparezcan del
  // ranking mientras el backfill los liga.
  const acum = new Map<string, any>();
  for (const x of t) {
    const cta = (x.cuenta || '').trim().toLowerCase();
    const key = x.company_id || `cuenta:${cta || 'sin-identificar'}`;
    let c = acum.get(key);
    if (!c) {
      c = { company_id: x.company_id || null, cuenta: x.cuenta || null, nombre: null, plan: null, estado_cuenta: null, arr: null, health_score: null,
            n: 0, total: 0, abiertos: 0, estancados: 0, urgentes: 0, ultimo: null as string | null, temas: {} as Record<string, number> };
      acum.set(key, c);
    }
    const ref = x.ultima_actividad_at || x.abierto_at || null;
    c.total++;
    if (ref && (!c.ultimo || ref > c.ultimo)) c.ultimo = ref;
    if (ABIERTO.includes(x.estado)) c.abiertos++;
    if (estancadoIds.has(x.conversation_id)) c.estancados++;
    if (!dentro(ref, P.ini, P.fin)) continue;
    c.n++;
    if (x.sentimiento === 'urgente' || x.sentimiento === 'negativo') c.urgentes++;
    const tm = x.tema || 'otros';
    c.temas[tm] = (c.temas[tm] || 0) + 1;
  }
  const topClientes = [...acum.values()]
    .filter((c: any) => c.n > 0)
    .sort((a: any, b: any) => b.n - a.n || b.abiertos - a.abiertos || b.urgentes - a.urgentes)
    .slice(0, 25)
    .map((c: any) => {
      // 'otros' es el cajón de sastre del clasificador y hoy es el tema más
      // grande: si gana el desempate, la columna dice "Otros" para medio ranking
      // y no informa nada. Se prefiere SIEMPRE un tema concreto, y solo cae en
      // 'otros' cuando el cliente no pidió ninguna otra cosa. El desempate va
      // por nombre para que el ranking no cambie entre dos cargas iguales.
      const orden = (e: [string, any][]) => e.sort((a, b) => (b[1] as number) - (a[1] as number) || a[0].localeCompare(b[0]));
      const entradas = Object.entries(c.temas) as [string, any][];
      const concretos = orden(entradas.filter(([k]) => k !== 'otros'));
      const tema = (concretos[0] || orden(entradas)[0])?.[0] || null;
      const { temas, ...resto } = c;
      return { ...resto, tema, tema_label: tema ? (TEMA_LABEL[tema] || tema) : null };
    });

  // Los nombres, en UNA consulta por los ids del top (no una por cliente).
  const idsTop = [...new Set([...topClientes.map((c: any) => c.company_id), ...detractores.map((x: any) => x.company_id)].filter(Boolean))] as string[];
  if (idsTop.length) {
    const { data: emp } = await supabase.from('companies').select('id, nombre, nombre_comercial, plan, estado_cuenta, arr, health_score').in('id', idsTop);
    const porId = new Map((emp || []).map((e: any) => [e.id, e]));
    for (const c of topClientes as any[]) {
      const e = c.company_id ? porId.get(c.company_id) : null;
      if (!e) continue;
      c.nombre = e.nombre_comercial || e.nombre || null;
      c.plan = e.plan || null;
      c.estado_cuenta = e.estado_cuenta || null;
      c.arr = e.arr ?? null;
      c.health_score = e.health_score ?? null;
    }
    for (const x of detractores) {
      const e = x.company_id ? porId.get(x.company_id) : null;
      if (e) x.nombre = e.nombre_comercial || e.nombre || null;
    }
  }

  // ── Tendencia ────────────────────────────────────────────────────────────
  // Por día hasta 92 días; más allá se agrupa por semana o serían 365 barras de
  // dos píxeles que no se pueden ni apuntar con el dedo.
  const porSemana = P.dias > 92;
  const serie: Array<{ dia: string; etiqueta: string; abiertos: number; resueltos: number }> = [];
  const indice = new Map<string, number>();
  for (let ms = P.ini; ms < P.fin; ms += 86400_000) {
    // `ms` es el arranque de un día de México; `diaMx` de ese instante devuelve
    // esa misma fecha, así que la llave del cubo y la del ticket son la misma.
    const d = diaMx(new Date(ms).toISOString())!;
    if (!porSemana) { indice.set(d, serie.length); serie.push({ dia: d, etiqueta: d, abiertos: 0, resueltos: 0 }); continue; }
    const llave = 's' + Math.floor((ms - P.ini) / (7 * 86400_000));
    if (!indice.has(llave)) { indice.set(llave, serie.length); serie.push({ dia: d, etiqueta: d, abiertos: 0, resueltos: 0 }); }
    indice.set(d, indice.get(llave)!);
  }
  for (const x of t) {
    const da = diaMx(x.abierto_at); if (da != null && indice.has(da)) serie[indice.get(da)!].abiertos++;
    const dr = diaMx(x.resuelto_at); if (dr != null && indice.has(dr)) serie[indice.get(dr)!].resueltos++;
  }

  return json({
    periodo: {
      desde: P.desde, hasta: P.hasta, dias: P.dias, personalizado: P.personalizado,
      agrupado: porSemana ? 'semana' : 'dia',
    },
    kpis: {
      entraron: { valor: hoy.entraron, anterior: ant.entraron },
      resueltos: { valor: hoy.resueltos, anterior: ant.resueltos },
      sin_resolver: { valor: abiertos.length, estancados: estancados.length, sin_1a_respuesta: sinPrimeraRespuesta.length },
      frt: { valor: hoy.frt, anterior: ant.frt, n: hoy.frt_n },
      resolucion: { valor: hoy.resolucion, anterior: ant.resolucion, n: hoy.resolucion_n },
      csat: { valor: cs.promedio, anterior: csAnt.promedio, n: cs.n },
    },
    totales: {
      total: t.length, abiertos: abiertos.length, resueltos: t.filter((x: any) => x.estado === 'resuelto' || x.estado === 'cerrado').length,
      en_curso: t.filter((x: any) => x.estado === 'en_curso').length,
      estancados: estancados.length,
      sin_ligar: t.filter((x: any) => !x.company_id).length,
      reabiertos: t.filter((x: any) => (x.reabierto_count || 0) > 0).length,
      con_asignado: conAsignado,
      en_periodo: delPeriodo.length,
    },
    csat: {
      promedio: cs.promedio, anterior: csAnt.promedio, n: cs.n,
      dist: cs.dist,
      promotores: cs.promotores, promotores_pct: pct(cs.promotores, cs.n),
      detractores: cs.detractores, detractores_pct: pct(cs.detractores, cs.n),
      cobertura: { resueltos: cs.cohorte.length, preguntados: cs.preguntados, respondieron: cs.n, tasa_pct: pct(cs.n, cs.cohorte.length) },
      lista_detractores: detractores,
    },
    por_estado: cuentaCon('estado', 'otros', t),
    por_sentimiento: cuentaCon('sentimiento', 'neutral', delPeriodo),
    por_tema: porTema,
    por_agente: porAgente,
    top_clientes: topClientes,
    tendencia: serie,
  });
};
