// DEMAND ENGINE · embeddings.
//
// Sirven para una sola cosa, y es la que hace que el motor no se ahogue en
// ruido: reconocer que «cómo saber qué ropa no se vende», «cómo detectar
// inventario parado» y «productos que llevan meses sin salir» son la MISMA
// pregunta. Sin esto habría tres oportunidades, tres artículos y tres páginas
// compitiendo entre ellas por la misma búsqueda.
//
// ⚠️ LA REGLA QUE NO SE PUEDE ROMPER: los vectores de dos modelos distintos NO
// viven en el mismo espacio. Comparar uno de OpenAI contra uno de Gemini da un
// número que parece una similitud y no significa nada — y como nada falla, el
// motor empezaría a fusionar problemas que no tienen que ver y nadie sabría por
// qué. Por eso el proveedor se ELIGE UNA VEZ, se guarda en `de_config`, y si
// deja de funcionar el motor se detiene y lo dice, en vez de cambiarse solo.
// Cambiar de proveedor a propósito obliga a recalcular todos los vectores.
import { supabase } from '../supabase';

const env = (k: string): string => String((import.meta as any).env?.[k] || process.env[k] || '').trim();

export type Proveedor = 'openai' | 'gemini';

/** Los dos dan 1536 dimensiones, que son las que ya usa `kb_chunks` en esta
 *  base: un solo formato de vector en todo el proyecto. */
const MODELOS: Record<Proveedor, { modelo: string; llave: string; usd_por_millon: number; umbralUnion: number }> = {
  openai: { modelo: 'text-embedding-3-small', llave: 'OPENAI_API_KEY', usd_por_millon: 0.02, umbralUnion: 0.85 },
  gemini: { modelo: 'gemini-embedding-001',   llave: 'GEMINI_API_KEY', usd_por_millon: 0.15, umbralUnion: 0.82 },
};

/**
 * A partir de qué parecido dos textos son EL MISMO problema.
 *
 * No es una constante universal: es una propiedad del modelo, y confundir las
 * dos cosas costó una tarde. Con 0.85 —el valor sensato para OpenAI— y vectores
 * de Gemini truncados a 1536, el vecino más parecido de 326 problemas reales
 * llegaba a 0.849: nada se fusionaba nunca y cada señal abría un problema
 * nuevo. Medido sobre esos datos: mediana 0.762, p90 0.827, y revisando los
 * pares a mano, de 0.82 hacia arriba siguen siendo la misma pregunta.
 *
 * Si algún día se cambia de modelo, este número se vuelve a MEDIR
 * (`node scripts/de-probar.mjs calibrar`), no se hereda.
 */
export const umbralUnion = (p: Proveedor) => MODELOS[p].umbralUnion;

export const proveedoresPosibles = (): Proveedor[] =>
  (Object.keys(MODELOS) as Proveedor[]).filter(p => env(MODELOS[p].llave).length > 0);

export const hayEmbeddings = () => proveedoresPosibles().length > 0;

/**
 * Qué proveedor usa esta instalación. Se fija la primera vez y se respeta.
 * Si el elegido se quedó sin llave, NO se cambia solo: se lanza. Un motor que
 * se arregla solo cambiando de espacio vectorial es un motor que corrompe sus
 * propios datos en silencio.
 */
export async function proveedorVigente(): Promise<Proveedor> {
  const { data } = await supabase.from('de_config').select('umbrales').eq('id', 1).maybeSingle();
  const guardado = data?.umbrales?.embeddings_proveedor as Proveedor | undefined;
  const posibles = proveedoresPosibles();

  if (guardado) {
    if (!posibles.includes(guardado))
      throw new Error(`El motor agrupa con ${guardado} y falta ${MODELOS[guardado].llave}. No se cambia de proveedor solo: los vectores ya guardados son de ese modelo y mezclarlos daría similitudes falsas. Repón la llave, o vacía de_queries/de_clusters y elige otro a propósito.`);
    return guardado;
  }

  if (!posibles.length) throw new Error('No hay ninguna llave de embeddings (OPENAI_API_KEY o GEMINI_API_KEY).');

  // Primera vez: se prueba de verdad, no se asume. Una llave puede existir y no
  // tener permiso sobre el modelo —pasó con OpenAI, cuyo proyecto no daba
  // acceso a text-embedding-3-small— y descubrirlo a medias de la corrida
  // significa haber pagado ya el paso anterior.
  for (const p of posibles) {
    try {
      await pedir(p, ['prueba']);
      const { data: cfg } = await supabase.from('de_config').select('umbrales').eq('id', 1).maybeSingle();
      await supabase.from('de_config')
        .update({ umbrales: { ...(cfg?.umbrales || {}), embeddings_proveedor: p } })
        .eq('id', 1);
      return p;
    } catch { /* se prueba el siguiente */ }
  }
  throw new Error('Ninguna llave de embeddings funciona: revisa que el proyecto tenga acceso al modelo.');
}

async function pedir(p: Proveedor, textos: string[]): Promise<number[][]> {
  const { modelo, llave } = MODELOS[p];
  const key = env(llave);

  if (p === 'openai') {
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, input: textos }),
    });
    if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j: any = await r.json();
    // El orden no se da por hecho: la API manda `index` justo para esto.
    return [...(j.data || [])].sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
  }

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:batchEmbedContents?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: textos.map(t => ({
        model: `models/${modelo}`, content: { parts: [{ text: t }] }, outputDimensionality: 1536,
      })),
    }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j: any = await r.json();
  // Gemini solo devuelve el vector normalizado en su tamaño nativo (3072). Al
  // pedir 1536 hay que normalizar aquí, o la distancia coseno sale torcida.
  return (j.embeddings || []).map((e: any) => normalizar(e.values || []));
}

function normalizar(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n > 0 ? v.map(x => x / n) : v;
}

export type Lote = { vectores: number[][]; proveedor: Proveedor; costo_usd: number };

/** Hasta 100 textos por llamada: más que eso y una sola respuesta lenta bloquea
 *  al worker entero. */
export async function embeber(textos: string[]): Promise<Lote> {
  const p = await proveedorVigente();
  if (!textos.length) return { vectores: [], proveedor: p, costo_usd: 0 };

  const vectores: number[][] = [];
  let caracteres = 0;
  for (let i = 0; i < textos.length; i += 100) {
    const trozo = textos.slice(i, i + 100).map(t => t.slice(0, 2000) || ' ');
    vectores.push(...await pedir(p, trozo));
    caracteres += trozo.reduce((s, t) => s + t.length, 0);
  }
  // ~4 caracteres por token: el costo aquí son centavos, pero un centavo sin
  // registrar es un centavo que no aparece en el gasto del mes.
  const tokens = caracteres / 4;
  return { vectores, proveedor: p, costo_usd: (tokens / 1_000_000) * MODELOS[p].usd_por_millon };
}

export const unEmbedding = async (texto: string): Promise<number[]> => (await embeber([texto])).vectores[0];

/** Formato que Postgres entiende para `vector`. */
export const aVector = (v: number[]) => `[${v.join(',')}]`;
