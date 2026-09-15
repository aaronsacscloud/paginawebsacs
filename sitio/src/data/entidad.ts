// LA ENTIDAD «SACS» — una sola verdad sobre quiénes somos, para las máquinas.
//
// Por qué existe este archivo: el objetivo no es solo rankear, es que una IA
// pueda RECONOCER a Sacs como una entidad y citarla. Para eso, lo que decimos
// de nosotros tiene que ser idéntico en todas partes y tiene que apuntar a algo
// que exista.
//
// Estaba roto: el schema `Organization` que viaja en TODAS las páginas del
// sitio declaraba `url: https://sacs.com.mx` y `logo: https://sacs.com.mx/
// logo.png`. Ese dominio NO responde (medido: sin conexión), y el logo era un
// 404. O sea que cada página le decía a Google y a cada rastreador de IA que
// Sacs vive en una dirección muerta. Difícil ser el referente de una categoría
// cuando la ficha de identidad apunta a la nada.
//
// Lo encontró el motor de demanda al auditar el sitio (15-sep-2026).
import { PLANES } from '../lib/crm/ti/conocimiento/planes';

export const SITIO = 'https://www.sacscloud.com';

/** El identificador estable de la entidad. Que sea una URL con `#` y no la
 *  portada a secas permite que otras piezas (producto, artículos, autores) se
 *  cuelguen de ella sin ambigüedad. */
export const ENTIDAD_ID = `${SITIO}/#organizacion`;
export const PRODUCTO_ID = `${SITIO}/#software`;

export const NOMBRE = 'Sacs';
export const DESCRIPCION = 'El sistema para marcas y tiendas de moda en México: inventario por talla y color, punto de venta, tienda en línea, mayoreo y WhatsApp sobre una sola base.';

/** Perfiles verificables en otros sitios. Va VACÍO a propósito mientras no haya
 *  perfiles confirmados: inventar un `sameAs` que no existe es peor que no
 *  tenerlo — un enlace roto en la ficha de identidad resta credibilidad justo
 *  donde se está pidiendo credibilidad. */
export const PERFILES: string[] = [];

export function organizacion() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ENTIDAD_ID,
    name: NOMBRE,
    alternateName: 'Sacs Cloud',
    url: SITIO,
    logo: `${SITIO}/og-default.png`,
    description: DESCRIPCION,
    areaServed: { '@type': 'Country', name: 'MX' },
    knowsAbout: [
      'retail de moda', 'inventario por talla y color', 'curva de tallas',
      'punto de venta para tiendas de ropa', 'mayoreo de ropa', 'consignación',
      'nivelación de inventario entre sucursales', 'sell-through', 'zapaterías', 'joyerías',
    ],
    ...(PERFILES.length ? { sameAs: PERFILES } : {}),
  };
}

export function sitioWeb() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITIO}/#sitio`,
    name: NOMBRE,
    url: SITIO,
    description: DESCRIPCION,
    publisher: { '@id': ENTIDAD_ID },
    inLanguage: 'es-MX',
  };
}

/**
 * Qué ES Sacs, en el vocabulario que una IA usa para responder «¿qué software
 * me recomiendas para una cadena de tiendas de ropa?».
 *
 * El precio sale de la misma ficha que usa el agente comercial: si algún día
 * cambia, cambia en un solo lugar y no queda un precio viejo enterrado en un
 * bloque de datos estructurados que nadie vuelve a mirar.
 */
export function software() {
  const desde = Math.min(...PLANES.map(p => p.anualMes));
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': PRODUCTO_ID,
    name: NOMBRE,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Retail Management Software',
    operatingSystem: 'Web',
    url: SITIO,
    description: DESCRIPCION,
    publisher: { '@id': ENTIDAD_ID },
    inLanguage: 'es-MX',
    audience: {
      '@type': 'BusinessAudience',
      audienceType: 'Tiendas de ropa, boutiques, zapaterías, joyerías, marcas de moda, mayoristas y cadenas de retail de moda',
    },
    featureList: [
      'Inventario por talla y color', 'Punto de venta', 'Tienda en línea',
      'Mayoreo y B2B', 'Traspasos y nivelación entre sucursales', 'Compras y proveedores',
      'Clientes y lealtad', 'Comisiones', 'Reportes y rentabilidad', 'WhatsApp', 'TikTok Shop',
    ],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'MXN',
      price: desde,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: desde,
        priceCurrency: 'MXN',
        unitText: 'por sucursal al mes, en plan anual',
      },
      availability: 'https://schema.org/InStock',
      url: `${SITIO}/planes`,
    },
  };
}

/** Lo que va en TODAS las páginas. */
export const SCHEMA_BASE = () => [organizacion(), software()];
