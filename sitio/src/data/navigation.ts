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

export interface BusinessSector {
  label: string;
  description: string;
  href: string;
  iconId: string;
  color: string;
  bgColor: string;
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
    label: 'Marcas de Ropa',
    description: 'Boutiques, moda y apparel retail',
    href: '/giros/marcas-de-ropa',
    iconId: 'clothing',
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.1)',
  },
  {
    label: 'Zapatería',
    description: 'Calzado y accesorios de moda',
    href: '/giros/zapateria',
    iconId: 'shoes',
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
  },
  {
    label: 'Joyería',
    description: 'Joyería fina, bisutería y accesorios',
    href: '/giros/joyeria',
    iconId: 'jewelry',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  {
    label: 'Novedades',
    description: 'Regalos, curiosidades y variedades',
    href: '/giros/novedades',
    iconId: 'novelty',
    color: '#A855F7',
    bgColor: 'rgba(168, 85, 247, 0.1)',
  },
  {
    label: 'Vinos y Licores',
    description: 'Vinotecas, licorería y spirits',
    href: '/giros/vinos-y-licores',
    iconId: 'wine',
    color: '#7C3AED',
    bgColor: 'rgba(124, 58, 237, 0.1)',
  },
  {
    label: 'Tienda de Comestibles',
    description: 'Abarrotes, gourmet y especialidades',
    href: '/giros/comestibles',
    iconId: 'grocery',
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  {
    label: 'Merchandising en Eventos',
    description: 'Venta en ferias, expos y conciertos',
    href: '/giros/merchandising-eventos',
    iconId: 'events',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
  },
  {
    label: 'Supermercado',
    description: 'Autoservicio y cadenas de retail',
    href: '/giros/supermercado',
    iconId: 'supermarket',
    color: '#14B8A6',
    bgColor: 'rgba(20, 184, 166, 0.1)',
  },
  {
    label: 'Electrónica',
    description: 'Gadgets, tecnología y accesorios',
    href: '/giros/electronica',
    iconId: 'electronics',
    color: '#6366F1',
    bgColor: 'rgba(99, 102, 241, 0.1)',
  },
  {
    label: 'Bicicletas',
    description: 'Bike shops y accesorios ciclistas',
    href: '/giros/bicicletas',
    iconId: 'bikes',
    color: '#0EA5E9',
    bgColor: 'rgba(14, 165, 233, 0.1)',
  },
  {
    label: 'Franquicias',
    description: 'Multi-unidad y operación escalable',
    href: '/giros/franquicias',
    iconId: 'franchise',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
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
        href: '/producto#vende',
        items: [
          { label: 'Punto de venta', href: '/producto#pos' },
          { label: 'Comercio electrónico', href: '/producto#ecommerce' },
          { label: 'WhatsApp Commerce', href: '/producto#whatsapp' },
          { label: 'Métodos de pago', href: '/producto#pagos' },
        ],
      },
      {
        verb: 'Controla',
        description: 'Opera todas tus tiendas',
        href: '/producto#controla',
        items: [
          { label: 'Gestión de inventario', href: '/producto#inventario' },
          { label: 'Multi-sucursal', href: '/producto#sucursales' },
          { label: 'Pedidos y logística', href: '/producto#pedidos' },
          { label: 'Facturación electrónica', href: '/producto#facturacion' },
        ],
      },
      {
        verb: 'Fideliza',
        description: 'Crece con tus clientes',
        href: '/producto#fideliza',
        items: [
          { label: 'CRM y clientes', href: '/producto#clientes' },
          { label: 'Programa de lealtad', href: '/producto#lealtad' },
          { label: 'Campañas', href: '/producto#campanas' },
          { label: 'Personalización', href: '/producto#custom' },
        ],
      },
      {
        verb: 'Automatiza',
        description: 'Decide con inteligencia',
        href: '/producto#automatiza',
        items: [
          { label: 'Reportes en tiempo real', href: '/producto#reportes' },
          { label: 'AXO · IA', href: '/producto#axo' },
          { label: 'Alertas inteligentes', href: '/producto#alertas' },
          { label: 'Integraciones', href: '/producto#integraciones' },
        ],
      },
    ],
  },
  {
    label: 'Giros de Negocio',
    href: '/giros',
    sectors: businessSectors,
  },
  { label: 'Planes', href: '/planes' },
  { label: 'Casos de éxito', href: '/casos-de-exito' },
];

export const footerLinks = {
  vende: [
    { label: 'Punto de venta', href: '/producto#pos' },
    { label: 'Comercio electrónico', href: '/producto#ecommerce' },
    { label: 'WhatsApp Commerce', href: '/producto#whatsapp' },
    { label: 'Métodos de pago', href: '/producto#pagos' },
  ],
  controla: [
    { label: 'Gestión de inventario', href: '/producto#inventario' },
    { label: 'Multi-sucursal', href: '/producto#sucursales' },
    { label: 'Pedidos y logística', href: '/producto#pedidos' },
    { label: 'Facturación electrónica', href: '/producto#facturacion' },
  ],
  fideliza: [
    { label: 'CRM y clientes', href: '/producto#clientes' },
    { label: 'Programa de lealtad', href: '/producto#lealtad' },
    { label: 'Campañas', href: '/producto#campanas' },
    { label: 'Personalización', href: '/producto#custom' },
  ],
  automatiza: [
    { label: 'Reportes en tiempo real', href: '/producto#reportes' },
    { label: 'AXO · IA', href: '/producto#axo' },
    { label: 'Alertas inteligentes', href: '/producto#alertas' },
    { label: 'Integraciones', href: '/producto#integraciones' },
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
    { label: 'Política de privacidad', href: '#' },
    { label: 'Términos de uso', href: '#' },
  ],
};
