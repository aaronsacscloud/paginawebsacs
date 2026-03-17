export interface NavSubItem {
  label: string;
  href: string;
  description?: string;
  icon?: string;
}

export interface NavLink {
  label: string;
  href: string;
  children?: NavSubItem[];
}

export const navLinks: NavLink[] = [
  {
    label: 'Producto',
    href: '/producto',
    children: [
      { label: 'Punto de venta', href: '/producto#pos', description: 'Cobra en segundos desde cualquier dispositivo.', icon: 'pos' },
      { label: 'Comercio electrónico', href: '/producto#ecommerce', description: 'Tu tienda online integrada con tu inventario.', icon: 'ecom' },
      { label: 'Pedidos y logística', href: '/producto#pedidos', description: 'Gestiona entregas y fulfillment sin fricciones.', icon: 'ship' },
      { label: 'Gestión de inventario', href: '/producto#inventario', description: 'Control total de stock en tiempo real.', icon: 'inv' },
      { label: 'Clientes y fidelización', href: '/producto#clientes', description: 'Conoce, segmenta y retén a tus clientes.', icon: 'crm' },
      { label: 'Automatización IA', href: '/producto#axo', description: 'AXO, tu copiloto de inteligencia artificial.', icon: 'axo' },
    ],
  },
  { label: 'Planes', href: '/planes' },
  { label: 'Casos de éxito', href: '/casos-de-exito' },
  { label: 'Nosotros', href: '/nosotros' },
];

export const footerLinks = {
  producto: [
    { label: 'Punto de venta', href: '/producto#pos' },
    { label: 'Comercio electrónico', href: '/producto#ecommerce' },
    { label: 'Pedidos y logística', href: '/producto#pedidos' },
    { label: 'Gestión de inventario', href: '/producto#inventario' },
    { label: 'Clientes y fidelización', href: '/producto#clientes' },
    { label: 'Automatización IA', href: '/producto#axo' },
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
