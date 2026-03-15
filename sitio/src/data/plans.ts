export interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export interface FAQ {
  question: string;
  answer: string;
}

export const plans: Plan[] = [
  {
    name: 'Semilla',
    price: 'Gratis',
    period: '',
    description: 'Para emprendedores que inician su camino en retail.',
    features: [
      '1 sucursal',
      'Punto de venta básico',
      'Inventario simple',
      'Reportes esenciales',
      'Soporte por email',
    ],
    cta: 'Empezar gratis',
    highlighted: false,
  },
  {
    name: 'Crecimiento',
    price: '$799',
    period: '/mes por sucursal',
    description: 'Para negocios que necesitan escalar sin fricciones.',
    features: [
      'Hasta 5 sucursales',
      'POS completo + CFDI',
      'Inventario multi-sucursal',
      'CRM con segmentación',
      'AXO — Asistente de IA',
      'Reportes avanzados',
      'Soporte prioritario',
    ],
    cta: 'Comenzar prueba',
    highlighted: true,
  },
  {
    name: 'Empresa',
    price: 'Personalizado',
    period: '',
    description: 'Para retailers con operaciones complejas y multi-ubicación.',
    features: [
      'Sucursales ilimitadas',
      'Todo de Crecimiento',
      'API e integraciones',
      'Onboarding dedicado',
      'Account manager',
      'SLA garantizado',
      'Personalización avanzada',
    ],
    cta: 'Contactar ventas',
    highlighted: false,
  },
];

export const faqs: FAQ[] = [
  {
    question: '¿Puedo probar SACS gratis?',
    answer:
      'Sí, el plan Semilla es completamente gratuito e incluye las funcionalidades básicas para una sucursal.',
  },
  {
    question: '¿Qué incluye el 10% de impacto social?',
    answer:
      'El 10% de cada licencia se destina a programas de capacitación digital, apoyo a emprendedores locales y conservación de ecosistemas en México.',
  },
  {
    question: '¿Puedo cambiar de plan en cualquier momento?',
    answer:
      'Sí, puedes escalar o reducir tu plan cuando lo necesites, sin penalizaciones.',
  },
];
