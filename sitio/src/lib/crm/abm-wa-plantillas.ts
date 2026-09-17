// ══ Las plantillas de WhatsApp del ABM en frío ═══════════════════════════════
//
// EL PROBLEMA DE AUTOMATIZAR WHATSAPP EN FRÍO
// Para abrir conversación con alguien que nunca nos escribió, Meta exige una
// PLANTILLA APROBADA. Y una plantilla es texto fijo con huecos: no se puede
// mandar un mensaje distinto a cada cuenta. Eso choca de frente con lo que hace
// que un mensaje frío funcione, que es justamente sonar escrito a mano.
//
// CÓMO SE RESUELVE
// El texto fijo carga el ESQUELETO y los saltos de línea; los huecos cargan
// TODO lo que cambia. Bien repartidos, dos cuentas reciben mensajes que se
// leen distintos aunque salgan de la misma plantilla:
//
//   "Estamos armando el mapa de las mejores casas de novia de México y
//    Cielo Inzunza Novias, en Culiacán, con 5.0 estrellas y 22 reseñas,
//    salió en la lista."
//   "Estamos armando el mapa de las mejores zapaterías de México y
//    Calzado Torres, en León, con 6 sucursales, salió en la lista."
//
// LA REGLA QUE OBLIGA A ESTE FORMATO
// Un valor de variable NO puede llevar saltos de línea, tabuladores ni más de
// cuatro espacios seguidos: Meta rechaza el envío (error 132012). Por eso la
// lista de funciones del giro va como UNA FRASE de corrido dentro del hueco, y
// nunca como viñetas — las viñetas necesitarían saltos y el mensaje no saldría.
// `sanearParam()` limpia por si acaso, pero el texto se escribe ya plano.
//
// Y el cuerpo de la plantilla tiene tope de 1024 caracteres contando los
// huecos. Los tres de aquí están holgados.
//
// OTRA QUE SE APRENDE A GOLPES: una variable NO puede quedar al PRINCIPIO ni al
// FINAL del cuerpo. Meta rechazó la apertura porque cerraba con "{{5}}?" — el
// signo de interrogación no cuenta como texto suficiente. Siempre tiene que
// haber palabras después del último hueco.
//
// POR QUÉ UNA PLANTILLA POR PASO Y NO UNA POR GIRO
// 22 giros × 3 pasos serían 66 aprobaciones de Meta, cada una con su revisión y
// su riesgo de rechazo. Con los huecos cargando lo del giro son 3, y agregar un
// giro nuevo no necesita aprobación de nadie: solo una fila más aquí abajo.
//
// LOS BOTONES SON LA PIEZA CLAVE, NO UN ADORNO
// Un toque en un botón de respuesta rápida ABRE LA VENTANA DE 24 HORAS. Dentro
// de esa ventana ya no hacen falta plantillas: se contesta con texto libre, la
// IA puede conversar de verdad y no se paga por mensaje. O sea: la plantilla
// solo tiene que lograr UN TOQUE. Ahí deja de sonar a robot y empieza la
// conversación real.
import { GIROS } from './abm-giros';
import { COPY } from './abm-giro-copy';
import { ALIADOS, type TipoAliado } from './abm-aliados';

export type PlantillaFria = {
  nombre: string;                  // el que se da de alta en Meta
  categoria: 'MARKETING';          // todo contacto en frío lo es, sin excepción
  idioma: string;
  cuerpo: string;
  botones: { tipo: 'QUICK_REPLY' | 'URL'; texto: string; url?: string }[];
  ejemplos: string[];              // Meta EXIGE una muestra por hueco
};

/** Lo que cambia por giro. Una fila por giro que se trabaje en frío.
 *  `plural`   — cómo se nombra al conjunto: "las mejores casas de novia"
 *  `singular` — para "una versión hecha para {{3}}"
 *  `funciones`— DE CORRIDO, sin saltos: es un valor de variable
 *  `dolor`    — lo que duele en ese giro, en una frase
 *  `solucion` — cómo se resuelve. NO puede repetir `funciones`: el paso 2 salía
 *               con la misma lista del paso 1 palabra por palabra, y un mensaje
 *               que no avanza es lo que cansa y hace que reporten
 *  `pesa`     — qué les pesa hoy, para el cierre
 *  `suyo`     — el objeto del negocio: "sus modelos", "sus números de calzado" */
export type GiroFrio = {
  plural: string; singular: string; funciones: string; dolor: string; solucion: string; pesa: string; suyo: string;
};

/* ── GIRO_FRIO sale del catálogo único ────────────────────────────────────────
   Antes esta tabla tenía cuatro giros escritos a mano aquí, y el correo 0 tenía
   los suyos en abm_plantillas. Dos copias del mismo texto: arreglar una frase
   obligaba a buscarla en dos lugares y casi siempre se arreglaba en uno solo.
   Ahora los 24 giros salen de abm-giro-copy.ts, que es la fuente. */
export const GIRO_FRIO: Record<string, GiroFrio> = Object.fromEntries(
  Object.entries(COPY).map(([g, c]) => [g, {
    /* El artículo se conserva del catálogo para que el género concuerde: sale
       «los mejores talleres», no «las mejores talleres». Poner «las mejores» a
       ciegas rompía todos los giros masculinos. */
    plural: c.plural.replace(/^(las|los)\s+/, (a) => `${a.trim()} mejores `),
    singular: c.singular,
    /* Tres funciones, en UNA frase de corrido: un valor de variable de Meta no
       puede llevar saltos de línea (error 132012), así que las viñetas del
       correo no sirven aquí.
       Se toma solo la primera oración de cada función —la del correo trae una
       segunda con el ejemplo, que aquí sobra— y se enlazan con comas y una «y».
       Sin minúscula inicial quedaba «…ya se fueron; La corrida completa», que
       se lee como tres frases cortadas y no como una lista. */
    funciones: (() => {
      const cortas = c.funciones.slice(0, 3)
        .map((f) => f.split('. ')[0].replace(/\.$/, '').trim());
      const [a, ...resto] = cortas;
      const bajas = resto.map((x) => x.charAt(0).toLowerCase() + x.slice(1));
      return `${a}, ${bajas.slice(0, -1).concat(`y ${bajas[bajas.length - 1]}`).join(', ')}.`;
    })(),
    dolor: c.dolorWa,
    solucion: c.solucion,
    pesa: c.pesa,
    suyo: c.suyo,
  }]),
);

const AGENDAR = 'https://www.sacscloud.com/agendar/demo';

/* ── Las tres plantillas ──────────────────────────────────────────────────────
   Los saltos de línea viven AQUÍ, en el texto fijo. Los huecos son frases de
   un solo renglón; si llevaran saltos, Meta rechaza el envío. */

export const ABM_FRIO: PlantillaFria[] = [
  {
    nombre: 'abm_frio_apertura_v1',
    categoria: 'MARKETING',
    idioma: 'es_MX',
    // {{1}} plural del giro · {{2}} la cuenta con su seña · {{3}} singular
    // {{4}} funciones del giro · {{5}} el objeto del negocio
    cuerpo:
`Buen día. Le escribo de Sacs — hacemos software mexicano de inventario y punto de venta para negocios de moda.

Estamos armando el mapa de {{1}} de México y {{2}} salió en la lista. Los encontramos en Google Maps; nadie nos pasó su contacto.

Le escribo porque lo nuestro no es un punto de venta genérico: tenemos una versión hecha para {{3}}. {{4}}

Este mes estamos dando demos gratis por videollamada, 20 minutos y sin compromiso. ¿Le muestro cómo se vería con {{5}} y su forma de trabajar?`,
    botones: [
      { tipo: 'QUICK_REPLY', texto: 'Sí, muéstrenme' },
      { tipo: 'QUICK_REPLY', texto: 'Ahora no' },
    ],
    ejemplos: [
      'las mejores casas de novia',
      'Cielo Inzunza Novias, en Culiacán, con 5.0 estrellas y 22 reseñas',
      'casas de novia',
      'Apartados con la fecha de la boda y sus abonos al día, el muestrario marcado aparte, y las pruebas, el taller y el pedido al proveedor con fecha.',
      'sus modelos',
    ],
  },
  {
    nombre: 'abm_frio_seguimiento_v1',
    categoria: 'MARKETING',
    idioma: 'es_MX',
    // {{1}} singular del giro · {{2}} el dolor · {{3}} singular · {{4}} la
    // SOLUCIÓN, que no es la lista de funciones del paso 1: repetirla era hacer
    // que el segundo mensaje no dijera nada nuevo.
    cuerpo:
`Le escribo una vez más y ya no le insisto más.

Lo que más nos dicen las {{1}} es que {{2}}

Eso es justo lo que resuelve la versión para {{3}}: {{4}}

La demo por videollamada sigue en pie: 20 minutos, gratis y sin compromiso. ¿Le acomoda esta semana o la que entra?`,
    botones: [
      { tipo: 'QUICK_REPLY', texto: 'Esta semana' },
      { tipo: 'QUICK_REPLY', texto: 'Mejor no' },
    ],
    ejemplos: [
      'casas de novia',
      'todo cuelga de una fecha: el vestido que se pide al proveedor, las pruebas, el anticipo y la liquidación. Si una se recorre, se recorren todas.',
      'casas de novia',
      'cada clienta con su fecha, sus abonos y sus pruebas en un solo lugar, y el sistema avisando antes, no cuando ya se pasó.',
    ],
  },
  {
    nombre: 'abm_frio_cierre_v1',
    categoria: 'MARKETING',
    idioma: 'es_MX',
    // {{1}} lo que les pesa hoy
    cuerpo:
`Con este cierro el tema — no quiero ser el que insiste.

Si en alguna temporada les pesa {{1}}, aquí seguimos y con gusto les muestro cómo lo resuelve el sistema. Este número queda abierto.

Gracias por el tiempo y mucho éxito con la temporada.`,
    botones: [{ tipo: 'URL', texto: 'Agendar cuando quiera', url: AGENDAR }],
    ejemplos: ['llevar los apartados, las pruebas y los abonos en libreta'],
  },
];

/* ── EL WHATSAPP DEL ALIADO ───────────────────────────────────────────────────
   Las tres de arriba son de PROSPECTO: «tenemos una versión hecha para casas de
   novia, ¿le muestro una demo?». A un aliado eso no le aplica —no le vendemos
   el sistema, le proponemos que sus clientes lo tengan—, así que lleva sus
   propias tres.

   Y llevan el hueco de la apertura por TIPO, que es la regla del dueño: al
   taller se le habla del pedido sin curva de tallas, al contador de su cierre
   de mes, al de insumos del cliente que le pide de urgencia lo que ya se le
   acabó. Sale del mismo catálogo que los correos (`abm-aliados.ts`), así que
   no hay dos versiones del mismo texto.

   Solo se manda a quien publicó su `wa.me` en su propio sitio (§6 bis). De los
   460 aliados, 122 lo publicaron. */
export const ALIADO_FRIO: PlantillaFria[] = [
  {
    nombre: 'abm_aliado_apertura_v1',
    categoria: 'MARKETING',
    idioma: 'es_MX',
    // {{1}} la cuenta con su seña · {{2}} la apertura de SU tipo · {{3}} qué gana
    cuerpo:
`Buen día. Le escribo de Sacs — hacemos software mexicano de inventario y punto de venta para negocios de moda.

Estamos armando la red de aliados de México y {{1}} salió en la lista. Los encontramos en Google Maps; nadie nos pasó su contacto.

No le escribo para venderle un sistema. Le escribo porque {{2}}, y lo que le propongo es que sus clientes lo tengan: {{3}}

¿Le cuento cómo funciona?`,
    botones: [
      { tipo: 'QUICK_REPLY', texto: 'Sí, cuénteme' },
      { tipo: 'QUICK_REPLY', texto: 'Ahora no' },
    ],
    ejemplos: [
      'Gorras CJ, en León, con 4.8 estrellas y 41 reseñas,',
      'le mandan bordar doscientas piezas sin decirle en qué tallas, y la mitad se queda sin vender',
      'usted nos presenta a su cliente, nosotros hacemos la venta y usted cobra el 40% de esa cuenta mientras siga pagando.',
    ],
  },
  {
    nombre: 'abm_aliado_seguimiento_v1',
    categoria: 'MARKETING',
    idioma: 'es_MX',
    // {{1}} a quién le vende él · {{2}} qué se le rompe a ese cliente
    cuerpo:
`Le escribo una vez más y ya no le insisto.

Usted le vende a {{1}}. Lo que vemos del otro lado es esto: {{2}}

Antes de venderle a nadie le hacemos un diagnóstico gratis: con sus existencias y sus ventas le decimos cuánto dinero trae parado y qué está dejando de vender por faltantes. Si no le sirve, ahí muere, y usted queda como quien le dio algo concreto.

¿Lo probamos con un cliente suyo, el que usted quiera?`,
    botones: [
      { tipo: 'QUICK_REPLY', texto: 'Va, con uno' },
      { tipo: 'QUICK_REPLY', texto: 'Mejor no' },
    ],
    ejemplos: [
      'locatarios y marcas que le mandan a bordar y estampar',
      'le piden 200 piezas sin decirle en qué tallas, y la mitad se queda sin vender',
    ],
  },
  {
    nombre: 'abm_aliado_cierre_v1',
    categoria: 'MARKETING',
    idioma: 'es_MX',
    // {{1}} a quién le vende él
    cuerpo:
`Con este cierro el tema — no quiero ser el que insiste.

Si algún día uno de {{1}} le dice que no sabe qué comprar o que no le cuadra el inventario, acuérdese de este mensaje: el diagnóstico es gratis y la comisión es del 40% mientras esa cuenta pague. Este número queda abierto.

Gracias por el tiempo.`,
    botones: [{ tipo: 'URL', texto: 'Agendar cuando quiera', url: AGENDAR }],
    ejemplos: ['sus clientes'],
  },
];

/** Los huecos del WhatsApp del aliado. Null si la cuenta no tiene tipo: sin
 *  saber a quién le vende, el mensaje no dice nada suyo y no vale mandarlo. */
export function paramsAliado(paso: 1 | 2 | 3, c: any): string[] | null {
  const t = ALIADOS[String(c.subgiro || '')] || tipoPorNombreViejo(c.subgiro);
  if (!t) return null;
  const gana = GANA[t.perfil];
  if (paso === 1) return [senaDeLaCuenta(c), bajar(t.apertura), gana];
  if (paso === 2) return [bajar(t.suGente), bajar(t.dolor)];
  return [bajar(t.suGente)];
}

/** Lo que gana, en una frase de un solo renglón (Meta no acepta saltos). */
const GANA: Record<string, string> = {
  referidor: 'usted nos presenta a su cliente, nosotros hacemos la venta y usted cobra el 40% de esa cuenta mientras siga pagando.',
  consultor: 'usted lo suma a su servicio y cobra comisión por la licencia además de sus propias horas de implementación.',
  orquestador: 'lo certificamos para que usted lo venda y lo opere, y cada tienda que opere le deja ingreso recurrente.',
  tecnologia: 'conectamos lo suyo con nuestra API y nuestro MCP, y usted llega a todas las marcas que operan con Sacs.',
};

const bajar = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** Los subgiros con los que se cargaron los 41 aliados viejos («Escuela»,
 *  «Firma»…) no son la clave del tipo. Sin esto se quedaban sin WhatsApp. */
function tipoPorNombreViejo(subgiro?: string | null): TipoAliado | null {
  const s = String(subgiro || '').trim().toLowerCase();
  if (!s) return null;
  for (const t of Object.values(ALIADOS)) if ((t.ya || []).some((v: string) => v.toLowerCase() === s)) return t;
  return null;
}

/** La seña que hace que el mensaje suene investigado y no masivo.
 *  Se arma con lo MEJOR que tengamos de esa cuenta, en este orden: calificación
 *  con reseñas, número de sucursales, ciudad. Nunca se inventa: si no hay nada,
 *  va solo el nombre, que igual es verdad. */
export function senaDeLaCuenta(c: any): string {
  const partes: string[] = [];
  if (c.ciudad) partes.push(`en ${c.ciudad}`);
  if (c.google_rating && Number(c.google_resenas) >= 5) {
    partes.push(`con ${Number(c.google_rating).toFixed(1)} estrellas y ${c.google_resenas} reseñas`);
  } else if (Number(c.sucursales) > 1 && c.sucursales_confianza !== 'baja') {
    partes.push(`con ${c.sucursales} sucursales`);
  }
  return partes.length ? `${c.nombre}, ${partes.join(', ')},` : String(c.nombre || '');
}

/** Los valores de los huecos, ya listos para `enviarPlantilla`. Devuelve null
 *  cuando el giro no tiene guion en frío escrito: es preferible no mandar nada
 *  a mandar un mensaje genérico que no dice nada de ellos. */
export function paramsFrios(paso: 1 | 2 | 3, c: any): string[] | null {
  const g = GIRO_FRIO[c.giro];
  if (!g) return null;
  if (paso === 1) return [g.plural, senaDeLaCuenta(c), g.singular, g.funciones, g.suyo];
  if (paso === 2) return [g.singular, g.dolor, g.singular, g.solucion];
  return [g.pesa];
}

/** Los giros que hoy se pueden trabajar en frío por WhatsApp. */
export const GIROS_FRIOS = Object.keys(GIRO_FRIO).map((k) => ({ giro: k, nombre: GIROS[k] || k }));
