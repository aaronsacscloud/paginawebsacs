// El cuestionario del brief, por etapas.
//
// Vive en código (no en la base) por una razón: el servidor tiene que poder
// decir "esta etapa está completa" sin confiar en lo que mande el navegador.
// Las respuestas sí van en jsonb, porque el cuestionario cambia de proyecto a
// proyecto y no vale la pena una columna por pregunta.
//
// Las preguntas están escritas para JOYERÍA. No son un formulario genérico de
// agencia: preguntan por quilataje, certificados, engaste y talla de anillo,
// porque de ahí sale la ficha de producto y el configurador.

export type CampoTipo =
  | 'texto'        // una línea
  | 'parrafo'      // varias líneas
  | 'opcion'       // una sola respuesta
  | 'multiple'     // varias respuestas
  | 'escala'       // 1..5 con extremos nombrados
  | 'archivos'     // subida a Storage
  | 'links';       // lista de {url, nota}

export type Campo = {
  id: string;
  etiqueta: string;
  ayuda?: string;
  tipo: CampoTipo;
  opciones?: string[];
  extremos?: [string, string];
  /** Obligatorio para poder ENVIAR la etapa a revisión. */
  requerido?: boolean;
  /** El campo permite además escribir algo libre ("Otro: ..."). */
  otro?: boolean;
  placeholder?: string;
};

export type Etapa = {
  clave: string;
  orden: number;
  titulo: string;
  resumen: string;
  /** Lo que Sacs hace con esta etapa una vez aprobada. */
  entrega: string;
  campos: Campo[];
};

export const ETAPAS: Etapa[] = [
  // ─────────────────────────────────────────────────────────────── 1 ──
  {
    clave: 'identidad',
    orden: 1,
    titulo: 'Identidad de la marca',
    resumen:
      'Todo lo que ya existe de Ruben’s: logo, manual, tipografías, colores. ' +
      'Si algo no existe, se dice aquí y nosotros lo resolvemos — lo que no ' +
      'sirve es descubrirlo a media producción.',
    entrega:
      'Kit de marca listo para web: logo en SVG y PNG, favicon, paleta y ' +
      'tipografías con su licencia.',
    campos: [
      {
        id: 'logo_archivos',
        etiqueta: 'Logo, en todos los formatos que tengan',
        ayuda:
          'Lo ideal es el vector: .ai, .eps, .svg o .pdf. Si solo existe un ' +
          'JPG de una tarjeta de presentación, súbanlo igual — se puede ' +
          'redibujar, pero necesitamos saberlo desde hoy.',
        tipo: 'archivos',
        requerido: true,
      },
      {
        id: 'logo_versiones',
        etiqueta: '¿Qué versiones del logo existen?',
        tipo: 'multiple',
        opciones: [
          'Horizontal',
          'Vertical / apilado',
          'Isotipo o símbolo solo (sin texto)',
          'Monocromático en blanco',
          'Monocromático en negro',
          'Versión en oro / metálica',
          'Favicon',
          'No sé — que lo revise Sacs',
        ],
      },
      {
        id: 'manual',
        etiqueta: 'Manual de identidad',
        ayuda: 'El PDF con los usos de la marca, si existe. Si no, sáltenlo.',
        tipo: 'archivos',
      },
      {
        id: 'tipografias',
        etiqueta: 'Tipografías de la marca',
        ayuda:
          'Nombres o archivos. Ojo con esto: si la tipografía es de pago, la ' +
          'web necesita su propia licencia (webfont). Si no la tienen, ' +
          'proponemos una equivalente.',
        tipo: 'texto',
        placeholder: 'Ej. Didot para títulos, Futura para textos',
      },
      { id: 'tipografias_archivos', etiqueta: 'Archivos de tipografía', tipo: 'archivos' },
      {
        id: 'colores',
        etiqueta: 'Colores oficiales',
        ayuda:
          'En HEX o Pantone. Incluyan el tono del oro y del plateado si la ' +
          'marca los usa: en pantalla el oro no es un color, es un degradado, ' +
          'y conviene definirlo una sola vez.',
        tipo: 'texto',
        placeholder: 'Ej. #0F0F0F, #C6A15B (oro), Pantone 871 C',
      },
      {
        id: 'nombre_uso',
        etiqueta: '¿Ruben’s o Ruben’s Bridal?',
        ayuda:
          '¿Cuándo se escribe cada una, lleva apóstrofo siempre y va en ' +
          'mayúsculas? Esto define los títulos de todo el sitio.',
        tipo: 'parrafo',
      },
      {
        id: 'claim',
        etiqueta: 'Slogan o frase de la casa',
        tipo: 'texto',
      },
      {
        id: 'foto_actual',
        etiqueta: 'Fotografía de producto que ya tienen',
        ayuda:
          'Pueden subir muestras aquí o pegar el link de la carpeta ' +
          '(Drive, Dropbox, WeTransfer) si pesa mucho.',
        tipo: 'archivos',
      },
      { id: 'foto_links', etiqueta: 'Links a carpetas de fotografía', tipo: 'links' },
      {
        id: 'no_hacer',
        etiqueta: 'Qué NO se puede hacer con la marca',
        ayuda:
          'Deformarla, cambiarle el color, ponerla sobre ciertos fondos, ' +
          'usar el isotipo solo… lo que sea intocable.',
        tipo: 'parrafo',
      },
      {
        id: 'redes',
        etiqueta: 'Redes y sitio actual',
        ayuda: 'Instagram, Facebook, TikTok y la página que tengan hoy.',
        tipo: 'texto',
        requerido: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 2 ──
  {
    clave: 'objetivo',
    orden: 2,
    titulo: 'Objetivo del ecommerce',
    resumen:
      'Para qué es el sitio. Aquí se decide lo más importante de todo el ' +
      'proyecto: qué se cierra en línea y qué termina en boutique. En joyería ' +
      'de alto valor esa línea define el diseño entero.',
    entrega:
      'El objetivo escrito en una frase, el modelo de venta decidido y los ' +
      'indicadores que vamos a revisar juntos.',
    campos: [
      {
        id: 'objetivo_6m',
        etiqueta: 'En 6 meses, ¿qué tiene que estar pasando para que digan «valió la pena»?',
        ayuda: 'Con un número si se puede. Vale más una meta incómoda que una bonita.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'modelo_venta',
        etiqueta: '¿Qué queremos que pase con una pieza de alto valor?',
        tipo: 'opcion',
        requerido: true,
        opciones: [
          'Se compra completa en línea, con su pago total',
          'Se aparta en línea con anticipo y se cierra en boutique',
          'El sitio solo genera la cita; el cierre siempre es humano',
          'Depende del monto',
        ],
      },
      {
        id: 'umbral',
        etiqueta: 'Si depende del monto: ¿arriba de cuánto la venta termina en boutique?',
        tipo: 'texto',
        placeholder: 'Ej. arriba de $80,000 solo agenda cita',
      },
      {
        id: 'ticket',
        etiqueta: 'Ticket promedio hoy y meta mensual del canal en línea',
        tipo: 'texto',
      },
      {
        id: 'publico',
        etiqueta: '¿A quién le habla el sitio?',
        tipo: 'multiple',
        requerido: true,
        otro: true,
        opciones: [
          'El novio buscando el anillo de compromiso',
          'La pareja eligiendo juntos',
          'La novia eligiendo argollas',
          'Regalo (aniversario, cumpleaños, Navidad)',
          'Autorregalo',
          'Bautizos, primera comunión, XV años',
          'Mayoreo o distribuidor',
        ],
      },
      {
        id: 'viaje',
        etiqueta: '¿Cuánto tiempo antes de la boda empiezan a buscar, y cuántas veces vuelven antes de decidir?',
        ayuda:
          'Un anillo de compromiso no se compra en una visita. Saber si son ' +
          'dos semanas o seis meses cambia todo el seguimiento.',
        tipo: 'parrafo',
      },
      {
        id: 'hoy_whatsapp',
        etiqueta: 'Hoy, cuando alguien pregunta por WhatsApp o Instagram, ¿qué pasa?',
        ayuda: 'Quién contesta, con qué material, y en cuánto tiempo.',
        tipo: 'parrafo',
      },
      {
        id: 'no_queremos',
        etiqueta: '¿Qué NO queremos que pase?',
        ayuda:
          'Que se vea como tienda genérica, que compitan solo por precio, ' +
          'que pidan descuento antes de ver la pieza…',
        tipo: 'parrafo',
      },
      {
        id: 'competencia',
        etiqueta: 'Contra quién compiten',
        ayuda: 'En San Luis y en línea. Pongan nombres y links.',
        tipo: 'texto',
      },
      {
        id: 'kpi',
        etiqueta: 'Qué vamos a medir juntos',
        tipo: 'multiple',
        otro: true,
        opciones: [
          'Citas agendadas en boutique',
          'Ventas cerradas en línea',
          'Apartados con anticipo',
          'Piezas cotizadas del catálogo de diamantes',
          'Piezas configuradas (montadura + diamante)',
          'Suscriptores para lanzamientos',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 3 ──
  {
    clave: 'referencias',
    orden: 3,
    titulo: 'Referencias e innovación',
    resumen:
      'Lo que quieren que se sienta. Aquí es donde se decide qué tan lejos ' +
      'llegamos con los efectos: 360°, configurador, probador virtual. ' +
      'Un link sin explicación no sirve — díganos qué exactamente les gustó.',
    entrega:
      'La dirección de arte cerrada y la lista de efectos que sí se construyen, ' +
      'con su costo en tiempo.',
    campos: [
      {
        id: 'sitios',
        etiqueta: 'Sitios que les gustan',
        ayuda:
          'Mínimo tres. Y en cada uno, qué exactamente: el video de portada, ' +
          'cómo se ve la ficha, la forma de comprar, la tipografía.',
        tipo: 'links',
        requerido: true,
      },
      {
        id: 'videos',
        etiqueta: 'Videos de referencia',
        ayuda:
          'Un reel, un TikTok, el video de otra marca. Peguen el link o suban ' +
          'el archivo.',
        tipo: 'links',
      },
      { id: 'videos_archivos', etiqueta: 'Archivos de video', tipo: 'archivos' },
      {
        id: 'efectos',
        etiqueta: '¿Qué efectos quieren que existan?',
        ayuda:
          'Marquen todo lo que les interese. Después decidimos juntos cuáles ' +
          'entran en los 45 días y cuáles son una segunda etapa.',
        tipo: 'multiple',
        requerido: true,
        otro: true,
        opciones: [
          'Vista 360° de la pieza — girarla con el dedo',
          'Zoom macro que muestre el engaste y el brillo',
          'Render 3D en vivo: cambiar metal y ver la pieza al instante',
          'Probador virtual: la mano o el cuello con la pieza puesta',
          'Configurador: elegir montadura y después el diamante',
          'Comparador de diamantes lado a lado',
          'Video que avanza conforme haces scroll',
          'Destellos y luz que reaccionan al movimiento',
          'Realidad aumentada desde el celular',
          'El certificado GIA/IGI abriéndose desde la ficha',
          'Grabado en vivo: escribes el nombre y lo ves en la pieza',
          'La historia de cada colección contada como editorial',
        ],
      },
      {
        id: 'efecto_estrella',
        etiqueta: 'Si solo pudiéramos hacer UNO increíble, ¿cuál?',
        ayuda:
          'Esta respuesta manda. Es la que va a la portada y la que la gente ' +
          'va a recordar.',
        tipo: 'texto',
        requerido: true,
      },
      {
        id: 'tono',
        etiqueta: '¿Qué tan lejos vamos?',
        tipo: 'escala',
        extremos: ['Sobrio y elegante', 'Espectacular y cinematográfico'],
        requerido: true,
      },
      {
        id: 'no_gustan',
        etiqueta: 'Sitios que NO les gustan, y por qué',
        ayuda: 'Esto nos sirve más que los que sí les gustan. En serio.',
        tipo: 'links',
      },
      {
        id: 'moodboard',
        etiqueta: 'Moodboard, Pinterest, capturas',
        tipo: 'archivos',
      },
      {
        id: 'idioma',
        etiqueta: 'Idiomas del sitio',
        tipo: 'opcion',
        opciones: ['Solo español', 'Español e inglés', 'Español ahora, inglés después'],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 4 ──
  {
    clave: 'catalogo',
    orden: 4,
    titulo: 'Catálogo, piezas y diamantes',
    resumen:
      'De aquí sale la ficha de producto y el buscador. Es la etapa más ' +
      'técnica y la que más tarda del lado de ustedes: incluye el acceso al ' +
      'catálogo del proveedor de diamantes, que es lo único del proyecto que ' +
      'no depende de nosotros.',
    entrega:
      'La ficha de producto definida campo por campo, las piezas de ' +
      'lanzamiento y la conexión al catálogo del proveedor probada.',
    campos: [
      {
        id: 'colecciones',
        etiqueta: '¿Cómo se agrupan las piezas?',
        ayuda:
          'Colecciones, líneas, por ocasión, por metal, por precio. Escríbanlo ' +
          'como lo dicen ustedes en el mostrador, no como creen que debería ' +
          'decirse.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'atributos',
        etiqueta: '¿Qué datos tiene que mostrar cada pieza?',
        tipo: 'multiple',
        requerido: true,
        otro: true,
        opciones: [
          'Metal y quilataje (10k / 14k / 18k) o ley de plata',
          'Peso en gramos',
          'Piedra central: tipo y quilataje',
          'Color y claridad',
          'Corte y pulido',
          'Certificación (GIA / IGI / HRD)',
          'Número de certificado',
          'Talla de anillo',
          'Largo de cadena',
          'Piedras secundarias (cantidad y quilataje total)',
          'Medidas en milímetros',
          'Origen de la piedra (natural / cultivado)',
        ],
      },
      {
        id: 'precio_visible',
        etiqueta: '¿El precio se ve?',
        tipo: 'opcion',
        requerido: true,
        opciones: [
          'Sí, siempre y completo',
          'Sí, pero como «desde $…»',
          'Solo en algunas líneas',
          'No: «consultar precio»',
        ],
      },
      {
        id: 'precio_metal',
        etiqueta: 'El oro se mueve todos los días. ¿El precio del sitio se recalcula solo?',
        ayuda:
          'Sacs ya sabe costear una pieza a partir del precio del metal y la ' +
          'mano de obra. La pregunta es si el sitio usa ese precio vivo o uno ' +
          'fijo que ustedes actualizan cuando quieren.',
        tipo: 'opcion',
        opciones: [
          'Que se recalcule solo con el precio del metal del día',
          'Fijo, hasta que nosotros lo cambiemos',
          'Mixto: vivo en oro por gramo, fijo en piezas de diseño',
          'No sé — explíquennos las dos y decidimos',
        ],
      },
      {
        id: 'hero',
        etiqueta: 'Las 10 a 15 piezas con las que queremos abrir',
        ayuda: 'Las que enamoran. Nombre, código o foto — como lo tengan.',
        tipo: 'parrafo',
        requerido: true,
      },
      { id: 'hero_archivos', etiqueta: 'Fotos de esas piezas', tipo: 'archivos' },
      {
        id: 'configurador',
        etiqueta: 'Montadura y diamante: ¿por separado o siempre pieza terminada?',
        ayuda:
          'Si van por separado, el cliente arma su anillo en el sitio: elige ' +
          'la montadura y después el diamante del catálogo del proveedor.',
        tipo: 'opcion',
        requerido: true,
        opciones: [
          'Por separado — el cliente arma su anillo',
          'Siempre pieza terminada',
          'Las dos: algunas líneas se arman, otras no',
        ],
      },
      {
        id: 'api_proveedor',
        etiqueta: 'Catálogo de diamantes del proveedor',
        ayuda:
          'Nombre del proveedor, contacto técnico (correo y teléfono) y si ya ' +
          'tienen credenciales o documentación del API. Esto es lo que más ' +
          'atrasa un proyecto así, por eso lo pedimos desde ahora.',
        tipo: 'parrafo',
        requerido: true,
      },
      { id: 'api_archivos', etiqueta: 'Documentación del proveedor', tipo: 'archivos' },
      {
        id: 'certificados',
        etiqueta: 'Certificado digital y en PVC',
        ayuda: 'Ya está incluido en lo contratado. Falta decidir dónde vive.',
        tipo: 'multiple',
        opciones: [
          'Visible en la ficha del producto',
          'Se envía por correo al comprar',
          'Con código QR en la tarjeta física',
          'Verificable desde una página pública',
        ],
      },
      {
        id: 'personalizacion',
        etiqueta: 'Personalización que ofrecen',
        tipo: 'multiple',
        otro: true,
        opciones: [
          'Grabado interior',
          'Grabado exterior',
          'Cambio de metal',
          'Cambio de piedra',
          'Tallas especiales',
          'Diseño a la medida',
        ],
      },
      {
        id: 'personalizacion_tiempos',
        etiqueta: 'Tiempos de cada personalización',
        ayuda: 'El cliente los va a ver en la ficha antes de comprar.',
        tipo: 'texto',
      },
      {
        id: 'fotografia',
        etiqueta: 'La fotografía de las piezas',
        tipo: 'opcion',
        requerido: true,
        opciones: [
          'Ya existe y está completa',
          'Existe, pero hay que rehacer una parte',
          'La producimos nosotros ahora',
          'Necesitamos que Sacs nos oriente',
        ],
      },
      {
        id: 'fotografia_360',
        etiqueta: '¿Tienen fotografía 360° o video de las piezas?',
        tipo: 'opcion',
        opciones: ['Sí, de varias piezas', 'De unas cuantas', 'No, ninguna'],
      },
      {
        id: 'inventario',
        etiqueta: '¿El stock del sitio sale de Sacs en automático?',
        ayuda:
          'Lo natural es que sí: la pieza que se vende en boutique desaparece ' +
          'del sitio sola. Digan si prefieren manejarlo aparte.',
        tipo: 'opcion',
        opciones: [
          'Sí, que salga de Sacs en automático',
          'Aparte, lo administramos a mano',
          'No sé — recomiéndennos',
        ],
      },
      {
        id: 'catalogo_archivo',
        etiqueta: 'Su catálogo o inventario en Excel',
        ayuda: 'Si ya lo tienen en un archivo, súbanlo aunque esté sucio.',
        tipo: 'archivos',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 5 ──
  {
    clave: 'operacion',
    orden: 5,
    titulo: 'Operación y lanzamiento',
    resumen:
      'Lo que hace que el sitio pueda cobrar, enviar y salir al aire. Son ' +
      'trámites, pero son los que detienen un lanzamiento el último día.',
    entrega: 'Fecha de salida confirmada, cobros probados y su equipo capacitado.',
    campos: [
      {
        id: 'dominio',
        etiqueta: 'Dominio y quién controla el DNS',
        ayuda:
          'Qué dirección va a usar y quién tiene el acceso hoy: ustedes, una ' +
          'agencia, un proveedor anterior. Vamos a necesitar entrar.',
        tipo: 'texto',
        requerido: true,
      },
      {
        id: 'pagos',
        etiqueta: '¿Cómo quieren cobrar?',
        tipo: 'multiple',
        requerido: true,
        otro: true,
        opciones: [
          'Tarjeta de crédito y débito',
          'Meses sin intereses',
          'Transferencia / SPEI',
          'Anticipo del 50% en línea, resto en boutique',
          'PayPal',
          'Mercado Pago',
          'Pago contra entrega en boutique',
        ],
      },
      {
        id: 'msi',
        etiqueta: 'Si van meses sin intereses: banco o terminal, y a cuántos meses',
        tipo: 'texto',
      },
      {
        id: 'envio',
        etiqueta: 'Envío de joyería',
        ayuda:
          'Paquetería, si va asegurado, quién empaca, si hay recolección en ' +
          'boutique y a qué zonas envían.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'politicas',
        etiqueta: 'Devoluciones, garantía, resize y limpieza',
        ayuda: 'Si ya está escrito, súbanlo. Si no, cuéntenlo como lo manejan hoy.',
        tipo: 'parrafo',
      },
      { id: 'politicas_archivos', etiqueta: 'Políticas en archivo', tipo: 'archivos' },
      {
        id: 'legales',
        etiqueta: 'Razón social, RFC y domicilio fiscal',
        ayuda: 'Para el aviso de privacidad, los términos y la facturación.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'admin',
        etiqueta: '¿Quién de Ruben’s va a administrar el sitio?',
        ayuda:
          'Nombre, puesto y correo. Es la persona a la que capacitamos y la ' +
          'que después va a cambiar banners, precios y fotos sin depender de ' +
          'nosotros.',
        tipo: 'texto',
        requerido: true,
      },
      {
        id: 'equipo',
        etiqueta: '¿Quién más aprueba?',
        ayuda:
          'Si quien decide no es quien está contestando este brief, es mejor ' +
          'saberlo hoy que en la revisión final.',
        tipo: 'parrafo',
      },
      {
        id: 'fecha',
        etiqueta: '¿Hay una fecha que no se puede mover?',
        ayuda: 'Una campaña, un aniversario, la temporada de bodas.',
        tipo: 'texto',
      },
      {
        id: 'analitica',
        etiqueta: 'Medición y campañas',
        tipo: 'multiple',
        otro: true,
        opciones: [
          'Google Analytics',
          'Meta Pixel (Facebook / Instagram)',
          'TikTok Pixel',
          'Google Ads',
          'WhatsApp Business API',
          'Nada todavía',
        ],
      },
    ],
  },
];

export const ETAPAS_POR_CLAVE = new Map(ETAPAS.map((e) => [e.clave, e]));

/** ¿Está vacía la respuesta a este campo? Un arreglo vacío también lo está. */
export function vacio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

/**
 * Los campos obligatorios que siguen vacíos. El servidor lo vuelve a correr
 * antes de aceptar un envío: el navegador puede mentir.
 */
export function faltantes(clave: string, respuestas: Record<string, unknown>): string[] {
  const etapa = ETAPAS_POR_CLAVE.get(clave);
  if (!etapa) return [];
  return etapa.campos
    .filter((c) => c.requerido && vacio(respuestas?.[c.id]))
    .map((c) => c.etiqueta);
}
