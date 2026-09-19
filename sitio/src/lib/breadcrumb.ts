// LA MIGA DE PAN — un solo lugar donde se arma el `BreadcrumbList` de
// schema.org para todo el sitio.
//
// Antes solo existía en `BlogLayout.astro`: cero en /producto, /giros (23
// páginas), /soluciones y /casos-de-exito. Cada función de aquí lee el
// nombre real desde `src/data/navigation.ts` — la fuente única de la
// jerarquía del sitio (mega-menú, footer) — en vez de escribirlo a mano en
// cada página y arriesgar que se desincronice cuando el nav cambie.
//
// Regla de schema.org que se respeta en todas: el ÚLTIMO elemento (la
// página actual) nunca lleva `item` — no es un link, es donde ya estás.
import { SITIO } from '../data/entidad';
import { businessSectors, modelosNegocio, navLinks } from '../data/navigation';

export interface Crumb {
  name: string;
  /** Si se omite, el ítem se emite sin `item` — así debe ir el último. */
  url?: string;
}

export function breadcrumbList(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: it.url } : {}),
    })),
  };
}

const INICIO: Crumb = { name: 'Inicio', url: `${SITIO}/` };

/** /giros/[slug] — el nombre del giro sale de `businessSectors`. */
export function breadcrumbGiro(href: string) {
  const giro = businessSectors.find((s) => s.href === href);
  const nombre = giro?.label ?? href.split('/').pop() ?? '';
  return breadcrumbList([
    INICIO,
    { name: 'Giros de negocio', url: `${SITIO}/giros` },
    { name: nombre },
  ]);
}

/** /soluciones/[slug] — no hay página "Soluciones" intermedia en el nav
 *  (cada escenario cuelga directo de Inicio), así que la miga es de 2 niveles.
 *  El nombre sale de `modelosNegocio`, el mismo arreglo del selector del home. */
export function breadcrumbSolucion(href: string) {
  const modelo = modelosNegocio.find((m) => m.href === href);
  return breadcrumbList([
    INICIO,
    { name: modelo?.label ?? href.split('/').pop() ?? '' },
  ]);
}

/** /producto/[slug] — Inicio > Producto > <pilar: Vende/Controla/...> > <función>,
 *  leído del mismo mega-menú "Plataforma" que ve una persona en el nav. */
export function breadcrumbProducto(slug: string) {
  const plataforma = navLinks.find((n) => n.label === 'Plataforma');
  for (const pilar of plataforma?.pillars ?? []) {
    const item = pilar.items.find((it) => it.href === `/producto/${slug}`);
    if (item) {
      return breadcrumbList([
        INICIO,
        { name: 'Producto', url: `${SITIO}/producto` },
        { name: pilar.verb, url: `${SITIO}${pilar.href}` },
        { name: item.label },
      ]);
    }
  }
  // No debería pasar (los 28 slugs de product.ts están todos en el mega-menú),
  // pero una miga de 2 niveles es mejor que ninguna si algún día se desincroniza.
  return breadcrumbList([INICIO, { name: 'Producto', url: `${SITIO}/producto` }, { name: slug }]);
}

/** /casos-de-exito y /casos-de-exito/[slug] */
export function breadcrumbCaso(nombre?: string) {
  const items: Crumb[] = [INICIO];
  if (nombre) {
    items.push({ name: 'Casos de éxito', url: `${SITIO}/casos-de-exito` }, { name: nombre });
  } else {
    items.push({ name: 'Casos de éxito' });
  }
  return breadcrumbList(items);
}
