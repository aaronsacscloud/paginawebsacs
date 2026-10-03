/**
 * Automatiza (/producto/<slug> de la sección Automatiza) — 3-oct-2026.
 *
 * Las 7 páginas de Automatiza ya no usan la plantilla de [slug].astro: se cuentan como las de /experiencia
 * (foto editorial a pantalla completa, escenas con el scroll) y el centro es la conversación con AXO en el celular.
 * Todo lo que dicen está verificado contra el código (sacs_api/modules/ai*.js, aiRadar, aiRutinas, aiTareas,
 * aiChatAcciones + aiPolitica, nivelacion*, lib/moda/pronostico.lib.js, config-integraciones). Lo que NO existe
 * (constructor visual de flujos, ruteo entre modelos, API pública con llaves, «+600 apps») no se promete.
 * Datos de ejemplo: Polanco Boutique (demo ficticia), clientas y equipo ficticios; respeta los nombres prohibidos de CLAUDE.md.
 */

export type Estado = 'hoy' | 'tu' | 'servicio';

/** Un mensaje del chat. `k` = en qué paso (tramo) aparece. */
export type Msg =
  | { k: number; tipo: 'yo'; t: string; voz?: string; img?: string }
  | { k: number; tipo: 'axo'; t: string }
  | { k: number; tipo: 'otro'; quien: string; t: string; voz?: string }
  | { k: number; tipo: 'canal'; t: string }
  | { k: number; tipo: 'kpis'; items: [string, string, string?][] }
  | { k: number; tipo: 'barras'; titulo: string; datos: [string, number, string][] }
  | { k: number; tipo: 'prendas'; items: { img: string; t: string; d: string }[] }
  /** confirma: en qué paso la tarjeta pasa a «Confirmado» (sin él se queda por confirmar) */
  | { k: number; tipo: 'accion'; titulo: string; filas: [string, string][]; boton?: string; hecho?: boolean; confirma?: number }
  | { k: number; tipo: 'fotos'; titulo: string; items: { img: string; t: string }[] }
  | { k: number; tipo: 'alerta'; titulo: string; t: string }
  | { k: number; tipo: 'listo'; t: string };

export interface Chat {
  tipo: 'chat';
  id: string;
  folio: [string, string];
  titulo: string;
  foto?: string; // escena de fondo (sin extensión): /images/automatiza/<foto>-1280.webp…
  pantalla: string; // título de la pantalla del celular (#canal o «Tu chat con AXO»)
  sub?: string;
  pasos: { t: string; d: string }[];
  msgs: Msg[];
  /** la cabecera del celular en cada paso (si cambia de canal) */
  cabeceras?: string[];
  /** el especialista y AXO en el mismo canal */
  humano?: string;
}
export interface Lista {
  tipo: 'lista';
  id: string;
  tema: 'claro' | 'marfil' | 'azul' | 'negro';
  folio: [string, string];
  titulo: string;
  bajada?: string;
  estilo?: 'tarjetas' | 'numerada' | 'tablero';
  items: { t: string; d: string; tag?: string; dato?: string; estado?: Estado }[];
  nota?: string;
  cta?: { t: string; href: string };
}
export interface Antes {
  tipo: 'antes';
  id: string;
  folio: [string, string];
  titulo: string;
  antes: { k: string; total: string; pasos: string[] };
  despues: { k: string; total: string; pasos: string[] };
}
export interface Hub {
  tipo: 'hub';
  id: string;
  folio: [string, string];
  titulo: string;
  bajada: string;
  grupos: { t: string; items: { n: string; d: string }[] }[];
}
export interface Pronostico {
  tipo: 'pronostico';
  id: string;
  folio: [string, string];
  titulo: string;
  bajada: string;
  prenda: { img: string; t: string; evento: string };
  tiendas: { n: string; tallas: [string, number, string][] }[];
  total: string;
  notas: string[];
}
export type Seccion = Chat | Lista | Antes | Hub | Pronostico;

export interface PaginaAuto {
  slug: string;
  n: string;
  nombre: string;
  seo: { title: string; description: string };
  hero: { etiqueta: string; titulo: string; bajada: string; foto: string; alt: string; aviso?: string; foco?: string };
  secciones: Seccion[];
  faqs: { question: string; answer: string }[];
}

const P = '/images/automatiza/';
const JEAN = `${P}prenda-jean.webp`, BOTIN = `${P}prenda-botin.webp`, BLAZER = `${P}prenda-blazer.webp`;
const VESTIDO = `${P}prenda-vestido.webp`, BOLSO = `${P}prenda-bolso.webp`, SUETER = `${P}prenda-sueter.webp`;
const V_CEL = `${P}vestido-cel.webp`, V_FONDO = `${P}vestido-fondo.webp`, V_MODELO = `${P}vestido-modelo.webp`, V_DETALLE = `${P}vestido-detalle.webp`;

export const AUTOMATIZA: PaginaAuto[] = [
  // ─────────────────────────────────────────────── 01 · AXO
  {
    slug: 'axo-copiloto-ia',
    n: '01',
    nombre: 'AXO · Copiloto IA',
    seo: {
      title: 'AXO, el copiloto de IA para tiendas de moda | Sacs',
      description: 'Pregúntale a tu tienda en tus palabras o con tu voz: AXO consulta tus ventas, inventario y clientas reales, y prepara apartados, traspasos u órdenes de compra que solo pasan con tu visto bueno.',
    },
    hero: {
      etiqueta: 'AXO · copiloto de IA',
      titulo: 'Pregúntale a tu tienda.',
      bajada: 'AXO vive dentro de Sacs. Le escribes o le hablas, consulta tus ventas, tu inventario y tus clientas reales, y hace el trabajo contigo — siempre con tu visto bueno.',
      foto: 'axo', foco: '55% 70%',
      alt: 'La dueña de una boutique le habla a su celular en el piso de venta, entre racks de sacos y vestidos de seda',
    },
    secciones: [
      {
        tipo: 'chat', id: 'axo-pregunta', foto: 'axo-escena',
        folio: ['01 · Pregúntale', 'Con tus datos reales'],
        titulo: 'La respuesta, con tus números.',
        pantalla: 'Tu chat con AXO', sub: 'Operador de IA',
        pasos: [
          { t: 'Le preguntas como a tu encargada', d: 'Sin reportes ni filtros: «¿cuánto vendí hoy?».' },
          { t: 'Te contesta con la cifra', d: 'Primero el número, después el contexto: contra ayer, por tienda, en tickets.' },
          { t: 'Te enseña qué se vende', d: 'Las prendas con su foto y sus piezas del día.' },
          { t: 'Y te dice qué cuidar', d: 'Si una talla se acaba, te lo dice y te propone qué hacer.' },
        ],
        msgs: [
          { k: 0, tipo: 'yo', t: '¿Cuánto vendí hoy?' },
          { k: 1, tipo: 'axo', t: '<b>$48,320</b> en 37 tickets, 12 % arriba del martes pasado. Polanco Boutique va adelante con $26,910.' },
          { k: 1, tipo: 'kpis', items: [['Venta', '$48,320', '+12 %'], ['Tickets', '37'], ['Ticket prom.', '$1,306']] },
          { k: 2, tipo: 'yo', t: '¿Qué es lo que más se está vendiendo?' },
          { k: 2, tipo: 'prendas', items: [{ img: JEAN, t: 'Jean recto clásico', d: '9 pzs' }, { img: BOTIN, t: 'Botín de gamuza camel', d: '5 pzs' }, { img: BLAZER, t: 'Blazer de lino ivory', d: '4 pzs' }] },
          { k: 3, tipo: 'axo', t: 'Tu caballito de batalla sigue siendo el jean recto. Ojo: en Polanco ya solo quedan <b>2 en talla 28</b> y SMA Centro tiene 6. ¿Te preparo el traspaso?' },
        ],
      },
      {
        tipo: 'chat', id: 'axo-voz', foto: 'axovoz-escena',
        folio: ['02 · Le hablas', 'Y lo hace contigo'],
        titulo: 'Le hablas desde el piso. Nada pasa sin tu sí.',
        pantalla: '#apartados', sub: 'Canal del equipo',
        pasos: [
          { t: 'Una nota de voz', d: 'Con la clienta enfrente, sin soltar la prenda.' },
          { t: 'AXO lo deja listo', d: 'Arma el apartado con prenda, talla, anticipo y vencimiento.' },
          { t: 'Tú confirmas', d: 'Las acciones van en dos pasos y respetan los permisos de cada quien.' },
          { t: 'El equipo se entera', d: 'Queda en #apartados y AXO avisa si se acerca el vencimiento sin abono.' },
        ],
        msgs: [
          { k: 0, tipo: 'yo', voz: '0:07', t: '«Hazle un apartado a Sofía Medina del blazer de lino, talla M, con 500 de anticipo»' },
          { k: 1, tipo: 'accion', titulo: 'Apartado nuevo', filas: [['Clienta', 'Sofía Medina'], ['Prenda', 'Blazer de lino ivory · M'], ['Total', '$2,890'], ['Anticipo', '$500'], ['Vence', '2 nov']], confirma: 2 },
          { k: 2, tipo: 'yo', t: 'Sí, confírmalo' },
          { k: 2, tipo: 'listo', t: 'Apartado AP-1043 creado · saldo $2,390' },
          { k: 3, tipo: 'axo', t: 'Listo. Si llega a 3 días del vencimiento sin abono, te aviso aquí mismo en #apartados.' },
        ],
      },
      {
        tipo: 'chat', id: 'axo-foto', foto: 'axofoto-escena',
        folio: ['03 · Le mandas una foto', 'Y la prenda queda dada de alta'],
        titulo: 'De la foto del celular a la ficha con fotos de catálogo.',
        pantalla: 'Tu chat con AXO', sub: 'Operador de IA',
        pasos: [
          { t: 'Le mandas la foto', d: 'Tal como la tomaste en la bodega, colgada en el gancho.' },
          { t: 'AXO la reconoce', d: 'Qué prenda es, de qué tela y de qué color.' },
          { t: 'Arma sus fotos', d: 'Con GPT Image: fondo liso, en modelo y el detalle de la tela.' },
          { t: 'Te enseña la ficha', d: 'Nombre, precio y tallas, para que la revises.' },
          { t: 'Tú la das de alta', d: 'Con tu sí, queda en tu catálogo con sus fotos.' },
        ],
        msgs: [
          { k: 0, tipo: 'yo', img: V_CEL, t: 'Dale de alta este vestido, a $1,890 en S, M y L' },
          { k: 1, tipo: 'axo', t: 'Es un <b>vestido midi de satén, negro</b>, con escote de caída. Lo dejo en Vestidos.' },
          { k: 2, tipo: 'fotos', titulo: 'Fotos de catálogo', items: [{ img: V_FONDO, t: 'Fondo liso' }, { img: V_MODELO, t: 'En modelo' }, { img: V_DETALLE, t: 'Detalle' }] },
          { k: 3, tipo: 'accion', titulo: 'Producto nuevo', filas: [['Nombre', 'Vestido midi de satén'], ['Color', 'Negro'], ['Precio', '$1,890'], ['Tallas', 'S · M · L']], boton: 'Dar de alta', confirma: 4 },
          { k: 4, tipo: 'yo', t: 'Sí, dale de alta' },
          { k: 4, tipo: 'listo', t: 'Vestido midi de satén creado · con sus 3 fotos' },
        ],
      },
      {
        tipo: 'lista', id: 'axo-hace', tema: 'marfil', estilo: 'tarjetas',
        folio: ['04 · Lo que hace hoy', 'En Sacs, en el celular y en WhatsApp'],
        titulo: 'Un copiloto que ya trabaja.',
        items: [
          { t: 'Preguntas en tus palabras', d: 'Ventas, inventario, clientas y compras, con tarjetas, gráficas y fotos.', estado: 'hoy' },
          { t: 'Voz y viva voz', d: 'Notas de voz que se transcriben, o conversación en tiempo real con el micrófono.', estado: 'hoy' },
          { t: 'Acciones en dos pasos', d: 'Apartados, abonos, traspasos, órdenes de compra en borrador y promociones que nacen pausadas.', estado: 'hoy' },
          { t: 'Canales del equipo', d: '#apartados, #inventario, #clientas, #nivelacion: con @menciones, tareas y tarjetas de acción.', estado: 'hoy' },
          { t: 'Foto → producto', d: 'Le mandas la foto de una prenda y AXO la da de alta con sus fotos de catálogo.', estado: 'hoy' },
          { t: 'Conteo dictado', d: '«590202, tres piezas»: cuenta contigo y te avisa si no cuadra con el sistema.', estado: 'hoy' },
          { t: 'Desde tu WhatsApp', d: 'Registras tu número y le escribes como a cualquier contacto; las acciones se confirman con un «sí».', estado: 'hoy' },
          { t: 'Permisos por rol', d: 'Quién puede pedir qué, qué necesita aprobación y hasta qué monto.', estado: 'tu' },
        ],
      },
      {
        tipo: 'antes', id: 'axo-antes',
        folio: ['05 · Antes y después', 'Una pregunta de las 11 de la noche'],
        titulo: 'De tres pantallas a una pregunta.',
        antes: { k: 'Así era', total: '20 minutos', pasos: ['Abrir el reporte de ventas y filtrar por tienda', 'Cruzarlo con existencias, talla por talla', 'Buscar quién tiene apartado qué', 'Mandar mensajes al equipo para mover la mercancía'] },
        despues: { k: 'Con AXO', total: '30 segundos', pasos: ['Le preguntas en tus palabras o con tu voz', 'Te contesta con la cifra y las prendas', 'Te propone el traspaso y tú confirmas'] },
      },
    ],
    faqs: [
      { question: '¿Con qué datos contesta AXO?', answer: 'Con los de tu cuenta, en vivo: ventas, inventario, clientas, compras y lo platicado en los canales del equipo. Para contestar solo lee; nunca escribe sin una acción confirmada.' },
      { question: '¿Puede mover dinero o mercancía sin que yo lo sepa?', answer: 'No. Las acciones van en dos pasos: AXO prepara una tarjeta con el resumen y solo se ejecuta cuando alguien con permiso confirma. Si nadie confirma, la acción vence a los 10 minutos.' },
      { question: '¿Puedo limitar quién usa AXO y qué puede pedirle?', answer: 'Sí. Hay un permiso «Usar AXO» por grupo de usuarios y una política por cuenta: quién puede pedir cada acción, cuál necesita aprobación de un administrador y topes de monto.' },
      { question: '¿Qué IA usa?', answer: 'El chat y las acciones corren con Claude, de Anthropic. La voz en tiempo real usa OpenAI y las fotos de producto, GPT Image.' },
      { question: '¿Funciona en el celular?', answer: 'Sí: en la app de Sacs para celular, con voz y foto, y también desde tu WhatsApp una vez que registras tu número.' },
      { question: '¿Cuánto cuesta usarlo?', answer: 'AXO consume créditos de IA. En Configuración › Créditos de IA ves tu saldo y tu historial de consumo.' },
    ],
  },

  // ─────────────────────────────────────────────── 02 · Workflows (rutinas y automatizaciones)
  {
    slug: 'workflows',
    n: '02',
    nombre: 'Rutinas y automatizaciones',
    seo: {
      title: 'Rutinas y automatizaciones para tiendas de moda | Sacs',
      description: 'Reportes que llegan solos, tareas que se persiguen solas, recordatorios a tus clientas y procesos que corren de noche. Se lo pides a AXO en una frase y queda programado.',
    },
    hero: {
      etiqueta: 'Rutinas y automatizaciones',
      titulo: 'Lo que se repite, se hace solo.',
      bajada: 'Reportes que llegan a la hora que eliges, tareas que se persiguen solas, recordatorios a tus clientas y procesos que corren de noche. Se lo pides a AXO en una frase y queda programado.',
      foto: 'rutinas', foco: '45% 75%',
      alt: 'La dueña de una boutique lee en su celular el resumen del día antes de abrir, con un espresso en el mostrador',
    },
    secciones: [
      {
        tipo: 'chat', id: 'wf-chat', foto: 'rutinas-escena',
        folio: ['01 · En una frase', 'Rutinas, tareas y boletín'],
        titulo: 'Lo pides una vez. Llega siempre.',
        pantalla: '#general', sub: 'Canal del equipo',
        pasos: [
          { t: 'Lo pides en una frase', d: '«Mándame las ventas por tienda cada lunes a las 8».' },
          { t: 'Ves cómo va a llegar', d: 'La vista previa del reporte, antes de programarlo.' },
          { t: 'Lo programas', d: 'Con tu sí, queda corriendo.' },
          { t: 'Tareas que se persiguen', d: 'AXO le recuerda a tu equipo y te avisa si no se cerró.' },
          { t: 'Y cada mañana, el boletín', d: 'Así cerró ayer, lo cobrado y lo que falta por cobrar.' },
        ],
        msgs: [
          { k: 0, tipo: 'yo', t: '@AXO mándame las ventas por tienda cada lunes a las 8' },
          { k: 1, tipo: 'barras', titulo: 'Vista previa · ventas por tienda', datos: [['Polanco', 26910, '$26,910'], ['SMA Centro', 14200, '$14,200'], ['Querétaro', 7210, '$7,210']] },
          { k: 1, tipo: 'accion', titulo: 'Rutina nueva', filas: [['Reporte', 'Ventas por tienda'], ['Cuándo', 'Lunes · 8:00'], ['Cómo', 'Por correo']], boton: 'Programar', confirma: 2 },
          { k: 2, tipo: 'yo', t: 'Prográmala' },
          { k: 2, tipo: 'listo', t: 'Rutina programada · el lunes te llega la primera' },
          { k: 3, tipo: 'yo', t: '@AXO que Marisol le cobre mañana el saldo a Paulina Arredondo' },
          { k: 3, tipo: 'axo', t: 'Tarea para Marisol: cobrar <b>$1,240</b> a Paulina Arredondo, mañana. Si no la cierra, se la recuerdo y te aviso.' },
          { k: 4, tipo: 'canal', t: 'Al día siguiente · 8:00' },
          { k: 4, tipo: 'axo', t: 'Buenos días. Así cerró ayer: venta <b>$52,180</b> (+8 %) en 41 tickets · cobrado $47,900 · por cobrar $9,320 en 6 apartados.' },
        ],
      },
      {
        tipo: 'lista', id: 'wf-corre', tema: 'marfil', estilo: 'tarjetas',
        folio: ['02 · Lo que ya corre solo', 'Por módulo, sin armar nada'],
        titulo: 'Automatizaciones que ya vienen.',
        bajada: 'No hay que arrastrar cajas: cada módulo trae sus automatizaciones y tú decides cuáles se prenden.',
        items: [
          { tag: 'Clientas', t: 'Embudos de correo', d: 'Se disparan con cliente nuevo, vuelta a stock, inactividad o cumpleaños, y salen solos si la clienta compra.', estado: 'tu' },
          { tag: 'Clientas', t: 'Carrito abandonado en 3 toques', d: 'Recordatorio, cupón y aviso de que el cupón vence.', estado: 'tu' },
          { tag: 'Clientas', t: 'Recordatorios', d: 'Apartados por vencer, puntos que caducan, tarjetas de regalo por expirar, membresías por renovar.', estado: 'tu' },
          { tag: 'Inventario', t: 'Mínimos y máximos automáticos', d: 'Se recalculan cada noche con lo que de verdad vendes.', estado: 'tu' },
          { tag: 'Inventario', t: 'Nivelación programada', d: 'Cada N días, con aprobación automática solo dentro de los candados que pones.', estado: 'tu' },
          { tag: 'Estudio', t: 'Publicación autónoma', d: 'Publica solo las prendas que pasan calidad de foto, color, costo y taxonomía.', estado: 'tu' },
          { tag: 'Equipo', t: '3 jugadas de la semana', d: 'Cada lunes: qué cobrar, qué reponer y qué precios venden con pérdida.', estado: 'hoy' },
          { tag: 'Equipo', t: 'Pase de turno', d: 'Al cerrar el corte, lo pendiente pasa al siguiente turno.', estado: 'tu' },
        ],
      },
      {
        tipo: 'antes', id: 'wf-antes',
        folio: ['03 · Antes y después', 'El lunes por la mañana'],
        titulo: 'El reporte ya está en tu correo.',
        antes: { k: 'Así era', total: 'Cada lunes', pasos: ['Pedir el reporte de la semana', 'Recordarle a cada quien lo que le toca', 'Revisar a mano qué apartados vencen', 'Acordarte de avisarle a la clienta'] },
        despues: { k: 'Con rutinas', total: 'Una vez', pasos: ['Le pides el reporte a AXO y lo programas', 'Las tareas se recuerdan solas', 'Los recordatorios salen con cada evento'] },
      },
    ],
    faqs: [
      { question: '¿Tiene un constructor de flujos para arrastrar cajas?', answer: 'No como tal. Las automatizaciones vienen listas por módulo (clientas, inventario, Estudio, equipo) y las rutinas, radares y tareas se las pides a AXO en una frase. Si necesitas algo a la medida, tu especialista lo arma contigo.' },
      { question: '¿Cuántas rutinas puedo tener?', answer: 'Los reportes programados al canal son hasta 5 activos por cuenta; las rutinas por correo se programan con vista previa antes de activarlas.' },
      { question: '¿Qué pasa si una tarea no se cumple?', answer: 'AXO la persigue: le recuerda a la persona y, si no se cierra, te avisa a ti.' },
      { question: '¿Las automatizaciones de inventario mueven mercancía solas?', answer: 'Solo si tú lo configuras y dentro de los candados que pongas (origen, monto, confianza). Lo normal es que propongan y tú apruebes.' },
      { question: '¿El boletín de la mañana usa IA?', answer: 'No hace falta: son tus números de ayer, con plantilla. La cuenta lo activa y llega a #general.' },
    ],
  },

  // ─────────────────────────────────────────────── 03 · Alertas
  {
    slug: 'alertas-inteligentes',
    n: '03',
    nombre: 'Alertas de quiebre y estancados',
    seo: {
      title: 'Alertas de quiebre de talla y mercancía estancada | Sacs',
      description: 'Le dices a AXO qué vigilar y lo revisa cada hora: una talla que se acaba, un ticket fuera de lo normal, una tienda que no despega. Y cada mañana el Tablero de moda te dice dónde está la curva rota y la mercancía parada.',
    },
    hero: {
      etiqueta: 'Alertas de quiebre y estancados',
      titulo: 'Te avisa antes de que se rompa la talla.',
      bajada: 'Le dices a AXO qué vigilar y lo revisa cada hora. Y cada mañana el Tablero de moda te dice dónde está la curva rota, qué básico se acaba y qué mercancía está parada.',
      foto: 'radar', foco: '40% 78%',
      alt: 'La gerente de una boutique mira una alerta en su celular junto a un anaquel de jeans con una talla casi agotada',
    },
    secciones: [
      {
        tipo: 'chat', id: 'al-radar', foto: 'radar-escena',
        folio: ['01 · El radar', 'Lo que tú le pides vigilar'],
        titulo: '«Avísame si…»',
        pantalla: '#inventario', sub: 'Canal del equipo',
        pasos: [
          { t: 'Le dices qué vigilar', d: 'En tus palabras: una talla, un ticket, una tienda.' },
          { t: 'Te muestra el radar', d: 'Qué vigila, cada cuándo y dónde avisa.' },
          { t: 'Lo enciendes', d: 'Con tu sí, lo revisa cada hora y al corte.' },
          { t: 'El aviso llega solo', d: 'En el canal, con la campana, cuando pasa.' },
          { t: 'Y propone qué hacer', d: 'El traspaso listo para que solo confirmes.' },
          { t: 'Tú lo mandas', d: 'Con tu sí, el traspaso queda por enviar.' },
        ],
        msgs: [
          { k: 0, tipo: 'yo', t: '@AXO avísame si se acaba la talla 28 del jean recto en cualquier tienda' },
          { k: 1, tipo: 'accion', titulo: 'Radar nuevo', filas: [['Vigila', 'Jean recto clásico · 28'], ['Cuándo', 'Cada hora y al corte'], ['Aviso', '#inventario']], boton: 'Encender', confirma: 2 },
          { k: 2, tipo: 'yo', t: 'Sí, enciéndelo' },
          { k: 2, tipo: 'listo', t: 'Radar encendido' },
          { k: 3, tipo: 'canal', t: 'Jueves · 17:40' },
          { k: 3, tipo: 'alerta', titulo: 'Radar · Jean recto 28', t: 'Quedan <b>2 piezas</b> en Polanco Boutique. SMA Centro tiene 6.' },
          { k: 4, tipo: 'axo', t: '¿Te preparo un traspaso de 4 piezas desde SMA Centro? Llega antes del fin de semana.' },
          { k: 4, tipo: 'accion', titulo: 'Traspaso', filas: [['De', 'SMA Centro'], ['A', 'Polanco Boutique'], ['Jean recto · 28', '4 pzs']], boton: 'Mandar', confirma: 5 },
          { k: 5, tipo: 'yo', t: 'Sí, mándalo' },
          { k: 5, tipo: 'listo', t: 'Traspaso TR-2207 creado · por enviar' },
        ],
      },
      {
        tipo: 'lista', id: 'al-tablero', tema: 'negro', estilo: 'tablero',
        folio: ['02 · Cada mañana', 'El Tablero de moda'],
        titulo: 'Lo importante de hoy, ya ordenado.',
        bajada: 'Cada noche Sacs revisa tu inventario por modelo, color y talla, y en la mañana te deja las tarjetas que importan, ordenadas por fecha límite y por dinero. Cada una abre la nivelación ya llena.',
        items: [
          { tag: 'Curva rota', t: 'Jean recto clásico · Índigo', d: 'Sin 28 ni 30 en Polanco: las tallas que más vendes.', dato: '−2 tallas núcleo' },
          { tag: 'Quiebre de básicos', t: 'Camiseta de algodón · Blanco', d: 'Se acaba en 6 días al ritmo de esta semana.', dato: '6 días' },
          { tag: 'Mercancía parada', t: 'Botín de gamuza · Querétaro', d: 'Lleva 45 días sin venderse ahí y en Polanco se agota.', dato: '$38,400' },
          { tag: 'Traspaso urgente', t: 'Vestido de satén negro · S', d: 'Hay 4 en SMA Centro y 0 en Polanco antes del evento.', dato: 'Antes del viernes' },
        ],
        nota: 'Y si lo prendes, a las 7:00 te llega por correo: «Anoche revisé tu inventario; lo importante de hoy… nada se mueve sin ti».',
      },
      {
        tipo: 'lista', id: 'al-tipos', tema: 'marfil', estilo: 'tarjetas',
        folio: ['03 · Qué puede vigilar', 'Radares que pides en una frase'],
        titulo: 'Tú eliges qué te quita el sueño.',
        items: [
          { t: 'Una prenda que se acaba', d: '«Avísame si quedan menos de 3 del botín camel».', estado: 'hoy' },
          { t: 'Tu top que se agota', d: 'Cuando uno de tus más vendidos se queda sin piezas.', estado: 'hoy' },
          { t: 'Ventas a ritmo bajo', d: 'Si una tienda va por debajo de su ritmo a media tarde.', estado: 'hoy' },
          { t: 'Un ticket fuera de lo normal', d: '«Avísame si un ticket pasa de $10,000».', estado: 'hoy' },
          { t: 'Descuentos de más', d: 'Cuando alguien aplica un descuento mayor al que pusiste.', estado: 'hoy' },
          { t: 'Lo que quieras, en tus palabras', d: 'Una condición libre que AXO revisa al corte.', estado: 'hoy' },
        ],
      },
    ],
    faqs: [
      { question: '¿Las alertas aprenden solas qué es «normal»?', answer: 'No adivinan umbrales por su cuenta: el radar vigila lo que tú le pides y el Tablero de moda aplica sus reglas por modelo, color y talla (curva rota, quiebre de básicos, mercancía parada).' },
      { question: '¿Cada cuánto revisa?', answer: 'Los radares se revisan cada hora y al corte; el Tablero se recalcula cada noche.' },
      { question: '¿Por dónde me llega el aviso?', answer: 'En el canal del equipo con la campana de Sacs. El briefing de las 7:00 llega por correo si lo activas.' },
      { question: '¿Mueve la mercancía solo?', answer: 'No. AXO te propone el traspaso como tarjeta y solo pasa cuando alguien con permiso confirma.' },
      { question: '¿Necesito la Suite de Moda?', answer: 'El Tablero de moda (curvas por talla, básicos, mercancía parada) es parte de la nivelación de moda. Los radares de AXO funcionan en cualquier cuenta con AXO.' },
    ],
  },

  // ─────────────────────────────────────────────── 04 · Forecast
  {
    slug: 'reportes-predictivos',
    n: '04',
    nombre: 'Forecast de demanda',
    seo: {
      title: 'Forecast de demanda por talla y tienda para moda | Sacs',
      description: 'Demand Planning pronostica cada modelo con tus temporadas reales: la base del año pasado alineada por evento, la tendencia reciente, los modelos nuevos por sus parecidos y la curva de tallas de cada zona. AXO te explica cada número.',
    },
    hero: {
      etiqueta: 'Forecast de demanda',
      titulo: 'Cuánto vas a vender. Por talla y por tienda.',
      bajada: 'Demand Planning pronostica cada modelo con tus temporadas reales y la curva de tallas de cada zona. Y AXO te explica cada número, en tus palabras.',
      foto: 'forecast', foco: '55% 75%',
      alt: 'La compradora de una marca de moda revisa gráficas de demanda junto a un rack de muestras de la próxima temporada',
    },
    secciones: [
      {
        tipo: 'pronostico', id: 'fc-pronostico',
        folio: ['01 · El pronóstico', 'Demand Planning'],
        titulo: 'Cada modelo, por talla y por tienda.',
        bajada: 'Así se ve el pronóstico de una prenda para un evento: cuántas piezas por talla en cada tienda y el rango en el que probablemente vas a vender.',
        prenda: { img: VESTIDO, t: 'Vestido midi de satén · Negro', evento: 'Buen Fin' },
        tiendas: [
          { n: 'Polanco Boutique', tallas: [['S', 18, '14–23'], ['M', 42, '35–51'], ['L', 21, '16–27']] },
          { n: 'SMA Centro', tallas: [['S', 11, '8–15'], ['M', 26, '21–32'], ['L', 14, '10–18']] },
          { n: 'Querétaro', tallas: [['S', 9, '6–12'], ['M', 19, '15–24'], ['L', 26, '20–33']] },
        ],
        total: '186 pzs · rango probable 152–221',
        notas: ['Base: Buen Fin del año pasado, día contra día', 'Tendencia de las últimas 8 semanas', 'Querétaro compra más L: su curva es otra'],
      },
      {
        tipo: 'chat', id: 'fc-chat', foto: 'forecast-escena',
        folio: ['02 · Y AXO te lo explica', 'En #nivelacion'],
        titulo: 'Cada número, con su explicación.',
        pantalla: '#nivelacion', sub: 'Canal del equipo',
        pasos: [
          { t: '¿Por qué así?', d: 'Le preguntas por una tienda o una talla.' },
          { t: 'Te lo narra', d: 'La curva de la zona, lo que hay en piso y la regla de red.' },
          { t: 'Te enseña el plan', d: 'Qué traspasos y qué compras propone la corrida.' },
          { t: 'Tú decides', d: 'Apruebas todo, o todo menos lo que no te convence.' },
        ],
        msgs: [
          { k: 0, tipo: 'yo', t: '¿Por qué Querétaro recibe más L del vestido de satén?' },
          { k: 1, tipo: 'axo', t: 'Porque allá la L es talla núcleo: el pronóstico pide <b>26 L</b> para Buen Fin y hay 12 en piso. La regla de red le manda 14 desde el CEDIS.' },
          { k: 2, tipo: 'yo', t: '¿Qué propone la corrida de hoy?' },
          { k: 2, tipo: 'barras', titulo: 'Corrida de hoy · piezas', datos: [['Traspasos', 46, '46 pzs · 14 mov.'], ['Del CEDIS', 30, '30 pzs · 6 envíos'], ['Compra', 120, '120 pzs · 2 OC']] },
          { k: 3, tipo: 'yo', t: 'Apruébala, menos la compra de botines' },
          { k: 3, tipo: 'listo', t: 'Aprobada sin la compra de botines · traspasos por enviar' },
        ],
      },
      {
        tipo: 'lista', id: 'fc-motor', tema: 'azul', estilo: 'numerada',
        folio: ['03 · El motor', 'Cómo se calcula'],
        titulo: 'Un pronóstico hecho para moda.',
        items: [
          { t: 'La base, alineada por evento', d: 'Las mismas fechas del año pasado, emparejadas por evento: Buen Fin contra Buen Fin, domingo contra domingo.' },
          { t: 'La tendencia, con freno', d: 'Tus últimas 8 semanas contra las mismas del año anterior, acotada para que una semana rara no dispare la compra.' },
          { t: 'Los modelos nuevos, por sus parecidos', d: 'Una prenda sin historia se pronostica con las de su familia que sí la tienen.' },
          { t: 'Por tienda y por talla', d: 'Cada tienda con la curva de su zona: unas compran más L, otras más M.' },
          { t: 'Con su rango', d: 'Un rango probable al 80 % y el dinero sin IVA, para comprar con margen de error a la vista.' },
        ],
        cta: { t: 'Ve una temporada completa en Planeación de demanda', href: '/planeacion-de-demanda' },
      },
      {
        tipo: 'antes', id: 'fc-antes',
        folio: ['04 · Antes y después', 'La compra de temporada'],
        titulo: 'De la corazonada al plan.',
        antes: { k: 'Así era', total: 'A ojo', pasos: ['Repetir lo que se compró el año pasado', 'La misma curva de tallas para todas las tiendas', 'Enterarte del quiebre cuando ya pasó'] },
        despues: { k: 'Con Demand Planning', total: 'Por talla', pasos: ['Pronóstico por modelo, tienda y talla', 'Compra por proveedor contra tu presupuesto', 'Al cierre, «¿le atinamos?» con su exactitud'] },
      },
    ],
    faqs: [
      { question: '¿Qué es Demand Planning?', answer: 'El módulo de planeación de la Suite de Moda: gestor de reglas, forecasting en 5 pasos (alcance, presupuesto, pronóstico, compra por proveedor y reparto) y temporadas con su resultado.' },
      { question: '¿AXO calcula el pronóstico?', answer: 'No: lo calcula el motor de Demand Planning. AXO lo consulta y te lo explica, y te ayuda a ajustar reglas y decidir líneas de la corrida.' },
      { question: '¿Y si una prenda es nueva?', answer: 'Se pronostica con sus parecidos de la misma familia que sí tienen historia.' },
      { question: '¿Se compra solo?', answer: 'No. Al aprobar el plan se crean órdenes de compra en borrador y se programa el primer reparto; la aprobación se puede deshacer.' },
      { question: '¿Cómo sé si le atinó?', answer: 'Al cerrar la temporada, la pantalla de Resultado compara lo pronosticado contra lo vendido y te dice qué mejorar.' },
    ],
  },

  // ─────────────────────────────────────────────── 05 · Orquestador
  {
    slug: 'orquestador-de-agentes',
    n: '05',
    nombre: 'Orquestador de agentes',
    seo: {
      title: 'Agentes de IA en los canales de tu tienda | Sacs',
      description: 'AXO trabaja en cada canal de tu equipo con su propio enfoque, recuerda lo acordado, hace análisis largos en segundo plano y usa el modelo de IA que mejor hace cada tarea: chat, voz, fotos y video.',
    },
    hero: {
      etiqueta: 'Orquestador de agentes',
      titulo: 'AXO en cada canal de tu tienda.',
      bajada: 'AXO trabaja en #apartados, #inventario, #clientas y #nivelacion con el enfoque de cada canal, recuerda lo que el equipo acordó, se queda trabajando en los análisis largos y te pasa con una persona cuando hace falta.',
      foto: 'agentes', foco: '45% 72%',
      alt: 'El equipo de una boutique de lujo trabaja en caja, bodega y probadores, cada quien con su celular o tablet',
    },
    secciones: [
      {
        tipo: 'chat', id: 'ag-chat', foto: 'agentes-escena',
        folio: ['01 · Los canales', 'Un agente por tema'],
        titulo: 'Cada canal sabe de lo suyo.',
        pantalla: 'Canales', sub: 'Polanco Boutique', cabeceras: ['#inventario', '#clientas', '#general', '#general', '#general'],
        pasos: [
          { t: '#inventario', d: 'Sabe que disponible es existencia menos apartados.' },
          { t: '#clientas', d: 'Recuerda lo que el equipo anotó de cada clienta.' },
          { t: 'Le pides algo largo', d: 'Se queda trabajando en segundo plano.' },
          { t: 'Te lo entrega', d: 'El resultado llega al canal cuando está listo.' },
          { t: 'Y una persona', d: 'Si el caso es para soporte, lo escala con el equipo de Sacs.' },
        ],
        msgs: [
          { k: 0, tipo: 'canal', t: '#inventario' },
          { k: 0, tipo: 'otro', quien: 'Marisol', t: '@AXO ¿cuánto hay disponible del vestido de satén negro en S?' },
          { k: 0, tipo: 'axo', t: '<b>Disponibles: 3</b> — hay 5 en existencia y 2 están apartados.' },
          { k: 1, tipo: 'canal', t: '#clientas' },
          { k: 1, tipo: 'otro', quien: 'Fernanda', t: '@AXO ¿qué quedamos con Renata Villaseñor?' },
          { k: 1, tipo: 'axo', t: 'El 12 de septiembre anotaste que quiere aviso de la colección de lino, talla M. Ya llegó: hay 3 en su talla.' },
          { k: 2, tipo: 'canal', t: '#general' },
          { k: 2, tipo: 'yo', t: '@AXO prepárame la junta con Textiles Aurora' },
          { k: 2, tipo: 'axo', t: 'Me quedo trabajando en esto: compras, precios, margen y lo platicado con ellos. Te lo dejo aquí en unos minutos.' },
          { k: 3, tipo: 'canal', t: '20 minutos después' },
          { k: 3, tipo: 'accion', titulo: 'Dossier · Textiles Aurora', filas: [['Compras del año', '$412,800'], ['Precio promedio', '+6 % vs. 2025'], ['Margen', '58 % · arriba de tu media'], ['Entregas', '3 tarde en agosto']], boton: 'Abrir dossier', hecho: true },
          { k: 4, tipo: 'otro', quien: 'Marisol', t: '@AXO no me deja timbrar la factura de ayer, marca error del SAT' },
          { k: 4, tipo: 'axo', t: 'Eso necesita revisar tu configuración fiscal: ya lo escalé con una persona de soporte de Sacs y te aviso aquí.' },
        ],
      },
      {
        tipo: 'lista', id: 'ag-modelos', tema: 'negro', estilo: 'numerada',
        folio: ['02 · Cada tarea, su modelo', 'Sin casarse con una sola IA'],
        titulo: 'La IA que mejor hace cada cosa.',
        items: [
          { t: 'Chat y acciones', d: 'Claude, de Anthropic: entiende la pregunta, consulta tus datos y prepara las acciones.', dato: 'Claude' },
          { t: 'Voz en tiempo real', d: 'OpenAI Realtime: conversas con AXO y él le pasa los datos al chat.', dato: 'OpenAI' },
          { t: 'Notas de voz', d: 'Whisper transcribe lo que dictas en el canal.', dato: 'Whisper' },
          { t: 'Fotos de producto y en modelo', d: 'GPT Image arma tus fotos de catálogo desde la foto de la prenda.', dato: 'GPT Image' },
          { t: 'Video', d: 'Veo, de Google, para el contenido de redes del Estudio.', dato: 'Veo' },
        ],
        nota: 'Cada función usa su modelo; no hay una cadena de modelos discutiendo cada pregunta. Lo que sí hay: un agente por canal, memoria del equipo y trabajo en segundo plano.',
      },
      {
        tipo: 'lista', id: 'ag-seguro', tema: 'marfil', estilo: 'tarjetas',
        folio: ['03 · Con candados', 'La IA consulta; tú decides'],
        titulo: 'Agentes que no se mandan solos.',
        items: [
          { t: 'Leer no es escribir', d: 'Para contestar, AXO solo consulta: no puede borrar ni editar desde una pregunta.', estado: 'hoy' },
          { t: 'Acciones en dos pasos', d: 'Prepara, tú confirmas; si nadie confirma, vence en 10 minutos.', estado: 'hoy' },
          { t: 'Política por cuenta', d: 'Quién puede pedir qué, qué necesita aprobación y topes de monto.', estado: 'tu' },
          { t: 'Memoria del equipo', d: 'Cada madrugada guarda lo acordado en los canales; nunca lee chats privados.', estado: 'hoy' },
        ],
      },
    ],
    faqs: [
      { question: '¿Son varios agentes o uno?', answer: 'AXO trabaja en cada canal del equipo con un enfoque distinto (#apartados, #inventario, #clientas, #nivelacion) y puede quedarse haciendo un trabajo largo en segundo plano. Cada función usa el modelo de IA que mejor la hace.' },
      { question: '¿Puedo elegir ChatGPT, Gemini o Claude para mi chat?', answer: 'El chat de AXO corre con Claude. La voz usa OpenAI, las fotos GPT Image y el video Veo. No hay un selector por pregunta.' },
      { question: '¿Qué es el trabajo profundo?', answer: 'Un análisis largo que AXO hace en segundo plano, con varios pasos y un presupuesto, y que te entrega en el canal. Nunca aplica cambios: los propone.' },
      { question: '¿Lee las conversaciones privadas?', answer: 'No. La memoria y la búsqueda solo usan los canales del equipo, nunca los chats 1 a 1.' },
      { question: '¿Y si AXO no puede resolverlo?', answer: 'Escala el caso a una persona del equipo de soporte de Sacs y te avisa en el canal.' },
    ],
  },

  // ─────────────────────────────────────────────── 06 · API e integraciones
  {
    slug: 'api-e-integraciones',
    n: '06',
    nombre: 'Integraciones',
    seo: {
      title: 'Integraciones con Shopify, Mercado Pago y más para moda | Sacs',
      description: 'Shopify, WooCommerce, Tienda Nube y TikTok Shop sincronizan productos, inventario, clientes y pedidos; Stripe y Mercado Pago cobran, hasta con terminal física; Envia.com envía; y tu catálogo sale por feed a Meta y TikTok.',
    },
    hero: {
      etiqueta: 'Integraciones',
      titulo: 'Conectado con lo que ya usas.',
      bajada: 'Tu tienda en línea, tus cobros, tus envíos y tus redes, hablando con el mismo inventario. Lo conectas en Configuración › Integraciones y se sincroniza solo.',
      foto: 'api', foco: '50% 75%',
      alt: 'El encargado técnico y la dueña de una boutique revisan una laptop junto a un carrito con paquetes de pedidos en línea',
    },
    secciones: [
      {
        tipo: 'hub', id: 'api-hub',
        folio: ['01 · Un solo inventario', 'Lo que se conecta hoy'],
        titulo: 'Todo pasa por Sacs.',
        bajada: 'Cada conexión lee y escribe sobre el mismo catálogo e inventario: lo que vendes en un canal se descuenta en todos.',
        grupos: [
          { t: 'Tiendas en línea', items: [{ n: 'Shopify', d: 'Productos, inventario, clientes y pedidos, en ambos sentidos' }, { n: 'WooCommerce', d: 'Igual que Shopify' }, { n: 'Tienda Nube', d: 'Pedidos y catálogo' }, { n: 'TikTok Shop', d: 'Catálogo y pedidos' }] },
          { t: 'Cobros', items: [{ n: 'Stripe', d: 'Pagos en línea' }, { n: 'Mercado Pago', d: 'En línea y con terminal física en caja' }] },
          { t: 'Envíos', items: [{ n: 'Envia.com', d: 'Guías y seguimiento' }] },
          { t: 'Redes', items: [{ n: 'Meta', d: 'Feed de catálogo para Facebook, Instagram y WhatsApp' }, { n: 'TikTok', d: 'Feed de catálogo' }] },
          { t: 'Avisos', items: [{ n: 'WhatsApp', d: 'Notificaciones con plantillas aprobadas por Meta' }, { n: 'Correo', d: 'Campañas y avisos' }] },
          { t: 'Bancos', items: [{ n: 'Cuentas bancarias', d: 'Movimientos para conciliar' }] },
        ],
      },
      {
        tipo: 'chat', id: 'api-chat', foto: 'apichat-escena',
        folio: ['02 · Y AXO lo ve todo', 'Los canales, en una pregunta'],
        titulo: 'Lo que entra por cada canal, en una pregunta.',
        pantalla: 'Tu chat con AXO', sub: 'Operador de IA',
        pasos: [
          { t: 'Le preguntas por un canal', d: 'Shopify, la tienda física o TikTok: todo es el mismo inventario.' },
          { t: 'Te contesta con la cifra', d: 'Pedidos, monto y lo que ya salió.' },
          { t: 'Y lo compara', d: 'Cada canal contra los demás, en una gráfica.' },
          { t: 'Con el mismo inventario', d: 'Lo que se vende en un canal y falta en una tienda, se mueve.' },
        ],
        msgs: [
          { k: 0, tipo: 'yo', t: '¿Cuánto entró hoy por la tienda en línea?' },
          { k: 1, tipo: 'axo', t: '<b>14 pedidos</b> por $21,380 desde tu tienda en Shopify. Ya están en Pedidos con su inventario descontado.' },
          { k: 2, tipo: 'barras', titulo: 'Venta de hoy por canal', datos: [['Tiendas', 48320, '$48,320'], ['Shopify', 21380, '$21,380'], ['TikTok Shop', 6240, '$6,240']] },
          { k: 3, tipo: 'yo', t: '¿Qué se vendió en TikTok Shop que ya no tengo en Polanco?' },
          { k: 3, tipo: 'prendas', items: [{ img: BOLSO, t: 'Bolso de piel cognac', d: '0 en Polanco' }, { img: SUETER, t: 'Suéter de cashmere', d: '0 en Polanco' }] },
          { k: 3, tipo: 'axo', t: 'SMA Centro tiene 4 bolsos y 5 suéteres. ¿Te paso unos a Polanco?' },
          { k: 3, tipo: 'accion', titulo: 'Traspaso', filas: [['De', 'SMA Centro'], ['A', 'Polanco Boutique'], ['Bolso cognac', '2 pzs'], ['Suéter cashmere', '3 pzs']] },
        ],
      },
    ],
    faqs: [
      { question: '¿Tienen una API pública?', answer: 'Hoy no publicamos una API abierta con llaves para terceros. Si necesitas conectar un sistema propio, lo vemos contigo y con tu especialista.' },
      { question: '¿Shopify se sincroniza en los dos sentidos?', answer: 'Sí: productos e inventario de Sacs a Shopify, y pedidos y clientes de Shopify a Sacs, sobre el mismo inventario.' },
      { question: '¿Puedo cobrar con terminal de Mercado Pago en caja?', answer: 'Sí, con Mercado Pago Point desde el punto de venta.' },
      { question: '¿Mi catálogo llega a Instagram y TikTok?', answer: 'Sí, por feed de catálogo: Meta (Facebook, Instagram, WhatsApp) y TikTok leen tu catálogo de Sacs y se actualizan solos.' },
      { question: '¿Y los marketplaces?', answer: 'Los marketplaces se conectan con acompañamiento: lo platicas con un asesor desde Canales de venta.' },
    ],
  },

  // ─────────────────────────────────────────────── 07 · Especialista
  {
    slug: 'especialista-ia',
    n: '07',
    nombre: 'Especialista IA dedicado',
    seo: {
      title: 'Especialista en IA dedicado para tu tienda de moda | Sacs',
      description: 'Con el plan Automatiza, una persona de Sacs entiende tu operación, configura las rutinas, radares y permisos de AXO, entrena a tu equipo y se sienta contigo cada mes a ver qué más automatizar.',
    },
    hero: {
      etiqueta: 'Especialista IA dedicado',
      titulo: 'Una persona que pone a AXO a trabajar contigo.',
      bajada: 'Con el plan Automatiza tienes un especialista de Sacs que entiende tu operación, configura tus rutinas, radares y permisos, entrena a tu equipo y se sienta contigo cada mes a ver qué más automatizar.',
      foto: 'especialista', foco: '50% 78%',
      alt: 'Un especialista de Sacs trabaja con la dueña de una boutique frente a una laptop en la oficina de la tienda',
    },
    secciones: [
      {
        tipo: 'chat', id: 'es-chat', foto: 'especialista-escena',
        folio: ['01 · Contigo, en tu canal', 'El especialista y AXO'],
        titulo: 'Lo arma contigo, en tu propio Sacs.',
        pantalla: '#general', sub: 'Polanco Boutique', humano: 'Daniel · Especialista Sacs',
        pasos: [
          { t: 'Entiende tu operación', d: 'Revisa tus tiendas, tus apartados y dónde se rompe la talla.' },
          { t: 'Configura a AXO', d: 'Radares, rutinas y canales hechos para tu tienda.' },
          { t: 'Tú lo enciendes', d: 'Nada se activa sin tu sí.' },
          { t: 'Pone los candados', d: 'Quién puede pedir qué y hasta qué monto.' },
          { t: 'Cada mes, la siguiente', d: 'Una sesión para ver qué más automatizar.' },
        ],
        msgs: [
          { k: 0, tipo: 'otro', quien: 'Daniel · Especialista Sacs', t: 'Revisé tus 3 tiendas: los apartados son tu fuerte y el jean en 28 se te rompe cada mes en Polanco.' },
          { k: 1, tipo: 'otro', quien: 'Daniel · Especialista Sacs', t: '@AXO crea un radar: avísale a la dueña si cualquier talla del jean recto queda en 2 piezas' },
          { k: 1, tipo: 'accion', titulo: 'Radar nuevo', filas: [['Vigila', 'Jean recto · todas las tallas'], ['Avisa', 'Con 2 piezas o menos'], ['Aviso', 'A ti, en #inventario']], boton: 'Encender', confirma: 2 },
          { k: 2, tipo: 'yo', t: 'Sí, enciéndelo' },
          { k: 2, tipo: 'listo', t: 'Radar encendido' },
          { k: 3, tipo: 'otro', quien: 'Daniel · Especialista Sacs', t: 'Te dejo los permisos por rol; revísalos y guárdalos:' },
          { k: 3, tipo: 'accion', titulo: 'Permisos de AXO', filas: [['Vendedoras', 'Apartados y abonos'], ['Gerentes', 'Traspasos'], ['Compras', 'OC en borrador'], ['Tope', '$20,000 sin aprobación']], boton: 'Guardar', confirma: 4 },
          { k: 4, tipo: 'yo', t: 'Guardados. ¿Qué sigue?' },
          { k: 4, tipo: 'otro', quien: 'Daniel · Especialista Sacs', t: 'Para este mes: la rutina de ventas por tienda los lunes y el briefing de las 7:00 para ti. ¿Lo vemos el jueves?' },
        ],
      },
      {
        tipo: 'lista', id: 'es-como', tema: 'azul', estilo: 'numerada',
        folio: ['02 · Cómo trabajamos', 'Incluido en el plan Automatiza'],
        titulo: 'De la primera semana en adelante.',
        items: [
          { t: 'Semana 1 · Tu operación', d: 'Tiendas, equipo, apartados, compras y dónde se te va el dinero o la talla.' },
          { t: 'Semanas 2 y 3 · AXO a tu medida', d: 'Canales del equipo, radares, rutinas, recordatorios y la publicación del Estudio.' },
          { t: 'Permisos y candados', d: 'La política de AXO por rol: quién pide, quién aprueba y hasta qué monto.' },
          { t: 'Tu equipo, entrenado', d: 'Cada rol aprende a pedirle a AXO lo suyo: caja, piso, bodega y compras.' },
          { t: 'Cada mes, una sesión', d: 'Qué funcionó, qué no y la siguiente automatización.' },
        ],
      },
      {
        tipo: 'antes', id: 'es-antes',
        folio: ['03 · Antes y después', 'Tener IA no es usarla'],
        titulo: 'De «lo vemos luego» a «ya está corriendo».',
        antes: { k: 'Solo', total: 'Algún día', pasos: ['Descubrir qué hace la IA por tu cuenta', 'Configurar sin saber qué conviene', 'Que el equipo no la use'] },
        despues: { k: 'Con tu especialista', total: 'En semanas', pasos: ['AXO configurado para tu tienda', 'Tu equipo pidiéndole lo suyo', 'Una automatización nueva cada mes'] },
      },
    ],
    faqs: [
      { question: '¿Es una persona o un chat?', answer: 'Una persona del equipo de Sacs. Trabaja contigo en sesiones y en el canal de tu cuenta; AXO es la IA que configura para ti.' },
      { question: '¿Qué plan lo incluye?', answer: 'El plan Automatiza: especialista dedicado, onboarding de automatización y una sesión mensual de optimización.' },
      { question: '¿Qué configura exactamente?', answer: 'Los canales del equipo, los radares, las rutinas y recordatorios, la política de permisos de AXO y, si usas la Suite de Moda, las reglas de nivelación y la publicación del Estudio.' },
      { question: '¿Y si quiero que alguien opere Sacs por mí?', answer: 'Para eso están los partners de Sacs: consultores certificados que implementan y operan Sacs con IA.' },
    ],
  },
];

export const autoPorSlug = (slug: string) => AUTOMATIZA.find((p) => p.slug === slug)!;
export const SLUGS_AUTOMATIZA = AUTOMATIZA.map((p) => p.slug);
