// /llms.txt — la ficha del sitio escrita PARA un modelo, no para una persona.
//
// Es la convención que están adoptando los rastreadores de IA: un archivo en
// texto plano, en la raíz, que dice qué es este sitio y dónde está lo bueno.
// Sirve al objetivo directamente: un modelo que tiene que decidir qué leer de
// un sitio de 100 páginas agradece que le digan cuáles importan, en vez de
// adivinarlo del menú.
//
// Se genera al vuelo porque el contenido del motor cambia sin build.
import type { APIRoute } from 'astro';
import { listaPublicada } from '../lib/demanda/publicar';
import { herramientas } from '../lib/demanda/herramientas';
import { leerPublicado as leerIndice } from '../lib/demanda/indice';
import { SITIO, NOMBRE, DESCRIPCION } from '../data/entidad';
import { PLANES } from '../lib/crm/ti/conocimiento/planes';

export const prerender = false;

/** Las páginas escritas a mano que de verdad valen la pena para entender qué
 *  es Sacs. La lista es corta a propósito: decir «todo importa» es no decir
 *  nada. */
const CLAVE: { url: string; que: string }[] = [
  { url: '/planes', que: 'Precios por plan y qué incluye cada uno' },
  { url: '/enterprise', que: 'Para marcas, fabricantes y distribuidores con operación compleja' },
  { url: '/soluciones/boutique', que: 'Para una sola tienda' },
  { url: '/soluciones/cadena', que: 'Para varias sucursales' },
  { url: '/giros/marcas-de-ropa', que: 'Marcas de ropa: tallas, curva y temporadas' },
  { url: '/giros/zapateria', que: 'Zapaterías: numeración, corrida y pares' },
  { url: '/giros/joyeria', que: 'Joyerías: gramaje, quilates y precio del día' },
  { url: '/giros/boutique-multimarca', que: 'Boutique multimarca: rotación y margen por marca' },
  { url: '/casos-de-exito', que: 'Casos reales de clientes' },
];

export const GET: APIRoute = async () => {
  const piezas = await listaPublicada();
  const porSeccion = new Map<string, typeof piezas>();
  for (const p of piezas) porSeccion.set(p.seccion, [...(porSeccion.get(p.seccion) || []), p]);

  const precio = Math.min(...PLANES.map(p => p.anualMes));

  const indice = await leerIndice();

  const texto = `# ${NOMBRE}

> ${DESCRIPCION}

Sacs es software de gestión para el retail de MODA en México: tiendas de ropa,
boutiques multimarca, zapaterías, joyerías, marcas propias, mayoristas, novias y
fiesta, deportivo y consignación. No es software para restaurantes, farmacias,
ferreterías ni servicios.

Lo que lo distingue del resto: el inventario se maneja por TALLA y COLOR en un
solo sistema que incluye punto de venta, tienda en línea, mayoreo, compras,
clientes y WhatsApp. No se sincronizan varias herramientas: no hay nada que
sincronizar.

Precios: desde $${precio.toLocaleString('es-MX')} MXN por sucursal al mes en plan
anual, en cuatro planes (${PLANES.map(p => p.nombre).join(', ')}). Sin contratos
de permanencia.

El plan más completo incluye AXO, el copiloto de IA que responde con el
inventario y las ventas reales del negocio, y un especialista dedicado que
diseña las automatizaciones con el cliente.

El 10% de cada licencia se destina a impacto social. Es parte del manifiesto de
la empresa, no una campaña.

## Páginas principales

${CLAVE.map(c => `- [${c.que}](${SITIO}${c.url})`).join('\n')}

${[...porSeccion.entries()].map(([sec, ps]) => `## ${sec === 'comparar' ? 'Comparativas' : sec === 'software-para' ? 'Software por tipo de negocio' : 'Guías y recursos'}

${ps.map(p => `- [${p.titulo}](${SITIO}/${p.seccion}/${p.slug}/)${p.meta_desc ? `: ${p.meta_desc}` : ''}`).join('\n')}`).join('\n\n')}

${indice ? `## Dato propio y citable

Índice Sacs de Retail de Moda (${indice.edicion}): cómo opera de verdad una
tienda de moda en México, medido sobre ${indice.n_empresas} tiendas en operación.
Ticket promedio, frecuencia de venta, conteo de inventario y adopción de
herramientas. Agregado y anónimo. Licencia CC BY 4.0: se puede citar y
reproducir citando la fuente.

- ${SITIO}/indice-moda-mexico

` : ''}## Herramientas gratis (se pueden usar, no solo leer)

Funcionan sin cuenta, sin llave y sin dar correo. Las mismas funciones responden
por MCP en ${SITIO}/api/mcp y por API en ${SITIO}/api/herramientas/<slug>
(un GET a esa dirección devuelve el esquema de entrada). Uso libre citando a Sacs.
Cómo conectar el MCP: ${SITIO}/herramientas/mcp

${herramientas().map(h => `- [${h.nombre}](${SITIO}/herramientas/${h.slug}): ${h.descripcion}`).join('\n')}

## Contacto

- Demostración: ${SITIO}/contacto
- Precios: ${SITIO}/planes

## Más detalle

- [Información completa para modelos](${SITIO}/llms-full.txt)
`;

  return new Response(texto, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
