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
  // Misma razón: compite con /herramientas/curva-de-tallas por «curva de
  // tallas», que es justo la búsqueda que queremos ganar. La herramienta es la
  // canónica; esta landing se llega por el correo del día 3.
  '/campana/curva-de-tallas',
  // Pantallas de la APLICACIÓN, no páginas de contenido. Sin `?user_id=` son
  // once palabras: ofrecérselas a un buscador es ofrecerle una página vacía.
  // Las levantó el motor como «contenido delgado», pero el arreglo no era
  // escribir más — era que nunca debieron estar en el índice.
  '/app/',
  // Acuse post-registro («tu cuenta ha sido creada»). Indexarla significa que
  // un buscador puede mandar ahí a alguien que no se registró.
  '/bienvenida',
  // Formulario, misma familia que /prueba-gratis.
  '/registro',
  // Biblioteca de referencia de componentes para desarrollo, no una página de
  // contenido. Sin enlaces entrantes y el propio body dice "no es una página
  // pública" — no debe rankear ni aparecer en el sitemap.
  /* Las 23 rutas retiradas (giros que no son moda, /manifiesto, las formas
     viejas de escribir «entrar»). Son páginas de redirección 301, no contenido:
     no deben anunciarse en el sitemap ni indexarse. Se detectan por el
     comentario «Página de redirección, no de contenido» en su archivo. */
  '/acceso',
  '/giros/belleza-y-cosmetica',
  '/giros/bicicletas',
  '/giros/comestibles',
  '/giros/electronica',
  '/giros/farmacias',
  '/giros/ferreterias',
  '/giros/florerias',
  '/giros/franquicias',
  '/giros/fundas-celulares',
  '/giros/jugueterias',
  '/giros/mascotas',
  '/giros/minisupers',
  '/giros/novedades',
  '/giros/parques-y-atracciones',
  '/giros/retail-entretenimiento',
  '/giros/supermercado',
  '/giros/vinos-y-licores',
  '/iniciar-sesion',
  '/login',
  '/manifiesto',
  '/marcas',
  '/soluciones/marca',
  '/componentes',
  // Programa Padrino: cero enlaces internos en todo el repo y sin intención
  // de búsqueda propia (no es un giro ni una función, es material de
  // campaña para compartir por partners). Una página sin enlaces y sin
  // búsqueda detrás no debe vivir en el índice; si se decide más adelante
  // ganarle tráfico orgánico, quítese de aquí Y dele un enlace real primero
  // (Footer o /partners) — nunca solo lo segundo.
  '/buddy',
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
  // Antes esto era `url.includes(p)`: un match de SUBCADENA. Eso hacía que
  // '/bienvenida' (pensada para bloquear solo el acuse post-registro,
  // https://www.sacscloud.com/bienvenida) también capturara
  // https://www.sacscloud.com/blog/bienvenida/ — que la CONTIENE como
  // subcadena — y la dejaba fuera del sitemap sin que nadie lo decidiera.
  //
  // Ahora se compara por RUTA, no por texto suelto:
  // - Los patrones que terminan en '/' (p.ej. '/admin/', '/email/') siguen
  //   siendo "carpeta": bloquean esa ruta y todo lo que cuelgue de ella.
  // - Los que NO terminan en '/' (p.ej. '/bienvenida', '/registro') son una
  //   página exacta: solo bloquean esa ruta (con o sin '/' final), nunca una
  //   ruta más larga que la contenga como subcadena.
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  return !NO_INDEXABLES.some(p => {
    if (typeof p !== 'string') return p.test(url);
    if (p.endsWith('/')) return pathname === p || pathname.startsWith(p);
    return pathname === p || pathname === `${p}/`;
  });
}
