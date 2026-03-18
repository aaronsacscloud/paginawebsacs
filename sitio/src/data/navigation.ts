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

export interface NavLink {
  label: string;
  href: string;
  children?: NavSubItem[];
  pillars?: NavPillar[];
}

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
  { label: 'Planes', href: '/planes' },
  { label: 'Casos de éxito', href: '/casos-de-exito' },
  { label: 'Nosotros', href: '/nosotros' },
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
