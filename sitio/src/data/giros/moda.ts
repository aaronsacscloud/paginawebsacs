/**
 * Contenido de la Suite para Tiendas de Ropa.
 *
 * Todo el texto, los ejemplos y las imágenes de la página viven aquí. La página
 * (src/pages/giros/marcas-de-ropa.astro) solo compone bloques. Es lo que hace
 * que un giro nuevo sea un archivo de datos y no una copia del código.
 *
 * Regla de contenido: NADA genérico. Cada ejemplo se escribe con prendas,
 * tallas y colores reales — "playera oversize negra M" y no "producto A".
 */


export const cortinaModa = {
  fotoAntes: '/images/suite-moda-hoy.webp',
  fotoDespues: '/images/suite-moda-resuelto.webp',
  altAntes: 'Gerente de tienda al teléfono, buscando en su libreta si queda una talla',
  altDespues: 'La misma gerente, tranquila en el mostrador, consultando la existencia en su tablet',
  libreta: ['Blusa negra M — ¿quedan?', 'Vestido S … ¿en Satélite?'],
  filas: [
    { que: 'Blusa satinada negra · M', donde: 'Centro', dato: '4' },
    { que: 'Vestido midi verde · S', donde: 'Satélite', dato: '3' },
    { que: 'Vestido cruzado · M', donde: 'Departamental', dato: '31 vend.' },
  ],
};






/* ── Las cuatro situaciones del año en una tienda de ropa ── */
export const casosModa = [
  {
    id: 'entrega',
    titulo: 'Llegó la entrega y el piso ya no da',
    texto:
      'La segunda entrega llega cuando la primera sigue colgada. Se recibe contra la orden, talla por talla y color por color, y el reparto a tiendas sale del mismo documento en lugar de a ojo.',
    remate: 'La prenda que no está en piso no existe: no se ve, no se prueba y no se vende — pero sí se marca en julio.',
    img: '/images/caso-moda-entrega.webp',
    alt: 'Empleada acomodando prendas dobladas en los anaqueles del almacén, junto a un burro de ropa colgada',
  },
  {
    id: 'evento',
    titulo: 'Se llenó la tienda y nadie sabe qué se probó',
    texto:
      'El 10 de mayo o el Buen Fin se vende en tres días lo de tres semanas. La caja cobra aunque se caiga el internet, y la vendedora ve desde el probador si esa talla está en otra tienda antes de que la clienta se vaya.',
    remate: 'Al lunes te enteras de qué talla se acabó, cuando ya no hay a quién pedírsela.',
    img: '/images/caso-moda-evento.webp',
    alt: 'Tienda grande un sábado: tres vendedoras uniformadas atendiendo el piso, los probadores y el mostrador',
  },
  {
    id: 'corazon',
    titulo: 'Se acabó la M y la L, y la prenda todavía se veía bien',
    texto:
      'Va en 60% de vendido y parece un éxito, pero lo que queda son XS y XXL. El vendido se lee por talla y por color, no por estilo, y las tallas sueltas de cuatro tiendas se juntan para rearmar la curva.',
    remate: 'Un estilo sin su corazón de talla se muere en dos semanas, y el reporte lo mostraba como una sola línea.',
    img: '/images/caso-moda-corazon.webp',
    alt: 'Dos vendedoras uniformadas revisando talla por talla un riel largo en el piso de venta',
  },
  {
    id: 'cambio',
    titulo: 'Regresa a cambiar y la talla está en otra tienda',
    texto:
      'El cambio se hace aunque la prenda venga de otra sucursal: la diferencia se cobra o se abona al monedero, y queda registrado quién lo autorizó.',
    remate: 'Una de cada seis prendas vuelve, y casi siempre por talla. Ahí se decide si haces una segunda venta o devuelves el dinero.',
    img: '/images/caso-moda-cambio.webp',
    alt: 'Vendedora uniformada entregando una prenda a una clienta en el mostrador, junto a los probadores',
  },
];

/* ── Cómo se implementa, con lo que de verdad se carga en una tienda de ropa ── */
export const pasosModa = [
  {
    cuando: 'Día 1', titulo: 'Tu surtido, cargado',
    texto: 'Nos das tu archivo o tu base actual y lo subimos nosotros. No capturas nada.',
    detalle: 'Estilo, color y talla — no una lista de "productos". Con la curva de cada estilo y la existencia real de cada tienda.',
    img: '/images/proc-moda-1.webp',
    alt: 'Consultor con laptop y dos vendedoras uniformadas revisando el riel durante la carga del surtido',
  },
  {
    cuando: 'Día 2', titulo: 'Tu operación, configurada',
    texto: 'Queda como ya trabajas, no como el sistema quiere que trabajes.',
    detalle: 'Tus proveedores y tus entregas, quién puede autorizar una marcación y hasta qué piso puede bajar.',
    img: '/images/proc-moda-2.webp',
    alt: 'Dueña de boutique y consultor revisando documentos de proveedores en la oficina',
  },
  {
    cuando: 'Día 3', titulo: 'Capacitación',
    texto: 'Una sesión con tu equipo antes de abrir. Cobrar y buscar una talla se aprende en la primera media hora.',
    detalle: 'Y se practica lo que se usa a diario: el cambio de talla, el apartado con abonos y el corte.',
    img: '/images/proc-moda-3.webp',
    alt: 'Equipo de una boutique en capacitación alrededor del mostrador antes de abrir',
  },
  {
    cuando: 'Día 4', titulo: 'Arranca una tienda',
    texto: 'La primera sucursal vende con SACS. El sistema viejo sigue en pie por si acaso.',
    detalle: 'Con sus apartados vivos ya migrados: nadie llega a liquidar y se encuentra con que su papel no existe.',
    img: '/images/proc-moda-4.webp',
    alt: 'Cajera cobrando en una boutique con un compañero acompañando el primer día',
  },
  {
    cuando: 'Día 5', titulo: 'Arrancan las demás',
    texto: 'Con la primera resuelta, las otras entran el mismo día.',
    detalle: 'Y el traspaso de tallas entre tiendas ya corre desde el primer fin de semana, que es cuando se nota.',
    img: '/images/proc-moda-5.webp',
    alt: 'Dueña de una cadena de boutiques recorriendo el pasillo, revisando el inventario en su tablet',
  },
];

/* ── Las cuatro cosas que una tienda de ropa hace todos los días ── */
export const etapasModa = [
  {
    id: 'vender', nombre: 'Vender',
    resumen: 'El probador, el mostrador y tus canales cobrando la misma prenda con un solo inventario.',
    puntos: [
      'Venta por estilo, talla y color, con el color como eje propio',
      'Cambio exprés de talla, aunque la prenda venga de otra tienda (desde Controla)',
      'Apartado con anticipo, y abonos por parcialidades',
      'Cotizaciones, pedidos y ventas a crédito',
      'Listas de precios: la clienta frecuente y el mayoreo',
      'Tienda en línea con el mismo inventario del piso',
      'WhatsApp, Instagram, Facebook y TikTok Shop',
      'Ticket por WhatsApp, y la caja cobra sin internet',
    ],
  },
  {
    id: 'controlar', nombre: 'Controlar',
    resumen: 'La talla, lo que compraste con seis meses de anticipación y lo que de verdad te deja cada prenda.',
    puntos: [
      'Existencia por estilo, color y talla en cada tienda',
      'Traspasos entre tiendas y distribución desde el CEDIS',
      'Órdenes de compra por variante y recepción contra la entrega',
      'Historial de costos: la importación que llegó con otro tipo de cambio',
      'Conteo físico desde el celular y conteos cíclicos, sin cerrar',
      'Kardex, trazabilidad y control de mermas',
      'Costeo y utilidad por prenda, no solo por venta',
      'Cuánto llevas vendido de lo que compraste, por estilo — y aviso de la prenda que se quedó parada (en Automatiza)',
    ],
  },
  {
    id: 'fidelizar', nombre: 'Fidelizar',
    resumen: 'Tu clienta ya te dijo su talla y su color. El sistema lo recuerda mejor que tú.',
    puntos: [
      'Perfil con lo que compró, en qué talla y en qué color',
      'Segmentación por comportamiento de compra',
      'Monedero, puntos y niveles de recompensa',
      'El cambio se bonifica en monedero, sin sacar efectivo de la caja',
      'Tarjetas de regalo físicas y digitales',
      'Campañas por WhatsApp y por correo',
      'Portal de clientes con tu marca y autofacturación',
      'Membresías con cobro recurrente',
    ],
  },
  {
    id: 'administrar', nombre: 'Administrar',
    resumen: 'Tu equipo, tus permisos y los números con los que decides — sin estar parada en la tienda.',
    puntos: [
      'Metas y comisión por vendedora y por tienda',
      'Quién puede autorizar un descuento, por usuario y por tienda',
      'Corte de caja ciego, para que el cajero no sepa cuánto debe haber (desde Fideliza)',
      'Permisos por usuario y por tienda (avanzados en POS, en Automatiza)',
      'Auditoría: quién marcó, quién canceló, quién cambió',
      '50+ reportes y 20+ indicadores de tu operación',
      'CFDI desde la caja y factura global',
      'Cuentas por pagar, gastos y complementos de pago',
      'Conexión con tu ERP y tu despacho por API (en Automatiza)',
    ],
  },
];

/* ── El plano de la tienda: la operación completa contada como un lugar.
   El control de asistencia y horarios NO viene en ningún plan —es el addon
   `staff` de plans.ts— y por eso va marcado. Descubrirlo en la llamada enfría
   la llamada. */
export const planoModa = [
  {
    id: 'piso',
    nombre: 'Piso de venta',
    simbolo: 'rieles',
    foto: '/images/plano-moda-piso.webp',
    alt: 'Piso de venta de una boutique: rieles de latón con prendas y una mesa de exhibición',
    pie: 'Cada prenda del riel sabe en qué talla y en qué tienda queda existencia.',
    pregunta: '«¿Cuántas me quedan de esta talla, y en qué tienda?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'Punto de venta con la matriz de tallas y colores de cada estilo' },
      { t: 'Existencia por estilo, talla y color, en cada tienda', plan: 'Controla' },
      { t: 'Traspaso entre tiendas cuando la talla está donde no se vende', plan: 'Controla' },
      { t: 'Conteo desde el celular, sin cerrar la tienda', plan: 'Controla' },
      { t: 'Recepción de la entrega contra la orden de compra', plan: 'Controla' },
    ],
  },
  {
    id: 'probador',
    nombre: 'Probadores',
    simbolo: 'probadores',
    foto: '/images/plano-moda-probador.webp',
    alt: 'Probadores de una boutique con cortinas de lino, banca de terciopelo y espejo de latón',
    pie: 'Aquí se decide la venta: la talla que falta se busca sin dejar a la clienta.',
    pregunta: '«Le quedó chica. ¿La tienes en M?»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Consulta de existencia de las otras tiendas sin dejar a la clienta' },
      { t: 'Apartado con anticipo y abonos' },
      { t: 'Cambio de talla o color, aunque la prenda venga de otra tienda' },
      { t: 'Vale a favor cuando no está su talla' },
      { t: 'Cambio sin ticket físico', plan: 'Fideliza' },
    ],
  },
  {
    id: 'trastienda',
    nombre: 'Trastienda',
    ambito: 'Detrás del mostrador',
    simbolo: 'anaqueles',
    foto: '/images/plano-moda-trastienda.webp',
    alt: 'Trastienda de una boutique: escritorio de madera, anaquelería con mercancía doblada y burro rodante',
    pie: 'La parte que nadie ve: quién abrió, quién vendió y quién autorizó.',
    pregunta: '«¿Quién abrió hoy, quién vendió qué y quién autorizó ese descuento?»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Metas y comisión por vendedora y por tienda' },
      { t: 'Permisos por usuario y por tienda' },
      { t: 'Auditoría: quién canceló, quién cambió, quién autorizó' },
      { t: 'Reportes e indicadores de la operación' },
      { t: 'Registro de empleados, horarios, turnos y asistencia', extra: true },
    ],
  },
  {
    id: 'mostrador',
    nombre: 'Mostrador',
    simbolo: 'mostrador',
    foto: '/images/plano-moda-mostrador.webp',
    alt: 'Mostrador de cobro de una boutique en madera y travertino, con bolsas de papel y papel de china',
    pie: 'La caja que no se detiene, ni en sábado ni sin internet.',
    pregunta: '«Es sábado, hay fila y se cayó el internet.»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'Punto de venta que sigue cobrando sin conexión' },
      { t: 'Corte de caja y arqueo automáticos al cerrar' },
      { t: 'Ticket por WhatsApp' },
      { t: 'Factura desde la caja, sin anotar el RFC en una libreta' },
      { t: 'Corte ciego: el cajero no sabe cuánto debe haber', plan: 'Fideliza' },
    ],
  },
  {
    id: 'linea',
    nombre: 'En línea',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-moda-linea.webp',
    alt: 'Mesa de empaque de pedidos en línea con cajas, papel de china y paquetes listos para enviar',
    pie: 'El mismo inventario del piso, empacándose para salir.',
    pregunta: '«Vendí en línea algo que ya no estaba en el piso.»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Tienda en línea con el mismo inventario del mostrador' },
      { t: 'WhatsApp, Instagram, Facebook y TikTok Shop' },
      { t: 'Un solo inventario para todos los canales' },
      { t: 'Perfil de la clienta con lo que compró y en qué talla', plan: 'Fideliza' },
      { t: 'Monedero, puntos y campañas', plan: 'Fideliza' },
    ],
  },
];
