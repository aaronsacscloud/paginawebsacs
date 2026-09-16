// Las páginas que NO deben aparecer en el sitemap.
//
// El sitemap y la etiqueta `robots` son dos afirmaciones sobre la misma página:
// uno dice «mírame» y la otra «ignórame». Publicarlas las dos a la vez es
// contradecirse delante del buscador, y el sitemap pierde autoridad para las
// páginas que sí queremos que mire.
//
// Lo encontró el motor de demanda al rastrear el sitio (15-sep-2026): 9 páginas
// con `noindex` estaban listadas en el sitemap, y dos que responden 400 sin su
// token también.
//
// ⚠️ Esta lista se mantiene a mano, pero NO depende de que alguien se acuerde:
// si mañana se agrega una página con `noindex` y se olvida apuntarla aquí, el
// rastreo semanal vuelve a levantar el hallazgo `noindex_en_sitemap`. La lista
// es la corrección; el motor es el recordatorio.
export const NO_INDEXABLES: (string | RegExp)[] = [
  '/admin/',            // el CRM entero
  '/partner/',          // portal de partners: login, recuperación, tablero
  '/partners/brand-kit',
  // Página de formulario, 34 palabras: no rankearía por nada y sí parecería
  // contenido flaco. Se capta por campaña, no por buscador.
  '/prueba-gratis',
  // Landing de campaña que repite lo de /producto y /planes con menos: si se
  // indexa, compite contra ellas por la misma búsqueda.
  '/campana/punto-de-venta',
  // VACÍAS desde el andamiaje original: el archivo solo tiene el comentario
  // «el contenido irá aquí». Fuera del índice hasta que tengan texto propio;
  // una página en blanco indexada resta, no suma.
  '/nosotros',
  '/manifiesto',
  // Transaccionales: se llega por el enlace del correo y sin token dan 400.
  // Que un buscador intente indexar un 400 no ayuda a nadie.
  '/agendar/cancelar',
  '/agendar/reagendar',
  '/pagar/embed',
  '/email/',            // bajas y vistas de correo
  '/acuse/', '/minuta/', '/cotizacion/', '/propuesta/', '/reporte/', '/estado-cuenta/',
];

/** ¿Va esta URL en el sitemap? */
export function enSitemap(url: string): boolean {
  return !NO_INDEXABLES.some(p => (typeof p === 'string' ? url.includes(p) : p.test(url)));
}
