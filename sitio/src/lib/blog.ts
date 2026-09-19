import { getCollection } from 'astro:content';

/**
 * Los artículos que sí salen al público.
 *
 * Existe porque el 19-sep-2026 descubrimos que `draft: true` no hacía
 * absolutamente nada: ninguna de las tres rutas del blog filtraba, así que un
 * borrador quedaba en producción con URL viva y entraba al sitemap. Eso vacía
 * la única garantía de la rutina semanal de contenido —«la máquina escribe,
 * una persona publica»— que es justo lo que nos separa del patrón que Google
 * llama abuso de contenido a escala.
 *
 * Toda ruta nueva que liste o genere artículos usa ESTA función, no
 * `getCollection('blog')` a pelo.
 */
export async function postsPublicados() {
    return (await getCollection('blog')).filter((p) => !p.data.draft);
}
