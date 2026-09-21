// ─────────────────────────────────────────────────────────────────────────
// Relaciones de enlazado interno: giro ⇄ producto ⇄ comparar ⇄ herramientas
// ⇄ recursos ⇄ casos de éxito.
//
// Por qué existe este archivo: hasta ahora ninguna página de giro, producto
// o caso de éxito enlazaba a otra dentro del contenido — solo al menú, al
// pie, a /prueba-gratis y a /contacto. Este archivo declara esas relaciones
// como datos (no a mano en cada página) para que:
//   - cada /giros/[slug] pueda mostrar sus funciones, su comparativa, su
//     herramienta y su caso de éxito relacionados (GiroEnlaces.astro).
//   - cada /producto/[slug] pueda enlazar de vuelta a los 2-3 giros donde
//     esa función pesa más (ProductoGiros.astro).
//
// Las URLs de /comparar/* y /recursos/* viven en Supabase (contenido del
// motor de demanda), así que cada slug usado aquí fue verificado a mano
// contra producción (curl a www.sacscloud.com) antes de declararse. No
// agregar un slug nuevo de /comparar o /recursos sin volver a verificarlo:
// esas páginas las escribe otro agente y pueden cambiar de slug.
//
// Verificado 19-sep-2026:
//   /comparar → alternativas-a-sizes-and-colors, sacs-vs-alegra-pos,
//   sacs-vs-bind-erp, sacs-vs-gestion-qbs-moda, sacs-vs-joor,
//   sacs-vs-lightspeed-retail, sacs-vs-loyverse, sacs-vs-managementpro,
//   sacs-vs-odoo, sacs-vs-pulpos, sacs-vs-shopify-pos, sacs-vs-sicar,
//   sacs-vs-square, sacs-vs-syska-pos, sacs-vs-vendty,
//   sistema-generico-vs-sistema-de-moda, software-de-moda-talla-color-temporada
//   /recursos → apartados-tienda-de-ropa, catalogo-de-mayoreo,
//   corridas-rotas-zapateria, curva-de-tallas, inventario-talla-color-sucursales,
//   nivelacion-inventario-entre-tiendas, que-tallas-recomprar,
//   ropa-que-no-se-vende, sell-through, tienda-fisica-y-en-linea,
//   whatsapp-para-tiendas-de-ropa, tiktok-fashion
//   /herramientas → curva-de-tallas, sale-o-no-sale, nivelar-entre-tiendas
//     (registro real en src/lib/demanda/herramientas — solo hay 3 hoy)

export interface EnlaceRel {
  /** slug relativo a su sección: /producto/<slug>, /comparar/<slug>, etc. */
  slug: string;
  /** Texto de ancla completo: dice a dónde va y por qué, en español de México. */
  ancla: string;
}

export interface GiroRelaciones {
  /** Nombre del giro en minúsculas, para tejerlo en frases ("las zapaterías"). */
  nombre: string;
  /** 3-4 funciones de /producto que más le importan a este giro. */
  funciones: EnlaceRel[];
  /** La herramienta de /herramientas que puede usar hoy, gratis. */
  herramienta: EnlaceRel;
  /** La comparativa de /comparar que más le sirve, si existe una que encaje de verdad. */
  comparativa?: EnlaceRel;
  /** La guía de /recursos que le toca, si existe. */
  recurso?: EnlaceRel;
  /** El caso de éxito del mismo ramo, si lo hay. */
  caso?: EnlaceRel;
}

export const GIRO_RELACIONES: Record<string, GiroRelaciones> = {
  'marcas-de-ropa': {
    nombre: 'las marcas de ropa',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Cómo se controla una matriz de tallas y colores por sucursal, sin capturarla dos veces' },
      { slug: 'ordenes-de-compra', ancla: 'El pedido de temporada a fábrica o a taller, con su costo y su fecha de llegada' },
      { slug: 'reportes-y-analitica', ancla: 'Qué talla y qué color se venden de verdad, temporada contra temporada' },
      { slug: 'tienda-en-linea', ancla: 'Vender en línea del mismo inventario que la tienda física, sin duplicar catálogo' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Audita gratis la curva de tallas de tu colección con la herramienta de Sacs' },
    comparativa: { slug: 'sacs-vs-bind-erp', ancla: 'Sacs vs Bind ERP: cuál conviene a una marca de ropa que ya cotiza a departamentales' },
    recurso: { slug: 'catalogo-de-mayoreo', ancla: 'Cómo armar un catálogo de mayoreo para vender a boutiques y departamentales' },
    caso: { slug: 'casa-maca', ancla: 'Casa Maca: cómo pasó de Excel y chats a una operación sincronizada en 30 días' },
  },
  'boutique-multimarca': {
    nombre: 'las boutiques multimarca',
    funciones: [
      { slug: 'conteo-fisico', ancla: 'Contar el inventario de varias marcas y proveedores sin mezclar lo de cada quién' },
      { slug: 'reportes-y-analitica', ancla: 'Ver qué marca deja margen y cuál solo ocupa percha' },
      { slug: 'cuentas-por-pagar', ancla: 'La liquidación a cada proveedor de una boutique multimarca, sin la calculadora' },
      { slug: 'programa-de-lealtad', ancla: 'Un monedero con puntos para el cliente que compra de varias marcas en tu tienda' },
    ],
    herramienta: { slug: 'nivelar-entre-tiendas', ancla: 'Calcula gratis qué mover entre tus sucursales con la herramienta de nivelación' },
    comparativa: { slug: 'sacs-vs-managementpro', ancla: 'Sacs vs ManagementPro: dos sistemas que dicen ser para boutiques, qué gana cada uno' },
    recurso: { slug: 'inventario-talla-color-sucursales', ancla: 'Cómo llevar un inventario por talla, color y sucursal sin que se descuadre' },
    caso: { slug: 'la-bella-pandita', ancla: 'La Bella Pandita: cómo automatizó su operación al escalar a 42 sucursales' },
  },
  'consignacion': {
    nombre: 'las tiendas en consignación',
    funciones: [
      { slug: 'cuentas-por-pagar', ancla: 'Cómo se le paga a cada consignante exactamente lo que le toca, sin libreta' },
      { slug: 'portal-de-clientes', ancla: 'El portal donde tu consignante ve su saldo sin que le tengas que llamar' },
      { slug: 'inventario-omnicanal', ancla: 'Cada prenda con su dueña, su comisión y su fecha de vigencia' },
      { slug: 'reportes-y-analitica', ancla: 'Qué consignante te trae piezas que sí rotan y cuál solo ocupa espacio' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Revisa gratis la curva de tallas de lo que tienes en piso con esta herramienta' },
    comparativa: { slug: 'sistema-generico-vs-sistema-de-moda', ancla: 'Por qué un sistema genérico no lleva consignación por dueña y uno de moda sí' },
    recurso: { slug: 'ropa-que-no-se-vende', ancla: 'Qué hacer con la ropa que no se vende antes de que se quede colgada para siempre' },
  },
  'merchandising-eventos': {
    nombre: 'el merchandising de eventos',
    funciones: [
      { slug: 'punto-de-venta', ancla: 'El punto de venta que sigue cobrando sin internet en un stand o un pop-up' },
      { slug: 'nivelacion-de-inventario', ancla: 'Traspasar mercancía entre módulos del evento en tiempo real, con escáner' },
      { slug: 'tienda-en-linea', ancla: 'Vender en línea lo que sobró de la gira, del mismo inventario del evento' },
      { slug: 'alertas-inteligentes', ancla: 'Un aviso automático cuando una talla se acaba en el módulo equivocado' },
    ],
    herramienta: { slug: 'nivelar-entre-tiendas', ancla: 'Calcula gratis qué mover entre tus módulos de venta con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Cómo elegir software de moda cuando el reloj corre por evento, no por temporada' },
    recurso: { slug: 'nivelacion-inventario-entre-tiendas', ancla: 'Cómo nivelar inventario entre varios puntos de venta sin perder el conteo' },
    caso: { slug: 'liveshow', ancla: 'Liveshow Merchandising: cómo despachó un pop-up en el Foro Sol sin perder trazabilidad' },
  },
  'novias-y-fiesta': {
    nombre: 'las boutiques de novias y fiesta',
    funciones: [
      { slug: 'apartados-y-pedidos', ancla: 'El apartado que cuenta hacia atrás desde la fecha de la boda o la fiesta' },
      { slug: 'workflows', ancla: 'Las etapas de prueba, ajuste y entrega de un vestido, con su responsable y su fecha' },
      { slug: 'clientes-y-crm', ancla: 'La ficha de la familia que vuelve para el XV, la boda y la graduación' },
      { slug: 'marketing-por-whatsapp', ancla: 'Mandar el catálogo al grupo de WhatsApp de la boda, del mismo inventario' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Revisa gratis qué tallas te faltan de tu colección de fiesta con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Qué pedirle a un software de moda cuando cada pieza tiene una fecha de evento' },
    recurso: { slug: 'apartados-tienda-de-ropa', ancla: 'Cómo armar una política de apartados con anticipo que sí se cumpla' },
  },
  'activewear': {
    nombre: 'las marcas de activewear',
    funciones: [
      { slug: 'social-commerce', ancla: 'Vender el mismo drop en TikTok, Instagram y tu tienda, del mismo inventario' },
      { slug: 'agentic-commerce', ancla: 'Un agente de IA que responde tallas y colorways por WhatsApp mientras dura el drop' },
      { slug: 'membresias-y-suscripciones', ancla: 'Una comunidad que paga por acceso anticipado a cada drop' },
      { slug: 'reportes-predictivos', ancla: 'Predecir qué talla se agota primero en el siguiente drop, con datos del anterior' },
    ],
    herramienta: { slug: 'sale-o-no-sale', ancla: 'Calcula gratis si vas a sacar tu próximo drop a tiempo con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para marcas que venden por drop, no por temporada larga' },
    recurso: { slug: 'tiktok-fashion', ancla: 'Cómo vender ropa deportiva en TikTok Shop sin duplicar tu inventario' },
  },
  'zapateria': {
    nombre: 'las zapaterías',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Por qué una zapatería necesita contar pares y no piezas sueltas' },
      { slug: 'nivelacion-de-inventario', ancla: 'Mover un número entre tiendas antes de que se rompa la corrida' },
      { slug: 'alertas-inteligentes', ancla: 'El aviso automático cuando un modelo se queda sin los números de en medio' },
      { slug: 'axo-copiloto-ia', ancla: 'Preguntarle a un copiloto de IA qué número comprar la próxima temporada' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Audita gratis la corrida de tu calzado con el auditor de curva de tallas' },
    comparativa: { slug: 'sacs-vs-syska-pos', ancla: 'Sacs vs Syska POS: cuál entiende de verdad la corrida completa de una zapatería' },
    recurso: { slug: 'corridas-rotas-zapateria', ancla: 'Qué es una corrida rota y cómo evitar que se coma tu margen' },
  },
  'joyeria': {
    nombre: 'las joyerías',
    funciones: [
      { slug: 'apartados-y-pedidos', ancla: 'Apartados de hasta 12 meses con abonos y recordatorios, sin libreta' },
      { slug: 'portal-de-clientes', ancla: 'El portal donde tu cliente sigue su reparación o su apartado sin llamar' },
      { slug: 'facturacion-electronica', ancla: 'Facturar cada pieza al momento, con su gramaje y su quilataje' },
      { slug: 'inventario-omnicanal', ancla: 'Cada pieza única con su foto, su peso y su certificado, sin confundirla con otra' },
    ],
    herramienta: { slug: 'nivelar-entre-tiendas', ancla: 'Calcula gratis qué pieza mover entre tus tiendas con esta herramienta' },
    comparativa: { slug: 'sistema-generico-vs-sistema-de-moda', ancla: 'Por qué un sistema genérico no lleva gramaje ni quilataje y uno especializado sí' },
    recurso: { slug: 'apartados-tienda-de-ropa', ancla: 'Cómo armar una política de apartados con anticipo que sí se cumpla' },
  },
  'western': {
    nombre: 'las tiendas western',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Corridas de bota por número y horma, sin perder el par que sí se vende' },
      { slug: 'apartados-y-pedidos', ancla: 'Apartar la bota o el sombrero para la feria o el jaripeo, con anticipo' },
      { slug: 'alertas-inteligentes', ancla: 'Un aviso automático cuando falta un número de bota de un modelo que sí rota' },
      { slug: 'reportes-y-analitica', ancla: 'Qué número y qué piel se venden de verdad, temporada contra temporada' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Audita gratis la corrida de tus botas y texanas con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para negocios donde la talla es un número de bota o de sombrero' },
  },
  'lenceria': {
    nombre: 'las tiendas de lencería',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Una matriz de copa y espalda sin cruzar tallas entre sí' },
      { slug: 'reportes-y-analitica', ancla: 'Qué talla exacta de copa y espalda se agota primero en cada tienda' },
      { slug: 'clientes-y-crm', ancla: 'La ficha de la clienta con su talla y su marca guardadas' },
      { slug: 'promociones', ancla: 'Promociones por set o por pieza suelta, en San Valentín o en Navidad' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Calcula gratis tu curva ideal de copa y espalda con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para cuando la talla no es solo S-M-L, sino copa y espalda' },
    recurso: { slug: 'curva-de-tallas', ancla: 'Qué es la curva de tallas y cómo se arma para que no se rompa un set' },
  },
  'uniformes': {
    nombre: 'los negocios de uniformes',
    funciones: [
      { slug: 'apartados-y-pedidos', ancla: 'Un pedido de 40 piezas por escuela o empresa, con anticipo y saldo' },
      { slug: 'facturacion-electronica', ancla: 'Facturar al cliente corporativo con sus datos guardados, sin recapturar' },
      { slug: 'workflows', ancla: 'El proceso de bordado, revisión y entrega, automatizado paso por paso' },
      { slug: 'inventario-omnicanal', ancla: 'Qué talla de qué polo falta antes del regreso a clases' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Calcula gratis la curva de tallas de un pedido escolar o corporativo' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para pedidos por talla y por persona, no por catálogo suelto' },
  },
  'ropa-infantil': {
    nombre: 'las tiendas de ropa infantil',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Tallas por edad, de 0-3 meses hacia arriba, sin adivinar la equivalencia' },
      { slug: 'clientes-y-crm', ancla: 'La ficha por familia con el cumpleaños del niño y su talla actual' },
      { slug: 'marketing-por-correo', ancla: 'Un correo automático cuando es momento de subir de talla' },
      { slug: 'programa-de-lealtad', ancla: 'Un monedero con puntos para que la mamá regrese cada temporada' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Audita gratis tu curva de tallas por edad con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para tiendas donde la talla cambia cada pocos meses' },
    recurso: { slug: 'sell-through', ancla: 'Qué es el sell-through y cómo saber qué talla se vende de verdad' },
  },
  'renta-de-vestidos': {
    nombre: 'las tiendas de renta de vestidos',
    funciones: [
      { slug: 'apartados-y-pedidos', ancla: 'El calendario de cada vestido: quién lo tiene, cuándo regresa y cuándo va a tintorería' },
      { slug: 'clientes-y-crm', ancla: 'El historial de eventos y tallas de quien renta cada temporada' },
      { slug: 'marketing-por-whatsapp', ancla: 'Recordatorios automáticos de entrega y devolución por WhatsApp' },
      { slug: 'inventario-omnicanal', ancla: 'Saber qué vestido está disponible, cuál en tintorería y cuál ya se rentó' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Revisa gratis qué tallas de tu colección de renta se agotan primero' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para negocios donde una prenda se vende varias veces al mes' },
    recurso: { slug: 'apartados-tienda-de-ropa', ancla: 'Cómo armar una política de depósito y entrega que sí se cumpla' },
  },
  'bolsas-y-accesorios': {
    nombre: 'las tiendas de bolsas y accesorios',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Variantes por piel y color, cada una con su propia existencia' },
      { slug: 'ordenes-de-compra', ancla: 'El pedido al taller con su lote de piel y su costo real' },
      { slug: 'clientes-y-crm', ancla: 'La cartera que combina con la bolsa, sugerida en el mismo ticket' },
      { slug: 'apartados-y-pedidos', ancla: 'Apartar una pieza de piel con anticipo mientras llega el siguiente lote' },
    ],
    herramienta: { slug: 'nivelar-entre-tiendas', ancla: 'Calcula gratis qué piel o color mover entre tus tiendas con esta herramienta' },
    comparativa: { slug: 'sistema-generico-vs-sistema-de-moda', ancla: 'Por qué un sistema genérico no distingue piel ni lote y uno de moda sí' },
  },
  'trajes-de-bano': {
    nombre: 'las tiendas de trajes de baño',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Top y bikini vendidos por separado y por talla, sin romper el set' },
      { slug: 'tienda-en-linea', ancla: 'Vender en línea la misma temporada corta que en tus boutiques físicas' },
      { slug: 'promociones', ancla: 'Liquidar a tiempo antes de que cambie la temporada, sin perder margen' },
      { slug: 'social-commerce', ancla: 'Vender por Instagram y WhatsApp del mismo inventario que tus boutiques' },
    ],
    herramienta: { slug: 'sale-o-no-sale', ancla: 'Calcula gratis si vas a liquidar tu temporada a tiempo con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para una temporada que dura meses, no años' },
    recurso: { slug: 'tienda-fisica-y-en-linea', ancla: 'Cómo conectar tu boutique física y tu tienda en línea en un solo inventario' },
    caso: { slug: 'sandmade', ancla: 'Sandmade Swimwear: 8 boutiques de Tulum a Los Cabos con un solo inventario' },
  },
  'sastreria': {
    nombre: 'las sastrerías',
    funciones: [
      { slug: 'apartados-y-pedidos', ancla: 'La orden de taller por etapas: primera prueba, ajuste, entrega' },
      { slug: 'clientes-y-crm', ancla: 'La ficha de medidas de cada cliente, sin volver a tomarlas' },
      { slug: 'ordenes-de-compra', ancla: 'El pedido de tela por metro para el siguiente traje' },
      { slug: 'gastos', ancla: 'El gasto real de tela e insumos por cada orden de taller' },
    ],
    herramienta: { slug: 'nivelar-entre-tiendas', ancla: 'Calcula gratis qué mover entre tus talleres o sucursales con esta herramienta' },
    comparativa: { slug: 'sistema-generico-vs-sistema-de-moda', ancla: 'Por qué un sistema genérico no lleva órdenes de taller por etapas y uno de moda sí' },
  },
  'opticas': {
    nombre: 'las ópticas de moda',
    funciones: [
      { slug: 'clientes-y-crm', ancla: 'La graduación y la receta de cada cliente, guardadas para la siguiente compra' },
      { slug: 'inventario-omnicanal', ancla: 'Armazones por variante de color y modelo, con existencia por sucursal' },
      { slug: 'portal-de-clientes', ancla: 'El portal donde tu cliente ve el avance de su armazón sin llamar' },
      { slug: 'facturacion-electronica', ancla: 'Facturar el armazón y el servicio de graduación en el mismo ticket' },
    ],
    herramienta: { slug: 'nivelar-entre-tiendas', ancla: 'Calcula gratis qué armazón mover entre tus sucursales con esta herramienta' },
    comparativa: { slug: 'sistema-generico-vs-sistema-de-moda', ancla: 'Por qué un sistema genérico no guarda receta ni graduación y uno especializado sí' },
  },
  'telas-y-merceria': {
    nombre: 'las tiendas de telas y mercería',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Inventario por metro y por rollo, sin medir de nuevo cada vez' },
      { slug: 'ordenes-de-compra', ancla: 'El pedido de tela por rollo, con su costo real por metro' },
      { slug: 'gastos', ancla: 'El gasto de compra por metro y por rollo, sin la calculadora aparte' },
      { slug: 'punto-de-venta', ancla: 'Cobrar por metro, por pieza y por corte en el mismo ticket' },
    ],
    herramienta: { slug: 'nivelar-entre-tiendas', ancla: 'Calcula gratis qué rollo mover entre tus sucursales con esta herramienta' },
    comparativa: { slug: 'sistema-generico-vs-sistema-de-moda', ancla: 'Por qué un sistema genérico no vende por metro y uno especializado sí' },
  },
  'tallas-grandes': {
    nombre: 'las tiendas de tallas grandes',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Curvas extendidas hasta la 5XL, sin que la 2XL se quede sin existencia' },
      { slug: 'clientes-y-crm', ancla: 'La ficha con la talla exacta de cada cliente, para no repetir el error' },
      { slug: 'reportes-y-analitica', ancla: 'Qué talla extendida se vende de verdad y cuál solo ocupa percha' },
      { slug: 'programa-de-lealtad', ancla: 'Un monedero para el cliente que siempre encuentra su talla en tu tienda' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Audita gratis tu curva extendida de tallas con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para curvas que no se detienen en la L' },
    recurso: { slug: 'que-tallas-recomprar', ancla: 'Qué tallas recomprar primero cuando la curva se rompe por arriba' },
  },
  'maternidad': {
    nombre: 'las tiendas de ropa de maternidad',
    funciones: [
      { slug: 'inventario-omnicanal', ancla: 'Tallas por trimestre del embarazo, sin confundirlas con tallas normales' },
      { slug: 'clientes-y-crm', ancla: 'La ficha con la fecha probable de parto de cada clienta' },
      { slug: 'marketing-por-correo', ancla: 'Un correo automático cuando la clienta pasa de embarazo a lactancia' },
      { slug: 'apartados-y-pedidos', ancla: 'Apartar el set de lactancia con anticipo antes de que nazca el bebé' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Audita gratis tu curva de tallas por etapa del embarazo con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para una talla que cambia cada trimestre' },
  },
  'outlet': {
    nombre: 'los outlets de moda',
    funciones: [
      { slug: 'ordenes-de-compra', ancla: 'El costo real de un lote cerrado, sin que se te pierda al mezclarlo con el resto' },
      { slug: 'reportes-y-analitica', ancla: 'El margen real por lote y por marca, no solo el descuento en la etiqueta' },
      { slug: 'inventario-omnicanal', ancla: 'Cada lote con su costo, su descuento y su temporada de origen' },
      { slug: 'promociones', ancla: 'Descuentos por etiqueta y por temporada, sin afectar el precio de catálogo' },
    ],
    herramienta: { slug: 'sale-o-no-sale', ancla: 'Calcula gratis si vas a liquidar tu temporada a tiempo con esta herramienta' },
    comparativa: { slug: 'software-de-moda-talla-color-temporada', ancla: 'Software de moda para negocios que compran por lote y venden por etiqueta' },
    recurso: { slug: 'ropa-que-no-se-vende', ancla: 'Qué hacer con la ropa que no se vende antes de que se quede colgada para siempre' },
  },
  'emprendedoras': {
    nombre: 'las emprendedoras de moda',
    funciones: [
      { slug: 'punto-de-venta', ancla: 'Un punto de venta listo desde el celular, sin hardware especial' },
      { slug: 'tienda-en-linea', ancla: 'Una tienda en línea conectada al mismo inventario que vendes por WhatsApp' },
      { slug: 'marketing-por-whatsapp', ancla: 'Vender por WhatsApp con catálogo real, sin perder el control del inventario' },
      { slug: 'especialista-ia', ancla: 'Un copiloto de IA que ayuda a decidir qué comprar y qué liquidar' },
    ],
    herramienta: { slug: 'curva-de-tallas', ancla: 'Calcula gratis la curva de tallas de tu primer pedido con esta herramienta' },
    comparativa: { slug: 'sistema-generico-vs-sistema-de-moda', ancla: 'Sistema genérico o uno de moda: cómo decidir cuando apenas empiezas' },
    recurso: { slug: 'whatsapp-para-tiendas-de-ropa', ancla: 'Cómo vender ropa por WhatsApp sin perder el control del inventario' },
  },
  'papeleria-y-arte': {
    nombre: 'las papelerías',
    funciones: [
      { slug: 'punto-de-venta', ancla: 'Cobrar rápido en temporada de listas escolares, sin filas eternas' },
      { slug: 'inventario-omnicanal', ancla: 'Vender por pieza, por paquete y por lista escolar sin perder margen' },
      { slug: 'promociones', ancla: 'Promociones de temporada escolar sin tocar el precio el resto del año' },
      { slug: 'reportes-y-analitica', ancla: 'Qué artículo de la lista escolar se agota primero cada agosto' },
    ],
    herramienta: { slug: 'sale-o-no-sale', ancla: 'Calcula gratis si vas a surtir tu temporada escolar a tiempo con esta herramienta' },
    comparativa: { slug: 'sistema-generico-vs-sistema-de-moda', ancla: 'Por qué un sistema genérico no arma listas escolares y uno especializado sí' },
  },
};

/**
 * Reverso: para cada función de /producto, los 2-3 giros donde pesa más.
 * Se declara aparte (no invirtiendo GIRO_RELACIONES) porque una función
 * puede pesarle mucho a un giro sin estar entre sus 3-4 funciones
 * principales, y porque el texto de ancla aquí habla desde la función hacia
 * el giro, no al revés.
 */
export const FUNCION_GIROS: Record<string, EnlaceRel[]> = {
  'punto-de-venta': [
    { slug: 'zapateria', ancla: 'Cómo cobra una zapatería sin perder el número exacto de cada par en el mostrador' },
    { slug: 'merchandising-eventos', ancla: 'El punto de venta que sigue cobrando sin internet en un stand o un pop-up' },
  ],
  'tienda-en-linea': [
    { slug: 'trajes-de-bano', ancla: 'Por qué una marca de trajes de baño vende en línea la misma temporada corta que en tienda' },
    { slug: 'activewear', ancla: 'Cómo una marca de activewear lanza un drop en línea con el mismo inventario del piso' },
  ],
  'promociones': [
    { slug: 'outlet', ancla: 'Cómo un outlet arma descuentos por lote y por etiqueta sin tocar el precio de catálogo' },
    { slug: 'trajes-de-bano', ancla: 'Por qué los trajes de baño liquidan a tiempo antes de que cambie la temporada' },
  ],
  'apartados-y-pedidos': [
    { slug: 'novias-y-fiesta', ancla: 'El apartado con fecha de boda que usan las tiendas de novias y fiesta' },
    { slug: 'joyeria', ancla: 'Cómo las joyerías manejan apartados de hasta 12 meses con abonos' },
  ],
  'social-commerce': [
    { slug: 'activewear', ancla: 'Cómo las marcas de activewear venden el mismo drop en TikTok, Instagram y su tienda' },
    { slug: 'emprendedoras', ancla: 'Vender por WhatsApp e Instagram sin perder el control del inventario, como las emprendedoras de moda' },
  ],
  'agentic-commerce': [
    { slug: 'emprendedoras', ancla: 'El agente de IA que cotiza y cobra por WhatsApp mientras una emprendedora atiende su tienda' },
    { slug: 'activewear', ancla: 'Cómo un agente de IA atiende dudas de talla y colorway durante un drop de activewear' },
  ],
  'facturacion-electronica': [
    { slug: 'uniformes', ancla: 'Por qué los negocios de uniformes facturan a la empresa sin recapturar datos en cada pedido' },
    { slug: 'marcas-de-ropa', ancla: 'La facturación que piden las tiendas departamentales a una marca de ropa' },
  ],
  'inventario-omnicanal': [
    { slug: 'zapateria', ancla: 'Por qué una zapatería necesita contar pares, no piezas sueltas, en su inventario' },
    { slug: 'lenceria', ancla: 'Cómo se controla una matriz de copa y espalda sin cruzar tallas en lencería' },
  ],
  'conteo-fisico': [
    { slug: 'boutique-multimarca', ancla: 'El conteo por marca y por proveedor que necesita una boutique multimarca' },
    { slug: 'telas-y-merceria', ancla: 'Cómo se cuenta un rollo de tela a la mitad sin medirlo de nuevo' },
  ],
  'nivelacion-de-inventario': [
    { slug: 'zapateria', ancla: 'Mover pares entre tiendas antes de que se rompa la corrida en una zapatería' },
    { slug: 'merchandising-eventos', ancla: 'Traspasar mercancía entre módulos de un evento en tiempo real' },
  ],
  'ordenes-de-compra': [
    { slug: 'outlet', ancla: 'Cómo se registra el costo real de un lote cerrado en un outlet' },
    { slug: 'bolsas-y-accesorios', ancla: 'El pedido al taller con su lote y su costo, para tiendas de bolsas y accesorios' },
  ],
  'gastos': [
    { slug: 'sastreria', ancla: 'Controlar el gasto de tela e insumos por orden de taller en una sastrería' },
    { slug: 'telas-y-merceria', ancla: 'Los gastos de compra por metro y por rollo en una tienda de telas y mercería' },
  ],
  'cuentas-por-pagar': [
    { slug: 'consignacion', ancla: 'Cómo se paga a cada consignante lo que le toca, sin errores, en una tienda en consignación' },
    { slug: 'boutique-multimarca', ancla: 'La liquidación a cada proveedor de una boutique multimarca' },
  ],
  'reportes-y-analitica': [
    { slug: 'boutique-multimarca', ancla: 'Ver qué marca deja margen y cuál solo ocupa percha en una boutique multimarca' },
    { slug: 'outlet', ancla: 'El margen real por lote y por marca en un outlet' },
  ],
  'clientes-y-crm': [
    { slug: 'sastreria', ancla: 'La ficha de medidas de cada cliente en una sastrería' },
    { slug: 'maternidad', ancla: 'El historial de compras por etapa del embarazo en una tienda de maternidad' },
  ],
  'programa-de-lealtad': [
    { slug: 'tallas-grandes', ancla: 'Cómo fidelizar al cliente que siempre encuentra su talla en una tienda de tallas grandes' },
    { slug: 'ropa-infantil', ancla: 'El monedero y los puntos que hacen que la mamá regrese a una tienda de ropa infantil' },
  ],
  'portal-de-clientes': [
    { slug: 'consignacion', ancla: 'El portal donde cada consignante ve su estado de cuenta sin llamar a la tienda' },
    { slug: 'joyeria', ancla: 'Seguimiento de una reparación o un apartado desde el portal del cliente en joyería' },
  ],
  'tarjetas-de-regalo': [
    { slug: 'papeleria-y-arte', ancla: 'Las tarjetas de regalo que se venden en temporada escolar en una papelería' },
    { slug: 'marcas-de-ropa', ancla: 'Cómo una marca de ropa vende tarjetas de regalo en tienda y en línea' },
  ],
  'marketing-por-correo': [
    { slug: 'maternidad', ancla: 'Correos por etapa del embarazo para una tienda de ropa de maternidad' },
    { slug: 'ropa-infantil', ancla: 'Campañas por correo cuando cambia la talla del niño, para tiendas de ropa infantil' },
  ],
  'marketing-por-whatsapp': [
    { slug: 'emprendedoras', ancla: 'Cómo vender por WhatsApp con catálogo real, la forma en que empiezan las emprendedoras de moda' },
    { slug: 'renta-de-vestidos', ancla: 'Recordatorios de entrega y devolución por WhatsApp para una tienda de renta de vestidos' },
  ],
  'membresias-y-suscripciones': [
    { slug: 'activewear', ancla: 'La comunidad que paga por acceso anticipado a cada drop de una marca de activewear' },
    { slug: 'tallas-grandes', ancla: 'Una membresía para el cliente frecuente de una tienda de tallas grandes' },
  ],
  'especialista-ia': [
    { slug: 'emprendedoras', ancla: 'El copiloto de IA que ayuda a una emprendedora a decidir qué comprar y qué liquidar' },
    { slug: 'marcas-de-ropa', ancla: 'Cómo una marca de ropa usa un especialista de IA para leer su propia rotación' },
  ],
  'axo-copiloto-ia': [
    { slug: 'boutique-multimarca', ancla: 'Preguntarle a Axo qué marca rota mejor en una boutique multimarca' },
    { slug: 'zapateria', ancla: 'Preguntarle a Axo qué número comprar la próxima temporada en una zapatería' },
  ],
  'workflows': [
    { slug: 'uniformes', ancla: 'El proceso de bordado, revisión y entrega automatizado para un pedido de uniformes' },
    { slug: 'novias-y-fiesta', ancla: 'Las etapas de prueba, ajuste y entrega de un vestido, automatizadas en una tienda de novias y fiesta' },
  ],
  'alertas-inteligentes': [
    { slug: 'zapateria', ancla: 'El aviso automático cuando se rompe una corrida en una zapatería' },
    { slug: 'western', ancla: 'Una alerta cuando falta un número de bota, para una tienda western' },
  ],
  'reportes-predictivos': [
    { slug: 'outlet', ancla: 'Anticipar qué lote conviene comprar la próxima temporada en un outlet' },
    { slug: 'activewear', ancla: 'Predecir qué talla se agota primero en el siguiente drop de una marca de activewear' },
  ],
  'orquestador-de-agentes': [
    { slug: 'marcas-de-ropa', ancla: 'Coordinar varios agentes de IA en una marca de ropa con varias sucursales' },
    { slug: 'emprendedoras', ancla: 'Automatizar tareas repetitivas mientras una emprendedora de moda crece su tienda' },
  ],
  'api-e-integraciones': [
    { slug: 'activewear', ancla: 'Conectar TikTok Shop al mismo inventario que usa una marca de activewear' },
    { slug: 'marcas-de-ropa', ancla: 'Integrar marketplaces y sistemas propios al inventario de una marca de ropa' },
  ],
};

/** Nombre para mostrar de cada giro (coincide con navigation.ts, sin importarlo). */
export const GIRO_NOMBRE: Record<string, string> = {
  'marcas-de-ropa': 'Tiendas de Ropa',
  'boutique-multimarca': 'Concept Store',
  'consignacion': 'Consignación y Segunda Mano',
  'merchandising-eventos': 'Merch de Eventos',
  'novias-y-fiesta': 'Novias y Fiesta',
  'activewear': 'Activewear',
  'zapateria': 'Zapaterías',
  'joyeria': 'Joyerías',
  'western': 'Western y Vaquera',
  'lenceria': 'Lencería y Ropa Interior',
  'uniformes': 'Uniformes',
  'ropa-infantil': 'Ropa Infantil y Bebés',
  'renta-de-vestidos': 'Renta de Vestidos y Trajes',
  'bolsas-y-accesorios': 'Bolsas y Accesorios de Piel',
  'trajes-de-bano': 'Trajes de Baño y Playa',
  'sastreria': 'Sastrería y Trajes a Medida',
  'opticas': 'Ópticas de Moda',
  'telas-y-merceria': 'Telas y Mercería',
  'tallas-grandes': 'Tallas Grandes',
  'maternidad': 'Ropa de Maternidad',
  'outlet': 'Outlet y Remates de Marca',
  'emprendedoras': 'Emprendedoras Digitales',
  'papeleria-y-arte': 'Papelería y Arte',
};
