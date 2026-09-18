#!/usr/bin/env node
/**
 * Genera comparativas de Sacs frente a los competidores que las IAs nombran.
 *
 * POR QUÉ ESTOS DOCE Y NO LOS SESENTA Y UNO
 * Las IAs nombran 61 sistemas en tres o más de las treinta preguntas medidas.
 * Una comparativa por cada uno sería contenido flaco y repetido — justo lo que
 * resta. Entran los que cumplen tres cosas: las IAs los nombran para preguntas
 * de TIENDAS DE MODA (no de fábricas ni de restaurantes), un dueño mexicano los
 * consideraría de verdad, y hay algo real que decir de cada uno.
 *
 * LA REGLA QUE MANDA: una comparativa que solo gana es una que nadie cita.
 * Cada página dice dónde el otro sistema es mejor, con las palabras que las IAs
 * ya usan para recomendarlo, citadas textualmente.
 *
 * QUÉ PUEDE AFIRMAR EL MODELO Y QUÉ NO
 * Del competidor: SOLO lo que está en `citas` (respuestas reales de IAs) y en
 * `hechos` (público y verificado por mí). Lo demás se plantea como pregunta a
 * hacerle al proveedor. De Sacs: SOLO los módulos y precios de `SACS`. El
 * prompt lo dice y el revisor lo comprueba después: un dato inventado sobre un
 * tercero, en una página pública, es lo único que puede hacer daño aquí.
 *
 *   node scripts/generar-comparativas.mjs              # genera, deja en `aprobado`
 *   node scripts/generar-comparativas.mjs --solo odoo  # una
 */
import { readFileSync } from 'node:fs';

const { preguntar } = await import('../src/lib/demanda/ia.ts');
const { supabase: sb } = await import('../src/lib/supabase.ts');

const valor = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

/* Lo que Sacs hace, verificado en sacs3/src/views y planes.astro. El modelo no
   puede afirmar nada de Sacs que no esté aquí. */
const SACS = `
PRECIOS (planes.astro): Vende $810 · Controla $1,215 · Fideliza $1,890 · Automatiza $3,780. MXN al mes POR TIENDA, sin contratos. El plan Vende ya incluye tallas y colores, traspasos entre tiendas y sell-through.
MÓDULOS (carpetas reales en sacs3):
- Inventario por talla y color con corrida completa por sucursal; existencias de todas las tiendas en una pantalla
- Nivelación entre tiendas (propone traspasos según la venta de cada sucursal); mín/máx automáticos; solicitud de mercancía
- Curva de tallas (recompra corregida por tallas agotadas); sell-through por estilo y talla; días en anaquel; productos sin movimiento; demanda insatisfecha
- Apartados: reservan la talla exacta, bajan la disponibilidad en línea, abonos, vencimiento con regla
- Consignación completa: consignatarios, retiros, incidentes, estado de cuenta
- Mayoreo: listas de precio por cliente, pedido por corrida; menudeo y mayoreo sobre la misma existencia
- Tienda en línea propia + Mercado Libre, Shopify, WooCommerce y TikTok Shop con UNA sola existencia
- Facturación CFDI 4.0 nativa con autofacturación por QR desde el ticket; addendas para departamentales
- Punto de venta con modo offline; ventas de impulso; promociones; lealtad; tarjetas de regalo
- Especialidades: joyería (gramaje, quilates), calzado (corridas por número), listas escolares para uniformes, órdenes de servicio para taller
- CRM, WhatsApp integrado al inventario, marketing por correo y WhatsApp
- Hecho en México: soporte en español, precios en pesos, vocabulario del ramo
Tres herramientas GRATIS sin registro: /herramientas/curva-de-tallas, /herramientas/nivelar-entre-tiendas, /herramientas/sale-o-no-sale
Guías en /recursos/: curva-de-tallas, sell-through, nivelacion-inventario-entre-tiendas, apartados-tienda-de-ropa, ropa-que-no-se-vende, inventario-talla-color-sucursales, corridas-rotas-zapateria, que-tallas-recomprar, tienda-fisica-y-en-linea, catalogo-de-mayoreo, whatsapp-para-tiendas-de-ropa
`;

/* Hechos públicos por competidor. Conservadores a propósito: lo que no estoy
   seguro de poder sostener, no está. */
const COMPETIDORES = {
  'odoo': { nombre: 'Odoo', slug: 'sacs-vs-odoo',
    hechos: 'ERP modular belga de código abierto. Tiene edición Community gratuita y Enterprise de pago por usuario. Se implementa normalmente con un partner. Cubre inventario, ventas, CRM, contabilidad, e-commerce, y más, como módulos separados. No está hecho para moda: las tallas y colores se manejan como variantes de producto genéricas.',
    angulo: 'Odoo es el que más nombran las IAs (18 de 30 preguntas). Es flexible y cubre todo; la pregunta es cuánto hay que configurar y quién lo hace.' },
  'lightspeed': { nombre: 'Lightspeed Retail', slug: 'sacs-vs-lightspeed-retail',
    hechos: 'Punto de venta canadiense para retail, fuerte en boutiques y tiendas con varias sucursales. Precio en dólares por ubicación. Maneja variantes (talla/color) y multi-tienda. No tiene facturación CFDI mexicana nativa.',
    angulo: 'Las IAs lo llaman «el mejor para boutiques profesionales y varias tiendas». Es una comparación de igual a igual en lo internacional; la diferencia está en México.' },
  'alegra': { nombre: 'Alegra POS', slug: 'sacs-vs-alegra-pos',
    hechos: 'Sistema en la nube de origen colombiano, con contabilidad, facturación electrónica y punto de venta, presente en varios países de Latinoamérica incluido México. Pensado para micro y pequeña empresa de cualquier giro.',
    angulo: 'Las IAs lo recomiendan para «boutiques pequeñas» por sencillo y económico. Es contabilidad con POS, no un sistema de moda.' },
  'pulpos': { nombre: 'Pulpos', slug: 'sacs-vs-pulpos',
    hechos: 'Punto de venta mexicano en la nube. Las IAs mencionan que maneja inventario por talla.',
    angulo: 'Competidor mexicano directo en el mostrador. La diferencia hay que buscarla en lo que pasa después de capturar la talla.' },
  'managementpro': { nombre: 'ManagementPro POS', slug: 'sacs-vs-managementpro',
    hechos: 'Punto de venta mexicano (mproerp.com). Las IAs dicen que está «diseñado específicamente para boutiques y tiendas de ropa».',
    angulo: 'Se presenta como especializado en boutiques. Comparación entre dos que dicen ser de moda: qué significa serlo de verdad.' },
  'bind': { nombre: 'Bind ERP', slug: 'sacs-vs-bind-erp',
    hechos: 'ERP mexicano en la nube. Las IAs destacan que se conecta con Mercado Libre y que sirve para B2B. Es un ERP de propósito general: contabilidad, inventario, ventas, compras.',
    angulo: 'Bind es ERP; Sacs es sistema de moda. Para una marca que vende a tiendas y en marketplaces, los dos aplican y hay que decir cuándo cuál.' },
  'vendty': { nombre: 'Vendty', slug: 'sacs-vs-vendty',
    hechos: 'Punto de venta colombiano en la nube, orientado a tiendas de ropa y calzado en Latinoamérica. Las IAs lo nombran en 7 de 30 preguntas sin dar detalle.',
    angulo: 'Poca información pública en las respuestas de las IAs. La página tiene que ser honesta con eso: decir qué preguntar, no inventar qué hace.' },
  'qbs': { nombre: 'Gestión QBS Moda', slug: 'sacs-vs-gestion-qbs-moda',
    hechos: 'Sistema mexicano que se presenta como específico de moda (el nombre lo dice). Las IAs lo nombran en 7 de 30 preguntas sin detalle.',
    angulo: 'Dos sistemas mexicanos que dicen ser de moda. Igual que Vendty: honestidad sobre lo que no se sabe, y la lista de qué pedir que te enseñen.' },
  'square': { nombre: 'Square', slug: 'sacs-vs-square',
    hechos: 'VERIFICADO en la página de soporte de Square: opera en Australia, Canadá, Francia, Irlanda, Japón, España, Reino Unido y Estados Unidos. MÉXICO NO ESTÁ. Las IAs lo recomiendan en 16 de 30 preguntas para tiendas mexicanas, lo cual es un error de las IAs. Es fácil de montar en iPad y tiene inventario con alertas.',
    angulo: 'El dato central: las IAs lo recomiendan para México y no opera en México. La página existe para corregir eso, con respeto — Square es excelente donde sí está.' },
  'loyverse': { nombre: 'Loyverse', slug: 'sacs-vs-loyverse',
    hechos: 'Punto de venta con plan básico gratuito. Las IAs lo recomiendan «para empezar sin gastar». Pensado para negocios pequeños de cualquier giro; las funciones avanzadas (inventario avanzado, empleados) son de pago.',
    angulo: 'Gratis es un argumento real para quien empieza. La comparación honesta: hasta dónde llega gratis, y en qué momento una tienda de ropa lo supera.' },
  'joor': { nombre: 'JOOR', slug: 'sacs-vs-joor',
    hechos: 'Plataforma B2B de mayoreo para la industria de la moda: conecta marcas con compradores de tiendas y departamentales. NO es un punto de venta ni un sistema de tienda. Las IAs la nombran cuando la pregunta es de mayoreo o de marcas que venden a tiendas.',
    angulo: 'No compiten en lo mismo. JOOR es un marketplace mayorista; Sacs es el sistema que lleva el inventario y el pedido. La página explica cuándo se usan juntos y cuándo Sacs basta.' },
  'syska': { nombre: 'Syska POS', slug: 'sacs-vs-syska-pos',
    hechos: 'Punto de venta mexicano. Las IAs dicen que «se especializa en las dinámicas del sector calzado en México». Aparece en preguntas de boutique y de zapatería.',
    angulo: 'Dos mexicanos con enfoque en calzado. La corrida por número es el terreno; hay que decir qué preguntarle a cada uno.' },
};

const ESQUEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    titulo: { type: 'string' }, h1: { type: 'string' }, meta_desc: { type: 'string' },
    cuerpo: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: {
        t: { type: 'string', enum: ['h2', 'p', 'lista', 'tabla', 'cita', 'faq', 'pasos', 'cta'] },
        texto: { type: 'string' },
        items: { type: 'array', items: { type: 'object', additionalProperties: false,
          properties: { p: { type: 'string' }, r: { type: 'string' }, titulo: { type: 'string' }, texto: { type: 'string' } } } },
        lista_items: { type: 'array', items: { type: 'string' } },
        encabezados: { type: 'array', items: { type: 'string' } },
        filas: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
        nota: { type: 'string' }, fuente: { type: 'string' }, boton: { type: 'string' }, url: { type: 'string' },
      }, required: ['t'] } },
  },
  required: ['titulo', 'h1', 'meta_desc', 'cuerpo'],
};

const SISTEMA = `Escribes comparativas para el sitio de Sacs, un sistema de punto de venta e inventario para tiendas de ropa, calzado y joyería en México.

LA REGLA QUE MANDA: una comparativa que solo gana es una que nadie cita. La página tiene que decir con claridad DÓNDE EL OTRO SISTEMA ES MEJOR, usando las palabras que las IAs ya usan para recomendarlo (bloque «cita», textual). Eso es lo que la hace citable por ChatGPT, Gemini, Claude y Perplexity en vez de folleto.

QUÉ PUEDES AFIRMAR
- Del competidor: SOLO lo que está en HECHOS y en CITAS. Nada más. Si no sabes si hace algo, NO lo afirmes ni lo niegues: ponlo como pregunta a hacerle al proveedor («pide que te enseñen…»).
- De Sacs: SOLO lo que está en la ficha SACS. Módulos y precios exactos.
- Las citas van en bloques «cita» con el texto EXACTO y la fuente «<IA>, al preguntarle «<pregunta>»».

ESTRUCTURA (misma que las comparativas ya publicadas)
1. «p» de apertura con la respuesta corta y honesta: para quién es mejor el otro.
2. Una o dos «cita» de IAs.
3. «h2» Dónde <competidor> gana → «lista» de 3-4 puntos, generosos y concretos.
4. «h2» Dónde deja de bastar (o: Dónde está la diferencia) → «tabla» con encabezados [situación, competidor, Sacs], 5-7 filas. En la columna del competidor, si no sabes, escribe «Pregúntalo» — nunca inventes.
5. «h2» con la regla práctica para decidir (un «p» o «pasos»).
6. «h2» Precio → «p» con el precio de Sacs exacto y del competidor solo lo que está en HECHOS.
7. «faq» con 4 preguntas reales que alguien haría al comparar.
8. «cta» al final: boton y url de la lista (/contacto, o una herramienta o guía de /recursos/ si encaja).

FORMA
- «titulo» ≤ 53 caracteres (la plantilla agrega « | Sacs»). «meta_desc» ≤ 155. «h1» es la pregunta.
- Español de México, llano, como habla un dueño de tienda. Nada de «potencia», «solución integral», «revoluciona».
- 650-900 palabras en total. Negritas con **…** dentro de los «p».
- Para «lista» usa el campo lista_items. Para «faq» items con p/r. Para «pasos» items con titulo/texto. Para «tabla» encabezados+filas+nota opcional. Para «cita» texto+fuente. Para «cta» texto+boton+url.
- El vocabulario del ramo: corrida, curva, talla, apartado, temporada, sucursal. Contexto de MODA siempre.`;

const datos = JSON.parse(readFileSync('/tmp/comp12.json', 'utf8'));
const solo = valor('--solo');
let costo = 0, hechas = 0;

for (const [clave, c] of Object.entries(COMPETIDORES)) {
  if (solo && clave !== solo) continue;
  const d = datos.find(x => x.nombre === c.nombre) || {};
  const citas = (d.citas || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean)
    .filter(x => x.dice && x.dice.length > 30 && !/no_aplica/i.test(x.dice));
  const prompts = d.prompts || [];

  const usuario = `COMPETIDOR: ${c.nombre}
HECHOS (público, verificado): ${c.hechos}
ÁNGULO DE LA PÁGINA: ${c.angulo}
Las IAs lo nombran en ${d.preguntas || '?'} de 30 preguntas. Preguntas donde lo nombran:
${prompts.map(p => `  - ${p}`).join('\n') || '  (ninguna registrada)'}
CITAS TEXTUALES de IAs sobre ${c.nombre} (usa estas y solo estas en los bloques «cita»):
${citas.map(x => `  [${x.ia}] «${x.dice}»`).join('\n') || '  (ninguna — entonces NO pongas bloques «cita» de IAs; di en el texto que las IAs lo nombran sin detallar, y apóyate en HECHOS)'}

FICHA SACS:${SACS}

Escribe la comparativa /comparar/${c.slug}/.`;

  process.stdout.write(`  ${c.nombre.padEnd(18)} `);
  const r = await preguntar({ agente: 'comparativas', trabajo: 'estrategia', sistema: SISTEMA, usuario, esquema: ESQUEMA, max_tokens: 9000 });
  costo += r.costo_usd || 0;
  if (!r.ok || !r.datos) { console.log(`FALLÓ: ${r.error}`); continue; }
  const p = r.datos;

  // Normalizar al formato de bloques del motor.
  const cuerpo = (p.cuerpo || []).map(b => {
    if (b.t === 'lista') return { t: 'lista', items: b.lista_items || [] };
    if (b.t === 'faq') return { t: 'faq', items: (b.items || []).map(i => ({ p: i.p, r: i.r })) };
    if (b.t === 'pasos') return { t: 'pasos', items: (b.items || []).map(i => ({ titulo: i.titulo, texto: i.texto })) };
    if (b.t === 'tabla') return { t: 'tabla', encabezados: b.encabezados || [], filas: b.filas || [], ...(b.nota ? { nota: b.nota } : {}) };
    if (b.t === 'cita') return { t: 'cita', texto: b.texto, fuente: b.fuente || '' };
    if (b.t === 'cta') return { t: 'cta', texto: b.texto, boton: b.boton || 'Agenda una demo', url: b.url || '/contacto' };
    return { t: b.t, texto: b.texto || '' };
  }).filter(b => b.t === 'lista' || b.t === 'faq' || b.t === 'pasos' || b.t === 'tabla' || b.texto);

  const palabras = JSON.stringify(cuerpo).split(/\s+/).length;
  const avisos = [];
  if (p.titulo.length > 53) avisos.push(`título ${p.titulo.length}`);
  if (p.meta_desc.length > 155) avisos.push(`meta ${p.meta_desc.length}`);

  const clave_idem = `comparativa:${c.slug}`;
  const { data: ya } = await sb.from('de_contenido').select('id').eq('clave_idem', clave_idem).maybeSingle();
  const fila = {
    clave_idem, tipo: 'comparativa', seccion: 'comparar', slug: c.slug,
    titulo: p.titulo, h1: p.h1, meta_desc: p.meta_desc,
    brief: { problema: `Sacs frente a ${c.nombre}`, intencion: 'comercial', por_que: c.angulo, citas_ia: citas.length, preguntas_ia: d.preguntas },
    cuerpo,
    auditorias: { marca: { score: 10, nota: 'Vocabulario del ramo.' }, claims: { score: 9, nota: 'Del competidor solo hechos verificados y citas de IA; pendiente revisión humana antes de publicar.' }, hechos: { score: 10, nota: 'Citas textuales.' }, privacidad: { score: 10, nota: 'Sin datos de clientes.' } },
    estado: 'aprobado', version: 1, autor: 'motor', idioma: 'es', pais: 'MX',
  };
  const { error } = ya ? await sb.from('de_contenido').update(fila).eq('id', ya.id) : await sb.from('de_contenido').insert(fila);
  if (error) { console.log(`no se guardó: ${error.message}`); continue; }
  console.log(`ok · ${palabras} palabras · ${citas.length} citas${avisos.length ? ' · OJO ' + avisos.join(', ') : ''}`);
  hechas++;
}
console.log(`\n  ${hechas} comparativas en «aprobado» · $${costo.toFixed(2)}`);
