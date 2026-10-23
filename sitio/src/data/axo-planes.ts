// Planes de AXO, la IA que trabaja dentro de SACS (presentación «AXO · noviembre 2026»).
//
// Es un producto aparte de las licencias: en el CRM viven en `plans` con categoría 'axo'
// y slug `axo_*`. Este archivo dice qué INCLUYE cada plan, para que la cotización y el
// acuse lo expliquen igual que con las licencias. No alimenta /planes ni las comparativas:
// esas páginas leen `plans` de ./plans.ts.
//
// Cada plan hereda las habilidades del de abajo (`inheritsFrom`), como en la presentación:
// Starter → Pro → Super Power → Super Power 20x → Corporativo 50x.
// Precios en pesos, más IVA. Precio de inauguración.
import type { Plan, PlanPrice } from './plans';

/** Solo se vende en pesos: el resto de monedas va en cero. */
const mxn = (n: number): PlanPrice => ({ mxn: n, usd: 0, eur: 0, brl: 0, cop: 0, ars: 0, clp: 0, pen: 0, gbp: 0 });

const CTA = { label: 'Habla con tu asesor', href: '/contacto', variant: 'secondary' as const };
const PAGANDO_EL_ANO = { category: 'Pagando el año', items: ['Implementación incluida', '5 flujos de automatización con un orquestador certificado por SACS'] };

export const axoPlanes: Plan[] = [
  {
    id: 'axo_starter',
    name: 'AXO Starter',
    description: 'Para empresas que apenas empiezan a usar la IA. Entiende tu negocio.',
    monthly: mxn(1500), annual: mxn(1200), annualTotal: mxn(14400),
    highlighted: false, cta: CTA,
    features: [
      { category: 'Analítica', items: [
        'Business intelligence con datos de SACS y de fuera',
        'Compara periodos, sucursales, vendedores, canales y proveedores',
        'Une datos de otros sistemas: el Excel del banco, tus marketplaces o la hoja de tu contador',
        'Reportes a la medida en minutos',
        'Te dice qué hacer, no solo qué pasó',
      ] },
      { category: 'Importación', items: [
        'Sube tus datos desde Excel, CSV, el PDF del proveedor o tu sistema anterior',
        'Acomoda cada columna en su lugar',
        'Revisa duplicados, códigos repetidos y precios en cero antes de guardar',
        'En cualquier módulo: productos, clientes, proveedores, inventario y precios',
      ] },
      { category: 'Memoria', items: [
        'Aprende de lo que tu equipo usa, comenta y revisa',
        'Recuerda tus reglas y procedimientos',
        'Cada mes automatiza más',
      ] },
    ],
    services: ['1 usuario', 'Capacidad 1x', 'Usuario extra: $1,500 al mes + IVA'],
  },
  {
    id: 'axo_pro',
    name: 'AXO Pro',
    description: 'Para equipos que quieren que AXO también ejecute. Hace el trabajo.',
    monthly: mxn(3000), annual: mxn(2400), annualTotal: mxn(28800),
    highlighted: false, inheritsFrom: 'AXO Starter', cta: CTA,
    features: [
      { category: 'Ejecución', items: [
        'Altas y cambios de productos, clientes, proveedores y usuarios',
        'Precios y promociones en una sucursal o en todas, con sus etiquetas',
        'Inventario: traspasos, ajustes y órdenes de compra',
        'Con tus permisos: cada cambio queda en bitácora y lo delicado te lo pide aprobar',
      ] },
      { category: 'Visión', items: [
        'Facturas y remisiones: registra la recepción y marca diferencias',
        'Fotos de producto: da de alta el artículo con su descripción',
        'Video del anaquel: detecta lo que falta y pide el resurtido',
        'Tickets y comprobantes: los convierte en gastos o pagos',
      ] },
    ],
    services: ['Hasta 3 usuarios', 'Capacidad 2x', 'Usuario extra: $1,500 al mes + IVA'],
  },
  {
    id: 'axo_super_power',
    name: 'AXO Super Power',
    description: 'Para automatizar tu operación de punta a punta. Automatiza y mejora.',
    monthly: mxn(10500), annual: mxn(8400), annualTotal: mxn(100800),
    badge: 'El más elegido', highlighted: true, inheritsFrom: 'AXO Pro', cta: CTA,
    features: [
      { category: 'Automatizaciones', items: [
        'Le cuentas cómo quieres que funcione un proceso y AXO lo diseña como consultor',
        'Te recomienda las mejores prácticas',
        'Configura SACS de inicio a fin: campos, reglas, aprobaciones y avisos',
        'Lo prueba en simulación y luego lo activa en real',
        'Tareas programadas, como el reporte de cada lunes en tu WhatsApp',
      ] },
      { category: 'Construcción', items: [
        'Campos y formularios nuevos en los módulos que ya usas',
        'Filtros y vistas a tu medida',
        'Reportes nuevos: los que te pide tu contador, tu socio o tu banco',
        'Tableros con lo importante de cada área',
        'Validaciones que evitan errores antes de guardar',
      ] },
      { category: 'Colaboración', items: [
        'Canales ilimitados por área, sucursal o proyecto',
        'AXO en cada canal, contestando con datos de SACS',
        'Cada acuerdo queda registrado en la orden, el cliente o la tarea',
        'AXO en WhatsApp: pides, apruebas y consultas sin abrir la computadora',
      ] },
      { category: 'Procedimientos empresariales', items: [
        'Detecta lo que se repite y dónde se atora cada área',
        'Conecta ventas, almacén, compras, finanzas y contabilidad en un solo camino',
        'Cada sugerencia trae los datos que la justifican',
        'Tu orquestador la afina y SACS la vuelve regla',
      ] },
      { category: 'Capacitación y onboarding', items: [
        'Ruta a la medida de cada puesto',
        'Enseña dentro de SACS con tus reglas y procedimientos',
        'Práctica sin riesgo y exámenes',
        'Avisa al encargado cuando la persona está lista para operar',
      ] },
    ],
    services: ['Hasta 5 usuarios', 'Capacidad 10x', 'Usuario extra: $1,500 al mes + IVA'],
  },
  {
    id: 'axo_super_power_20x',
    name: 'AXO Super Power 20x',
    description: 'Todo Super Power, para operaciones intensivas. Opera a escala.',
    monthly: mxn(19000), annual: mxn(15200), annualTotal: mxn(182400),
    highlighted: false, inheritsFrom: 'AXO Super Power', cta: CTA,
    features: [
      { category: 'Voz', items: [
        'Llamadas de cobranza, confirmaciones y seguimiento',
        'Cada llamada transcrita y registrada en SACS',
        'Se cobra por llamada completada',
      ] },
      PAGANDO_EL_ANO,
    ],
    services: ['Hasta 5 usuarios', 'Capacidad 20x', 'Usuario extra: $1,500 al mes + IVA'],
  },
  {
    id: 'axo_corporativo_50x',
    name: 'AXO Corporativo 50x',
    description: 'AXO administra toda tu empresa y es tu centro de control operativo.',
    monthly: mxn(46000), annual: mxn(36800), annualTotal: mxn(441600),
    highlighted: false, inheritsFrom: 'AXO Super Power 20x', cta: CTA,
    features: [
      { category: 'Centro de control operativo', items: [
        'Vigila todas las áreas y sucursales en tiempo real',
        'Decide y actúa dentro de tu política de autonomía',
        'Coordina a los responsables y escala lo que se atora',
        'Parte ejecutivo diario para la dirección',
      ] },
      // «Pagando el año» lo hereda de Super Power 20x.
    ],
    services: ['Hasta 15 usuarios', 'Capacidad 50x', 'Usuario extra: $1,500 al mes + IVA'],
  },
];

/** ¿Es un plan de AXO? Por slug (`axo_super_power`) o por nombre («AXO Super Power»). */
export const esPlanAxo = (texto?: string | null) => /^axo[\s_]/i.test(String(texto || '').trim());
