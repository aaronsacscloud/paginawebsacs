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
    label: 'Restaurantes',
    description: 'Servicio completo y casual dining',
    href: '/giros/restaurantes',
    iconId: 'restaurant',
    color: '#FF6B35',
    bgColor: 'rgba(255, 107, 53, 0.1)',
  },
  {
    label: 'Cafeterías',
    description: 'Café de especialidad y bakery-café',
    href: '/giros/cafeterias',
    iconId: 'cafe',
    color: '#8B5E3C',
    bgColor: 'rgba(139, 94, 60, 0.1)',
  },
  {
    label: 'Bares y Antros',
    description: 'Bares, pubs y vida nocturna',
    href: '/giros/bares',
    iconId: 'bar',
    color: '#7C3AED',
    bgColor: 'rgba(124, 58, 237, 0.1)',
  },
  {
    label: 'Comida Rápida',
    description: 'Fast food y quick-service',
    href: '/giros/comida-rapida',
    iconId: 'fastfood',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
  },
  {
    label: 'Tiendas de Ropa',
    description: 'Boutiques y moda retail',
    href: '/giros/tiendas-de-ropa',
    iconId: 'clothing',
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.1)',
  },
  {
    label: 'Salones de Belleza',
    description: 'Estéticas, spas y barberías',
    href: '/giros/salones-de-belleza',
    iconId: 'beauty',
    color: '#14B8A6',
    bgColor: 'rgba(20, 184, 166, 0.1)',
  },
  {
    label: 'Abarrotes y Mini Súper',
    description: 'Tiendas de conveniencia y abarrotes',
    href: '/giros/abarrotes',
    iconId: 'grocery',
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  {
    label: 'Panaderías',
    description: 'Panaderías y pastelerías',
    href: '/giros/panaderias',
    iconId: 'bakery',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  {
    label: 'Joyerías',
    description: 'Joyería fina y accesorios',
    href: '/giros/joyerias',
    iconId: 'jewelry',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  {
    label: 'Servicios Profesionales',
    description: 'Consultorios, despachos y más',
    href: '/giros/servicios-profesionales',
    iconId: 'professional',
    color: '#6366F1',
    bgColor: 'rgba(99, 102, 241, 0.1)',
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
