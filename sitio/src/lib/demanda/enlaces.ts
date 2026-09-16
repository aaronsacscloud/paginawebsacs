// DEMAND ENGINE · el enlazado interno.
//
// Es la primera acción que el motor puede ejecutar de punta a punta SIN pedirle
// nada a un modelo: el grafo de enlaces ya existe, los problemas ya están
// agrupados, y decidir a qué enlazar es comparar dos vectores.
//
// Por qué importa para el objetivo: una página que nadie enlaza le dice al
// buscador que ni nosotros la consideramos importante. Y para una IA, los
// enlaces internos son el mapa que le dice qué apartado responde qué — una
// página suelta se lee como un callejón sin salida.
import { supabase } from '../supabase';
import { unEmbedding, aVector, hayEmbeddings } from './embeddings';
import { registrar } from './handlers';
import { SITIO } from '../../data/entidad';
import type { Bloque } from './bloques';
import type { ResultadoHandler } from './tipos';

export type Sugerencia = {
  desde: string; hacia: string; anchor: string; parecido: number; motivo: string;
};

/** Anchors variados a partir del título. Un mismo texto exacto repetido en
 *  veinte páginas se lee como manipulación, no como ayuda. */
function anchorsDe(titulo: string, problema?: string | null): string[] {
  const t = String(titulo || '').replace(/\s*[|·—-]\s*Sacs.*$/i, '').trim();
  const variantes = [t];
  if (problema && problema.length > 10 && problema.toLowerCase() !== t.toLowerCase()) variantes.push(problema);
  const sinPregunta = t.replace(/^(qué es|cómo|cuál es|por qué)\s+/i, '').trim();
  if (sinPregunta && sinPregunta !== t) variantes.push(sinPregunta);
  return [...new Set(variantes.filter(v => v.length >= 8 && v.length <= 80))];
}

/**
 * ¿Desde dónde debería enlazarse esta página?
 *
 * Se busca por PARECIDO SEMÁNTICO contra los problemas que ya tiene asignados
 * cada página del sitio, no por coincidencia de palabras. Enlazar por palabra
 * suelta produce lo de siempre: «inventario» apuntando desde una página de
 * facturación porque la palabra aparecía.
 */
export async function sugerirEnlacesHacia(url: string, max = 5): Promise<Sugerencia[]> {
  const { data: destino } = await supabase.from('de_paginas')
    .select('url, titulo, cluster_id').eq('url', url).maybeSingle();
  if (!destino) return [];

  // El vector del destino: su problema si lo tiene, si no su título.
  let vector: string | null = null;
  let problema: string | null = null;
  if (destino.cluster_id) {
    const { data: cl } = await supabase.from('de_clusters')
      .select('problema_canonico, embedding').eq('id', destino.cluster_id).maybeSingle();
    if (cl?.embedding) { vector = cl.embedding as any; problema = cl.problema_canonico; }
  }
  if (!vector && hayEmbeddings() && destino.titulo) vector = aVector(await unEmbedding(destino.titulo));
  if (!vector) return [];

  const { data: cercanas, error } = await supabase.rpc('de_paginas_cercanas', { v: vector, excluir: url, lim: max * 3 });
  if (error) throw new Error(`no se pudieron buscar páginas cercanas: ${error.message}`);

  // Las que YA enlazan no se vuelven a sugerir.
  const { data: yaEnlazan } = await supabase.from('de_enlaces').select('desde').eq('hacia', url);
  const tienen = new Set((yaEnlazan || []).map(e => e.desde));

  const anchors = anchorsDe(destino.titulo || '', problema);
  return (cercanas || [])
    .filter((c: any) => !tienen.has(c.url))
    .slice(0, max)
    .map((c: any, i: number) => ({
      desde: c.url, hacia: url,
      anchor: anchors[i % anchors.length] || destino.titulo || '',
      parecido: Math.round(Number(c.similitud) * 100) / 100,
      motivo: `Habla de «${c.problema || c.titulo}», que es lo mismo que responde esta página`,
    }));
}

/** Enlaces relacionados AL PIE de una pieza del motor: son los únicos que el
 *  motor puede poner solo, porque el contenido dinámico es suyo. Tocar una
 *  página escrita a mano es trabajo de repositorio y pasa por el operador. */
export async function enlazarDesdeContenido(contenidoId: string, max = 4): Promise<number> {
  const { data: c } = await supabase.from('de_contenido')
    .select('id, cluster_id, cuerpo, seccion, slug').eq('id', contenidoId).maybeSingle();
  if (!c?.cluster_id) return 0;

  const { data: cl } = await supabase.from('de_clusters').select('embedding').eq('id', c.cluster_id).maybeSingle();
  if (!cl?.embedding) return 0;

  const propia = `${SITIO}/${c.seccion}/${c.slug}/`;
  const { data: cercanas } = await supabase.rpc('de_paginas_cercanas', { v: cl.embedding, excluir: propia, lim: max });
  const utiles = (cercanas || []).filter((x: any) => x.titulo);
  if (!utiles.length) return 0;

  const cuerpo = (c.cuerpo || []) as Bloque[];
  const sinRelacionados = cuerpo.filter(b => !(b.t === 'h2' && b.texto === 'Relacionado'));
  const bloques: Bloque[] = [
    ...sinRelacionados,
    { t: 'h2', texto: 'Relacionado' },
    { t: 'lista', items: utiles.map((x: any) => `[${x.titulo.replace(/\s*[|·—-]\s*Sacs.*$/i, '').trim()}](${x.url.replace(SITIO, '')})`) },
  ];
  await supabase.from('de_contenido').update({ cuerpo: bloques, actualizado_at: new Date().toISOString() }).eq('id', contenidoId);
  return utiles.length;
}

registrar('enlaces.calcular', async (): Promise<ResultadoHandler> => {
  const { data: huerfanas } = await supabase.from('de_paginas')
    .select('url, titulo').eq('huerfana', true).neq('indexable', false).limit(20);

  const sugerencias: Sugerencia[] = [];
  for (const h of huerfanas || []) {
    try { sugerencias.push(...await sugerirEnlacesHacia(h.url, 3)); } catch { /* una página no tumba el barrido */ }
  }

  // Las sugerencias sobre páginas del repositorio son trabajo de OPERADOR: hay
  // que editar un archivo. Se encolan con todo lo necesario para hacerlo.
  const siguientes = sugerencias.length ? [{
    tipo: 'codigo.tecnico',
    clave_idem: `enlaces:huerfanas:${new Date().toISOString().slice(0, 10)}`,
    prioridad: 55,
    payload: {
      que: 'Enlazar las páginas huérfanas desde donde tenga sentido',
      criterio: 'Cada página listada debe recibir al menos un enlace desde una página relacionada, con anchor variado.',
      sugerencias: sugerencias.slice(0, 30),
    },
  }] : [];

  return {
    ok: true,
    resumen: sugerencias.length
      ? `${sugerencias.length} enlaces sugeridos para ${huerfanas?.length || 0} páginas huérfanas`
      : 'no hay huérfanas indexables que enlazar',
    datos: { huerfanas: huerfanas?.length || 0, sugerencias: sugerencias.length },
    siguientes,
  };
});
