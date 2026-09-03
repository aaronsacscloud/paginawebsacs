// CONOCIMIENTO DEL AGENTE · LOS GIROS DE MODA.
//
// Sacs es un sistema para el retail de MODA: solo estos ocho giros existen en
// el sitio y solo de estos habla el agente (decisión del dueño, 2026-09-02).
// Cada ficha sale de la página pública del giro (src/pages/giros/*.astro,
// src/data/giros/*.ts, navigation.ts) más el conocimiento del oficio; el
// agente recibe SOLO la ficha del giro del lead, no las ocho.
//
// Regla: lo que dice una ficha debe ser verdad en el sitio y en plans.ts. Las
// suites NO se venden aparte: son segmentación por giro (lo que se instala por
// ser de ese giro). Los extras/plugins solo se mencionan; el consultor los ve
// en la reunión. El agente solo da precios de licencia. La conversación cambia
// por tamaño (1–2 tiendas vs. 3+): validado con el dueño el 2026-09-02.

export type GiroId =
  | 'ropa' | 'multimarca' | 'consignacion' | 'merch' | 'novias' | 'activewear' | 'zapateria' | 'joyeria';

export type FichaGiro = {
  id: GiroId;
  nombre: string;
  /** Cómo le dicen ellos a su negocio (para reconocerlo en lo que escriben). */
  alias: string[];
  landing: string;
  queVenden: string;
  comoOperan: string;
  /** Lo que les duele, en sus palabras (sale del sitio). */
  dolores: string[];
  /** Palabras del oficio: si el lead las usa, es de este giro. */
  vocabulario: string[];
  /** Las 3 preguntas de descubrimiento que más dicen de su operación. */
  preguntas: string[];
  /** Lo primero que se le enseña en la demo y por qué. */
  moduloPrincipal: string;
  /** Cómo se resume Sacs para este giro, en una línea que ellos entienden. */
  argumento: string;
  /** Cómo cambia la conversación por tamaño (regla del dueño: 1–2 tiendas = vender rápido y sencillo; 3+ = control y automatización). */
  tamano: { chica: string; grande: string };
  /** Lo que más le importa al evaluar (validado por el dueño 2026-09-02). */
  lesImporta: string[];
  /** Lo que busca de verdad cuando escribe. */
  buscan: string[];
  /** Cómo le gusta que le hablen. */
  tono: string[];
  /** Lo que se instala POR SER de este giro (las suites no se venden aparte: son segmentación por giro). */
  incluidoPorGiro: string[];
  /** Extras/plugins que solo se mencionan; el consultor los ve en la reunión. */
  extrasMencionar: string[];
  /** Caso de éxito que le habla (id de casos.ts) o null. */
  caso: string | null;
  /** Señales de valor alto para el score. */
  valorAlto: string[];
};

export const GIROS: FichaGiro[] = [
  {
    id: 'ropa',
    nombre: 'Tiendas y marcas de ropa',
    // MAYOREO DE ROPA cae aquí pero habla distinto: su cliente es una tienda (no «clienta»), vende por paquete/docena/surtido, lista de mayoreo y crédito, pedidos por WhatsApp o catálogo; una bodega puede ser cuenta grande. Tono neutro; módulos primero: cotización→pedido, listas mayoreo/menudeo, ventas a crédito y saldos, catálogo para que el cliente pida solo.
    alias: ['boutique', 'tienda de ropa', 'marca de ropa', 'ropa', 'mayoreo de ropa', 'venta a mayoreo', 'apparel', 'ropa de dama', 'ropa de caballero', 'ropa infantil', 'moda', 'bisutería', 'accesorios', 'bolsas'],
    landing: 'https://www.sacscloud.com/giros/marcas-de-ropa',
    queVenden: 'Prendas por talla y color: una blusa en seis tallas y cuatro colores son 24 existencias distintas que comprar, contar y reponer.',
    comoOperan: 'Una boutique o varias tiendas (a veces con bodega/CEDIS), compran por temporada (PV/OI) o por colección/drop, venden en piso, en línea, por WhatsApp e Instagram; el cambio de talla es el pan de cada día.',
    dolores: [
      'La M se acabó el primer fin de semana y la XXL lleva dos temporadas colgada.',
      '«¿Tendrás esta en chica?» — y hay que llamar a la otra tienda.',
      'Vendiste en línea una talla que ya se había vendido en el mostrador.',
      'La clienta pregunta por WhatsApp y nadie sabe si eso sigue disponible.',
      'Dejaste 40 vestidos en una departamental y nadie sabe cuántos se vendieron.',
      'Compraste parejo de todas las tallas porque así se ha hecho siempre.',
    ],
    vocabulario: ['talla', 'curva', 'matriz', 'temporada', 'colección', 'drop', 'colgada', 'percha', 'cambio de talla', 'departamental', 'traspaso', 'sucursal', 'probador', 'look', 'outfit', 'remate'],
    preguntas: [
      '¿Cuántas veces a la semana te piden una talla que no tienes o no sabes si está en la otra tienda?',   // pregunta de MAGNITUD: sin número no hay urgencia
      '¿Cuántas tiendas tienes y vendes también en línea o por WhatsApp/Instagram?',
      '¿Cómo llevas hoy las tallas y colores: libreta, Excel u otro sistema?',
      '¿Qué te pasa más seguido: que se te acabe una talla sin darte cuenta, o que se te quede prenda colgada?',
    ],
    moduloPrincipal: 'La matriz de tallas y colores con existencia por talla en cada tienda, y el cambio de talla en el mostrador. Es lo que ningún sistema genérico entiende.',
    argumento: 'Tu tienda no vende productos: vende tallas y colores. Sacs lleva la existencia por talla en cada tienda, con un mismo inventario para tu piso, tu tienda en línea, tu WhatsApp y tus marketplaces.',
    tamano: { chica: 'Una boutique que empieza: quiere vender rápido, sencillo, tallas y colores, y su tienda en línea (la de Sacs o la que ya trae: WooCommerce, Shopify) integrada. No le hables de CEDIS ni de reportes.', grande: '3+ tiendas: control — qué talla hay en cada tienda, traspasos, compra por curva, sell-through — y automatización (avisos, resurtido, IA).' },
    lesImporta: ['Que el sistema entienda tallas y colores desde el día uno (ya probó uno genérico y no las entendía).', 'Vender en línea y por WhatsApp sin sobrevender lo que ya se vendió en el piso.', 'Ver qué se vendió y qué se quedó, por talla, modelo y tienda, para comprar mejor la siguiente temporada.'],
    buscan: ['Salir de un sistema que no le sirve (genérico o desarrollo a la medida sin soporte) sin dolor.', 'Comparar precio: está cotizando varios y el precio por sucursal es lo primero que quiere oír — dáselo después de saber qué vende y cuántas tiendas tiene.'],
    tono: ['Con su vocabulario: talla, curva, colgada, temporada, percha.', 'Cercano, de tú, en femenino («clienta», «tu boutique»), cálido y profesional.'],
    incluidoPorGiro: ['Todo lo de moda va con el plan: matriz talla × color, cambios de talla, apartados, tienda en línea y redes, temporada/colección/drop. Lo que deja en departamentales (consigna) se instala si lo menciona.'],
    extrasMencionar: ['Probador virtual, foto y video con IA, lookbooks, pre-órdenes: se mencionan si pregunta; el consultor los ve en la reunión.'],
    caso: 'casa-maca',
    valorAlto: ['2 o más tiendas', 'tiene CEDIS o bodega', 'vende en línea y en piso', 'marca propia con producción'],
  },
  {
    id: 'multimarca',
    nombre: 'Boutique multimarca',
    alias: ['boutique multimarca', 'multimarca', 'varias marcas', 'tienda de diseñadores', 'concept store'],
    landing: 'https://www.sacscloud.com/giros/boutique-multimarca',
    queVenden: 'Prendas y accesorios de varias marcas y varios proveedores en un mismo espacio; parte en firme y parte en consigna.',
    comoOperan: 'Reciben proveedores cada semana (la mercancía llega sin código de barras), compran en expos por temporada, arman looks de varias marcas, apartan con abonos y necesitan saber qué marca deja dinero y cuál solo ocupa percha.',
    dolores: [
      'Llegaron tres proveedores el mismo martes y ninguno trae código de barras.',
      'El de la consigna pasa el viernes y nadie sabe cuánto se le debe.',
      'La marca nueva se ve preciosa — y no ha vendido una pieza en tres semanas.',
      'Compraste en la expo por corazonada, porque el corte por marca no existe.',
      'El remate de enero se come el margen que dejó diciembre.',
    ],
    vocabulario: ['marca', 'proveedor', 'consigna', 'en firme', 'expo', 'percha', 'corte por marca', 'margen', 'etiquetar', 'look', 'apartado', 'vale'],
    preguntas: [
      '¿Cuántos modelos dirías que tienes con la corrida rota (sin las tallas de en medio) ahora mismo?',   // pregunta de MAGNITUD: sin número no hay urgencia
      '¿Con cuántas marcas o proveedores trabajas, y alguna te deja mercancía en consigna?',
      '¿Cómo sabes hoy qué marca te está dejando y cuál no?',
      '¿La mercancía te llega con código de barras o la etiquetas tú?',
    ],
    moduloPrincipal: 'Cada prenda con su marca, su proveedor y su costo; etiquetado al recibir; y el corte que dice qué marca vendió y cuál se quedó.',
    argumento: 'Cada prenda con su marca y su proveedor, el corte que dice qué marca paga la percha que ocupa, y un solo inventario para el piso, la tienda en línea y el WhatsApp.',
    tamano: { chica: 'Una boutique chica: lo que vende es lo básico — cobrar, tallas y colores, apartados y su tienda en línea. Lo de marcas y proveedores viene después, no lo abras tú.', grande: 'Multimarca grande o con bodega: corte por marca y proveedor, margen por marca, recepción y etiquetado, resurtido por marca para llegar a la expo con datos.' },
    lesImporta: ['Saber qué marca le deja dinero y cuál solo ocupa percha (compra en la expo por corazonada).', 'Si es chica: vender rápido y en línea; lo demás después.', 'La consigna SOLO si ella la menciona o si tú preguntas y dice que sí: entonces cuentas claras con cada proveedor.'],
    buscan: ['Orden entre muchos proveedores: ya no sabe qué tiene de quién ni cuánto debe.', 'Salir de un sistema genérico donde todo es «producto», sin marca ni proveedor.'],
    tono: ['Con su vocabulario: marca, proveedor, consigna, expo, percha, corte.', 'Honesto con lo que se instala según su caso: genera confianza, no la espanta.', 'Con casos: Casa Maca (dos boutiques + línea) le habla.'],
    incluidoPorGiro: ['Marca y proveedor en cada prenda, etiquetado al recibir y corte por marca van con el plan. La consigna (lo del proveedor separado de lo firme y su liquidación) se instala cuando la boutique trabaja consigna.'],
    extrasMencionar: ['Probador virtual, lookbooks, foto con IA: solo si pregunta; se ven en la reunión.'],
    caso: 'casa-maca',
    valorAlto: ['más de 10 proveedores', 'trabaja consigna', 'más de una tienda'],
  },
  {
    id: 'consignacion',
    nombre: 'Consignación y segunda mano',
    alias: ['consignación', 'segunda mano', 'preloved', 'bazar', 'vintage', 'clóset', 'closet sale', 'resale', 'tienda de consignación'],
    landing: 'https://www.sacscloud.com/giros/consignacion',
    queVenden: 'El clóset de sus clientas: piezas únicas que no son suyas, a comisión pactada por contrato, con Lives y tienda en línea.',
    comoOperan: 'Reciben clósets (una clienta llega con dos maletas), valúan, firman contrato con comisión y vigencia, exhiben en piso y en Live, rinden cuenta a cada consignante, pagan o dejan saldo a favor, y regresan lo que no se vendió.',
    dolores: [
      '«¿Ya se vendió algo mío?» — y a buscar en la libreta.',
      'El contrato está en una carpeta y la comisión «era 40… ¿o 45?».',
      'Se vendió en el Live y nadie la bajó de la tienda en línea.',
      'La bolsa dudosa sigue exhibida porque nadie decidió si es original.',
      'Vino por sus piezas y tardaste una hora en juntarlas.',
      'Vendiste dos veces la misma pieza única.',
    ],
    vocabulario: ['consignante', 'comisión', 'contrato', 'pieza única', 'Live', 'saldo a favor', 'liquidación', 'retiro', 'vigencia', 'autenticidad', 'clóset'],
    preguntas: [
      '¿Cuántas consignantes te preguntan a la semana «¿ya se vendió algo mío?»?',   // pregunta de MAGNITUD: sin número no hay urgencia
      '¿Cuántas consignantes activas tienes y cómo les rindes cuentas hoy?',
      '¿Haces Lives o vendes en línea además del piso?',
      '¿Cómo llevas el contrato y la comisión de cada pieza: libreta, Excel, otro sistema?',
    ],
    moduloPrincipal: 'La Suite de Consignación: cada pieza con su dueña y su comisión, el estado de cuenta que la consignante ve sola, y el Live con piezas contadas.',
    argumento: 'Tu tienda no vende inventario: vende el clóset de tus clientas. Cada pieza con su dueña, su comisión por contrato y su cuenta clara — y la liquidación sale sola.',
    tamano: { chica: 'Bazar o tienda que empieza: cobrar, apartar la pieza de verdad y vender en línea; la cuenta por consignante en lo básico. Sencillo.', grande: 'Consignación con lista de espera, Lives y muchas consignantes: contrato con firma remota, estado de cuenta y saldo a favor, Lives con piezas contadas, retiros y disputas de autenticidad.' },
    lesImporta: ['No deberle a nadie sin saberlo: lo vendido sin liquidar es dinero de la consignante.', 'Que la consignante no le llame: que vea sola en su portal qué se vendió y cuánto le toca.', 'No vender dos veces la misma pieza única entre piso, Live y tienda en línea.'],
    buscan: ['Salir de la libreta y el Excel: crecieron las consignantes y ya no cuadra.', 'Profesionalizar el Live y la línea: se le cruzan las piezas.', 'Un sistema que entienda consigna (probó uno donde todo era «producto tuyo»).', 'Precio: quiere saber cuánto cuesta antes de nada.'],
    tono: ['Con su vocabulario: consignante, comisión, pieza única, Live, saldo a favor, retiro.', 'Cercano, de tú, en femenino; es una comunidad de clientas.', 'Sencillo si apenas empieza.'],
    incluidoPorGiro: ['La consignación completa se instala por ser de este giro: cada pieza con su dueña y comisión, contrato con firma remota, estado de cuenta y saldo a favor, Lives, retiros. No es un extra.'],
    extrasMencionar: [],
    caso: null,
    valorAlto: ['más de 50 consignantes', 'hace Lives', 'tiene lista de espera'],
  },
  {
    id: 'merch',
    nombre: 'Merch de eventos',
    alias: ['merch', 'merchandising', 'mercancía oficial', 'conciertos', 'festivales', 'gira', 'tour', 'pop-up', 'feria', 'stand'],
    landing: 'https://www.sacscloud.com/giros/merchandising-eventos',
    queVenden: 'La playera del tour: pocos diseños en muchas tallas, vendidos en una ola de dos horas en varios módulos a la vez.',
    comoOperan: 'Montan módulos de venta en un venue (a veces sin internet), staff que cobra por primera vez esa noche, reabasto desde el camión durante el show, preventa que se entrega en la fila, corte por módulo de madrugada y la gira que sigue a otra ciudad.',
    dolores: [
      'El venue no tiene señal y la terminal se quedó pensando.',
      'La fila da vuelta al pasillo y se va con el encore.',
      'La M se acabó en el módulo 2 — y sobraba en el 4.',
      'Nadie sabe cuánto lleva vendido la noche, hasta mañana.',
      'La preventa se entrega palomeando una lista impresa.',
      'El corte se hace de madrugada, contando cajas en el camión.',
    ],
    vocabulario: ['módulo', 'venue', 'encore', 'preventa', 'fila', 'camión', 'gira', 'fecha', 'staff', 'corte', 'sin internet', 'bundle', 'kit'],
    preguntas: [
      '¿Cuántas piezas se te quedan sin vender por evento por no saber qué talla llevar de cada diseño?',   // pregunta de MAGNITUD: sin número no hay urgencia
      '¿Cuántos puntos de venta montas por fecha y cuántas fechas al mes?',
      '¿Qué te pasa cuando se cae el internet del venue?',
      '¿Cómo entregas hoy la preventa y cómo haces el corte de la noche?',
    ],
    moduloPrincipal: 'El POS que cobra sin internet, un almacén por módulo consolidado en vivo y la entrega de preventa con escáner. Probado en giras de 100+ puntos de venta.',
    argumento: 'Tu venta no dura un mes: dura dos horas. POS que cobra sin internet, un almacén por módulo, traspasos mientras suena el show y el corte por fecha — el sistema con el que se opera la mercancía oficial de giras en México.',
    tamano: { chica: 'Pop-up o pocas fechas: cobrar sin internet, inventario por módulo y el corte de la noche. Directo.', grande: 'Gira de varias ciudades y decenas de módulos: traspasos en vivo, preventa por escáner, la Torre de Control (semáforo por módulo con reabasto en vivo) y la tienda del artista después de la gira.' },
    lesImporta: ['Que no se caiga en la hora pico: perder ventas por sistema caído es su trauma (Liveshow perdió 20 % en dos horas).', 'Velocidad por venta: la fila se va con el encore.', 'Que el staff nuevo cobre esa misma noche con media hora de capacitación.', 'Rendir cuentas al artista o la productora con un corte confiable por módulo y fecha.'],
    buscan: ['Un sistema que aguante el evento (viene de una mala noche con terminales colgadas).', 'Control de inventario entre módulos: la M se acabó en el 2 y sobraba en el 4.', 'Cómo se cobra si no tiene tiendas sino fechas (módulos y almacenes de una gira no se cobran por separado; se define en la demo).'],
    tono: ['Con su vocabulario: módulo, venue, encore, preventa, gira, fecha, staff.', 'Con el caso Liveshow y cifras: 100+ puntos de venta, 150,000 transacciones, sin internet.', 'Neutro/masculino, ejecutivo y de operación: menos «clienta», más «tu fecha».'],
    incluidoPorGiro: ['Cobrar sin internet, un almacén por módulo, traspasos durante el show, entrega de preventa por escáner y corte por módulo van con el plan para este giro; la Torre de Control se instala en giras grandes.'],
    extrasMencionar: [],
    caso: 'liveshow',
    valorAlto: ['más de 10 módulos por fecha', 'gira de varias ciudades', 'preventa en línea'],
  },
  {
    id: 'novias',
    nombre: 'Novias y fiesta',
    alias: ['novias', 'vestidos de novia', 'XV años', 'quince años', 'fiesta', 'casa de novias', 'graduación', 'renta de vestidos'],
    landing: 'https://www.sacscloud.com/giros/novias-y-fiesta',
    queVenden: 'Vestidos de novia, XV años y fiesta: el piso vive de muestras por talla y lo de ella se pide sobre pedido contra la fecha del evento.',
    comoOperan: 'Apartan con anticipo y abonos largos que cierran dos semanas antes de la boda, piden el vestido al proveedor con fecha amarrada al evento, el taller ajusta por etapas (primera prueba, ajuste, prueba final, plancha, entrega) y la semana de la entrega todo converge.',
    dolores: [
      'La boda es el 14 de marzo y el vestido «ya merito llega».',
      '«¿Cuánto debo?» — y a buscar el cuaderno de abonos.',
      'La muestra talla 6 se vendió — y era la única.',
      'La costurera tiene ocho vestidos y nadie sabe cuál va primero.',
      'El papá abonó en efectivo y el recibo quedó en una servilleta.',
    ],
    vocabulario: ['apartado', 'abono', 'anticipo', 'fecha del evento', 'muestra', 'sobre pedido', 'taller', 'prueba', 'ajuste', 'entrega', 'novia', 'quinceañera'],
    preguntas: [
      '¿Cuántos vestidos tienes apartados hoy y cuántas horas a la semana se te van en seguir anticipos y ajustes?',   // pregunta de MAGNITUD: sin número no hay urgencia
      '¿Cuántos apartados vivos traes ahorita y cómo llevas los abonos?',
      '¿Vendes sobre pedido contra la fecha del evento o de muestras en piso?',
      '¿Tienes taller de ajustes propio?',
    ],
    moduloPrincipal: 'El apartado con la fecha del evento adentro y los abonos con recordatorio; luego el taller por etapas con órdenes de servicio.',
    argumento: 'Tu venta no termina en la caja: termina en una fecha. El apartado con la boda adentro, los abonos que cierran dos semanas antes, el pedido que tiene que llegar y el taller con sus pruebas — todo contando hacia atrás desde el evento.',
    tamano: { chica: 'Casa chica: cobrar, apartar con la fecha del evento y llevar los abonos sin cuaderno. El taller y el catálogo después.', grande: 'Casa que viste a media ciudad: taller por etapas con fechas y responsable, muestras vs. sobre pedido, la semana de entregas, la familia que vuelve (XV, boda, graduación).' },
    lesImporta: ['No fallarle a una fecha: la boda no se mueve; que el pedido y el taller lleguen a tiempo y lo tardío se vea en rojo.', 'Abonos sin cuaderno ni servilleta: cuánto debe cada familia y que el recibo exista.', 'No vender la muestra única por error.'],
    buscan: ['Salir del cuaderno de abonos.', 'Un sistema que entienda fechas de evento (probó uno donde la venta «se entrega hoy»).', 'Tener página o catálogo para que la novia se lo enseñe a su mamá y al grupo de la boda.', 'Precio.'],
    tono: ['Con su vocabulario: apartado, abono, anticipo, prueba, muestra, entrega, fecha.', 'Con ejemplos concretos: «Valeria, boda el 14 de marzo, 30 % de anticipo» aterriza mejor que una lista.', 'Sencillo si es una casa chica.'],
    incluidoPorGiro: ['Apartado con fecha de evento y abonos con recordatorio, muestras marcadas, pedido contra la fecha y el taller por etapas (órdenes de servicio) se instalan por ser de este giro.'],
    extrasMencionar: [],
    caso: null,
    valorAlto: ['taller propio', 'más de 30 apartados vivos', 'más de una casa'],
  },
  {
    id: 'activewear',
    nombre: 'Marcas de activewear',
    alias: ['activewear', 'ropa deportiva', 'leggings', 'sets', 'drops', 'marca deportiva', 'fitness', 'gym wear'],
    landing: 'https://www.sacscloud.com/giros/activewear',
    queVenden: 'Sets (top + legging) por colorway que salen en drops a una hora exacta, en línea y en showroom, a una comunidad que vuelve.',
    comoOperan: 'Producen lotes por colorway, lanzan el drop en tienda en línea + Instagram + TikTok Shop + showroom con un solo inventario, empacan pedidos, cambian tallas por paquetería y piden el siguiente lote con la venta del anterior.',
    dolores: [
      'El drop salió a las 8 y a las 8:20 ya habías sobrevendido la S.',
      'El top voló y el legging se quedó viudo en el rack.',
      'La clienta pide cambio de talla y su talla ya voló.',
      'Instagram dice que hay, la bodega dice que no.',
      'El lote nuevo se pidió de memoria — y volvió a sobrar la L.',
    ],
    vocabulario: ['drop', 'colorway', 'set', 'top', 'legging', 'restock', 'lote', 'showroom', 'sobreventa', 'TikTok Shop', 'comunidad', 'avísame'],
    preguntas: [
      '¿Cuántos pedidos de tu tienda en línea se te caen al mes por talla agotada que sí tenías en tienda?',   // pregunta de MAGNITUD: sin número no hay urgencia
      '¿Vendes por drops? ¿En qué canales sale el drop y cómo evitas sobrevender?',
      '¿Cómo llevas hoy el set: como una pieza o como dos?',
      '¿Cuántas piezas produce un lote y cómo decides el siguiente?',
    ],
    moduloPrincipal: 'El drop con un solo inventario en todos los canales (la talla agotada se apaga sola) y el set como kit con el descase visible por talla.',
    argumento: 'Tu marca no vende piezas: vende sets que no deben romperse. El drop sale a la hora exacta con un solo inventario para tu tienda en línea, tus redes y tu showroom; el kit empuja al set completo; y el siguiente lote se pide con datos.',
    tamano: { chica: 'Marca que empieza en drops: que Shopify/TikTok/Instagram y su bodega hablen el mismo inventario, el set como kit y el cambio de talla. Rápido.', grande: 'Marca con showroom y fila afuera: POS del showroom con la línea, empaque y envíos, lote pedido con datos del drop anterior, comunidad con lista de avísame y campañas de restock.' },
    lesImporta: ['No sobrevender el drop: vender la S dos veces destruye la confianza de la comunidad.', 'Que Shopify, TikTok Shop e Instagram se conecten de verdad con lo que ya trae, no reemplazarlo a la fuerza.', 'Empacar y enviar rápido; cambios por paquetería contra inventario real.', 'Pedir el siguiente lote con datos, sin que sobre la L otra vez.'],
    buscan: ['Unir bodega, showroom y línea: Instagram dice que hay, la bodega dice que no.', 'Precio y cómo se cobra si no tiene tiendas.'],
    tono: ['Con su vocabulario: drop, colorway, set, restock, comunidad, lote, avísame. Lenguaje de marca digital, no de tienda tradicional.'],
    incluidoPorGiro: ['Drop con un solo inventario en todos los canales, sets como kits con el descase visible, cambio de talla y lote con datos van con el plan.'],
    extrasMencionar: ['Foto y video de producto con IA, pre-órdenes de colección: se mencionan si pregunta.'],
    caso: 'sandmade',
    valorAlto: ['drops mensuales', 'TikTok Shop o Shopify activo', 'showroom físico'],
  },
  {
    id: 'zapateria',
    nombre: 'Zapaterías',
    alias: ['zapatería', 'calzado', 'zapatos', 'tenis', 'botas', 'sneakers'],
    landing: 'https://www.sacscloud.com/giros/zapateria',
    queVenden: 'Pares por modelo × color × número, con medios números: un modelo con la corrida rota ya es saldo aunque el reporte diga que hay 17 pares.',
    comoOperan: 'Muestra en el muro y la corrida en la bodega, cambio de número en el mostrador, apartados por quincena (agosto se juega en dos quincenas), pedido de temporada por embarques (León, SAPICA) y varias tiendas que se completan la corrida entre sí.',
    dolores: [
      'El 23½ se acabó el primer fin de semana.',
      'Del 27 te quedan tres pares desde la temporada pasada.',
      '«¿Me lo trae en el 24?» — y alguien camina a la bodega a ver.',
      'Ese modelo ya está roto: sin los números de en medio, eso ya es saldo.',
      'Le apretó el 26 y lo compró en la otra tienda.',
    ],
    vocabulario: ['corrida', 'número', 'medio número', 'par', 'horma', 'saldo', 'embarque', 'León', 'SAPICA', 'quincena', 'apartado', 'muro', 'caja'],
    preguntas: [
      '¿Cuántos modelos tienes hoy con los números de en medio agotados? (eso ya es saldo aunque el reporte diga que hay pares)',   // pregunta de MAGNITUD: sin número no hay urgencia
      '¿Cuántas tiendas tienes y cómo sabes hoy qué números quedan de cada modelo?',
      '¿Compras por embarques de temporada? ¿Cómo te llega el pedido?',
      '¿Manejas apartados por quincena?',
    ],
    moduloPrincipal: 'La corrida completa con medios números por tienda, el aviso de corrida rota y el cambio de número en el mostrador.',
    argumento: 'Tu tienda no vende modelos: vende números. Corrida completa con medios números, cambio de número en el mostrador, apartados por quincena y el pedido de temporada por embarques — con un mismo inventario para piso, línea y WhatsApp.',
    tamano: { chica: 'Una zapatería: cobrar, la corrida con medios números y los apartados por quincena. Práctico.', grande: '3+ tiendas con bodega: qué número hay en cada tienda, nivelar la corrida entre tiendas, el pedido de temporada por embarques y no comprar a ciegas.' },
    lesImporta: ['Saber qué número hay y dónde, sin que nadie camine a la bodega.', 'No comprar a ciegas la temporada: qué números reordenar y qué modelo ya es saldo.', 'Aguantar la quincena y el regreso a clases: fila, sin internet, varias cajas.', 'Cambiarse sin parar las tiendas: la migración la hacemos nosotros.'],
    buscan: ['Control de la corrida entre tiendas: se rompe en una y sobra en otra.', 'Salir de un sistema que no entiende números (de abarrotes o de ropa).', 'Vender en línea y por WhatsApp sin vender el par que ya estaba apartado.'],
    tono: ['Con su vocabulario: corrida, número, medio número, par, embarque, saldo, León, SAPICA.', 'Neutro/masculino, práctico y directo; negocios familiares.'],
    incluidoPorGiro: ['Corrida con medios números por tienda, cambio de número en el mostrador, apartados por quincena, pedido por embarques y traspasos van con el plan para este giro.'],
    extrasMencionar: [],
    caso: 'la-bella-pandita',
    valorAlto: ['más de 2 tiendas', 'bodega central', 'compra por embarques'],
  },
  {
    id: 'joyeria',
    nombre: 'Joyerías',
    alias: ['joyería', 'joyeria fina', 'oro', 'plata', 'quilates', 'kilates', 'argollas', 'relojería'],
    landing: 'https://www.sacscloud.com/giros/joyeria',
    queVenden: 'Piezas que valen lo que pesan por lo que vale el gramo: dos anillos del mismo modelo no valen lo mismo porque no pesan lo mismo.',
    comoOperan: 'Fijan su precio del gramo de fino con su colchón, un factor por quilataje (10K/14K/18K), costo histórico del metal que no se mueve, repreciado de toda la vitrina cuando sube el oro, apartados largos (las argollas de enero para la boda de agosto), taller de reparaciones y compra de metal.',
    dolores: [
      'El oro subió en marzo y la vitrina sigue con el precio de agosto pasado.',
      'Dos anillos del mismo modelo, uno pesa 2.4 y otro 3.1.',
      'Reetiquetar la vitrina entera son tres domingos con la cortina abajo.',
      'La esclava te la dejaron a un precio en enero y a otro en junio: ¿ganaste o te vendiste barato?',
      'La hoja de cálculo del costeo solo la entiende el dueño.',
    ],
    vocabulario: ['gramo', 'quilataje', 'kilataje', 'fino', 'colchón', 'repreciar', 'vitrina', 'charola', 'peso', 'argollas', 'apartado', 'taller', 'compra de oro', 'LFPIORPI'],
    preguntas: [
      '¿Cuántas piezas tienes en vitrina con precio de antes de la última subida del oro?',   // pregunta de MAGNITUD: sin número no hay urgencia
      '¿Cómo pones hoy el precio: por pieza fija o por gramo según el oro?',
      '¿Qué haces cuando sube el oro: reetiquetas toda la vitrina?',
      '¿Cuántas vitrinas o sucursales tienes y manejas apartados largos?',
    ],
    moduloPrincipal: 'La Suite Joyería: precio del gramo con colchón, factor por quilataje, costo histórico inmutable y repreciar en masa con simulación antes de aplicar.',
    argumento: 'Tu vitrina no vende piezas: vende gramos. Tu precio del gramo de fino, el factor por quilataje que usa tu casa y el costo histórico que no se mueve — con un mismo inventario para piso, línea y WhatsApp.',
    tamano: { chica: 'Una vitrina que empieza (o bisutería): cobrar, catálogo con foto, apartados y tienda en línea. OJO: la BISUTERÍA no maneja gramos ni quilates: se trata como accesorios (talla única), nada de precio por gramo ni taller.', grande: 'Casa de joyería fina con varias sucursales: un solo precio del gramo para todas, repreciar en masa cuando sube el oro, costo histórico y margen real, taller de reparaciones, compra de oro y LFPIORPI.' },
    lesImporta: ['No venderse barato cuando sube el oro: la vitrina con precio de agosto pasado es dinero regalado.', 'Un solo precio del gramo en todas las sucursales.', 'Que el costeo no dependa de su hoja de Excel que solo él entiende.', 'Control del metal parado (cuánto oro hay en la charola que no rota) y del taller (los 0.3 g que faltaron).'],
    buscan: ['Un sistema que entienda gramos y quilates (los genéricos con precio fijo por pieza no se configuran para esto).', 'Reaccionar al precio del oro sin caos operativo.', 'Ordenar apartados largos y el taller de reparaciones.', 'Precio.'],
    tono: ['Con su vocabulario: gramo, quilataje, fino, colchón, charola, vitrina, argollas.', 'Con números y aritmética: un ejemplo con pesos y quilates reales convence más que adjetivos.', 'Discreción y confianza: valores altos y LFPIORPI; hablar de control y cumplimiento abre la puerta.'],
    incluidoPorGiro: ['Para joyería que vende oro y gemas se instala la suite completa: precio por gramo con colchón y factor por quilataje, repreciar en masa, costo histórico, compras de metal, LFPIORPI, y las órdenes de reparación junto a la joyería. Para bisutería nada de eso aplica.'],
    extrasMencionar: [],
    caso: null,
    valorAlto: ['varias sucursales con un solo precio del gramo', 'taller propio', 'compra de oro'],
  },
];

export const giroPorId = (id: string | null | undefined) => GIROS.find(g => g.id === id) || null;

/** Adivina el giro por lo que escribió el lead o por el texto libre del CRM. */
export function detectarGiro(texto: string): FichaGiro | null {
  const t = (texto || '').toLowerCase();
  if (!t) return null;
  let mejor: { g: FichaGiro; n: number } | null = null;
  for (const g of GIROS) {
    let n = 0;
    for (const a of g.alias) if (t.includes(a.toLowerCase())) n += 3;
    for (const v of g.vocabulario) if (t.includes(v.toLowerCase())) n += 1;
    if (n && (!mejor || n > mejor.n)) mejor = { g, n };
  }
  return mejor && mejor.n >= 3 ? mejor.g : null;
}

/** La ficha en texto para el prompt. */
export function fichaGiroTexto(g: FichaGiro): string {
  return `GIRO DEL LEAD: ${g.nombre}
Qué venden: ${g.queVenden}
Cómo operan: ${g.comoOperan}
Lo que les duele (en sus palabras): ${g.dolores.map(d => `· ${d}`).join(' ')}
POR TAMAÑO — averigua cuántas tiendas tiene antes de proponer nada:
· 1–2 tiendas (emprendedor): ${g.tamano.chica}
· 3 o más: ${g.tamano.grande}
Lo que le importa al evaluar: ${g.lesImporta.map(d => `· ${d}`).join(' ')}
Lo que busca de verdad cuando escribe: ${g.buscan.map(d => `· ${d}`).join(' ')}
Cómo hablarle: ${g.tono.map(d => `· ${d}`).join(' ')}
Preguntas de descubrimiento que sirven: ${g.preguntas.map(p => `· ${p}`).join(' ')}
Lo primero que se le enseña: ${g.moduloPrincipal}
Cómo se resume Sacs para este giro: ${g.argumento}
Lo que se instala por ser de este giro (NO se vende aparte, va con su plan): ${g.incluidoPorGiro.join(' ')}
${g.extrasMencionar.length ? `Extras que solo se mencionan (el consultor los ve en la reunión): ${g.extrasMencionar.join(' ')}` : ''}
Página del giro para mandarle: ${g.landing}`;
}
