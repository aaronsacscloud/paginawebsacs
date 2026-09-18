#!/usr/bin/env node
/**
 * Genera los títulos y las descripciones nuevas del canal, y deja el resultado
 * en `scripts/yt-cambios.json` para que `yt-aplicar.mjs` lo suba.
 *
 * Lo separo del script que aplica a propósito: generar cuesta dinero de modelo
 * y se puede repetir sin consecuencias; aplicar toca un canal público y no
 * tiene deshacer. Dos comandos, dos decisiones.
 *
 *   node scripts/yt-generar.mjs --catalogo <archivo.json> [--limite 40]
 *
 * El catálogo se baja con `yt-catalogo.mjs` y trae lo que la API ya publica:
 * id, título actual, descripción actual, vistas y fecha.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const valor = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

/* Las páginas a las que puede enlazar una descripción. El modelo NO inventa
   URLs: elige de esta lista o no pone ninguna. Un enlace inventado en 224
   descripciones son 224 páginas 404 servidas desde YouTube, y eso es peor que
   no enlazar nada. */
const PAGINAS = {
  'curva-de-tallas':                  'tallas, curva, matriz de tallas y colores, qué tallas pedir',
  'sell-through':                     'sell-through, rotación, qué tan rápido se vende una colección',
  'nivelacion-inventario-entre-tiendas': 'traspasos, mover mercancía entre sucursales, nivelación, CEDIS',
  'whatsapp-para-tiendas-de-ropa':    'vender por WhatsApp, cotizar y cobrar por chat',
  'apartados-tienda-de-ropa':         'apartados, abonos, plazos, cancelaciones',
  'ropa-que-no-se-vende':             'inventario muerto, producto obsoleto, depuración, stock parado',
  'inventario-talla-color-sucursales':'existencias por talla y color en varias tiendas',
  'corridas-rotas-zapateria':         'corridas rotas, calzado, números incompletos',
  'que-tallas-recomprar':             'recompra, próxima temporada, reposición por talla',
  'tienda-fisica-y-en-linea':         'omnicanal, mismo inventario en físico y en línea, e-commerce',
  'catalogo-de-mayoreo':              'mayoreo, vender a otras tiendas, B2B, listas de precio',
};

const SISTEMA = `Eres quien escribe los títulos y las descripciones del canal de YouTube de Sacs,
un software de punto de venta e inventario para tiendas de ropa, calzado y joyería en México.

OBJETIVO: que una persona que busca en YouTube o en Google encuentre el video, y que
ChatGPT, Gemini, Claude y Perplexity puedan CITARLO al contestar una pregunta. Lo que una
IA lee de un video es el título y la descripción. Si la descripción no contesta nada, no
hay nada que citar.

REGLAS DEL TÍTULO
- Es la PREGUNTA que hace el cliente, escrita como la escribiría él. Máximo 100 caracteres.
- Nada de mayúsculas gritadas, nada de asteriscos, nada de emoji de relleno, nada del
  número del archivo al final ("... 1"), nada de nombres de módulo internos.
- Di el giro cuando el video lo permita: "en mi zapatería", "de ropa", "en mi boutique".
  Lo específico gana: la única vez que una IA nombró a Sacs fue en la pregunta más
  específica de treinta.
- Si el título actual YA es una pregunta natural y funciona, cámbialo poco o nada. Varios
  de estos videos tienen miles de vistas justamente porque su título ya está bien.
- El nombre "Sacscloud" en el título solo si el video es de marca o historia de cliente.

REGLAS DE LA DESCRIPCIÓN
- Entre 180 y 320 palabras. Empieza CONTESTANDO, en dos o tres líneas, sin preámbulo.
- Después, qué se ve en el video, en viñetas con "· ".
- Español de México, llano, como habla un dueño de tienda. Nada de "potencia tu negocio",
  "solución integral", "revoluciona". Si una frase podría estar en el folleto de cualquier
  software, sobra.
- Cierra con "Guía completa: https://www.sacscloud.com/recursos/<slug>/" SOLO si alguno de
  los slugs disponibles trata de verdad el mismo tema. Si ninguno encaja, omite la línea.
- Última línea: tres o cuatro hashtags en minúsculas, sin acentos.
- NO inventes funciones. Si el título actual y la descripción actual no dicen que algo
  existe, no lo afirmes. Ante la duda, describe el problema y no la función.

CAMPO "revisar": true si el título actual es tan vago que no puedes saber qué enseña el
video (por ejemplo "Video 12", "Capacitacion", "Introducción"). En ese caso escribe la
mejor propuesta posible pero márcala para que un humano la confirme antes de publicar.`;

/* `additionalProperties: false` en CADA objeto: Anthropic rechaza el esquema
   sin eso («For 'object' type, additionalProperties must be explicitly set to
   false»), y de paso es lo que impide que el modelo devuelva campos de más que
   después nadie mira. */
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    videos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          titulo: { type: 'string' },
          descripcion: { type: 'string' },
          etiquetas: { type: 'array', items: { type: 'string' } },
          pagina: { type: 'string' },
          revisar: { type: 'boolean' },
        },
        required: ['id', 'titulo', 'descripcion', 'etiquetas', 'pagina', 'revisar'],
      },
    },
  },
  required: ['videos'],
};

const { preguntar } = await import('../src/lib/demanda/ia.ts');

const catalogo = JSON.parse(readFileSync(valor('--catalogo'), 'utf8'));
const limite = Number(valor('--limite') || 0);
const lista = limite ? catalogo.slice(0, limite) : catalogo;
const LOTE = 6;

const paginas = Object.entries(PAGINAS).map(([s, q]) => `  ${s} → ${q}`).join('\n');
const out = [];
let costo = 0;

for (let i = 0; i < lista.length; i += LOTE) {
  const lote = lista.slice(i, i + LOTE);
  const usuario = `Páginas disponibles para enlazar (usa el slug tal cual, o ninguna):\n${paginas}\n\n` +
    `Reescribe estos ${lote.length} videos:\n\n` +
    lote.map(v => `id: ${v.id}\nvistas: ${v.vistas}\ntítulo actual: ${v.titulo}\n` +
      `descripción actual: ${(v.desc || '').trim().slice(0, 700) || '(vacía)'}`).join('\n\n---\n\n');

  const r = await preguntar({
    agente: 'yt_reescritor', trabajo: 'trabajo',
    sistema: SISTEMA, usuario, esquema: ESQUEMA, max_tokens: 8000,
  });
  costo += r.costo_usd || 0;

  if (!r.ok || !r.datos?.videos) {
    console.error(`  lote ${i / LOTE + 1}: ${r.error}`);
    continue;
  }
  /* Solo se acepta lo que corresponde a un id del lote: si el modelo inventa
     un id o repite otro, ese registro se tira en vez de acabar en un PUT
     contra un video que nadie pidió tocar. */
  const validos = new Set(lote.map(v => v.id));
  for (const v of r.datos.videos) {
    if (!validos.has(v.id)) { console.error(`  id ajeno descartado: ${v.id}`); continue; }
    const orig = lote.find(x => x.id === v.id);
    out.push({ ...v, grupo: orig.g || '?', antes: orig.titulo, vistas: orig.vistas });
  }
  process.stdout.write(`\r  ${out.length}/${lista.length} · $${costo.toFixed(3)}   `);
}

writeFileSync(join(AQUI, 'yt-cambios.json'), JSON.stringify(out, null, 2));
const revisar = out.filter(v => v.revisar).length;
console.log(`\n\n  ${out.length} videos escritos en scripts/yt-cambios.json`);
console.log(`  ${revisar} marcados para revisar a mano (el título actual no dice qué enseña el video)`);
console.log(`  costo: $${costo.toFixed(2)}`);
