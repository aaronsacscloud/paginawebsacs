// DEMAND ENGINE · lo que cierra el ciclo: medirse y aprender.
//
// Hasta aquí el motor hace cosas y las mide por separado —visibilidad en IA,
// clics del buscador, herramientas usadas, leads atribuidos—. Lo que faltaba es
// lo único que convierte todo eso en aprendizaje: **guardar una serie** y
// **comprobar si sus predicciones se cumplieron**.
//
// Sin serie, dentro de tres meses nadie puede decir «el AVS pasó de 0 a X»:
// solo se puede decir cuánto vale hoy. Y una cifra sin ayer no distingue un
// sistema que funciona de uno que se quedó quieto.
//
// Sin evaluación de predicciones, el score que decide QUÉ escribe el motor no
// tiene forma de estar equivocado. Un modelo de prioridades que nunca se
// comprueba no es un modelo: es una opinión con decimales.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { diaCdmx } from './fechas';
import { traerTodo, contar } from './paginar';
import type { ResultadoHandler } from './tipos';

/* Devuelve si guardó. No es ceremonia: la primera versión registraba el error
   por consola y seguía, y el handler contestaba «6 métricas guardadas» habiendo
   guardado CERO —`detalle` es NOT NULL y le estaba pasando `null`—. Un resumen
   que cuenta intentos en vez de resultados es exactamente la clase de mentira
   que este proyecto lleva toda la sesión arreglando, y la escribí otra vez.

   `detalle` va a `{}` y no a null por lo mismo: la columna no acepta null, y
   averiguarlo por un error en tiempo de ejecución es averiguarlo tarde. */
async function guardarMetrica(fecha: string, metrica: string, dimension: string, valor_dim: string, valor: number, detalle?: any): Promise<boolean> {
  const { error } = await supabase.from('de_metricas_diarias').upsert(
    { fecha, metrica, dimension, valor_dim, valor, detalle: detalle ?? {} },
    { onConflict: 'fecha,metrica,dimension,valor_dim' });
  if (error) { console.error(`[aprender] no se pudo guardar ${metrica}: ${error.message}`); return false; }
  return true;
}

// ── metricas.calcular · la foto diaria del marcador ─────────────────────────
//
// Se guarda TODO lo que se sabe cada día, aunque sea cero. Guardar solo cuando
// hay algo deja huecos en la serie, y un hueco es indistinguible de un cero
// cuando se dibuja la gráfica seis meses después.
registrar('metricas.calcular', async (): Promise<ResultadoHandler> => {
  const fecha = diaCdmx();

  const [publicadas, paginas, herramientasHoy, toques, oportunidades, problemas] = await Promise.all([
    contar('de_contenido', q => q.eq('estado', 'publicado')),
    contar('de_paginas', q => q.eq('indexable', true)),
    contar('de_herramienta_usos', q => q.gte('created_at', new Date(Date.now() - 864e5).toISOString())),
    contar('de_herramienta_usos'),
    contar('de_oportunidades'),
    contar('de_clusters', q => q.not('score_oportunidad', 'is', null)),
  ]);

  const m: [string, string, number][] = [
    ['contenido_publicado', 'motor', publicadas],
    ['paginas_indexables', 'sitio', paginas],
    ['herramientas_usos_dia', 'motor', herramientasHoy],
    ['herramientas_usos_total', 'motor', toques],
    ['oportunidades', 'motor', oportunidades],
    ['problemas_puntuados', 'motor', problemas],
  ];
  let guardadas = 0;
  for (const [metrica, dim, valor] of m) if (await guardarMetrica(fecha, metrica, dim, 'todo', valor)) guardadas++;

  // Si no se guardó todo, el handler FALLA. Una métrica que no queda es un
  // hueco en la serie, y la serie es el único motivo por el que esto existe.
  return {
    ok: guardadas === m.length,
    resumen: guardadas === m.length
      ? `${guardadas} métricas del día guardadas`
      : `solo ${guardadas} de ${m.length} métricas se guardaron`,
    datos: Object.fromEntries(m.map(x => [x[0], x[2]])),
  };
});

// ── atribucion.procesar · la serie de lo que trae clientes ──────────────────
//
// La atribución vive en vistas, que son una foto del AHORA. Si nadie la
// congela, el día que alguien pregunte «¿cuándo empezó a funcionar?» la
// respuesta será «no se puede saber».
registrar('atribucion.procesar', async (): Promise<ResultadoHandler> => {
  const fecha = diaCdmx();

  const { data: cob } = await supabase.from('de_atribucion_cobertura').select('*').maybeSingle();
  const { data: act } = await supabase.from('de_atribucion').select('tipo, activo, leads, clientes, arr');

  const leads = (act || []).reduce((s, a) => s + Number(a.leads || 0), 0);
  const clientes = (act || []).reduce((s, a) => s + Number(a.clientes || 0), 0);
  const arr = (act || []).reduce((s, a) => s + Number(a.arr || 0), 0);

  let ok = true;
  const g = async (...a: Parameters<typeof guardarMetrica>) => { ok = (await guardarMetrica(...a)) && ok; };

  await g(fecha, 'visitantes_tocados', 'atribucion', 'todo', Number(cob?.visitantes_tocados || 0));
  await g(fecha, 'leads_atribuidos', 'atribucion', 'todo', leads);
  await g(fecha, 'clientes_atribuidos', 'atribucion', 'todo', clientes);
  await g(fecha, 'arr_atribuido', 'atribucion', 'todo', arr);
  // La cobertura se guarda JUNTO a las cifras, siempre. Una serie de leads
  // atribuidos sin su cobertura al lado se lee mal con el tiempo: no se
  // distingue «el motor mejoró» de «empezó a llegar más gente por la web».
  await g(fecha, 'cobertura_atribucion_pct', 'atribucion', 'todo', Number(cob?.pct_con_rastro || 0));

  // Y por activo, para poder decir cuál específicamente funcionó.
  for (const a of act || []) {
    await g(fecha, 'leads_por_activo', 'atribucion', `${a.tipo}:${a.activo}`, Number(a.leads || 0),
      { clientes: a.clientes, arr: a.arr });
  }

  return {
    ok,
    resumen: `${leads} lead(s) y ${clientes} cliente(s) atribuidos · cobertura ${cob?.pct_con_rastro ?? 0}%`
      + (ok ? '' : ' · ALGUNA MÉTRICA NO SE GUARDÓ'),
    datos: { leads, clientes, arr, cobertura: cob?.pct_con_rastro },
  };
});

// ── El Demand Capture Score ─────────────────────────────────────────────────
//
// UN número, de 0 a 100, que contesta: **¿qué tanto de la demanda que existe
// estamos capturando?**
//
// No sustituye a las otras métricas, las ordena. Un tablero con quince cifras
// no se mira; una cifra que se mueve sí — y cuando se mueve, las quince están
// ahí para decir por qué.
//
// Las cuatro partes y su peso, con el porqué:
export const PARTES_DCS = {
  // Lo más difícil y lo más valioso: que una IA nos nombre cuando le preguntan.
  // Es el objetivo declarado del proyecto, así que pesa como tal.
  visibilidad_ia: 40,
  // Que el buscador nos traiga gente que NO buscaba «Sacs». El 97% de los clics
  // de hoy son de marca: eso es gente que ya nos conocía, y capturar demanda
  // existente no es capturar demanda nueva.
  busqueda_sin_marca: 25,
  // Que lo que publicamos y construimos se USE. Un activo que nadie toca no
  // captura nada, por bien escrito que esté.
  uso_de_activos: 20,
  // Que eso acabe en alguien con nombre. Es lo único que se cobra.
  conversion: 15,
};

export async function calcularDcs(): Promise<{ dcs: number; partes: Record<string, { valor: number; de: number; nota: string }> }> {
  const hace30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const ultima = async (metrica: string, dimension: string) => {
    const { data } = await supabase.from('de_metricas_diarias')
      .select('valor').eq('metrica', metrica).eq('dimension', dimension)
      .gte('fecha', hace30).order('fecha', { ascending: false }).limit(1).maybeSingle();
    return Number(data?.valor ?? 0);
  };

  const avs = await ultima('avs', 'ia');
  const clicsSinMarca = await ultima('clics_sin_marca', 'buscadores');
  const clicsTotales = await ultima('clics_totales', 'buscadores');
  const usos = await contar('de_herramienta_usos', q => q.gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()));
  const publicadas = await contar('de_contenido', q => q.eq('estado', 'publicado'));
  const { data: cob } = await supabase.from('de_atribucion_cobertura').select('con_toque_del_motor, visitantes_tocados').maybeSingle();

  /* Cada parte se normaliza a 0-100 con un TECHO declarado, y los techos son
     metas, no límites naturales. Da igual que sean discutibles: lo que no da
     igual es que estén escritos, porque si no, el número sube o baja según
     quién lo calcule. */
  const pctSinMarca = clicsTotales > 0 ? (clicsSinMarca / clicsTotales) * 100 : 0;
  // Techo 40%: si cuatro de cada diez clics vienen de gente que no nos buscaba
  // por nombre, el motor está trayendo demanda nueva de verdad.
  const normSinMarca = Math.min(100, (pctSinMarca / 40) * 100);

  // Techo 200 usos al mes: es el punto en que las herramientas dejan de ser
  // una demo y empiezan a ser un canal.
  const normUso = Math.min(100, (usos / 200) * 100);

  // Techo 5%: de los visitantes que tocan el motor, cuántos dejan sus datos.
  const tocados = Number(cob?.visitantes_tocados || 0);
  const convertidos = Number(cob?.con_toque_del_motor || 0);
  const tasaConv = tocados > 0 ? (convertidos / tocados) * 100 : 0;
  const normConv = Math.min(100, (tasaConv / 5) * 100);

  const partes = {
    visibilidad_ia:      { valor: avs,         de: PARTES_DCS.visibilidad_ia,     nota: `AVS ${avs}/100` },
    busqueda_sin_marca:  { valor: normSinMarca, de: PARTES_DCS.busqueda_sin_marca, nota: `${Math.round(pctSinMarca)}% de los clics no son de marca (meta 40%)` },
    uso_de_activos:      { valor: normUso,      de: PARTES_DCS.uso_de_activos,     nota: `${usos} usos de herramienta en 30 días sobre ${publicadas} piezas publicadas (meta 200)` },
    conversion:          { valor: normConv,     de: PARTES_DCS.conversion,         nota: tocados ? `${convertidos} de ${tocados} visitantes dejaron sus datos (meta 5%)` : 'nadie ha tocado el motor todavía' },
  };

  const dcs = Math.round(
    Object.entries(partes).reduce((s, [k, p]) => s + (p.valor / 100) * (PARTES_DCS as any)[k], 0) * 10) / 10;

  return { dcs, partes };
}

registrar('aprender.evaluar', async (): Promise<ResultadoHandler> => {
  const fecha = diaCdmx();
  const { dcs, partes } = await calcularDcs();

  const guardado = await guardarMetrica(fecha, 'dcs', 'motor', 'todo', dcs,
    Object.fromEntries(Object.entries(partes).map(([k, p]) => [k, { valor: Math.round(p.valor * 10) / 10, nota: p.nota }])));

  /* Las predicciones que ya vencieron. Hoy no hay ninguna: el motor todavía no
     ha publicado nada a través del flujo completo de oportunidad, que es donde
     se registra la apuesta. Que el mecanismo exista antes que los datos es a
     propósito — construirlo después, con las predicciones ya vencidas y sin
     nadie que las guardara, es no poder evaluarlas nunca. */
  const vencidas = await traerTodo<any>('de_predicciones', 'id, oportunidad_id, esperado, confianza, horizonte_dias, evaluar_at',
    q => q.is('evaluada_at', null).lte('evaluar_at', new Date().toISOString()));

  return {
    ok: guardado,
    resumen: (guardado ? '' : 'NO se guardó el DCS · ') + (vencidas.length
      ? `DCS ${dcs}/100 · ${vencidas.length} predicción(es) por evaluar`
      : `DCS ${dcs}/100 · ninguna predicción ha vencido todavía`),
    datos: { dcs, partes, predicciones_vencidas: vencidas.length },
  };
});
