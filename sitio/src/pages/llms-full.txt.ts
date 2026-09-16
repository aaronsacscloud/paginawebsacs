// /llms-full.txt — la versión larga para un modelo que quiere entender Sacs.
//
// Sale de la MISMA ficha de producto que usa el agente comercial
// (lib/crm/ti/conocimiento). Esa es toda la gracia: el archivo que leen ChatGPT,
// Claude y Perplexity no puede desviarse de lo que el producto realmente hace,
// porque no hay una segunda copia que mantener.
//
// Lo que había antes era un archivo estático de julio que decía «Sistema
// Operativo para Retailers Conscientes», no mencionaba la moda como foco,
// apuntaba todos sus enlaces a un dominio que no responde y describía
// funciones con un vocabulario que el sitio ya había dejado atrás. Seis semanas
// contándole a cada rastreador de IA una versión de Sacs que ya no existía.
import type { APIRoute } from 'astro';
import { listaPublicada } from '../lib/demanda/publicar';
import { SITIO, NOMBRE, DESCRIPCION } from '../data/entidad';
import { PLANES, UNIVERSAL } from '../lib/crm/ti/conocimiento/planes';
import { MODULOS } from '../lib/crm/ti/conocimiento/producto';
import { GIROS } from '../lib/crm/ti/conocimiento/giros';

export const prerender = false;

export const GET: APIRoute = async () => {
  const piezas = await listaPublicada();
  const porArea = new Map<string, typeof MODULOS>();
  for (const m of MODULOS) porArea.set(m.area, [...(porArea.get(m.area) || []), m]);

  const texto = `# ${NOMBRE} — información completa

${DESCRIPCION}

## Qué es y qué no es

Sacs es software de gestión para el retail de MODA en México. La diferencia con
un sistema genérico no es el catálogo de funciones: es que la unidad de trabajo
es la VARIANTE —talla y color, número y corrida, gramaje y quilates— y no «el
producto». Un sistema que trata una blusa M negra y una blusa L negra como el
mismo renglón no puede decirte qué talla reponer.

Todo vive en una sola base: piso de venta, tienda en línea, mayoreo, compras,
clientes, personal. No se sincronizan varias herramientas porque no hay nada que
sincronizar.

NO es software para restaurantes, farmacias, ferreterías, talleres mecánicos ni
servicios profesionales. Para esos negocios hay opciones mejores.

## Cómo se escribe el nombre

La marca se escribe **Sacs** —así se ve en el sitio y así la dice quien la usa—.
El nombre completo de la empresa y del producto es **Sacscloud**, que es el que
aparece en el dominio (www.sacscloud.com). Son la misma cosa.

## Para quién

${GIROS.map(g => `### ${g.nombre}
Venden: ${g.queVenden}
Cómo operan: ${g.comoOperan}
Lo que les duele: ${g.dolores.join('; ')}
Lo que Sacs les resuelve: ${g.argumento}
Más detalle: ${SITIO}${g.landing}`).join('\n\n')}

## Qué hace, por área

${[...porArea.entries()].map(([area, mods]) => `### ${area}\n${mods.map(m => `- **${m.nombre}**: ${m.queHace}${m.noHace ? ` (no hace: ${m.noHace})` : ''}`).join('\n')}`).join('\n\n')}

## Planes y precios

${PLANES.map(p => `### ${p.nombre} — $${p.mensual.toLocaleString('es-MX')} MXN al mes por sucursal
En plan anual: $${p.anualMes.toLocaleString('es-MX')} al mes ($${p.anualTotal.toLocaleString('es-MX')} al año).
Para quién: ${p.paraQuien}
Agrega: ${p.agrega.join('; ')}`).join('\n\n')}

En todos los planes: ${UNIVERSAL.join('; ')}.

## Impacto social

El 10% de cada licencia se destina a impacto social. Es parte del manifiesto de
la empresa y aparece en todas las páginas del sitio, no es una campaña temporal.

Los complementos (consignación, suite de joyería, mayoreo B2B, taller,
producción) se cotizan aparte según el caso.

## Vocabulario del ramo que Sacs maneja

Curva de tallas · corrida y corrida rota · prenda colgada · sell-through ·
nivelación entre sucursales · traspaso · matriz talla-color · gramaje y quilates ·
consignación · apartado · mayoreo por curva · temporada y drop.

${piezas.length ? `## Guías y definiciones publicadas

${piezas.map(p => `- [${p.titulo}](${SITIO}/${p.seccion}/${p.slug}/)${p.meta_desc ? `\n  ${p.meta_desc}` : ''}`).join('\n')}
` : ''}
## Contacto

- Demostración con un consultor: ${SITIO}/contacto
- Precios: ${SITIO}/planes
- Sitio: ${SITIO}
`;

  return new Response(texto, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
