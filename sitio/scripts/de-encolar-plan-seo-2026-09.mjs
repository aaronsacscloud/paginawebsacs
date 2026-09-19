// DEMAND ENGINE · encola los briefs de las 9 páginas priorizadas del plan de
// contenido SEO de moda (informe "sección 3 · los 12 contenidos a escribir
// primero", 19-sep-2026).
//
// QUÉ HACE
// Por cada página objetivo de la lista PLAN abajo:
//   1. Si YA existe una pieza en `de_contenido` para esa sección+slug, la
//      salta (no duplica trabajo).
//   2. Si YA existe una oportunidad con esa clave (`de_oportunidades`), la
//      salta también — así el script se puede volver a correr sin miedo.
//   3. Si no existe ninguna de las dos, inserta una fila en `de_oportunidades`
//      (tipo `SEO_CONTENT`, la vía que ya usa el motor para pasar de "detecté
//      un problema" a "esto hay que escribirlo") con el título, la intención,
//      las preguntas a responder y las páginas a enlazar tal como vienen en el
//      informe, en `descripcion` y `evidencia`.
// Al final, si quedó al menos una oportunidad nueva, encola UNA acción
// `contenido.brief` con `encolar()` (la función real de
// `src/lib/demanda/cola.ts`, la misma que usa el ciclo diario) con
// `payload.limite` igual al número de oportunidades nuevas, para que el
// worker (`/api/cron/de-worker`, corre cada 5 min) las tome en su próxima
// pasada sin esperar al ciclo de mañana.
//
// LO QUE NO HACE
// No escribe la página, no la publica, no toca `de_contenido` directamente:
// solo dispara la vía normal del motor (oportunidad → `contenido.brief`
// encolado → el handler ya existente en `contenido.ts` llama a la IA y crea
// el `de_contenido` en estado `brief`). El paso `contenido.borrador` ya está
// en el ciclo diario y lo recoge solo; publicar sigue siendo un clic del
// dueño en la bandeja de `/admin/crm` (`/api/crm/demanda/borradores`,
// acción `publicar`) — eso este script nunca lo toca.
//
// POLÍTICA VIGENTE (leída en producción el 19-sep-2026, puede cambiar):
// `contenido.brief` nivel 1, LOW, sin aprobación, tope 20/día → nace `lista`.
// `contenido.borrador` nivel 2, LOW, sin aprobación, tope 10/día → nace `lista`.
// `autonomia_global` = 2. Con eso, las 9 oportunidades corren SOLAS hasta
// quedar en `de_contenido` estado `borrador`; NINGUNA necesita el clic del
// dueño para llegar ahí. El clic del dueño solo aparece para publicar.
//
// AVISO DE ARQUITECTURA (no se toca desde aquí, solo se deja dicho): el campo
// `brief.enlaces` que escribe la IA solo se renderiza como link real hacia
// `/recursos/<slug>/` — así está escrito en `escribirBorrador()`
// (`src/lib/demanda/contenido.ts`, línea ~294). Los enlaces del informe hacia
// `/producto`, `/giros`, `/comparar`, `/planes` o `/agendar` NO se van a
// insertar solos como link — se los damos al modelo en la descripción para
// que los mencione en el texto, pero no hay garantía de que queden como
// `[texto](/ruta/)`. Si se quiere que sí, hace falta tocar `contenido.ts`
// (fuera del alcance de este script).
//
// CÓMO SE VUELVE A CORRER
//   cd /opt/sacs/paginawebsacs/sitio
//   /tmp/node-v22.12.0-linux-x64/bin/node --experimental-strip-types \
//     --import ./scripts/de-registrar-hooks.mjs \
//     scripts/de-encolar-plan-seo-2026-09.mjs
// (Se necesita Node ≥22 por los imports de `src/lib/demanda/*.ts` — el
// servidor trae Node 20, de ahí el binario portátil, ver
// `paginawebsacs/CLAUDE.md` sección "Dev local de paginawebsacs. El
// `--import ./scripts/de-registrar-hooks.mjs` es el mismo puente que ya usa
// `npm test`: resuelve los imports sin extensión del repo —`../supabase`
// en vez de `../supabase.ts`— cuando el código corre desde node y no desde
// Astro/Vite. Si el binario de Node 22 portátil ya no está en /tmp, bajar
// otro cualquiera ≥22.12.)
// Es seguro correrlo más de una vez: todo lo ya encolado se salta (revisa
// `de_contenido` por sección+slug y `de_oportunidades` por `clave_idem`
// antes de insertar).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

for (const l of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { supabase } = await import(join(RAIZ, 'src/lib/supabase.ts'));
const { encolar } = await import(join(RAIZ, 'src/lib/demanda/cola.ts'));

const FUENTE = 'Plan de contenido SEO — sacscloud.com (moda), sección 3, "Los 12 contenidos a escribir primero" (informe 19-sep-2026)';

/** Las 9 de las 12 que el motor de demanda puede atender con un brief
 *  (recursos/comparar/software-para). Las otras 3 —calculadora de margen,
 *  de punto de reorden y de costo de maquila, más su guía compañera— son
 *  herramientas (código nuevo bajo /herramientas), no contenido: las decide
 *  el operador en el repo, no esta cola, y por eso no están aquí. */
const PLAN = [
  {
    orden: 1,
    seccion: 'software-para', slug: 'tienda-de-ropa',
    titulo: 'Software para tienda de ropa: qué debe tener (con o sin Sacs)',
    intencion: 'Investigación / primer contacto: todavía no sabe que Sacs existe.',
    preguntas: [
      'Qué módulos son indispensables (POS, inventario por talla/color, apartados, tienda en línea)',
      'Qué diferencia a un sistema genérico de uno hecho para moda',
      'Cuánto cuesta el rango del mercado',
    ],
    dato_propio: 'La curva de tallas y el sell-through son los dos números que un sistema genérico no calcula.',
    enlaces: ['/producto/inventario-omnicanal', '/producto/punto-de-venta', '/comparar (el roundup nuevo)', '/giros (índice)', '/planes'],
  },
  {
    orden: 2,
    seccion: 'software-para', slug: 'mayoreo-de-ropa',
    titulo: 'Sistema para mayoreo de ropa: catálogo, precios y pedidos',
    intencion: 'Marca o distribuidor que vende a otras tiendas, no al público final.',
    preguntas: [
      'Cómo se maneja precio de mayoreo vs. menudeo sin capturarlo dos veces',
      'Cómo se ponen mínimos por línea',
      'Cómo se arma un catálogo para compradores',
    ],
    dato_propio: 'Un solo inventario para menudeo y mayoreo, no dos sistemas separados.',
    enlaces: ['/recursos/catalogo-de-mayoreo', '/recursos/precios-mayoreo-y-menudeo-mismo-inventario (cuando se publique)', '/giros/marcas-de-ropa', '/recursos/pedidos-en-feria-de-moda (nuevo, ver más abajo)'],
  },
  {
    orden: 3,
    seccion: 'software-para', slug: 'punto-de-venta-para-boutique',
    titulo: 'Punto de venta para boutique: lo que un POS de abarrotes no trae',
    intencion: 'Dueña de una boutique buscando un POS.',
    preguntas: [
      'Qué necesita una boutique que un POS genérico de abarrotes no trae (apartados, cambios sin ticket, looks armados)',
    ],
    dato_propio: 'El patrón de apartado con abonos, específico del ramo de moda.',
    enlaces: ['/producto/apartados-y-pedidos', '/giros/boutique-multimarca', '/giros/marcas-de-ropa', '/comparar/sacs-vs-square'],
  },
  {
    orden: 4,
    seccion: 'software-para', slug: 'zapaterias',
    titulo: 'Programa para zapatería: qué pedirle antes de comprar',
    intencion: 'Investigación, todavía comparando opciones antes de decidir.',
    preguntas: [
      'Cómo se maneja el número de calzado (curva EU/MX)',
      'Cómo se controla por caja',
      'Cómo se maneja la temporada',
    ],
    dato_propio: 'Las corridas rotas por número, tal como ya se documentó en /recursos/corridas-rotas-zapateria.',
    enlaces: ['/giros/zapateria', '/comparar/sacs-vs-sicar', '/comparar/sacs-vs-syska-pos', '/recursos/corridas-rotas-zapateria'],
  },
  {
    orden: 5,
    seccion: 'software-para', slug: 'tienda-de-novias',
    titulo: 'Sistema para tienda de novias: apartados, tallas y citas',
    intencion: 'Producto — giro de alto ticket, con cadencia ABM activa desde el 14-sep-2026.',
    preguntas: [
      'Cómo se manejan apartados con anticipo largo (meses, no días)',
      'Cómo se manejan tallas por medida/ajuste',
      'Cómo se agenda una cita',
    ],
    dato_propio: 'El apartado sin reloj que ya existe como patrón en el giro de Consignación, adaptado a anticipo de vestido.',
    enlaces: ['/giros/novias-y-fiesta', '/producto/apartados-y-pedidos', '/agendar'],
  },
  {
    orden: 6,
    seccion: 'comparar', slug: 'mejores-sistemas-para-tiendas-de-ropa-mexico',
    titulo: 'Los mejores sistemas para tiendas de ropa en México, comparados',
    intencion: 'Roundup — comparación SIN una marca todavía en mente. Es la pieza más citable por una IA cuando alguien pregunta "cuál es el mejor sistema" sin nombrar a nadie. NO es una comparativa 1-a-1: es la tabla que reúne y enlaza a las que ya existen.',
    preguntas: [
      'Qué opción conviene según el tamaño de la tienda',
      'Qué opción conviene si factura',
      'Qué opción conviene si vende en línea',
    ],
    dato_propio: 'Tabla que apunta a las 17 comparativas 1-a-1 ya publicadas en /comparar/sacs-vs-* como fuente ampliada de cada fila.',
    enlaces: ['cada /comparar/sacs-vs-* ya publicada (17 páginas)', '/planes'],
  },
  {
    orden: 7,
    seccion: 'recursos', slug: 'curva-de-tallas-como-calcularla',
    titulo: 'Cómo se calcula la curva de tallas, paso a paso',
    intencion: 'How-to — quiere el MÉTODO, no el concepto. Ya existe la definición en /recursos/curva-de-tallas; esta es la pieza compañera y distinta: "cómo se calcula" contra "qué es".',
    preguntas: [
      'Cómo se calcula la curva de tallas paso a paso, con un ejemplo numérico real',
      'Cómo se corrige el cálculo por días que la talla estuvo agotada',
    ],
    dato_propio: 'La misma lógica de /herramientas/curva-de-tallas (el "auditor de curva"), contada en texto.',
    enlaces: ['/herramientas/curva-de-tallas', '/recursos/curva-de-tallas (la definición — enlazar como "ver también", no repetir su contenido)', '/producto/ordenes-de-compra'],
    aviso: 'Riesgo de canibalización con /recursos/curva-de-tallas (definición) y /herramientas/curva-de-tallas (calculadora): que el título y el <title> dejen clarísimo que esta es la guía de "cómo se calcula", no "qué es" ni la calculadora misma.',
  },
  {
    orden: 8,
    seccion: 'recursos', slug: 'pedidos-en-feria-de-moda',
    titulo: 'Cómo levantar pedidos en una feria de moda sin perder ninguno',
    intencion: 'Temporal/estacional — antes de Intermoda, SAPICA.',
    preguntas: [
      'Cómo se captura el pedido sin internet en el stand',
      'Cómo no se duplica el mínimo de línea',
      'Cómo se convierte en orden de compra el lunes siguiente',
    ],
    dato_propio: 'El cobro y la captura sin internet ya documentados en el giro de Merch de Eventos.',
    enlaces: ['/giros/marcas-de-ropa', '/software-para/mayoreo-de-ropa (nuevo, ver arriba)', '/producto/ordenes-de-compra'],
  },
  {
    orden: 9,
    seccion: 'recursos', slug: 'quiebre-de-talla-como-evitarlo',
    titulo: 'Cómo evitar el quiebre de talla ("otra vez se me acabó la M")',
    intencion: 'Problema agudo y recurrente, no una duda conceptual.',
    preguntas: [
      'Por qué se rompe la corrida',
      'Cómo se detecta antes de que pase',
      'Qué hacer cuando ya pasó (traspaso vs. recompra)',
    ],
    dato_propio: 'La nivelación entre tiendas como la salida cuando la corrida ya se rompió.',
    enlaces: ['/herramientas/nivelar-entre-tiendas', '/herramientas/punto-de-reorden (nuevo — todavía no existe, no lo enlaces hasta que se construya)', '/producto/nivelacion-de-inventario'],
  },
];

function claveOportunidad(item) {
  return `SEO_CONTENT:manual:${item.seccion}-${item.slug}`;
}

function descripcion(item) {
  return [
    `Página objetivo: /${item.seccion}/${item.slug}/`,
    `Intención: ${item.intencion}`,
    '',
    'Preguntas que la página tiene que contestar sí o sí:',
    ...item.preguntas.map(p => `  - ${p}`),
    '',
    `Dato propio a demostrar: ${item.dato_propio}`,
    '',
    'Páginas del sitio a las que debe enlazar (úsalas en "enlaces" las que sean propias de /recursos/; las demás mencionalas en el texto o en nota_honestidad si el esquema no las admite como enlace):',
    ...item.enlaces.map(e => `  - ${e}`),
    item.aviso ? `\nAviso: ${item.aviso}` : '',
  ].filter(Boolean).join('\n');
}

async function yaHayContenido(seccion, slug) {
  const { data } = await supabase.from('de_contenido').select('id, estado').eq('seccion', seccion).eq('slug', slug).maybeSingle();
  return data || null;
}

async function main() {
  console.log(`Plan: ${PLAN.length} páginas a evaluar.\n`);
  const nuevas = [];
  const saltadas = [];

  for (const item of PLAN.sort((a, b) => a.orden - b.orden)) {
    const ruta = `/${item.seccion}/${item.slug}/`;
    const yaContenido = await yaHayContenido(item.seccion, item.slug);
    if (yaContenido) {
      saltadas.push(`${ruta} — ya existe en de_contenido (estado: ${yaContenido.estado}), no se toca`);
      continue;
    }

    const clave = claveOportunidad(item);
    const { data: yaOp } = await supabase.from('de_oportunidades').select('id, estado, accion_id').eq('clave_idem', clave).maybeSingle();
    if (yaOp) {
      saltadas.push(`${ruta} — ya había una oportunidad (${clave}), estado ${yaOp.estado}${yaOp.accion_id ? ', ya atendida' : ''}, no se duplica`);
      continue;
    }

    const { data, error } = await supabase.from('de_oportunidades').insert({
      clave_idem: clave,
      tipo: 'SEO_CONTENT',
      cluster_id: null,
      titulo: item.titulo,
      descripcion: descripcion(item),
      evidencia: {
        fuente: FUENTE,
        seccion_objetivo: item.seccion,
        slug_objetivo: item.slug,
        intencion: item.intencion,
        preguntas: item.preguntas,
        enlaces_pedidos: item.enlaces,
        dato_propio: item.dato_propio,
        orden_prioridad: item.orden,
      },
      score: 100 - item.orden, // conserva el orden del informe al escoger el brief
      desglose: { origen: 'plan_seo_manual', nota: 'no viene de un cluster detectado: es un brief pedido a mano desde el informe de contenido' },
      pesos_version: null,
      accion_recomendada: 'Escribir la página que lo responda mejor que nadie',
      esfuerzo: 'M',
      descubrimiento_tipo: 'marketing',
      riesgo: 'LOW',
      estado: 'nueva',
    }).select('id').single();

    if (error) { saltadas.push(`${ruta} — ERROR al insertar oportunidad: ${error.message}`); continue; }
    nuevas.push({ ruta, id: data.id, clave });
    console.log(`+ oportunidad creada para ${ruta} (${clave})`);
  }

  console.log('\n--- resumen de oportunidades ---');
  console.log(`nuevas: ${nuevas.length} · saltadas: ${saltadas.length}`);
  for (const s of saltadas) console.log(`  · ${s}`);

  if (!nuevas.length) {
    console.log('\nNo hay nada nuevo que encolar: todas las páginas del plan ya tenían oportunidad o contenido.');
    return;
  }

  // Un solo `contenido.brief`, con cupo para las que se acaban de crear.
  // clave_idem fija: si el script se vuelve a correr el mismo día, no duplica
  // la acción (aunque sí puede insertar oportunidades nuevas que faltaban).
  const hoy = new Date().toISOString().slice(0, 10);
  const r = await encolar({
    tipo: 'contenido.brief',
    clave_idem: `contenido.brief:plan-seo-manual:${hoy}`,
    prioridad: 52, // misma prioridad que usa el ciclo diario para esta fase
    payload: { limite: nuevas.length },
    creada_por: 'operador_plan_seo',
    motivo: `Brief de las ${nuevas.length} páginas priorizadas del plan de contenido SEO (informe 19-sep-2026)`,
  });

  console.log('\n--- acción encolada ---');
  console.log(r);
  if (r.estado === 'necesita_aprobacion') {
    console.log('\nOJO: esta política pide aprobación del dueño antes de correr. Queda visible en la cola del CRM esperando el clic.');
  } else if (r.id === null) {
    console.log('\nNO se encoló: revisa el motivo de arriba (tope diario alcanzado o kill switch encendido).');
  } else {
    console.log(`\nQuedó en estado "${r.estado}" — con la política actual (nivel 1, sin aprobación, autonomía global 2) corre sola en la próxima pasada del worker (cada 5 min).`);
  }
}

await main();
