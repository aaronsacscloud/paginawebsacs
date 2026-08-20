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
import type { RackPieza } from '../../components/suite/SuiteRack.astro';

export const rackModa: RackPieza[] = [
  { n: 'Vestido midi', img: '/images/rack-vestido.webp', tallas: 5, colores: 3 },
  { n: 'Blusa satinada', img: '/images/rack-blusa.webp', tallas: 6, colores: 4 },
  { n: 'Saco lino', img: '/images/rack-saco.webp', tallas: 4, colores: 2 },
  { n: 'Jean recto', img: '/images/rack-jean.webp', tallas: 6, colores: 3 },
  { n: 'Playera oversize', img: '/images/rack-playera.webp', tallas: 5, colores: 6 },
  { n: 'Falda plisada', img: '/images/rack-falda.webp', tallas: 4, colores: 3 },
];

export const cortinaModa = {
  fotoAntes: '/images/suite-moda-hoy.webp',
  fotoDespues: '/images/suite-moda-resuelto.webp',
  altAntes: 'Vendedora buscando en su libreta si queda una talla',
  altDespues: 'Vendedora atendiendo tranquila con el sistema en pantalla',
  libreta: ['Blusa negra M — ¿quedan?', 'Vestido S … ¿en Satélite?'],
  filas: [
    { que: 'Blusa satinada negra · M', donde: 'Centro', dato: '4' },
    { que: 'Vestido midi verde · S', donde: 'Satélite', dato: '3' },
    { que: 'Vestido cruzado · M', donde: 'Departamental', dato: '31 vend.' },
  ],
};

export const sucursalesModa = [
  { nombre: 'Polanco', venta: '$521,400', llena: 100, ticket: '$2,050', margen: '58%', delta: '+9%' },
  { nombre: 'Centro', venta: '$412,800', llena: 79, ticket: '$1,340', margen: '54%', delta: '+4%' },
  { nombre: 'Satélite', venta: '$386,200', llena: 74, ticket: '$1,180', margen: '51%', delta: '+1%' },
  {
    nombre: 'León', venta: '$198,600', llena: 38, ticket: '$890', margen: '43%', delta: '−12%',
    alerta: true,
    nota: 'Tres semanas cayendo. El margen bajó 6 puntos: está saliendo demasiada prenda con descuento.',
  },
];

export const reglasModa = [
  { si: 'El descuento pasa de 15%', entonces: 'pide tu autorización', detalle: 'Llega a tu teléfono con nombre, hora y motivo. La vendedora no decide sola cuánto regalar.' },
  { si: 'Se cancela una venta ya cobrada', entonces: 'queda firmada', detalle: 'Quién, cuándo y por qué. Es la fuga más común y la más silenciosa de todas.' },
  { si: 'El corte de caja no cuadra', entonces: 'no cierra', detalle: 'El faltante se registra a nombre de quien cerró, y tú lo ves el mismo día — no a fin de mes.' },
];

export const diasModa = [
  { dia: 'Día 1', titulo: 'Tu catálogo, cargado', detalle: 'Nos das tu archivo —o tu base actual— y lo subimos nosotros con tallas, colores y existencias.' },
  { dia: 'Día 2', titulo: 'Tu operación, configurada', detalle: 'Sucursales, cajas, usuarios, permisos, impuestos y formas de pago quedan como ya trabajas.' },
  { dia: 'Día 3', titulo: 'Capacitación', detalle: 'Dos horas con tu equipo. Cobrar se aprende en veinte minutos: hay rotación y el sistema lo asume.' },
  { dia: 'Día 4', titulo: 'Arranca una tienda', detalle: 'La primera sucursal vende con SACS. El sistema viejo sigue en pie por si acaso.' },
  { dia: 'Día 5', titulo: 'Arrancan las demás', detalle: 'Con la primera resuelta, las otras entran el mismo día. Tu histórico se conserva y se consulta.' },
];

export const cajaModa = {
  lineas: [
    { n: 'Blusa satinada · Negro · M', p: '$899.00' },
    { n: 'Falda plisada · Vino · S', p: '$1,190.00' },
  ],
  total: '$2,089.00',
};

/* ── La junta del rebaje: el bloque propio del giro.
   En moda la utilidad no se decide cuando compras: se decide cuando marcas.
   Hoy se marca parejo —"todo lo de verano al 30"— porque es lo único que se
   puede hacer sin datos, y eso hace dos daños a la vez: regala margen sobre la
   prenda que se vendía sola, y no mueve la que ya está muerta.

   Lo que hay que respetar si algún día se toca:
   · Antes de bajar un peso hay cuatro palancas gratis: acomodo, maniquí,
     traspaso y combo. Un bloque que va directo al descuento le dice al dueño
     que no entiende su oficio.
   · El básico de continuidad NO se marca nunca: se vende todo el año.
   · Si ya se fue el corazón de la talla, marcar no sirve. Eso es esqueleto.
   · Se marca de golpe y en número redondo —30, 50, 70—. Nadie ha puesto una
     etiqueta que diga 17%.
   · En la prenda que ya se vendía sola se cuentan las MISMAS piezas en los dos
     caminos: el descuento no le crea clientes nuevos, solo adelanta la venta. */
export const marcacionModa = {
  temporada: 'Primavera–Verano',
  semana: 8,
  semanasTotal: 13,
  prendas: [
    {
      id: 'midi',
      nombre: 'Vestido midi flores · verde agua',
      compradas: 96, vendidas: 74, piso: 22,
      va: 77, marca: 62, precio: 1290, costo: 445, ritmo: 4.5,
      talla: 'Curva completa',
      accion: 'No se marca',
      tono: 'ok',
      nota: 'Va quince puntos ARRIBA de su marca y vende 4.5 a la semana: las 22 que quedan se acaban solas en las cinco semanas que faltan. Marcarla al 30 es regalar margen sobre algo que ya se estaba vendiendo.',
      dif: 8514,
    },
    {
      id: 'blusa',
      nombre: 'Blusa satinada · negro',
      compradas: 140, vendidas: 88, piso: 52,
      va: 63, marca: 0, precio: 899, costo: 310, ritmo: 8,
      talla: 'Básico de continuidad',
      accion: 'No se marca: es básico',
      tono: 'ok',
      nota: 'Al básico no se le mide sell-through de temporada: se le mide cobertura. Se vende todo el año y se repone. Un sistema genérico la manda a rebaja por antigüedad — son cuarenta piezas de margen regaladas.',
      dif: 10788,
    },
    {
      id: 'saco',
      nombre: 'Saco de lino · beige',
      compradas: 60, vendidas: 21, piso: 39,
      va: 35, marca: 62, precio: 1990, costo: 690, ritmo: 1.5,
      talla: 'Completa · 7 M y 6 L',
      accion: 'Marcación 30%',
      tono: 'marca',
      nota: 'Veintisiete puntos abajo de su marca y le quedan cinco semanas, pero conserva el corazón de la talla: todavía se puede vender. Aquí marcar SÍ conviene — al doble de ritmo salen quince en lugar de siete, y el margen por pieza aguanta.',
      dif: 0,
    },
    {
      id: 'falda',
      nombre: 'Falda plisada · vino',
      compradas: 72, vendidas: 30, piso: 42,
      va: 42, marca: 62, precio: 1190, costo: 410, ritmo: 0,
      talla: 'Completa',
      accion: 'No la marques: cámbiala de tienda',
      tono: 'traspaso',
      nota: 'León tiene 26 de las 42 piezas y vende una por semana; Polanco tiene 3 y vende cinco. No es problema de precio, es de dónde está. Veinte piezas de León a Polanco y se venden a precio completo.',
      dif: 20982,
      reparto: [
        { tienda: 'Polanco', piso: 3, vende: 5 },
        { tienda: 'Centro', piso: 8, vende: 2 },
        { tienda: 'Satélite', piso: 5, vende: 1.5 },
        { tienda: 'León', piso: 26, vende: 1 },
      ],
    },
    {
      id: 'playera',
      nombre: 'Playera oversize · lila',
      compradas: 120, vendidas: 96, piso: 24,
      va: 80, marca: 62, precio: 549, costo: 190, ritmo: 2,
      talla: '19 de 24 son XS y XXL',
      accion: 'Esqueleto: sale completa',
      tono: 'esqueleto',
      nota: 'Va en 80% y parece un éxito, pero ya se le fue el corazón de la talla. A un esqueleto el descuento no lo salva: las cinco del centro se agrupan en una tienda y las diecinueve puntas van a outlet.',
      dif: 1372,
    },
  ],
  /* La columna fea. Un bloque que dice que todo se recupera es una calculadora
     de ilusiones, y el dueño lo sabe: él ya vio irse prenda por debajo de costo. */
  feo: {
    piezas: 65,
    costo: 33475,
    prenda: 'Vestido cruzado estampado · coral',
    detalle: 'Va en 23% en la semana 8. Ya se marcó al 20% en la semana 9 y no reaccionó: salieron cuatro en tres semanas. Al 50% se van unas veinte antes de que cierre la temporada, y las otras cuarenta y cinco salen en julio al 70% — a $447 la pieza contra $515 que costó.',
    remate: 'La marcación no arregla la compra. Ese error se firmó en enero; el sistema te lo dijo en la semana 4, pero no lo deshace.',
  },
  pasos: ['Se lee', 'Se acomoda', 'Se autoriza', 'Se programa', 'Se reetiqueta', 'Se mide'],
  pasosDetalle: [
    'El sistema, lunes a las siete. Arma la lista con el corte del fin de semana: cada prenda con su semana, su vendido, su marca y su talla — ordenada por lo que se puede salvar, no por antigüedad.',
    'Dueño y gerente. Primero salen las que solo están mal repartidas o mal exhibidas: acomodo, maniquí, traspaso y combo no cuestan un peso. Lo que se arregla aquí no llega al descuento.',
    'El dueño, y solo el dueño. Fija el porcentaje por prenda y el piso hasta donde puede bajar. La tienda que ejecuta no decide cuánto se regala: al gerente el descuento le sube la venta y le baja el margen, y él cobra sobre venta.',
    'El sistema. El precio entra a la fecha y hora que fijaste, en las tiendas que elegiste, y se apaga solo. Nadie se queda cambiando precios a las nueve de la noche del sábado.',
    'La gerente de tienda. Etiquetas nuevas con su código de barras, la prenda se reagrupa y se separa del piso a precio — lo marcado canibaliza lo que está a precio si duermen juntos.',
    'El sistema, dos semanas después. Cuántas piezas salieron y a qué margen. La que no reaccionó al 30 no reacciona al 40: esa se va completa a liquidación.',
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
    img: '/images/caso-moda-temporada.webp',
    alt: 'Compradora y proveedor revisando muestras y una orden impresa sobre una mesa con telas',
  },
  {
    id: 'evento',
    titulo: 'Se llenó la tienda y nadie sabe qué se probó',
    texto:
      'El 10 de mayo o el Buen Fin se vende en tres días lo de tres semanas. La caja cobra aunque se caiga el internet, y la vendedora ve desde el probador si esa talla está en otra tienda antes de que la clienta se vaya.',
    remate: 'Al lunes te enteras de qué talla se acabó, cuando ya no hay a quién pedírsela.',
    img: '/images/caso-moda-probador.webp',
    alt: 'Vendedora con prendas en el brazo atendiendo a una clienta que sale del probador',
  },
  {
    id: 'corazon',
    titulo: 'Se acabó la M y la L, y la prenda todavía se veía bien',
    texto:
      'Va en 60% de vendido y parece un éxito, pero lo que queda son XS y XXL. El vendido se lee por talla y por color, no por estilo, y las tallas sueltas de cuatro tiendas se juntan para rearmar la curva.',
    remate: 'Un estilo sin su corazón de talla se muere en dos semanas, y el reporte lo mostraba como una sola línea.',
    img: '/images/caso-moda-rebaja.webp',
    alt: 'Dos empleadas ordenando un burro de ropa por talla y colocando etiquetas de precio',
  },
  {
    id: 'cambio',
    titulo: 'Regresa a cambiar y la talla está en otra tienda',
    texto:
      'El cambio se hace aunque la prenda venga de otra sucursal: la diferencia se cobra o se abona al monedero, y queda registrado quién lo autorizó.',
    remate: 'Una de cada seis prendas vuelve, y casi siempre por talla. Ahí se decide si haces una segunda venta o devuelves el dinero.',
    img: '/images/caso-moda-consigna.webp',
    alt: 'Empleada revisando prendas colgadas en un burro contra una lista impresa en el almacén',
  },
];

/* ── Cómo se implementa, con lo que de verdad se carga en una tienda de ropa ── */
export const pasosModa = [
  {
    cuando: 'Día 1', titulo: 'Tu surtido, cargado',
    texto: 'Nos das tu archivo o tu base actual y lo subimos nosotros. No capturas nada.',
    detalle: 'Estilo, color y talla — no una lista de "productos". Con la curva de cada estilo y la existencia real de cada tienda.',
    img: '/images/proc-moda-1.webp',
    alt: 'Consultor con laptop y empleada revisando prendas en un burro contra una lista',
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
    alt: 'Dueña de una cadena de boutiques revisando su tablet en el pasillo de una de sus tiendas',
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
      'Apartado con anticipo, y abonos parciales (desde Controla)',
      'Cotizaciones, pedidos y ventas a crédito',
      'Listas de precios: la clienta frecuente y el mayoreo (desde Controla)',
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
      'Sell-through, ABC y alertas de prenda estancada (en Automatiza)',
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
      'Autorización de descuento y corte de caja ciego',
      'Permisos por usuario y por tienda (avanzados en Automatiza)',
      'Auditoría: quién marcó, quién canceló, quién cambió',
      '50+ reportes y 20+ indicadores de tu operación',
      'CFDI desde la caja y factura global',
      'Cuentas por pagar, gastos y complementos de pago',
      'Conexión con tu ERP y tu despacho por API (en Automatiza)',
    ],
  },
];
