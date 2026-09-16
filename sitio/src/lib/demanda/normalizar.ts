// DEMAND ENGINE · de texto suelto a problema canónico.
//
// El paso donde el ruido se vuelve información. Tres movimientos:
//
//   1. NORMALIZAR — «¿Cómo sé qué ropa NO se me vende?» y «como saber que ropa
//      no se vende» son la misma consulta. Minúsculas, sin acentos, sin
//      relleno. El texto original SIEMPRE se conserva: es lo que la gente
//      escribe de verdad, y eso vale para el contenido y para los prompts.
//   2. ENTENDER — un modelo barato lee el texto crudo y dice qué está
//      intentando resolver esa persona, con qué intención y a qué tipo de
//      negocio le pasa. Lo que no es demanda, lo descarta.
//   3. AGRUPAR — se busca el problema canónico más parecido por embedding. Si
//      se parece lo suficiente, se une; si no, nace uno nuevo.
//
// Sin el paso 3, cuatro formas de preguntar lo mismo serían cuatro
// oportunidades, cuatro artículos y cuatro páginas compitiendo entre ellas.
import { supabase } from '../supabase';
import { preguntar } from './ia';
import { embeber, aVector, hayEmbeddings, umbralUnion, proveedorVigente } from './embeddings';
import { umbral } from './config';
import { registrar } from './handlers';
import type { Config, ResultadoHandler } from './tipos';

const VACIAS = new Set(['de','la','el','los','las','un','una','unos','unas','y','o','a','en','para','por','con','del','al','que','se','su','sus','mi','mis','lo','le','me','es','son','como','cómo','muy','mas','más','ya','si','sí','no','hay','ser','estar','tengo','tiene','puedo','quiero']);

/** Solo para comparar y deduplicar. Nunca sustituye al texto original. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // fuera acentos
    .replace(/[¿?¡!.,;:()"'`´]/g, ' ')
    .split(/\s+/)
    .filter(p => p && !VACIAS.has(p))
    .join(' ')
    .trim()
    .slice(0, 300);
}

const ESQUEMA = {
  type: 'object',
  properties: {
    resultados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          es_demanda: { type: 'boolean' },
          pregunta: { type: 'string' },
          intent: { type: 'string', enum: ['informacional', 'comercial', 'transaccional', 'navegacional', 'comparativa'] },
          intent_comercial: { type: 'number' },
          categoria: { type: 'string' },
          icp: { type: 'array', items: { type: 'string' } },
        },
        required: ['i', 'es_demanda'],
        additionalProperties: false,
      },
    },
  },
  required: ['resultados'],
  additionalProperties: false,
};

const sistema = (categorias: string[], icps: string[]) => `Lees mensajes reales de negocios de MODA en México (tiendas de ropa, boutiques, zapaterías, joyerías, marcas, mayoristas) escritos a un proveedor de software de retail.

Tu trabajo: por cada texto, decir QUÉ ESTÁ INTENTANDO RESOLVER esa persona.

Reglas:
- "es_demanda": false si el texto no expresa una necesidad, pregunta o problema del negocio (saludos, confirmaciones, datos de contacto, agradecimientos, coordinación de horarios). Sé estricto: más vale descartar que inventar demanda.
- "pregunta": el problema en UNA línea, escrito como lo diría alguien del ramo buscando la solución, en minúsculas, sin nombres propios ni marcas. Ejemplo: "cómo saber qué tallas volver a comprar", no "el cliente pregunta por reposición".
- "intent": informacional (quiere entender), comercial (compara soluciones), transaccional (quiere contratar ya), navegacional (busca algo nuestro), comparativa (nosotros contra otro).
- "intent_comercial": 0 a 1, qué tan cerca está de comprar.
- "categoria": una sola, de esta lista exacta: ${categorias.join(', ')}.
- "icp": de esta lista exacta, las que apliquen (vacío si no se puede saber): ${icps.join(', ')}.

Nunca inventes lo que no está en el texto. Si no se entiende, es_demanda: false.`;

export type Normalizadas = { leidas: number; demanda: number; descartadas: number; queries: number; clusters_nuevos: number; costo_usd: number };

export async function normalizarPendientes(limite = 60, cfg?: Config): Promise<Normalizadas> {
  const r: Normalizadas = { leidas: 0, demanda: 0, descartadas: 0, queries: 0, clusters_nuevos: 0, costo_usd: 0 };

  /* NO SE GASTA EN UN PASO QUE NO PUEDE TERMINAR.
     Lo encontró la primera corrida real: sin OPENAI_API_KEY el modelo sí leía
     las señales —y se cobraba— pero el agrupado se saltaba en silencio, así que
     las mismas señales volvían a pagarse en la vuelta siguiente, y en la
     siguiente. La regla general: comprobar las dependencias ANTES de la primera
     llamada cara, no en medio. */
  if (!hayEmbeddings())
    throw new Error('Falta OPENAI_API_KEY: sin ella no se puede agrupar, y leer sin agrupar solo gasta.');

  const { data: senales } = await supabase
    .from('de_senales')
    .select('id, texto, query_cruda, pais, idioma, fuente, peso, confianza, icp')
    .eq('procesada', false)
    .order('created_at')
    .limit(limite);
  if (!senales?.length) return r;
  r.leidas = senales.length;

  const [{ data: cats }, { data: icps }] = await Promise.all([
    supabase.from('de_taxonomia').select('id').eq('activa', true),
    supabase.from('de_icp').select('id').eq('activo', true),
  ]);
  const CATS = (cats || []).map(c => c.id);
  const ICPS = (icps || []).map(i => i.id);

  const entrada = senales.map((s, i) => `[${i}] ${(s.query_cruda || s.texto || '').slice(0, 600)}`).join('\n');
  const resp = await preguntar<{ resultados: any[] }>({
    agente: 'demanda_investigador',
    trabajo: 'volumen',
    sistema: sistema(CATS, ICPS),
    usuario: entrada,
    esquema: ESQUEMA,
    max_tokens: 8000,
    // El texto ya se anonimizó al entrar, pero se repite: el costo es cero y
    // el día que alguien agregue una fuente sin limpiar, aquí no pasa.
    anonimizar: true,
    contexto: { senales: senales.length },
  });
  r.costo_usd += resp.costo_usd;
  if (!resp.ok || !resp.datos?.resultados) {
    const e: any = new Error(resp.error || 'el modelo no devolvió resultados');
    e.definitivo = resp.definitivo;
    throw e;
  }

  const porIndice = new Map<number, any>();
  for (const x of resp.datos.resultados) porIndice.set(Number(x.i), x);

  // Solo lo que de verdad es demanda llega a embeberse: ahí sí se paga por
  // volumen y no tiene sentido vectorizar un «gracias, ahí nos vemos».
  const utiles: { senal: any; res: any; pregunta: string; norm: string }[] = [];
  for (let i = 0; i < senales.length; i++) {
    const res = porIndice.get(i);
    const pregunta = String(res?.pregunta || '').trim();
    if (!res?.es_demanda || pregunta.length < 8) { r.descartadas++; continue; }
    utiles.push({ senal: senales[i], res, pregunta, norm: normalizar(pregunta) });
  }
  r.demanda = utiles.length;

  if (utiles.length) {
    const lote = await embeber(utiles.map(u => u.pregunta));
    r.costo_usd += lote.costo_usd;
    // El umbral lo pone el MODELO que generó los vectores; el ajuste manual de
    // `de_config` solo manda si alguien lo puso a propósito.
    const uCluster = cfg?.umbrales?.similitud_cluster ?? umbralUnion(lote.proveedor);

    for (let i = 0; i < utiles.length; i++) {
      const u = utiles[i];
      const vec = aVector(lote.vectores[i]);

      // ¿Ya existe este problema? Se pregunta a la base con distancia coseno.
      const { data: cercano } = await supabase.rpc('de_cluster_cercano', { v: vec, lim: 1 });
      const mejor = (cercano || [])[0];
      let cluster_id: string | null = null;

      if (mejor && Number(mejor.similitud) >= uCluster) {
        cluster_id = mejor.id;
      } else {
        const { data: nuevo } = await supabase.from('de_clusters').insert({
          problema_canonico: u.pregunta,
          categoria: CATS.includes(u.res.categoria) ? u.res.categoria : null,
          icp: (u.res.icp || []).filter((x: string) => ICPS.includes(x)),
          idioma: u.senal.idioma || 'es',
          pais: [u.senal.pais || 'MX'],
          embedding: vec,
          naturaleza_dominante: 'observada',
          confianza: u.senal.confianza ?? 0.7,
        }).select('id').single();
        cluster_id = nuevo?.id || null;
        if (cluster_id) r.clusters_nuevos++;
      }

      // La consulta: única por texto normalizado + país + idioma. Si ya estaba,
      // se le suma una señal más en vez de duplicarla.
      const { data: existente } = await supabase.from('de_queries')
        .select('id, senales_n, fuentes')
        .eq('texto_norm', u.norm).eq('pais', u.senal.pais || 'MX').eq('idioma', u.senal.idioma || 'es')
        .maybeSingle();

      let query_id = existente?.id || null;
      if (existente) {
        await supabase.from('de_queries').update({
          senales_n: (existente.senales_n || 0) + 1,
          fuentes: [...new Set([...(existente.fuentes || []), u.senal.fuente])],
          cluster_id, actualizada_at: new Date().toISOString(),
        }).eq('id', existente.id);
      } else {
        const { data: q } = await supabase.from('de_queries').insert({
          texto_norm: u.norm,
          texto_original: u.pregunta,
          pais: u.senal.pais || 'MX', idioma: u.senal.idioma || 'es',
          intent: u.res.intent || null,
          intent_comercial: Number.isFinite(u.res.intent_comercial) ? u.res.intent_comercial : null,
          embedding: vec, cluster_id,
          fuentes: [u.senal.fuente],
          volumen_naturaleza: 'inferida',
        }).select('id').single();
        query_id = q?.id || null;
        if (query_id) r.queries++;
      }

      await supabase.from('de_senales').update({
        procesada: true, cluster_id, query_id,
        icp: (u.res.icp || []).filter((x: string) => ICPS.includes(x)),
      }).eq('id', u.senal.id);
    }
  }

  // Lo descartado se marca igual: si no, se vuelve a leer y a pagar cada vuelta.
  const ids = senales.map(s => s.id).filter(id => !utiles.find(u => u.senal.id === id));
  if (ids.length) await supabase.from('de_senales').update({ procesada: true }).in('id', ids);

  await recontar();
  return r;
}

/** Los conteos del cluster se recalculan aquí y no en cada inserción: hacerlo
 *  fila por fila multiplica las escrituras y se desincroniza igual. */
async function recontar(): Promise<void> {
  await supabase.rpc('de_recontar_clusters');
}

registrar('normalizar', async (a, ctx): Promise<ResultadoHandler> => {
  if (!hayEmbeddings()) return { ok: false, resumen: 'falta OPENAI_API_KEY para agrupar', definitivo: true };
  let total: Normalizadas = { leidas: 0, demanda: 0, descartadas: 0, queries: 0, clusters_nuevos: 0, costo_usd: 0 };
  // Varias vueltas mientras quede tiempo del cron: la cola de señales del
  // primer día trae miles y de a 60 no se vacía nunca.
  while (Date.now() < ctx.limite - 20_000) {
    let r: Normalizadas;
    try {
      r = await normalizarPendientes(60, ctx.cfg);
    } catch (e: any) {
      if (e?.definitivo) return { ok: false, resumen: e.message, definitivo: true, datos: total, costo_usd: total.costo_usd };
      throw e;
    }
    total = {
      leidas: total.leidas + r.leidas, demanda: total.demanda + r.demanda,
      descartadas: total.descartadas + r.descartadas, queries: total.queries + r.queries,
      clusters_nuevos: total.clusters_nuevos + r.clusters_nuevos,
      costo_usd: total.costo_usd + r.costo_usd,
    };
    if (r.leidas === 0) break;
  }
  return {
    ok: true,
    resumen: total.leidas
      ? `${total.leidas} señales leídas · ${total.demanda} son demanda · ${total.queries} consultas nuevas · ${total.clusters_nuevos} problemas nuevos`
      : 'no había señales sin procesar',
    datos: total,
    costo_usd: total.costo_usd,
  };
});

/**
 * Repasa los problemas ya formados y funde los que resultaron ser el mismo.
 *
 * Hace falta aparte del agrupado de cada señal porque un cluster se mueve: al
 * recalcularse su centro con los miembros nuevos, dos que nacieron separados
 * pueden terminar siendo uno. Sin este repaso, la base acumula duplicados que
 * ya nadie vuelve a mirar.
 */
registrar('agrupar', async (): Promise<ResultadoHandler> => {
  if (!hayEmbeddings()) return { ok: false, resumen: 'sin proveedor de embeddings', definitivo: true };
  const p = await proveedorVigente();
  // El error del RPC SÍ se mira. La primera versión de esta función se quedaba
  // sin tiempo a partir de cierto tamaño y devolvía vacío, y la corrida de
  // producción reportó «nada que fundir · 0 problemas» como si todo estuviera
  // bien. Un fallo silencioso aquí es un catálogo que se llena de duplicados
  // durante semanas sin que nadie lo note.
  const { data, error } = await supabase.rpc('de_refundir_clusters', { umbral: umbralUnion(p), max_pasadas: 5 });
  if (error) throw new Error(`no se pudieron refundir los problemas: ${error.message}`);
  const r = (data || [])[0];
  if (!r) throw new Error('la refundición no devolvió resultado');
  await supabase.rpc('de_recontar_clusters');
  return {
    ok: true,
    resumen: r.fusionados ? `${r.fusionados} problemas fundidos · quedan ${r.restantes}` : `nada que fundir · ${r.restantes} problemas`,
    datos: r,
  };
});
