// DEMAND ENGINE · encola los briefs de los 7 huecos de "páginas de
// definición" que encontró la auditoría GEO del 19-sep-2026
// (/tmp/.../scratchpad/seo/geo.md, sección 2.1 — "Páginas de definición: qué
// existe y qué falta"). Son conceptos del ramo que hoy no tienen una página
// propia en /recursos/ que los defina, y por eso un modelo de IA no puede
// citar a Sacs cuando alguien pregunta por ellos.
//
// QUÉ HACE (mismo camino que scripts/de-encolar-plan-seo-2026-09.mjs)
// Por cada página objetivo de la lista PLAN abajo:
//   1. Si YA existe una pieza en `de_contenido` para esa sección+slug, la
//      salta (no duplica trabajo, no la toca).
//   2. Si YA existe una oportunidad con esa clave (`de_oportunidades`), la
//      salta también — así el script se puede volver a correr sin miedo.
//   3. Si no existe ninguna de las dos, inserta una fila en `de_oportunidades`
//      (tipo `SEO_CONTENT`) con el título, la intención, las preguntas a
//      responder y las páginas a enlazar (todas verificadas por curl contra
//      https://www.sacscloud.com el 19-sep-2026 — cada una responde 200; ver
//      el comentario `enlaces_verificados` en cada item).
// Al final, si quedó al menos una oportunidad nueva, encola UNA acción
// `contenido.brief` con `encolar()` (`src/lib/demanda/cola.ts`) con
// `payload.limite` igual al número de oportunidades nuevas, para que el
// worker (`/api/cron/de-worker`, cada 5 min) las tome sin esperar al ciclo
// de mañana.
//
// REGLA DE ESTILO (instrucción del dueño, ver CLAUDE.md del repo):
// TODO el contenido se escribe en contexto de moda, con el lenguaje del ramo
// tal como se habla en México, aunque el concepto sea genérico (margen,
// punto de reorden, sell-in/sell-out, etc. existen en cualquier retail — acá
// se cuentan con tela, tallas, corridas y temporadas). Esta instrucción va
// en cada `descripcion` para que la IA que escribe el brief la reciba.
//
// LO QUE NO HACE
// No escribe la página, no la publica, no toca `de_contenido` directamente:
// solo dispara la vía normal del motor (oportunidad → `contenido.brief`
// encolado → el handler en `contenido.ts` llama a la IA y crea el
// `de_contenido` en estado `brief`, luego `contenido.borrador` en el ciclo
// diario lo pasa a `borrador`). Publicar sigue siendo un clic del dueño en
// `/admin/crm` (`/api/crm/demanda/borradores`, acción `publicar`).
//
// CÓMO SE VUELVE A CORRER
//   cd /opt/sacs/paginawebsacs/sitio
//   /tmp/node-v22.12.0-linux-x64/bin/node --experimental-strip-types \
//     --import ./scripts/de-registrar-hooks.mjs \
//     scripts/de-encolar-brechas-geo-2026-09.mjs
// Es seguro correrlo más de una vez: revisa `de_contenido` por sección+slug
// y `de_oportunidades` por `clave_idem` antes de insertar cualquier cosa, y
// nunca borra ni modifica filas existentes.

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

const FUENTE = 'Auditoría GEO — sacscloud.com, sección 2.1 "Páginas de definición: qué existe y qué falta" (19-sep-2026)';

const REGLA_ESTILO = 'Regla de estilo del dueño (obligatoria): escribe TODO en contexto de moda — tela, tallas, corridas, temporada, tienda/boutique/showroom, feria — con el lenguaje del ramo tal como se habla en México. Nunca lo presentes como un concepto genérico de retail o contabilidad aunque lo sea; los ejemplos y cifras deben ser de prendas/calzado. Todo dato que cites debe ser verdad (no inventar cifras de mercado).';

/** Los 7 huecos, en el orden de prioridad pedido. Cada `enlaces` trae solo
 *  URLs verificadas por curl (200) el 19-sep-2026 contra www.sacscloud.com —
 *  no se declara ningún link a una página que no exista todavía. */
const PLAN = [
  {
    orden: 1,
    seccion: 'recursos', slug: 'margen-y-markup',
    titulo: 'Margen y markup en una tienda de ropa: cuál es cuál',
    intencion: 'Definición — confunden los dos términos y necesitan la distinción clara, con ejemplo en pesos.',
    preguntas: [
      'Qué es el margen y qué es el markup, con un ejemplo numérico de una prenda real (costo vs. precio de venta)',
      'Por qué el mismo % de markup no da el mismo % de margen (y por qué eso importa al fijar precio de temporada)',
      'Cuál de los dos hay que ver para saber si el negocio realmente gana',
    ],
    enlaces: [
      { url: '/herramientas/margen', obligatorio: true, texto: 'la calculadora de margen y markup de Sacs' },
    ],
    nota: 'Hoy la distinción solo existe como frase suelta dentro de la calculadora /herramientas/margen ("Margen es la ganancia entre el precio de venta; markup es la ganancia entre el costo"), sin artículo propio ni schema de definición. Este brief es esa página de definición — debe enlazar a la calculadora como la herramienta para calcularlo con los números propios.',
  },
  {
    orden: 2,
    seccion: 'recursos', slug: 'punto-de-reorden',
    titulo: 'Punto de reorden en ropa: cuándo volver a pedir cada talla',
    intencion: 'Definición + método — quiere saber en qué momento exacto hay que reordenar antes de romper la corrida.',
    preguntas: [
      'Qué es el punto de reorden y por qué se calcula por talla, no por prenda en general',
      'Cómo entra el tiempo de entrega del proveedor (maquila o importación) en el cálculo',
      'Qué pasa si se reordena tarde (corrida rota) vs. si se reordena a tiempo',
    ],
    enlaces: [
      { url: '/herramientas/punto-de-reorden', obligatorio: true, texto: 'la calculadora de punto de reorden de Sacs' },
    ],
    nota: 'Página compañera de la calculadora /herramientas/punto-de-reorden (hoy es un HowTo sin artículo de definición). Debe enlazar a esa calculadora como la vía para sacar el número propio con el tiempo de entrega real del proveedor.',
  },
  {
    orden: 3,
    seccion: 'recursos', slug: 'costo-de-maquila',
    titulo: 'Cómo se arma el costo de maquila de una prenda',
    intencion: 'Método — quiere entender de qué se compone el costo real, no solo "cuánto cobra el taller".',
    preguntas: [
      'Qué entra en el costo de una prenda maquilada: tela, insumos (hilo, botones, etiquetas), corte, confección',
      'Cómo se le suma la merma de tela (el desperdicio del tendido/corte)',
      'Por qué el costo por pieza cambia según el tamaño del lote',
    ],
    enlaces: [
      { url: '/herramientas/costo-de-maquila', obligatorio: true, texto: 'la calculadora de costo de maquila de Sacs' },
    ],
    nota: 'Página compañera de la calculadora /herramientas/costo-de-maquila (hoy es un HowTo sin artículo de definición). Debe enlazar a esa calculadora para que el lector arme su costo con sus propios números de tela, insumos, corte, confección, merma y lote.',
  },
  {
    orden: 4,
    seccion: 'recursos', slug: 'que-es-la-consignacion',
    titulo: 'Qué es la consignación en tiendas de ropa (y cómo se controla)',
    intencion: 'Definición — todavía no sabe si le conviene el modelo, busca entender el concepto antes de operarlo.',
    preguntas: [
      'Qué es vender en consignación y en qué se diferencia de comprar el inventario',
      'Quién es dueño de la mercancía mientras está en el aparador y qué pasa si no se vende',
      'Cómo se liquida al proveedor/diseñador cuando sí se vende (el % acordado, cuándo se le paga)',
    ],
    enlaces: [
      { url: '/giros/consignacion', obligatorio: true, texto: 'el giro de Consignación de Sacs' },
    ],
    nota: 'El concepto en sí, NO la venta del servicio — hoy solo existe /giros/consignacion, que vende la solución para operar consignación, no explica qué es el modelo para quien todavía no lo conoce. Debe enlazar a ese giro como el siguiente paso para quien ya entendió el concepto y quiere operarlo con Sacs.',
  },
  {
    orden: 5,
    seccion: 'recursos', slug: 'sell-in-vs-sell-out',
    titulo: 'Sell-in vs. sell-out: la diferencia que toda marca mayorista debe medir',
    intencion: 'Definición — marca o distribuidor de ropa/calzado que vende a otras tiendas y confunde "ya vendí" con "ya se vendió en el punto de venta".',
    preguntas: [
      'Qué es el sell-in (lo que la marca le factura al mayorista/tienda) y qué es el sell-out (lo que esa tienda le vende al público)',
      'Por qué un sell-in alto con sell-out bajo es una señal de alarma (inventario atorado en el cliente, no en demanda real)',
      'Cómo debería una marca pedirle datos de sell-out a sus puntos de venta para no operar a ciegas',
    ],
    enlaces: [
      { url: '/giros/marcas-de-ropa', obligatorio: false, texto: 'el giro de Marcas de ropa de Sacs' },
      { url: '/recursos/precios-mayoreo-y-menudeo-mismo-inventario', obligatorio: false, texto: 'la guía de precios de mayoreo y menudeo en el mismo inventario' },
    ],
    nota: 'No existe nada hoy sobre este concepto en el sitio. Es vocabulario clave para marcas que venden a mayoristas — enlazar al giro de Marcas de ropa y a la guía de mayoreo/menudeo ya publicada, ambos verificados 200.',
  },
  {
    orden: 6,
    seccion: 'recursos', slug: 'pre-venta-y-pedido-en-firme',
    titulo: 'Pre-venta y pedido en firme: el vocabulario de las ferias de moda',
    intencion: 'Definición — compradora o marca que va a una feria (Intermoda, SAPICA) y no domina los términos con los que se arman los pedidos ahí.',
    preguntas: [
      'Qué es un pedido en pre-venta (se toma en la feria, antes de producir) vs. un pedido en firme (ya confirmado, con fecha de entrega y sin cancelación)',
      'Por qué las marcas arman su producción con base en las pre-ventas de la feria y no antes',
      'Qué riesgo corre el comprador si confunde una pre-venta con un pedido en firme (fechas de entrega, mínimos, cancelaciones)',
    ],
    enlaces: [
      { url: '/giros/marcas-de-ropa', obligatorio: false, texto: 'el giro de Marcas de ropa de Sacs' },
    ],
    nota: 'No existe nada hoy sobre este concepto en el sitio. Solo se declara el link al giro de Marcas de ropa (verificado 200) — la guía "pedidos en feria de moda" del plan de contenido anterior sigue sin publicarse (404 confirmado hoy), así que NO se enlaza.',
  },
  {
    orden: 7,
    seccion: 'recursos', slug: 'que-es-un-line-sheet',
    titulo: 'Qué es un line sheet (y cómo se arma uno de ropa o calzado)',
    intencion: 'Definición — compradora mayorista o marca que empieza a vender a tiendas y no sabe qué es este documento que le piden o que tiene que mandar.',
    preguntas: [
      'Qué es un line sheet y qué información trae (foto, clave, precio de mayoreo, tallas/colores disponibles, mínimo)',
      'En qué momento del proceso de venta a mayoristas se usa (antes del pedido, en la feria, en la reunión con el comprador)',
      'Qué diferencia a un line sheet de un catálogo normal para el público',
    ],
    enlaces: [
      { url: '/comparar/sacs-vs-joor', obligatorio: true, texto: 'la comparativa Sacs vs. Joor' },
    ],
    nota: 'No existe nada hoy sobre este concepto en el sitio, y ni siquiera se menciona en /comparar/sacs-vs-joor (confirmado: cero ocurrencias de "line sheet" ahí), la comparativa con el marketplace B2B donde es vocabulario básico. Debe enlazar a esa comparativa.',
  },
  {
    orden: 8,
    seccion: 'recursos', slug: 'corrida-rota',
    titulo: 'Qué es una corrida rota (y por qué pasa en cualquier tienda de ropa)',
    intencion: 'Definición del concepto general — hoy solo existe contado con marco de zapatería; aplica igual a playeras, pantalones, vestidos.',
    preguntas: [
      'Qué es una corrida (el set completo de tallas de un modelo) y qué significa que esté "rota"',
      'Por qué una corrida rota espanta venta aunque haya piezas en el aparador (falta justo la talla que se busca)',
      'Qué la rompe primero: mala compra inicial, mala reposición, o venta despareja entre tallas',
    ],
    enlaces: [
      { url: '/recursos/corridas-rotas-zapateria', obligatorio: true, texto: 'la guía de corridas rotas en zapatería' },
    ],
    nota: 'IMPORTANTE: NO duplicar /recursos/corridas-rotas-zapateria. Esa página ya existe y trata el concepto con marco de zapatería (números de calzado). Esta página nueva debe tratar el concepto GENERAL de corrida rota (aplica a cualquier prenda con tallas: playeras, pantalones, vestidos) y enlazar a la guía de zapatería como el caso particular de ese giro, sin repetir su contenido.',
  },
];

function claveOportunidad(item) {
  return `SEO_CONTENT:manual:${item.seccion}-${item.slug}`;
}

function descripcion(item) {
  const enlacesTexto = item.enlaces.map(e =>
    `  - ${e.url} (${e.obligatorio ? 'OBLIGATORIO enlazarla' : 'opcional'}) — ${e.texto}`
  );
  return [
    `Página objetivo: /${item.seccion}/${item.slug}/`,
    `Intención: ${item.intencion}`,
    '',
    REGLA_ESTILO,
    '',
    'Preguntas que la página tiene que contestar sí o sí:',
    ...item.preguntas.map(p => `  - ${p}`),
    '',
    'Páginas del sitio a las que debe enlazar (todas verificadas 200 por curl el 19-sep-2026):',
    ...enlacesTexto,
    '',
    `Nota: ${item.nota}`,
  ].filter(Boolean).join('\n');
}

async function yaHayContenido(seccion, slug) {
  const { data } = await supabase.from('de_contenido').select('id, estado').eq('seccion', seccion).eq('slug', slug).maybeSingle();
  return data || null;
}

async function main() {
  console.log(`Plan: ${PLAN.length} páginas a evaluar (huecos GEO sección 2.1).\n`);
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
        enlaces_verificados: item.enlaces.map(e => ({ url: e.url, http_status_check: '200 (curl, 19-sep-2026)', obligatorio: e.obligatorio })),
        orden_prioridad: item.orden,
        nota: item.nota,
      },
      score: 100 - item.orden,
      desglose: { origen: 'geo_audit_2026-09-19', nota: 'no viene de un cluster detectado: hueco encontrado a mano en la auditoría GEO, sección 2.1' },
      pesos_version: null,
      accion_recomendada: 'Escribir la página de definición que cierre este hueco de GEO',
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

  const hoy = new Date().toISOString().slice(0, 10);
  const r = await encolar({
    tipo: 'contenido.brief',
    clave_idem: `contenido.brief:geo-brechas-definicion:${hoy}`,
    prioridad: 52,
    payload: { limite: nuevas.length },
    creada_por: 'operador_geo_brechas',
    motivo: `Brief de los ${nuevas.length} huecos de páginas de definición encontrados en la auditoría GEO (sección 2.1, 19-sep-2026)`,
  });

  console.log('\n--- acción encolada ---');
  console.log(r);
  if (r.estado === 'necesita_aprobacion') {
    console.log('\nOJO: esta política pide aprobación del dueño antes de correr. Queda visible en la cola del CRM esperando el clic.');
  } else if (r.id === null) {
    console.log('\nNO se encoló: revisa el motivo de arriba (tope diario alcanzado o kill switch encendido).');
  } else {
    console.log(`\nQuedó en estado "${r.estado}" — con la política actual corre sola en la próxima pasada del worker (cada 5 min).`);
  }
}

await main();
