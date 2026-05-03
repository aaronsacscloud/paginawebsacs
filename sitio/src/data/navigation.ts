export interface NavSubItem {
  label: string;
  href: string;
  description?: string;
  icon?: string;
}

export interface NavPillar {
  verb: string;
  description: string;
  href: string;
  items: NavSubItem[];
}

export interface SectorPersonalization {
  label: string;
  description: string;
}

export interface BusinessSector {
  label: string;
  description: string;
  href: string;
  iconId: string;
  color: string;
  bgColor: string;
  personalizations: SectorPersonalization[];
}

export interface NavLink {
  label: string;
  href: string;
  children?: NavSubItem[];
  pillars?: NavPillar[];
  sectors?: BusinessSector[];
}

export const businessSectors: BusinessSector[] = [
  {
    label: 'Tiendas de Ropa',
    description: 'Boutiques, moda y apparel',
    personalizations: [
      { label: 'Tallas y colores', description: 'Variantes por SKU (talla × color) con stock independiente. Reportes por talla más vendida y agotada.' },
      { label: 'Curvas de tallas', description: 'Pre-empaqueta paquetes con curvas (S-M-L-XL) en proporciones reales para evitar roturas de stock.' },
      { label: 'Temporadas y drops', description: 'Categoriza por temporada (PV/OI), colección y drop. Caducidad y rebajas programadas.' },
      { label: 'Outlet automático', description: 'Mueve sobrantes a outlet con markdown progresivo sin tocar el catálogo regular.' },
      { label: 'Probadores conectados', description: 'Tablet en probador con catálogo, recomendador de tallas y reserva entre sucursales.' },
      { label: 'Cambios sin ticket', description: '"No me quedó la talla" — cambio rápido vinculado al cliente sin ticket físico.' },
      { label: 'Looks completos', description: 'Vende un outfit (camisa + pantalón + cinturón) con descuento por look armado.' },
      { label: 'Uniformes B2B', description: 'Pedidos corporativos con tallaje por empleado, factura única y entregas programadas.' },
      { label: 'Reabasto por rotación', description: 'Detecta prendas que se están agotando antes que otras y sugiere reposición inteligente.' },
    ],
    href: '/giros/marcas-de-ropa',
    iconId: 'clothing',
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.1)',
  },
  {
    label: 'Zapaterías',
    description: 'Calzado por hormas y pares',
    personalizations: [
      { label: 'Tallas y hormas', description: 'Inventario por número y horma (ancho/normal/angosto). Alerta cuando un par queda incompleto.' },
      { label: 'Pares vs huérfanos', description: 'Reportes de pares vendidos vs muestras solas. Sabe exactamente qué reordenar y qué liquidar.' },
      { label: 'Display y exhibición', description: 'Distingue par de exhibición vs vendible. Sin sobreventa de muestras del aparador.' },
      { label: 'Reabasto por curva', description: 'Sugerencias de compra por talla y modelo según rotación real por temporada y sucursal.' },
      { label: 'Pre-reserva VIP', description: 'Reserva par exclusivo a cliente VIP cuando llega la próxima colección.' },
      { label: 'Limpieza y servicio', description: 'Servicio de cuidado, lustrado y resuelado vinculado al ticket. Recordatorio post-venta.' },
      { label: 'Garantía por desgaste', description: 'Tickets de garantía con fecha de venta, modelo y cliente para reclamos de fábrica.' },
      { label: 'Devolución por horma', description: 'Cambio rápido si "le aprieta el dedo" — registra ajuste de horma para no repetir error.' },
      { label: 'Outlet de tallas extremas', description: 'Liquida tallas atípicas (22/30) en outlet sin afectar precio del catálogo regular.' },
    ],
    href: '/giros/zapateria',
    iconId: 'shoes',
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
  },
  {
    label: 'Joyerías',
    description: 'Joyería fina y bisutería',
    personalizations: [
      { label: 'Kilataje y certificados', description: 'Certificado de autenticidad, kilataje (10K/14K/18K/24K) y peso adjuntos a cada venta.' },
      { label: 'Piezas únicas', description: 'SKU único con foto, peso en gramos, materiales (oro, plata, gemas) y descripción detallada.' },
      { label: 'Apartados largos', description: 'Apartados hasta 12 meses con abonos parciales y recordatorios por correo y SMS.' },
      { label: 'Grabados y fechas', description: 'Captura grabado, fecha de entrega y costo extra. Tracking del taller en el ticket.' },
      { label: 'Reparaciones', description: 'Tickets de reparación con foto antes/después, fecha de entrega y costo desglosado.' },
      { label: 'Compra-venta de oro', description: 'Tasación por gramaje con precio diario auto-actualizado. Cumple con KYC y UIF.' },
      { label: 'Póliza de mantenimiento', description: 'Limpieza, baño de rodio y ajustes con vigencia y servicios incluidos por pieza.' },
      { label: 'Consigna vs compra firme', description: 'Inventario por proveedor con tracking de consigna, devoluciones y liquidaciones.' },
      { label: 'Política de cambios', description: 'Régimen especial para joyería: solo cambio o crédito en tienda, sin devoluciones en efectivo.' },
    ],
    href: '/giros/joyeria',
    iconId: 'jewelry',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  {
    label: 'Retail de Entretenimiento',
    description: 'Licencias, fan-merch y ediciones',
    personalizations: [
      { label: 'Licencias por marca', description: 'Reportes de venta por licenciante (Disney, Marvel, Pokémon). Cumple con regalías y reportes.' },
      { label: 'Pre-ventas y drops', description: 'Reserva con anticipo, notifica al cliente cuando llega y bloquea venta hasta fecha oficial.' },
      { label: 'Ediciones numeradas', description: 'Control estricto de lote con numeración (1/500, 2/500…) y certificado por edición.' },
      { label: 'Variantes coleccionables', description: 'Funko Pop por exclusivo, chase, glow-in-the-dark y errores de impresión como SKUs separados.' },
      { label: 'Eventos y firmas', description: 'Vende boletos para meet & greet o firmas con artistas vinculados al producto comprado.' },
      { label: 'Bundles temáticos', description: 'Box set por personaje o saga con descuento automático al comprar el kit completo.' },
      { label: 'Waitlist por SKU', description: 'Lista de espera para productos agotados; auto-asigna y notifica cuando llega reposición.' },
      { label: 'Cuenta regresiva', description: 'Bloqueo de venta hasta hora oficial del drop con cuenta regresiva en POS y tienda en línea.' },
      { label: 'Reportes por fandom', description: 'Qué franquicia vende más por sucursal, edad del cliente y temporada del año.' },
    ],
    href: '/giros/retail-entretenimiento',
    iconId: 'entertainment',
    color: '#A855F7',
    bgColor: 'rgba(168, 85, 247, 0.1)',
  },
  {
    label: 'Papelería y Arte',
    description: 'Materiales escolares y bellas artes',
    personalizations: [
      { label: 'Listas escolares', description: 'Sube lista PDF del colegio y arma cotización completa en segundos. Empaque como SKU armable.' },
      { label: 'Pedidos por aula', description: 'Cotiza y entrega por salón, grado o escuela con factura única y desglose por alumno.' },
      { label: 'Catálogo masivo', description: 'Miles de SKUs con búsqueda rápida, scanner y filtros (marca, color, gramaje, tamaño).' },
      { label: 'Marcas premium', description: 'Faber-Castell, Prismacolor, Canson categorizados con reportes por marca y rotación.' },
      { label: 'Sets por color', description: 'Variantes de 24, 36, 48, 72 colores como un mismo producto con stock independiente.' },
      { label: 'Mayoreo escalonado', description: 'Precios por volumen para escuelas, dibujantes y compradores B2B con auto-descuento.' },
      { label: 'Bellas artes especializadas', description: 'Categoría con óleos, gouache, papel ácido-free y herramientas de bastidor.' },
      { label: 'Servicios extra al ticket', description: 'Encuadernación, fotocopias y plotter por metro lineal facturados en el mismo cobro.' },
      { label: 'Temporada de regreso', description: 'Modo "back to school": stock especial, horarios extendidos y reportes de temporada alta.' },
    ],
    href: '/giros/papeleria-y-arte',
    iconId: 'stationery',
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  {
    label: 'Parques y Atracciones',
    description: 'Merchandise en venues y eventos',
    personalizations: [
      { label: 'Stock por venue', description: 'Inventario independiente por puesto, atracción o pop-up, todo consolidado en HQ.' },
      { label: 'POS sin internet', description: 'Cobra en tablet con o sin WiFi. Sincroniza automáticamente al recuperar señal.' },
      { label: 'Pago con pulsera RFID', description: 'Carga saldo en pulsera del visitante, paga sin sacar tarjeta. Cierre del día totalizado.' },
      { label: 'Tap, QR y contactless', description: 'Lectores móviles, QR dinámico y tap-to-pay sin caja fija para venta en cualquier punto.' },
      { label: 'Souvenirs personalizados', description: 'Foto del visitante en producto (taza, llavero, magnet) con upsell automático en POS.' },
      { label: 'Boleto + merch en una venta', description: 'Combina boleto de atracción con producto del shop en un solo ticket y pago.' },
      { label: 'Membresías de parque', description: 'Pase anual con descuento en tienda, identificado por QR o pulsera al pagar.' },
      { label: 'Activación por temporada', description: 'Catálogo Halloween, Navidad o eventos especiales que se activa/desactiva por fecha.' },
      { label: 'Reportes por hora', description: 'Ventas por hora del día y atracción para ajustar staff, stock y horarios pico.' },
    ],
    href: '/giros/parques-y-atracciones',
    iconId: 'themepark',
    color: '#E11D48',
    bgColor: 'rgba(225, 29, 72, 0.1)',
  },
  {
    label: 'Electrónica',
    description: 'Gadgets, tecnología y accesorios',
    personalizations: [
      { label: 'IMEI y números de serie', description: 'Captura IMEI y serie en cada venta para trazabilidad total y auditoría legal.' },
      { label: 'Garantías por equipo', description: 'Tickets de garantía vinculados al cliente, equipo, serie y fecha exacta de venta.' },
      { label: 'Plan de pagos / MSI', description: 'Integra Kueski, Atrato, Mercado Crédito y MSI bancarios directo en POS.' },
      { label: 'Trade-in / canje', description: 'Recibe equipo usado con tasación automática y descuenta en compra de nuevo.' },
      { label: 'Activación SIM/eSIM', description: 'Vende y activa chip Telcel, AT&T o Movistar en el mismo ticket de venta.' },
      { label: 'Bundles inteligentes', description: 'Equipo + funda + cristal + cargador como combo con descuento automático al armar.' },
      { label: 'Garantía extendida', description: 'Vende cobertura de 12 o 24 meses extra como SKU vinculado al equipo principal.' },
      { label: 'Reparaciones internas', description: 'Tickets de reparación con estado (recibido, diagnóstico, listo) y aviso al cliente.' },
      { label: 'RMA al fabricante', description: 'Defectos vuelven al proveedor con tracking del reembolso o reposición sin perderlo.' },
    ],
    href: '/giros/electronica',
    iconId: 'electronics',
    color: '#6366F1',
    bgColor: 'rgba(99, 102, 241, 0.1)',
  },
  {
    label: 'Fundas para Celulares',
    description: 'Accesorios por modelo de teléfono',
    personalizations: [
      { label: 'Por modelo exacto', description: 'Filtra catálogo por iPhone 15, Galaxy S24 y todos los modelos vigentes con su variante.' },
      { label: 'Compatibilidad cruzada', description: 'Una funda sirve para varios modelos. El sistema sugiere alternativas compatibles.' },
      { label: 'Lanzamientos automáticos', description: 'Catálogo se prepopulea con nuevos modelos al lanzamiento (iPhone 17, S25, Pixel 10).' },
      { label: 'Cristal por modelo exacto', description: 'Stock de templado por talla precisa del cristal con alerta de discontinuación.' },
      { label: 'Personalización con foto', description: 'Cliente sube foto, se imprime en funda. Cobra extra y guarda diseño para reorden.' },
      { label: 'Bundles funda + mica', description: 'Combos de funda + cristal + cargador con precio especial automático al armar.' },
      { label: 'Servicio "te lo pongo"', description: 'Cobra instalación de mica o hidrogel como servicio extra en el mismo ticket.' },
      { label: 'Marcas premium', description: 'Spigen, OtterBox, Casetify, UAG categorizados con reportes por marca y margen.' },
      { label: 'Alternativa al agotado', description: 'Si una funda se acaba, sugiere modelo similar compatible con el mismo teléfono.' },
    ],
    href: '/giros/fundas-celulares',
    iconId: 'phonecase',
    color: '#14B8A6',
    bgColor: 'rgba(20, 184, 166, 0.1)',
  },
  {
    label: 'Minisúpers',
    description: 'Abarrotes, conveniencia y barrio',
    personalizations: [
      { label: 'Báscula y a granel', description: 'Vende por kilo (frutas, abarrotes, dulces) con báscula integrada y precio dinámico.' },
      { label: 'Caducidad y mermas', description: 'Alerta automática de productos por caducar; descuento programado y reporte de mermas semanal.' },
      { label: 'Conteo nocturno', description: 'Conteo cíclico por anaquel sin cerrar tienda. Ajustes auditados con foto y firma del encargado.' },
      { label: 'Crédito a vecinos', description: 'Cuenta corriente por cliente del barrio con límite, recordatorios y reporte de cobranza.' },
      { label: 'Cigarros y controlados', description: 'Bloqueo de venta a menores, control por SKU restringido y reportes para SAT.' },
      { label: 'Recargas y servicios', description: 'Tiempo aire, pago de luz, agua y gas en el mismo POS con comisión automática.' },
      { label: 'Promos por temporada', description: 'Activa precios especiales en temporada (regreso a clases, navidad) sin tocar catálogo base.' },
      { label: 'Reabasto inteligente', description: 'Sugerencia de pedido por proveedor según rotación real y días sin stock.' },
      { label: 'Multi-sucursal', description: 'Inventario y precios consolidados entre todas tus tiendas con transferencias entre ellas.' },
    ],
    href: '/giros/minisupers',
    iconId: 'minisuper',
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
  },
  {
    label: 'Vinos y Licores',
    description: 'Bebidas alcohólicas y maridaje',
    personalizations: [
      { label: 'Verificación de edad', description: 'POS bloquea venta sin verificar identificación. Captura datos para auditoría legal.' },
      { label: 'Inventario por añada', description: 'SKU por cosecha y bodega con stock independiente. Reportes de rotación por añada.' },
      { label: 'Precio por presentación', description: 'Mismo vino en 750ml, magnum y caja con precio y stock independiente por presentación.' },
      { label: 'Ediciones limitadas', description: 'Numeración, certificado y reserva VIP para botellas de colección y allocation.' },
      { label: 'Catas y eventos', description: 'Vende boletos para catas con maridaje incluido y descuento en compra del mismo vino.' },
      { label: 'Maridaje sugerido', description: 'Recomienda vino según comida del cliente o producto que ya está comprando.' },
      { label: 'Permisos y CRT', description: 'Cumple con SAT, marbetes y registros del CRT (Consejo Regulador del Tequila) automáticamente.' },
      { label: 'Club del vino', description: 'Membresía con envío mensual de selección, descuentos y eventos exclusivos.' },
      { label: 'Temperatura y cuidado', description: 'Notas de almacenamiento por SKU y alerta si la temperatura del cellar se sale de rango.' },
    ],
    href: '/giros/vinos-y-licores',
    iconId: 'wine',
    color: '#7C2D12',
    bgColor: 'rgba(124, 45, 18, 0.1)',
  },
];

export const navLinks: NavLink[] = [
  {
    label: 'Plataforma',
    href: '/producto',
    pillars: [
      {
        verb: 'Vende',
        description: 'Cobra en todos los canales',
        href: '/producto/punto-de-venta',
        items: [
          { label: 'Punto de venta', href: '/producto/punto-de-venta' },
          { label: 'Tienda en línea', href: '/producto/tienda-en-linea' },
          { label: 'Promociones', href: '/producto/promociones' },
          { label: 'Apartados y pedidos', href: '/producto/apartados-y-pedidos' },
          { label: 'Social & WhatsApp Commerce', href: '/producto/social-commerce' },
          { label: 'Agentic Commerce', href: '/producto/agentic-commerce' },
          { label: 'Facturación electrónica', href: '/producto/facturacion-electronica' },
        ],
      },
      {
        verb: 'Controla',
        description: 'Inventario, compras y finanzas',
        href: '/producto/inventario-omnicanal',
        items: [
          { label: 'Inventario omnicanal', href: '/producto/inventario-omnicanal' },
          { label: 'Conteo físico', href: '/producto/conteo-fisico' },
          { label: 'Nivelación de inventario', href: '/producto/nivelacion-de-inventario' },
          { label: 'Órdenes de compra', href: '/producto/ordenes-de-compra' },
          { label: 'Gastos', href: '/producto/gastos' },
          { label: 'Cuentas por pagar', href: '/producto/cuentas-por-pagar' },
          { label: 'Reportes y analítica', href: '/producto/reportes-y-analitica' },
        ],
      },
      {
        verb: 'Fideliza',
        description: 'Conquista y retén clientes',
        href: '/producto/clientes-y-crm',
        items: [
          { label: 'Clientes y CRM', href: '/producto/clientes-y-crm' },
          { label: 'Programa de lealtad', href: '/producto/programa-de-lealtad' },
          { label: 'Portal de clientes', href: '/producto/portal-de-clientes' },
          { label: 'Tarjetas de regalo', href: '/producto/tarjetas-de-regalo' },
          { label: 'Marketing por correo', href: '/producto/marketing-por-correo' },
          { label: 'Marketing por WhatsApp', href: '/producto/marketing-por-whatsapp' },
          { label: 'Membresías y suscripciones', href: '/producto/membresias-y-suscripciones' },
        ],
      },
      {
        verb: 'Automatiza',
        description: 'Inteligencia que opera por ti',
        href: '/producto/especialista-ia',
        items: [
          { label: 'Especialista IA dedicado', href: '/producto/especialista-ia' },
          { label: 'AXO · Copiloto IA', href: '/producto/axo-copiloto-ia' },
          { label: 'Workflows', href: '/producto/workflows' },
          { label: 'Alertas inteligentes', href: '/producto/alertas-inteligentes' },
          { label: 'Reportes predictivos', href: '/producto/reportes-predictivos' },
          { label: 'Orquestador de agentes', href: '/producto/orquestador-de-agentes' },
          { label: 'API e integraciones', href: '/producto/api-e-integraciones' },
        ],
      },
    ],
  },
  {
    label: 'Giros de Negocio',
    href: '/giros',
    sectors: businessSectors,
  },
  { label: 'Partners', href: '/partners' },
  { label: 'Planes', href: '/planes' },
  { label: 'Casos de éxito', href: '/casos-de-exito' },
];

export const footerLinks = {
  vende: [
    { label: 'Punto de venta', href: '/producto/punto-de-venta' },
    { label: 'Tienda en línea', href: '/producto/tienda-en-linea' },
    { label: 'Promociones', href: '/producto/promociones' },
    { label: 'Apartados y pedidos', href: '/producto/apartados-y-pedidos' },
    { label: 'Social & WhatsApp Commerce', href: '/producto/social-commerce' },
    { label: 'Agentic Commerce', href: '/producto/agentic-commerce' },
    { label: 'Facturación electrónica', href: '/producto/facturacion-electronica' },
  ],
  controla: [
    { label: 'Inventario omnicanal', href: '/producto/inventario-omnicanal' },
    { label: 'Conteo físico', href: '/producto/conteo-fisico' },
    { label: 'Nivelación de inventario', href: '/producto/nivelacion-de-inventario' },
    { label: 'Órdenes de compra', href: '/producto/ordenes-de-compra' },
    { label: 'Gastos', href: '/producto/gastos' },
    { label: 'Cuentas por pagar', href: '/producto/cuentas-por-pagar' },
    { label: 'Reportes y analítica', href: '/producto/reportes-y-analitica' },
  ],
  fideliza: [
    { label: 'Clientes y CRM', href: '/producto/clientes-y-crm' },
    { label: 'Programa de lealtad', href: '/producto/programa-de-lealtad' },
    { label: 'Portal de clientes', href: '/producto/portal-de-clientes' },
    { label: 'Tarjetas de regalo', href: '/producto/tarjetas-de-regalo' },
    { label: 'Marketing por correo', href: '/producto/marketing-por-correo' },
    { label: 'Marketing por WhatsApp', href: '/producto/marketing-por-whatsapp' },
    { label: 'Membresías y suscripciones', href: '/producto/membresias-y-suscripciones' },
  ],
  automatiza: [
    { label: 'Especialista IA dedicado', href: '/producto/especialista-ia' },
    { label: 'AXO · Copiloto IA', href: '/producto/axo-copiloto-ia' },
    { label: 'Workflows', href: '/producto/workflows' },
    { label: 'Alertas inteligentes', href: '/producto/alertas-inteligentes' },
    { label: 'Reportes predictivos', href: '/producto/reportes-predictivos' },
    { label: 'Orquestador de agentes', href: '/producto/orquestador-de-agentes' },
    { label: 'API e integraciones', href: '/producto/api-e-integraciones' },
  ],
  empresa: [
    { label: 'Nosotros', href: '/nosotros' },
    { label: 'Manifiesto', href: '/manifiesto' },
    { label: 'Casos de éxito', href: '/casos-de-exito' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contacto', href: '/contacto' },
  ],
  recursos: [
    { label: 'Planes y precios', href: '/planes' },
    { label: 'Centro de ayuda', href: '#' },
    { label: 'Estado del sistema', href: '#' },
    { label: 'Aviso de privacidad', href: '/privacidad' },
    { label: 'Términos y condiciones', href: '/terminos' },
  ],
};
