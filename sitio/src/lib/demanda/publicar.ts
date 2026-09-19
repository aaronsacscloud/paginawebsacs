// DEMAND ENGINE · leer y publicar contenido.
import { supabase } from '../supabase';
import { frenoDeSalida } from './salida';
import { aHtml, palabras, schemaDeCuerpo, indice, aTexto, type Bloque } from './bloques';
import { SITIO, ENTIDAD_ID } from '../../data/entidad';

export const SECCIONES = ['recursos', 'comparar', 'software-para'] as const;
export type Seccion = typeof SECCIONES[number];

export type Publicado = {
  id: string; titulo: string; h1: string; meta_desc: string | null;
  seccion: string; slug: string; tipo: string;
  html: string; indice: { texto: string; ancla: string }[];
  schema: Record<string, any>[]; publicado_at: string | null; actualizado_at: string;
  palabras: number; brief: any;
};

/** Lo que la ruta necesita para pintar la página, ya listo. */
export async function leerPublicado(seccion: string, slug: string): Promise<Publicado | null> {
  const { data } = await supabase
    .from('de_contenido')
    .select('id, titulo, h1, meta_desc, seccion, slug, tipo, cuerpo, brief, publicado_at, actualizado_at, cluster_id')
    .eq('seccion', seccion).eq('slug', slug).eq('estado', 'publicado')
    .maybeSingle();
  if (!data) return null;

  const cuerpo = (data.cuerpo || []) as Bloque[];
  const url = `${SITIO}/${seccion}/${slug}/`;

  return {
    id: data.id,
    titulo: data.titulo,
    h1: data.h1 || data.titulo,
    meta_desc: data.meta_desc,
    seccion: data.seccion, slug: data.slug, tipo: data.tipo,
    html: aHtml(cuerpo),
    indice: indice(cuerpo),
    palabras: palabras(cuerpo),
    brief: data.brief,
    publicado_at: data.publicado_at,
    actualizado_at: data.actualizado_at,
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': data.tipo === 'comparativa' ? 'Article' : 'Article',
        '@id': `${url}#articulo`,
        headline: data.titulo,
        description: data.meta_desc || aTexto(cuerpo).slice(0, 200),
        inLanguage: 'es-MX',
        mainEntityOfPage: url,
        // El autor es la organización, no una persona inventada. Un `Person`
        // con nombre falso es justo el tipo de detalle que quita credibilidad
        // cuando alguien va a verificar quién escribió esto.
        author: { '@id': ENTIDAD_ID },
        publisher: { '@id': ENTIDAD_ID },
        datePublished: data.publicado_at,
        dateModified: data.actualizado_at,
      },
      ...schemaDeCuerpo(cuerpo),
    ],
  };
}

/** Todo lo publicado, para el sitemap y para llms.txt. */
export async function listaPublicada(): Promise<{ seccion: string; slug: string; titulo: string; meta_desc: string | null; actualizado_at: string }[]> {
  const { data } = await supabase
    .from('de_contenido')
    .select('seccion, slug, titulo, meta_desc, actualizado_at')
    .eq('estado', 'publicado')
    .order('actualizado_at', { ascending: false });
  return data || [];
}

/**
 * Publica (o republica) una pieza.
 *
 * Guarda la versión ANTERIOR antes de tocar nada: revertir tiene que ser un
 * update, no una arqueología. Y sincroniza el inventario de páginas, porque el
 * enlazado interno y la canibalización no distinguen quién escribió qué.
 */
export async function publicar(id: string, motivo = 'publicación'): Promise<{ url: string; version: number; simulado?: string }> {
  const { data: c, error } = await supabase.from('de_contenido').select('*').eq('id', id).maybeSingle();
  if (error || !c) throw new Error('no existe ese contenido');
  if (!['aprobado', 'publicado', 'refrescar'].includes(c.estado))
    throw new Error(`no se puede publicar en estado «${c.estado}»: primero tiene que pasar las auditorías`);

  /* El freno va ANTES de tocar nada —ni la versión, ni el estado—. Si se
     comprobara al final, la simulación ya habría escrito la mitad. */
  const freno = await frenoDeSalida(`publicado ${c.seccion}/${c.slug}`);
  if (freno) return { url: `${SITIO}/${c.seccion}/${c.slug}/`, version: c.version, simulado: freno.motivo };

  if (c.estado === 'publicado') {
    const { error: eVer } = await supabase.from('de_contenido_versiones').insert({
      contenido_id: c.id, version: c.version, titulo: c.titulo,
      cuerpo: c.cuerpo, brief: c.brief, auditorias: c.auditorias,
      motivo, creada_por: 'motor',
    });
    // Se aborta ANTES de sobrescribir. Guardar la versión vieja es lo único que
    // hace reversible esta operación: si no quedó guardada y aun así
    // publicamos encima, el contenido anterior deja de existir y `revertir()`
    // —el botón de emergencia— se queda sin nada a lo que volver.
    if (eVer) throw new Error(`[publicar] no se pudo guardar la versión ${c.version} antes de sobrescribir: ${eVer.message}`);
  }

  const version = c.estado === 'publicado' ? c.version + 1 : c.version;
  const { error: ePub } = await supabase.from('de_contenido').update({
    estado: 'publicado', version,
    publicado_at: c.publicado_at || new Date().toISOString(),
    actualizado_at: new Date().toISOString(),
  }).eq('id', id);
  // Sin esto, la función devolvía la URL y la versión nueva aunque la base no
  // hubiera escrito nada: el motor anotaba «publicado», la bitácora decía
  // «publicado», y la página seguía como estaba.
  if (ePub) throw new Error(`[publicar] no se pudo publicar ${id}: ${ePub.message}`);

  /* Avisar a Bing EN EL MOMENTO, sin esperar al ciclo de mañana. Publicar una
     guía a las diez y que se pueda encontrar a las once, en vez de la semana
     que viene, es la diferencia entre el contenido y el contenido que sirve.
     Va con `void`: que el aviso falle no puede desandar una publicación que ya
     está hecha, y el ciclo diario lo reintenta de todos modos. */
  void import('./indexar')
    .then(m => m.avisarIndexNow([`${SITIO}/${c.seccion}/${c.slug}/`]))
    .then(r => { if (!r.ok) console.error(`[publicar] no se pudo avisar a Bing: ${r.detalle}`); })
    .catch(e => console.error(`[publicar] el aviso a Bing falló: ${e?.message}`));

  const { error: eSync } = await supabase.rpc('de_sincronizar_paginas_publicadas');
  // El espejo de páginas no bloquea la publicación (el contenido ya se sirve
  // desde `de_contenido`), pero si se queda viejo el rastreo reporta huérfanas
  // y enlaces rotos que no existen. Se avisa en vez de tragárselo.
  if (eSync) console.error(`[publicar] el espejo de páginas quedó viejo: ${eSync.message}`);

  return { url: `${SITIO}/${c.seccion}/${c.slug}/`, version };
}

/** Vuelve a la versión anterior. Nunca se bloquea por nivel de autonomía:
 *  deshacer un daño no puede necesitar permiso. */
export async function revertir(id: string): Promise<{ version: number }> {
  const { data: v } = await supabase.from('de_contenido_versiones')
    .select('*').eq('contenido_id', id).order('version', { ascending: false }).limit(1).maybeSingle();
  if (!v) throw new Error('no hay versión anterior a la que volver');

  /* Revertir NO se frena por simulación: deshacer un daño no es «afectar al
     mundo de afuera», es dejar de afectarlo. Pero sí respeta el apagador, que
     es una decisión distinta: con el motor apagado, quien decide qué se
     restaura es una persona.

     El apagador se comprueba a mano y no con `frenoDeSalida` justamente para
     poder hacer esta distinción. */
  const { leerConfig: leerCfg } = await import('./config');
  const cfgRev = await leerCfg();
  if (cfgRev.kill_switch) throw new Error('[revertir] El motor está apagado: la reversión la tiene que disparar una persona.');

  const { error } = await supabase.from('de_contenido').update({
    titulo: v.titulo, cuerpo: v.cuerpo, brief: v.brief, auditorias: v.auditorias,
    version: v.version, actualizado_at: new Date().toISOString(),
  }).eq('id', id);
  /* Este es el camino de emergencia: se llama cuando algo salió mal y hay que
     deshacerlo YA. Devolver la versión como si hubiera funcionado, sin haber
     escrito nada, es la peor forma de fallar que tiene este archivo: el
     contenido dañado se queda publicado y todo el mundo cree que ya se
     arregló. */
  if (error) throw new Error(`[revertir] NO se pudo volver a la versión ${v.version} de ${id}: ${error.message}`);

  const { error: eSync } = await supabase.rpc('de_sincronizar_paginas_publicadas');
  if (eSync) console.error(`[revertir] el espejo de páginas quedó viejo: ${eSync.message}`);
  return { version: v.version };
}

export async function retirar(id: string, motivo: string): Promise<void> {
  // Retirar sí pasa por el freno: quitar una página del sitio es un cambio
  // visible para cualquiera, y en simulación el dueño espera ver qué se
  // retiraría, no encontrarse la página fuera.
  const freno = await frenoDeSalida(`retirado el contenido ${id} (${motivo})`);
  if (freno) throw new Error(freno.motivo);

  const { error } = await supabase.from('de_contenido').update({
    estado: 'retirado', retirado_at: new Date().toISOString(), actualizado_at: new Date().toISOString(),
  }).eq('id', id);
  // Retirar se pide cuando una página está haciendo daño. Que falle en silencio
  // deja el daño publicado y a nadie buscándolo.
  if (error) throw new Error(`[retirar] NO se pudo retirar ${id}: ${error.message}`);

  const { error: eVer } = await supabase.from('de_contenido_versiones').insert({
    contenido_id: id, version: 0, motivo: `retirado: ${motivo}`, creada_por: 'motor',
  });
  // La bitácora sí puede fallar sin deshacer el retiro: lo importante ya pasó.
  if (eVer) console.error(`[retirar] ${id} se retiró pero no quedó en la bitácora: ${eVer.message}`);

  const { error: eSync } = await supabase.rpc('de_sincronizar_paginas_publicadas');
  if (eSync) console.error(`[retirar] el espejo de páginas quedó viejo: ${eSync.message}`);
}
