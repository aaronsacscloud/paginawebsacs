export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  location: string;
}

export interface CaseStudy extends Testimonial {
  industry: string;
  challenge: string;
  result: string;
  stat: string;
  statLabel: string;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      'SACS nos ayudó a reducir un 40% el tiempo en cierres de caja. Antes tardábamos horas, ahora son minutos.',
    name: 'María González',
    role: 'Dueña, Boutique Rosa',
    location: 'CDMX',
  },
  {
    quote:
      'Lo que más me gusta es que el inventario se actualiza en todas las sucursales al instante. Ya no hay confusión.',
    name: 'Roberto Méndez',
    role: 'Director, Calzado León',
    location: 'Guadalajara',
  },
  {
    quote:
      'AXO me sugirió reordenar un producto que no tenía en el radar. Vendimos 200 piezas esa semana.',
    name: 'Ana Castillo',
    role: 'Gerente, ModaMX',
    location: 'Monterrey',
  },
];

export const caseStudies: CaseStudy[] = [
  {
    name: 'Boutique Rosa',
    industry: 'Moda femenina',
    location: 'CDMX — 3 sucursales',
    challenge:
      'Cierres de caja manuales que tomaban horas y errores frecuentes en inventario.',
    result:
      'Reducción del 40% en tiempo operativo. Inventario sincronizado en tiempo real.',
    quote:
      'SACS nos devolvió tiempo para enfocarnos en lo que importa: nuestras clientas.',
    role: 'Fundadora',
    stat: '40%',
    statLabel: 'menos tiempo en operación',
  },
  {
    name: 'Calzado León',
    industry: 'Calzado',
    location: 'Guadalajara — 8 sucursales',
    challenge:
      'Transferencias de inventario entre sucursales eran caóticas y generaban pérdidas.',
    result:
      'Transferencias automatizadas. Reducción del 25% en merma por descontrol.',
    quote:
      'Antes era un caos mover producto entre tiendas. Ahora es un clic.',
    role: 'Director General',
    stat: '25%',
    statLabel: 'reducción en merma',
  },
  {
    name: 'ModaMX',
    industry: 'Fast fashion',
    location: 'Monterrey — 5 sucursales',
    challenge:
      'No tenían visibilidad de qué productos reordenar ni cuándo.',
    result:
      'AXO predijo demanda con 85% de precisión. Ventas incrementaron 18% en 3 meses.',
    quote:
      'AXO me sugirió reordenar un producto que no tenía en el radar. Vendimos 200 piezas esa semana.',
    role: 'Gerente de Compras',
    stat: '18%',
    statLabel: 'incremento en ventas',
  },
];
