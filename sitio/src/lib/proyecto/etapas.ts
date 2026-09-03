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
  /** Bloque al que pertenece dentro de la etapa. Los campos consecutivos con
   *  el mismo grupo se pintan bajo un solo encabezado. */
  grupo?: string;
  etiqueta: string;
  ayuda?: string;
  tipo: CampoTipo;
  opciones?: string[];
  extremos?: [string, string];
  /** Obligatorio para poder ENVIAR la etapa a revisión. */
  requerido?: boolean;
  /** El campo permite además escribir algo libre ("Otro: ..."). */
  otro?: boolean;
  /** Para tipo 'links': qué se pregunta en la segunda casilla de cada fila.
   *  Sin esto, todas preguntaban "¿qué exactamente te gustó?" — que no viene
   *  al caso cuando el link es una carpeta de fotos. */
  notaPh?: string;
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
        grupo: 'El logo',
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
        grupo: 'El logo',
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
        grupo: 'El manual y sus reglas',
        etiqueta: 'Manual de identidad',
        ayuda: 'El PDF con los usos de la marca, si existe. Si no, sáltenlo.',
        tipo: 'archivos',
      },
      {
        id: 'tipografias',
        grupo: 'Tipografía y color',
        etiqueta: 'Tipografías de la marca',
        ayuda:
          'Nombres o archivos. Ojo con esto: si la tipografía es de pago, la ' +
          'web necesita su propia licencia (webfont). Si no la tienen, ' +
          'proponemos una equivalente.',
        tipo: 'texto',
        placeholder: 'Ej. Didot para títulos, Futura para textos',
      },
      { id: 'tipografias_archivos', grupo: 'Tipografía y color', etiqueta: 'Archivos de tipografía', tipo: 'archivos' },
      {
        id: 'colores',
        grupo: 'Tipografía y color',
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
        grupo: 'Cómo se escribe la marca',
        etiqueta: '¿Ruben’s o Ruben’s Bridal?',
        ayuda:
          '¿Cuándo se escribe cada una, lleva apóstrofo siempre y va en ' +
          'mayúsculas? Esto define los títulos de todo el sitio.',
        tipo: 'parrafo',
      },
      {
        id: 'claim',
        grupo: 'Cómo se escribe la marca',
        etiqueta: 'Slogan o frase de la casa',
        tipo: 'texto',
      },
      {
        id: 'foto_actual',
        grupo: 'Lo que ya existe',
        etiqueta: 'Fotografía de producto que ya tienen',
        ayuda:
          'Pueden subir muestras aquí o pegar el link de la carpeta ' +
          '(Drive, Dropbox, WeTransfer) si pesa mucho.',
        tipo: 'archivos',
      },
      { id: 'foto_links', grupo: 'Lo que ya existe', etiqueta: 'Links a carpetas de fotografía', tipo: 'links', notaPh: 'Qué hay en esa carpeta' },
      {
        id: 'no_hacer',
        grupo: 'El manual y sus reglas',
        etiqueta: 'Qué NO se puede hacer con la marca',
        ayuda:
          'Deformarla, cambiarle el color, ponerla sobre ciertos fondos, ' +
          'usar el isotipo solo… lo que sea intocable.',
        tipo: 'parrafo',
      },
      {
        id: 'redes',
        grupo: 'Lo que ya existe',
        etiqueta: 'Redes y sitio actual',
        ayuda: 'Instagram, Facebook, TikTok y la página que tengan hoy.',
        tipo: 'texto',
        requerido: true,
      },
    ],
  },


  // ─────────────────────────────────────────────────────────────── 2 ──
  {
    clave: 'palabras',
    orden: 2,
    titulo: 'La historia y las palabras',
    resumen:
      'De aquí sale la sección "Nosotros" y el tono de todo el sitio. Es la ' +
      'etapa que más se subestima y la que más vende: en joyería fina nadie ' +
      'compra una pieza de un desconocido. Cuéntenlo como lo cuentan en la ' +
      'casa, sin acomodarlo — nosotros lo acomodamos.',
    entrega:
      'La página "Nosotros" escrita, el tono de voz definido y quién redacta ' +
      'cada pieza nueva.',
    campos: [
      {
        id: 'historia_origen',
        grupo: 'La historia de la casa',
        etiqueta: '¿En qué año abrió Ruben’s y quién la fundó?',
        ayuda:
          'Cuéntenlo como se cuenta en la familia, no como se escribiría en un ' +
          'folleto. Si empezó en un local chico o en una mesa, eso es lo que ' +
          'hay que decir.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'historia_hitos',
        grupo: 'La historia de la casa',
        etiqueta: 'Los momentos que marcaron la casa',
        ayuda:
          'La primera boutique. La que más costó abrir. Un cambio de ' +
          'generación. Un reconocimiento. Una pieza que se recuerda.',
        tipo: 'parrafo',
      },
      {
        id: 'historia_oficio',
        grupo: 'La historia de la casa',
        etiqueta: '¿Hay taller propio? ¿Quién hace las piezas?',
        ayuda:
          'Un maestro joyero con nombre y años de oficio vale más que ' +
          'cualquier adjetivo. Si el taller es externo, también sirve saberlo.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'historia_porque',
        grupo: 'La historia de la casa',
        etiqueta: '¿Por qué una pareja debería comprar su anillo aquí y no en una cadena?',
        ayuda: 'La respuesta honesta, no la de comercial. Esa es la que convence.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'historia_cliente',
        grupo: 'La historia de la casa',
        etiqueta: 'Una historia real de un cliente que se acuerden',
        ayuda:
          'El señor que volvió a los 25 años por las bodas de plata. La pieza ' +
          'que se rehízo tres veces. Sin nombres si no quieren.',
        tipo: 'parrafo',
      },
      {
        id: 'historia_caras',
        grupo: 'La historia de la casa',
        etiqueta: '¿Quiénes son las caras de la casa?',
        ayuda:
          'Nombres, puesto y años en Ruben’s de quienes van a aparecer en ' +
          '"Nosotros". La gente compra de personas.',
        tipo: 'parrafo',
      },
      {
        id: 'historia_archivos',
        grupo: 'La historia de la casa',
        etiqueta: 'Fotos antiguas, recortes, reconocimientos',
        ayuda:
          'La foto del primer local, del fundador, del taller. Aunque estén ' +
          'maltratadas: eso es exactamente lo que se ve bien en esta sección.',
        tipo: 'archivos',
      },
      {
        id: 'tono_trato',
        grupo: 'Cómo habla la marca',
        etiqueta: '¿De usted o de tú?',
        ayuda: 'Define el sitio entero y no se cambia a media obra.',
        tipo: 'opcion',
        requerido: true,
        opciones: [
          'De usted, siempre',
          'De tú',
          'De usted en las piezas de alto valor, de tú en el resto',
          'No sé — recomiéndennos',
        ],
      },
      {
        id: 'tono_ejemplo',
        grupo: 'Cómo habla la marca',
        etiqueta: 'Peguen un texto suyo que sientan que “suena a Ruben’s”',
        ayuda:
          'Un post, una descripción, un mensaje de WhatsApp. Con uno bueno ' +
          'sacamos el tono de todo lo demás.',
        tipo: 'parrafo',
      },
      {
        id: 'tono_tres',
        grupo: 'Cómo habla la marca',
        etiqueta: 'Tres palabras que describan a Ruben’s — y tres que NO',
        ayuda: 'Las tres que no sirven más que las tres que sí.',
        tipo: 'texto',
        placeholder: 'Sí: … · No: …',
      },
      {
        id: 'tono_prohibidas',
        grupo: 'Cómo habla la marca',
        etiqueta: 'Palabras que no usamos nunca',
        ayuda:
          '“Barato”, “oferta”, “promoción”, “bisutería”… En alta joyería ' +
          'algunas casas no las escriben jamás.',
        tipo: 'texto',
      },
      {
        id: 'escribe_quien',
        grupo: 'Quién escribe',
        etiqueta: '¿Quién escribe las descripciones de las piezas nuevas?',
        ayuda:
          'Las que ya tienen están muy bien escritas. La pregunta es quién ' +
          'sostiene ese nivel cuando entren 50 piezas más.',
        tipo: 'opcion',
        requerido: true,
        opciones: [
          'Nosotros, como hasta ahora',
          'Sacs las redacta y ustedes las aprueban',
          'AXO las redacta y ustedes las aprueban',
          'Entre los dos: ustedes la ficha técnica, nosotros el texto',
        ],
      },
      {
        id: 'escribe_ritmo',
        grupo: 'Quién escribe',
        etiqueta: '¿Cuántas piezas nuevas entran al mes?',
        ayuda: 'Define si hace falta carga masiva o alcanza con capturarlas a mano.',
        tipo: 'texto',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 4 ──
  {
    clave: 'mercado',
    orden: 4,
    titulo: 'El mercado y su gente',
    resumen:
      'De dónde va a llegar la gente y cuándo compra. Sin esto se puede ' +
      'entregar la vitrina más espectacular de México y que la vean cuarenta ' +
      'personas al mes. No es marketing: es información que cambia cómo se ' +
      'construye el sitio y qué se termina primero.',
    entrega:
      'El plan de tráfico, las temporadas que mandan sobre el calendario de ' +
      'entrega y la lista con la que se lanza.',
    campos: [
      {
        id: 'google_negocio',
        grupo: 'Dónde los buscan hoy',
        etiqueta: 'Su ficha de Google',
        ayuda:
          'Peguen el link y díganos quién la administra. Para una joyería con ' +
          'boutique física es de donde llega la mitad de la gente.',
        tipo: 'texto',
        requerido: true,
      },
      {
        id: 'resenas',
        grupo: 'Dónde los buscan hoy',
        etiqueta: '¿Cuántas reseñas tienen, de cuánto, y quién las contesta?',
        tipo: 'texto',
      },
      {
        id: 'busquedas',
        grupo: 'Dónde los buscan hoy',
        etiqueta: '¿Qué escribe la gente en Google cuando los busca?',
        ayuda:
          '“Anillos de compromiso San Luis Potosí” no es lo mismo que “alta ' +
          'joyería”. Escríbanlo tal cual creen que lo teclean.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'sitio_anterior',
        grupo: 'Dónde los buscan hoy',
        etiqueta: '¿Hay un sitio anterior?',
        ayuda:
          'URL y quién lo hizo. Si existe y muere sin redirecciones, se pierde ' +
          'lo poco que hoy posiciona — y eso no se recupera.',
        tipo: 'texto',
      },
      {
        id: 'sitio_anterior_destino',
        grupo: 'Dónde los buscan hoy',
        etiqueta: 'Ese sitio, ¿se apaga o se conserva?',
        tipo: 'opcion',
        opciones: [
          'Se apaga y todo se va al nuevo',
          'Se conserva aparte',
          'No existe',
          'No sabemos quién lo controla',
        ],
      },
      {
        id: 'pauta',
        grupo: 'Publicidad',
        etiqueta: '¿Dónde se anuncian hoy?',
        tipo: 'multiple',
        otro: true,
        opciones: [
          'Facebook e Instagram (pauta pagada)',
          'Google Ads',
          'Influencers o creadores',
          'Radio',
          'Espectaculares o impresos',
          'Ferias y eventos',
          'Solo orgánico, sin pagar',
        ],
      },
      {
        id: 'pauta_quien',
        grupo: 'Publicidad',
        etiqueta: '¿Quién la maneja y con cuánto al mes?',
        ayuda: 'Agencia, alguien de la casa, o nadie fijo.',
        tipo: 'texto',
      },
      {
        id: 'pauta_resultado',
        grupo: 'Publicidad',
        etiqueta: '¿Qué les ha funcionado mejor hasta hoy y qué fue dinero tirado?',
        tipo: 'parrafo',
      },
      {
        id: 'temporadas',
        grupo: 'El calendario del año',
        etiqueta: '¿Cuáles son sus temporadas fuertes?',
        tipo: 'multiple',
        requerido: true,
        otro: true,
        opciones: [
          '14 de febrero',
          '10 de mayo',
          'Temporada de bodas',
          'Graduaciones',
          'XV años y primeras comuniones',
          'Buen Fin',
          'Navidad y Reyes',
          'Aniversario de la casa',
        ],
      },
      {
        id: 'temporada_fuerte',
        grupo: 'El calendario del año',
        etiqueta: 'De todas, ¿cuál es LA más fuerte y con cuánta anticipación la preparan?',
        ayuda:
          'Esta respuesta decide qué se termina primero. Si la más fuerte es ' +
          'diciembre, el sitio tiene que estar vendiendo en noviembre, no en ' +
          'diciembre.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'temporada_baja',
        grupo: 'El calendario del año',
        etiqueta: '¿Cuál es el mes más flojo del año?',
        ayuda: 'Es el mejor mes para lanzar y para capacitar sin prisa.',
        tipo: 'texto',
      },
      {
        id: 'base_clientes',
        grupo: 'Su gente',
        etiqueta: '¿Tienen base de clientes fuera de SACS?',
        ayuda:
          'Correos, WhatsApp, el cuaderno de la boutique, el Excel de alguien. ' +
          'Díganos cuántos son más o menos. En su cuenta hoy hay 6 clientes ' +
          'capturados: lanzar sin lista es lanzar al vacío.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'base_archivo',
        grupo: 'Su gente',
        etiqueta: 'La base, si la tienen en archivo',
        ayuda: 'Excel, CSV, exportación de Mailchimp. Aunque esté sucia.',
        tipo: 'archivos',
      },
      {
        id: 'base_permiso',
        grupo: 'Su gente',
        etiqueta: '¿Esos clientes aceptaron recibir correos o mensajes?',
        ayuda:
          'No es un trámite: mandar correo a quien no lo aceptó quema el ' +
          'dominio y en México tiene consecuencias legales.',
        tipo: 'opcion',
        opciones: [
          'Sí, se les pregunta al registrarlos',
          'Algunos sí, otros no sabemos',
          'No, nunca se les preguntó',
        ],
      },
      {
        id: 'mercado_geo',
        grupo: 'Su gente',
        etiqueta: '¿Hasta dónde venden?',
        tipo: 'multiple',
        otro: true,
        opciones: [
          'San Luis Potosí y alrededores',
          'Todo el Bajío',
          'Toda la República',
          'Estados Unidos',
          'Otros países',
        ],
      },
      {
        id: 'cliente_vuelve',
        grupo: 'Su gente',
        etiqueta: '¿Cada cuánto vuelve un cliente y a qué vuelve?',
        ayuda:
          'Compromiso → argollas → aniversario → bautizo. Si ese camino existe, ' +
          'el sitio lo puede acompañar solo.',
        tipo: 'parrafo',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 3 ──
  {
    clave: 'objetivo',
    orden: 3,
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
        grupo: 'La meta',
        etiqueta: 'En 6 meses, ¿qué tiene que estar pasando para que digan «valió la pena»?',
        ayuda: 'Con un número si se puede. Vale más una meta incómoda que una bonita.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'modelo_venta',
        grupo: 'Cómo se cierra una venta',
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
        grupo: 'Cómo se cierra una venta',
        etiqueta: 'Si depende del monto: ¿arriba de cuánto la venta termina en boutique?',
        tipo: 'texto',
        placeholder: 'Ej. arriba de $80,000 solo agenda cita',
      },
      {
        id: 'ticket',
        grupo: 'Cómo se cierra una venta',
        etiqueta: 'Ticket promedio hoy y meta mensual del canal en línea',
        tipo: 'texto',
      },
      {
        id: 'publico',
        grupo: 'A quién le hablamos',
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
        grupo: 'A quién le hablamos',
        etiqueta: '¿Cuánto tiempo antes de la boda empiezan a buscar, y cuántas veces vuelven antes de decidir?',
        ayuda:
          'Un anillo de compromiso no se compra en una visita. Saber si son ' +
          'dos semanas o seis meses cambia todo el seguimiento.',
        tipo: 'parrafo',
      },
      {
        id: 'hoy_whatsapp',
        grupo: 'El terreno de hoy',
        etiqueta: 'Hoy, cuando alguien pregunta por WhatsApp o Instagram, ¿qué pasa?',
        ayuda: 'Quién contesta, con qué material, y en cuánto tiempo.',
        tipo: 'parrafo',
      },
      {
        id: 'no_queremos',
        grupo: 'El terreno de hoy',
        etiqueta: '¿Qué NO queremos que pase?',
        ayuda:
          'Que se vea como tienda genérica, que compitan solo por precio, ' +
          'que pidan descuento antes de ver la pieza…',
        tipo: 'parrafo',
      },
      {
        id: 'competencia',
        grupo: 'El terreno de hoy',
        etiqueta: 'Contra quién compiten',
        ayuda: 'En San Luis y en línea. Pongan nombres y links.',
        tipo: 'texto',
      },
      {
        id: 'kpi',
        grupo: 'La meta',
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
    orden: 5,
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
        grupo: 'Lo que les gusta',
        etiqueta: 'Sitios que les gustan',
        ayuda:
          'Mínimo tres. Y en cada uno, qué exactamente: el video de portada, ' +
          'cómo se ve la ficha, la forma de comprar, la tipografía.',
        tipo: 'links',
        requerido: true,
      },
      {
        id: 'videos',
        notaPh: '¿Qué te gustó de ese video?',
        grupo: 'Lo que les gusta',
        etiqueta: 'Videos de referencia',
        ayuda:
          'Un reel, un TikTok, el video de otra marca. Peguen el link o suban ' +
          'el archivo.',
        tipo: 'links',
      },
      { id: 'videos_archivos', grupo: 'Lo que les gusta', etiqueta: 'Archivos de video', tipo: 'archivos' },
      {
        id: 'efectos',
        grupo: 'Los efectos',
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
        grupo: 'Los efectos',
        etiqueta: 'Si solo pudiéramos hacer UNO increíble, ¿cuál?',
        ayuda:
          'Esta respuesta manda. Es la que va a la portada y la que la gente ' +
          'va a recordar.',
        tipo: 'texto',
        requerido: true,
      },
      {
        id: 'tono',
        grupo: 'Los efectos',
        etiqueta: '¿Qué tan lejos vamos?',
        tipo: 'escala',
        extremos: ['Sobrio y elegante', 'Espectacular y cinematográfico'],
        requerido: true,
      },
      {
        id: 'no_gustan',
        notaPh: '¿Por qué no?',
        grupo: 'Lo que no les gusta',
        etiqueta: 'Sitios que NO les gustan, y por qué',
        ayuda: 'Esto nos sirve más que los que sí les gustan. En serio.',
        tipo: 'links',
      },
      {
        id: 'moodboard',
        grupo: 'Lo que les gusta',
        etiqueta: 'Moodboard, Pinterest, capturas',
        tipo: 'archivos',
      },
      {
        id: 'idioma',
        grupo: 'Un detalle más',
        etiqueta: 'Idiomas del sitio',
        tipo: 'opcion',
        opciones: ['Solo español', 'Español e inglés', 'Español ahora, inglés después'],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 4 ──
  {
    clave: 'catalogo',
    orden: 6,
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
        grupo: 'Cómo se organizan las piezas',
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
        grupo: 'Cómo se organizan las piezas',
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
        grupo: 'El precio',
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
        grupo: 'El precio',
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
        grupo: 'Las piezas del lanzamiento',
        etiqueta: 'Las 10 a 15 piezas con las que queremos abrir',
        ayuda: 'Las que enamoran. Nombre, código o foto — como lo tengan.',
        tipo: 'parrafo',
        requerido: true,
      },
      { id: 'hero_archivos', grupo: 'Las piezas del lanzamiento', etiqueta: 'Fotos de esas piezas', tipo: 'archivos' },
      {
        id: 'configurador',
        grupo: 'Diamantes y configurador',
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
        grupo: 'Diamantes y configurador',
        etiqueta: 'Catálogo de diamantes del proveedor',
        ayuda:
          'Nombre del proveedor, contacto técnico (correo y teléfono) y si ya ' +
          'tienen credenciales o documentación del API. Esto es lo que más ' +
          'atrasa un proyecto así, por eso lo pedimos desde ahora.',
        tipo: 'parrafo',
        requerido: true,
      },
      { id: 'api_archivos', grupo: 'Diamantes y configurador', etiqueta: 'Documentación del proveedor', tipo: 'archivos' },
      {
        id: 'certificados',
        grupo: 'Diamantes y configurador',
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
        grupo: 'Personalización',
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
        grupo: 'Personalización',
        etiqueta: 'Tiempos de cada personalización',
        ayuda: 'El cliente los va a ver en la ficha antes de comprar.',
        tipo: 'texto',
      },
      {
        id: 'fotografia',
        grupo: 'La fotografía',
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
        grupo: 'La fotografía',
        etiqueta: '¿Tienen fotografía 360° o video de las piezas?',
        tipo: 'opcion',
        opciones: ['Sí, de varias piezas', 'De unas cuantas', 'No, ninguna'],
      },
      {
        id: 'inventario',
        grupo: 'El inventario',
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
        grupo: 'El inventario',
        etiqueta: 'Su catálogo o inventario en Excel',
        ayuda: 'Si ya lo tienen en un archivo, súbanlo aunque esté sucio.',
        tipo: 'archivos',
      },
    ],
  },


  // ─────────────────────────────────────────────────────────────── 7 ──
  {
    clave: 'servicio',
    orden: 7,
    titulo: 'Servicio y post-venta',
    resumen:
      'Reparaciones es hoy el segundo módulo más usado de su cuenta en Sacs, y ' +
      'en lo contratado van las membresías de reparaciones y servicios. En ' +
      'joyería el servicio no es post-venta: es la razón por la que un cliente ' +
      'vuelve a los diez años. Aquí se decide cuánto de eso se ve en el sitio.',
    entrega:
      'El catálogo de servicios con sus precios y tiempos, la membresía ' +
      'definida y la garantía escrita pieza por pieza.',
    campos: [
      {
        id: 'servicios',
        grupo: 'Lo que ya hacen',
        etiqueta: '¿Qué servicios dan hoy?',
        tipo: 'multiple',
        requerido: true,
        otro: true,
        opciones: [
          'Limpieza y pulido',
          'Cambio de talla (resize)',
          'Baño de rodio',
          'Soldadura y reparación de cadena',
          'Reengaste de piedra',
          'Cambio de piedra',
          'Restauración de pieza antigua',
          'Grabado',
          'Avalúo o tasación',
          'Cambio de pila y servicio de reloj',
          'Diseño de pieza a la medida',
        ],
      },
      {
        id: 'servicios_precio',
        grupo: 'Lo que ya hacen',
        etiqueta: '¿Cuáles son gratis y cuáles se cobran?',
        ayuda:
          'Con precios, aunque sean "desde". Si la limpieza de por vida es ' +
          'gratis para quien compró aquí, eso va en la ficha de cada pieza — ' +
          'es de las cosas que más cierran una venta en línea.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'servicios_tiempo',
        grupo: 'Lo que ya hacen',
        etiqueta: '¿Cuánto tarda cada uno?',
        ayuda: 'El cliente lo va a ver antes de pedirlo.',
        tipo: 'parrafo',
      },
      {
        id: 'taller',
        grupo: 'Lo que ya hacen',
        etiqueta: 'El taller: ¿propio o externo?',
        ayuda:
          '¿En qué boutique está? ¿Se puede reparar joyería que no se compró ' +
          'en Ruben’s? Eso último abre un negocio entero.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'membresia_que',
        grupo: 'La membresía',
        etiqueta: '¿Qué incluye la membresía de servicio?',
        ayuda:
          'Ya está contratada la personalización. Falta decidir qué vende: ' +
          'limpiezas al año, un resize gratis, revisión de engaste, prioridad ' +
          'en el taller, garantía extendida.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'membresia_precio',
        grupo: 'La membresía',
        etiqueta: '¿Cuánto cuesta y cada cuándo se paga?',
        tipo: 'texto',
      },
      {
        id: 'membresia_venta',
        grupo: 'La membresía',
        etiqueta: '¿Cómo llega a manos del cliente?',
        tipo: 'multiple',
        opciones: [
          'Se vende en el sitio, como un producto más',
          'Se vende solo en boutique',
          'Se regala con las piezas de cierto monto',
          'Va incluida siempre, sin costo',
        ],
      },
      {
        id: 'membresia_alcance',
        grupo: 'La membresía',
        etiqueta: '¿Aplica solo a piezas compradas en Ruben’s, o a cualquier joya?',
        ayuda:
          'Si aplica a cualquier joya, la membresía es una puerta de entrada ' +
          'para clientes nuevos, no solo un beneficio para los de casa.',
        tipo: 'opcion',
        opciones: [
          'Solo piezas compradas aquí',
          'Cualquier joya, venga de donde venga',
          'Cualquier joya, pero a distinto precio',
        ],
      },
      {
        id: 'garantia_que',
        grupo: 'La garantía',
        etiqueta: '¿Qué cubre la garantía y por cuánto tiempo?',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'garantia_no',
        grupo: 'La garantía',
        etiqueta: '¿Qué NO cubre?',
        ayuda:
          'Golpes, pérdida de piedra por uso, trabajo hecho en otro taller. ' +
          'Decirlo claro desde el principio evita el pleito después.',
        tipo: 'parrafo',
      },
      {
        id: 'garantia_papel',
        grupo: 'La garantía',
        etiqueta: '¿Cómo comprueba el cliente que la pieza es suya y está en garantía?',
        ayuda:
          'Nota, certificado, número de serie. Aquí se conecta con los ' +
          'certificados digitales y en PVC que ya están contratados.',
        tipo: 'parrafo',
      },
      {
        id: 'devolucion_real',
        grupo: 'La garantía',
        etiqueta: '¿Aceptan devoluciones? ¿En qué casos y en cuántos días?',
        ayuda:
          'En línea la ley pide algo distinto que en mostrador. Digan lo que ' +
          'hacen hoy de verdad y nosotros lo ajustamos.',
        tipo: 'parrafo',
      },
      {
        id: 'sitio_reparacion',
        grupo: 'Qué de esto vive en el sitio',
        etiqueta: '¿El cliente puede pedir una reparación desde el sitio?',
        tipo: 'opcion',
        requerido: true,
        opciones: [
          'Sí, que levante la orden y le den cita',
          'Que solo pida informes y el taller le contesta',
          'No, eso se hace en boutique',
        ],
      },
      {
        id: 'sitio_estatus',
        grupo: 'Qué de esto vive en el sitio',
        etiqueta: '¿Puede ver en qué va su reparación?',
        ayuda:
          'El dato ya existe en Sacs — hoy son 15 órdenes. Enseñarlo es de las ' +
          'cosas más baratas y más agradecidas del proyecto.',
        tipo: 'opcion',
        opciones: [
          'Sí, con un folio y sin cuenta',
          'Sí, pero entrando con su correo',
          'No hace falta',
        ],
      },
      {
        id: 'sitio_avisos',
        grupo: 'Qué de esto vive en el sitio',
        etiqueta: '¿Le avisamos cuando su pieza está lista?',
        tipo: 'multiple',
        opciones: ['Por WhatsApp', 'Por correo', 'Le hablamos por teléfono', 'No, él llama'],
      },
      {
        id: 'servicios_archivos',
        grupo: 'Qué de esto vive en el sitio',
        etiqueta: 'Su lista de precios de servicios, si la tienen en papel o Excel',
        tipo: 'archivos',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 8 ──
  {
    clave: 'operacion',
    orden: 8,
    titulo: 'Operación y lanzamiento',
    resumen:
      'Lo que hace que el sitio pueda cobrar, enviar y salir al aire. Son ' +
      'trámites, pero son los que detienen un lanzamiento el último día.',
    entrega: 'Fecha de salida confirmada, cobros probados y su equipo capacitado.',
    campos: [
      {
        id: 'dominio',
        grupo: 'El dominio',
        etiqueta: 'Dominio y quién controla el DNS',
        ayuda:
          'Qué dirección va a usar y quién tiene el acceso hoy: ustedes, una ' +
          'agencia, un proveedor anterior. Vamos a necesitar entrar.',
        tipo: 'texto',
        requerido: true,
      },
      {
        id: 'pagos',
        grupo: 'Cómo van a cobrar',
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
        grupo: 'Cómo van a cobrar',
        etiqueta: 'Si van meses sin intereses: banco o terminal, y a cuántos meses',
        tipo: 'texto',
      },
      {
        id: 'envio',
        grupo: 'Envío y garantías',
        etiqueta: 'Envío de joyería',
        ayuda:
          'Paquetería, si va asegurado, quién empaca, si hay recolección en ' +
          'boutique y a qué zonas envían.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'politicas',
        grupo: 'Envío y garantías',
        etiqueta: 'Devoluciones, garantía, resize y limpieza',
        ayuda: 'Si ya está escrito, súbanlo. Si no, cuéntenlo como lo manejan hoy.',
        tipo: 'parrafo',
      },
      { id: 'politicas_archivos', grupo: 'Envío y garantías', etiqueta: 'Políticas en archivo', tipo: 'archivos' },
      {
        id: 'legales',
        grupo: 'Datos fiscales',
        etiqueta: 'Razón social, RFC y domicilio fiscal',
        ayuda: 'Para el aviso de privacidad, los términos y la facturación.',
        tipo: 'parrafo',
        requerido: true,
      },
      {
        id: 'admin',
        grupo: 'El equipo',
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
        grupo: 'El equipo',
        etiqueta: '¿Quién más aprueba?',
        ayuda:
          'Si quien decide no es quien está contestando este brief, es mejor ' +
          'saberlo hoy que en la revisión final.',
        tipo: 'parrafo',
      },
      {
        id: 'fecha',
        grupo: 'El equipo',
        etiqueta: '¿Hay una fecha que no se puede mover?',
        ayuda: 'Una campaña, un aniversario, la temporada de bodas.',
        tipo: 'texto',
      },
      {
        id: 'analitica',
        grupo: 'Medición y campañas',
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
