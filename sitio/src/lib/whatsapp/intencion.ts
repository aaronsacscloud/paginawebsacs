/**
 * De qué CTA vino un WhatsApp entrante.
 *
 * Todos nuestros botones de WhatsApp mandan el mensaje ya escrito (`?text=`).
 * Ese texto es la mejor señal de intención que tenemos: no dice solo "me
 * escribieron", dice EN QUÉ PUNTO del argumento se convencieron. Un lead que
 * llega con "quiero ver el hueco de curva" no es el mismo que llega con "ya lo
 * platicamos internamente" — uno quiere producto y el otro quiere cerrar.
 *
 * Hasta hoy ese texto se guardaba y nadie lo miraba. Peor: si el teléfono ya
 * era un contacto conocido —el caso de TODO lead en Oportunidad— el sistema
 * solo llamaba a marcarRespondio(), que ni siquiera cambia el estatus de
 * alguien en 'cotizado'. El mensaje caía en la bandeja y no pasaba nada.
 *
 * Cómo se reconoce: por una frase distintiva de cada mensaje, no por el texto
 * completo. El lead puede editar antes de enviar —WhatsApp se lo permite— y
 * casi siempre agrega algo al final. Con que sobreviva la frase, se reconoce.
 *
 * Si algún día se cambia el texto de un botón, hay que cambiar su frase aquí.
 * Por eso cada entrada dice de dónde sale.
 */

export interface Intencion {
  /** Identificador estable para etiquetar y medir. */
  clave: string;
  /** De dónde salió, para una persona. */
  fuente: string;
  /** Qué quiere, en una línea que el vendedor pueda leer de reojo. */
  quiere: string;
  /** alta = está pidiendo cerrar o ver algo concreto; media = duda. */
  temperatura: 'alta' | 'media';
  /** Está pidiendo cita: el sistema contesta con horarios reales al momento. */
  agenda?: boolean;
}

interface Regla extends Intencion { frases: string[] }

/** Sin acentos, sin signos y en minúsculas: el lead escribe como quiere. */
const normalizar = (s: string) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const REGLAS: Regla[] = [
  // ── Secuencia "Oportunidad · Moda multitienda" (8 correos) ──
  { clave: 'oportunidad-1-diez-cosas', fuente: 'Correo 1 · Diez cosas que un genérico no hace',
    quiere: 'Preguntar por una de las diez', temperatura: 'media',
    frases: ['diez cosas'] },
  { clave: 'oportunidad-2-siete-preguntas', fuente: 'Correo 2 · Las 7 preguntas',
    quiere: 'Profundizar en una de las siete preguntas', temperatura: 'media',
    frases: ['siete preguntas', '7 preguntas'] },
  { clave: 'oportunidad-3-hueco-curva', fuente: 'Correo 3 · El hueco de curva',
    quiere: 'Probar el motor con un estilo suyo de la temporada pasada', temperatura: 'alta',
    frases: ['hueco de curva'] },
  { clave: 'oportunidad-4-traspasos', fuente: 'Correo 4 · No hay que comprar, hay que mover',
    quiere: 'Ver cómo funcionaría el traspaso entre sus tiendas', temperatura: 'alta',
    frases: ['traspaso entre mis tiendas', 'traspaso entre sus tiendas'] },
  { clave: 'oportunidad-5-catalogo', fuente: 'Correo 5 · Las marcas que ponen el ejemplo',
    quiere: 'Saber qué tan listo está su catálogo', temperatura: 'alta',
    frases: ['listo esta mi catalogo', 'tan listo esta mi catalogo'] },
  { clave: 'oportunidad-6-implementacion', fuente: 'Correo 6 · El caso y la parte fea',
    quiere: 'Preguntar lo incómodo de la implementación', temperatura: 'alta',
    frases: ['sobre la implementacion'] },
  { clave: 'oportunidad-7-probador', fuente: 'Correo 7 · El probador virtual',
    quiere: 'Ver el probador virtual funcionando', temperatura: 'alta',
    frases: ['probador virtual'] },
  { clave: 'oportunidad-8-decision', fuente: 'Correo 8 · La decisión',
    quiere: 'DECIDIR — ya lo platicó internamente', temperatura: 'alta',
    frases: ['ya lo platicamos internamente', 'platicamos internamente'] },

  // ── Secuencia "Prueba gratis · 14 días" ──
  // Las dos de sesión llevan `agenda: true`: al reconocerlas, el sistema
  // contesta con los horarios reales en vez de dejar al lead esperando. Pedir
  // una cita y que nadie conteste hasta mañana es la peor forma de recibir a
  // alguien que YA está usando el producto.
  { clave: 'prueba-sesion-inicio', fuente: 'Prueba · Sesión con Andrea (inicio)',
    quiere: 'Sesión de arranque: revisar sus flujos y por dónde empezar', temperatura: 'alta', agenda: true,
    frases: ['sesion con andrea para revisar mis flujos'] },
  { clave: 'prueba-sesion-mitad', fuente: 'Prueba · Sesión con Andrea (mitad)',
    quiere: 'Revisión de medio camino: va a la mitad de su prueba', temperatura: 'alta', agenda: true,
    frases: ['mitad de mi prueba y quiero agendar'] },
  { clave: 'prueba-descuento', fuente: 'Prueba · 35% en el pago anual',
    quiere: 'PIDE EL DESCUENTO — quiere el 35% anual', temperatura: 'alta',
    frases: ['35% de descuento en el pago anual', '35 de descuento en el pago anual'] },
  { clave: 'prueba-academia-wa', fuente: 'Prueba · La Academia',
    quiere: 'Ayuda para empezar la Academia', temperatura: 'media',
    frases: ['empezar la academia'] },

  // ── CTAs del sitio ──
  { clave: 'sitio-demo-giro', fuente: 'Sitio · Demo desde una página de giro',
    quiere: 'Demo de su vertical (el giro viene en el mensaje)', temperatura: 'alta',
    frases: ['mi giro es'] },
  { clave: 'sitio-demo-boutique', fuente: 'Sitio · Suite de moda',
    quiere: 'Demo para su boutique', temperatura: 'alta',
    frases: ['tengo una boutique y quiero ver sacs'] },
  { clave: 'sitio-modulos', fuente: 'Sitio · Módulos extraordinarios de moda',
    quiere: 'Ver los módulos de pago para su marca', temperatura: 'alta',
    frases: ['modulos extraordinarios'] },
  { clave: 'sitio-demo', fuente: 'Sitio · Agendar demo',
    quiere: 'Agendar una demo', temperatura: 'alta',
    frases: ['agendar una demo en linea'] },
  { clave: 'partners', fuente: 'Portal de partners',
    quiere: 'Pregunta del programa de partners — NO es venta', temperatura: 'media',
    frases: ['programa de partners'] },
];

/**
 * Reconoce de qué CTA vino. Devuelve null si el texto no coincide con ninguno:
 * un lead escribiendo por su cuenta es un caso legítimo y no hay que forzarlo
 * dentro de una etiqueta inventada.
 */
export function intencionDe(texto?: string | null): Intencion | null {
  const t = normalizar(String(texto || ''));
  if (t.length < 8) return null;
  for (const r of REGLAS) {
    if (r.frases.some(f => t.includes(normalizar(f)))) {
      const { frases, ...intencion } = r;
      return intencion;
    }
  }
  return null;
}
