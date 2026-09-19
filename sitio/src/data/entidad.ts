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
import { businessSectors } from './navigation';
import { WHATSAPP_NUMBER, WHATSAPP_LEGIBLE } from '../lib/whatsapp';

export const SITIO = 'https://www.sacscloud.com';

/** El identificador estable de la entidad. Que sea una URL con `#` y no la
 *  portada a secas permite que otras piezas (producto, artículos, autores) se
 *  cuelguen de ella sin ambigüedad. */
export const ENTIDAD_ID = `${SITIO}/#organizacion`;
export const PRODUCTO_ID = `${SITIO}/#software`;

export const NOMBRE = 'Sacs';
export const DESCRIPCION = 'El sistema para marcas y tiendas de moda en México: inventario por talla y color, punto de venta, tienda en línea, mayoreo y WhatsApp sobre una sola base.';

/** Datos legales y de contacto, confirmados por el dueño (19-sep-2026). Antes
 *  este archivo declaraba a propósito que NO existían — mejor nada que
 *  inventado. Ya existen: se agregan aquí, una sola vez, para que
 *  `/nosotros` y el schema `Organization` los lean de la misma fuente. */
export const RAZON_SOCIAL = 'DESARROLLOS TECNOLOGICOS CON AMOR E IMPACTO POSITIVO';
export const RFC = 'DTA240507AX3';
export const FUNDACION = '2014';
export const EMAIL = 'hola@sacscloud.com';
export const DOMICILIO = {
  calle: 'Senda de Inspiración 19A',
  colonia: 'Milenio III',
  ciudad: 'Santiago de Querétaro',
  estado: 'Querétaro',
  cp: '76060',
};

/** El fundador, como entidad propia (Person) para que `Organization.founder`
 *  y la ficha de `/nosotros` apunten al mismo `@id` en vez de declararlo dos
 *  veces con el riesgo de que se desincronice. */
export const AARON_ID = `${SITIO}/#aaron-herzberg`;

export function fundador() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': AARON_ID,
    name: 'Aaron Herzberg',
    jobTitle: 'Director general y fundador',
    sameAs: ['https://www.linkedin.com/in/aaronherzberg/'],
  };
}

/** Perfiles verificables en otros sitios. Solo entra aquí lo confirmado a mano:
 *  inventar un `sameAs` que no existe (o que nadie revisó que siga activo) es
 *  peor que no tenerlo — un enlace roto en la ficha de identidad resta
 *  credibilidad justo donde se está pidiendo credibilidad. */
export const PERFILES: string[] = [
  // Verificado en vivo (auditoría 15-sep-2026): página de empresa activa,
  // 1,283 seguidores, "Sacscloud.com", Cancún, fundada 2010. Ya referenciada
  // en la plantilla de correo (src/pages/api/email-templates/seed.ts:434).
  'https://www.linkedin.com/company/sacscloud',
  // Instagram, Facebook, TikTok y YouTube (@sacscloud) existen, pero no se
  // agregan aquí todavía: un fetch anónimo no confirma que la cuenta está
  // activa ni que el handle es el correcto, y el propio dueño tiene que
  // abrirlos a mano y confirmarlo primero — el mismo riesgo que ya evitó
  // este archivo con el dominio muerto sacs.com.mx.
];

export function organizacion() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ENTIDAD_ID,
    name: NOMBRE,
    /* «Sacs» es como se habla y como se ve; «Sacscloud» es el nombre que no se
       confunde con nada —y es el que la gente teclea cuando ya nos conoce—.
       Declarar los dos es lo que permite que un modelo entienda que son la
       misma entidad en vez de tratarlos como dos cosas distintas. */
    alternateName: ['Sacscloud', 'Sacs Cloud', 'SACS'],
    url: SITIO,
    logo: `${SITIO}/og-default.png`,
    description: DESCRIPCION,
    areaServed: { '@type': 'Country', name: 'MX' },
    knowsAbout: [
      'retail de moda', 'inventario por talla y color', 'curva de tallas',
      'punto de venta para tiendas de ropa', 'mayoreo de ropa', 'consignación',
      'nivelación de inventario entre sucursales', 'sell-through', 'zapaterías', 'joyerías',
    ],
    /* El WhatsApp de ventas sale de la fuente única (src/lib/whatsapp.ts):
       si el número cambia, cambia en un solo lugar y este schema no se queda
       con uno viejo. */
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: WHATSAPP_LEGIBLE,
      url: `https://wa.me/${WHATSAPP_NUMBER}`,
      areaServed: { '@type': 'Country', name: 'MX' },
      availableLanguage: ['Spanish'],
    },
    legalName: RAZON_SOCIAL,
    taxID: RFC,
    foundingDate: FUNDACION,
    telephone: WHATSAPP_LEGIBLE,
    email: EMAIL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${DOMICILIO.calle}, Col. ${DOMICILIO.colonia}`,
      addressLocality: DOMICILIO.ciudad,
      addressRegion: DOMICILIO.estado,
      postalCode: DOMICILIO.cp,
      addressCountry: 'MX',
    },
    founder: fundador(),
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

/**
 * El `Service` de una página de giro (/giros/[slug]).
 *
 * A propósito NO es otro `SoftwareApplication` genérico repetido 23 veces:
 * eso le pelearía la identidad a la entidad principal (`PRODUCTO_ID`, el
 * único software que existe). Cada giro es una FORMA de dar el mismo
 * software, no un producto distinto — de ahí `Service` con `provider`
 * apuntando siempre a la misma Organization.
 */
export function servicioGiro(href: string) {
  const giro = businessSectors.find((s) => s.href === href);
  const nombre = giro?.label ?? href.split('/').pop() ?? '';
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${SITIO}${href}#servicio`,
    serviceType: `Software para ${nombre.toLowerCase()}`,
    provider: { '@id': ENTIDAD_ID },
    areaServed: { '@type': 'Country', name: 'MX' },
    audience: { '@type': 'BusinessAudience', audienceType: nombre },
    url: `${SITIO}${href}`,
  };
}

/** Lo que va en TODAS las páginas. */
export const SCHEMA_BASE = () => [organizacion(), software()];
