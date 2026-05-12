// Mock data para `?demo=1` en el portal del partner.
// Sirve para que un founder o partner nuevo pueda ver "cómo se ve lleno"
// sin tener actividad real. Las APIs siguen funcionando — el shell decide
// si usa estos fixtures o llama al endpoint real.

// ─── Helpers para timestamps relativos ───
const now = Date.now();
const dayMs = 24 * 3600 * 1000;
const daysAgo = (d: number) => new Date(now - d * dayMs).toISOString();
const minsAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
const inDays = (d: number) => new Date(now + d * dayMs).toISOString();

// ─── Summary ───
export const demoSummary = {
  user: {
    id: 'demo-partner-id',
    nombre: 'Andrea Araujo',
    email: 'andrea@ejemplo.mx',
    default_commission_pct: 50,
  },
  proximoPago: 3500,
  pendiente: 1750,
  totalAno: 17500,
  bonosMes: {
    prueba_gratis_count: 4, prueba_gratis_sum: 0, // sin bonos individuales en v2
    demo_completada_count: 3, demo_completada_sum: 0,
    venta_directa_count: 1, venta_directa_sum: 3500,
  },
  leads: { total: 24, bookings: 5, bookings_realizadas: 3 },
  topFuentes: [
    { fuente: 'instagram', count: 15 },
    { fuente: 'whatsapp', count: 5 },
    { fuente: 'twitter', count: 4 },
  ],
};

// ─── Leads (24 contacts en distintos estados) ───
const leadNames = [
  ['Mariana López',   'mariana@joyasmar.mx',    '+52 55 1234 5678', 'Joyería Mariana',           'CDMX'],
  ['Carlos Méndez',   'carlos@mendezboutique.com','+52 55 2345 6789','Méndez Boutique',           'CDMX'],
  ['Laura Jiménez',   'laura@cafedelaura.mx',   '+52 33 3456 7890', 'Café de Laura',             'Guadalajara'],
  ['Roberto Vázquez', 'roberto@vazquezjoyas.mx','+52 81 4567 8901', 'Vázquez Joyas (3 sucs)',    'Monterrey'],
  ['Sofía Ramírez',   'sofia@ramireztienda.mx', '+52 55 5678 9012', 'Ramírez Tienda',            'Querétaro'],
  ['Diego Hernández', 'diego@hernandezopt.mx',  '+52 55 6789 0123', 'Óptica Hernández',          'Puebla'],
  ['Valentina Torres','valentina@torrespet.mx', '+52 55 7890 1234', 'Torres Pet Shop',           'Mérida'],
  ['Andrés Martínez', 'andres@martinezbar.mx',  '+52 55 8901 2345', 'Martínez Bar',              'León'],
  ['Camila Rojas',    'camila@rojasfarm.mx',    '+52 55 9012 3456', 'Farmacia Rojas',            'Tijuana'],
  ['Joaquín Silva',   'joaquin@silvarestaurante.mx','+52 33 0123 4567','Silva Restaurante',      'Guadalajara'],
  ['Isabela Cruz',    'isabela@cruzboutique.mx','+52 55 1357 2468', 'Cruz Boutique',             'CDMX'],
  ['Mateo Fuentes',   'mateo@fuentesferr.mx',   '+52 55 2468 1357', 'Ferretería Fuentes',        'Toluca'],
  ['Renata Castillo', 'renata@castillospa.mx',  '+52 55 3579 2468', 'Castillo Spa',              'CDMX'],
  ['Sebastián Vega',  'sebastian@vegaautos.mx', '+52 81 4680 3579', 'Vega Autos',                'Monterrey'],
  ['Lucía Paredes',   'lucia@paredespan.mx',    '+52 33 5791 4680', 'Panadería Paredes',         'Guadalajara'],
  ['Tomás Aguilar',   'tomas@aguilartec.mx',    '+52 55 6802 5791', 'Aguilar Tech',              'CDMX'],
  ['Daniela Soto',    'daniela@sotofloreria.mx','+52 55 7913 6802', 'Florería Soto',             'Querétaro'],
  ['Emilio Navarro',  'emilio@navarrocervecera.mx','+52 33 8024 7913','Cervecería Navarro',     'Guadalajara'],
  ['Sara Bravo',      'sara@bravoaccesorios.mx','+52 55 9135 8024', 'Accesorios Bravo',          'CDMX'],
  ['Lucas Ortiz',     'lucas@ortizgym.mx',      '+52 81 0246 9135', 'Gym Ortiz',                 'Monterrey'],
  ['Paula Mendoza',   'paula@mendozalibrer.mx', '+52 55 1357 0246', 'Librería Mendoza',          'Puebla'],
  ['Hugo Reyes',      'hugo@reyestienda.mx',    '+52 55 2468 1357', 'Reyes Tienda Deportiva',    'CDMX'],
  ['Lola Cortés',     'lola@cortesnails.mx',    '+52 33 3579 2468', 'Cortés Nail Studio',        'Guadalajara'],
  ['Iván Salinas',    'ivan@salinasvapeshop.mx','+52 55 4680 3579', 'Salinas Vape Shop',         'CDMX'],
];

// stages: nuevo / prueba / demo_agendada / demo_realizada / cliente / pagado
const stageMap: Record<string, string> = {
  nuevo: 'lead',
  prueba: 'prueba_gratis',
  demo_agendada: 'demo_agendada',
  demo_realizada: 'demo_realizada',
  cliente: 'cliente',
  pagado: 'cliente',
};

const leadDist: Array<{ stage: string; count: number }> = [
  { stage: 'nuevo', count: 3 },
  { stage: 'prueba', count: 4 },
  { stage: 'demo_agendada', count: 2 },
  { stage: 'demo_realizada', count: 1 },
  { stage: 'cliente', count: 9 },   // total 24 — 5 ya pagaron, 4 esperando primer pago
  { stage: 'pagado', count: 5 },
];

const buildDemoLeads = () => {
  const contacts: any[] = [];
  const bookings: any[] = [];
  const deals: any[] = [];
  let idx = 0;
  const stages: string[] = [];
  leadDist.forEach(({ stage, count }) => { for (let i = 0; i < count; i++) stages.push(stage); });

  stages.forEach((stage, i) => {
    const [nombre, email, whatsapp, empresa, ciudad] = leadNames[i] || leadNames[i % leadNames.length];
    const contactId = `demo-contact-${i}`;
    const createdDay = 30 - Math.min(28, i * 1.2);
    const fuente = i % 3 === 0 ? 'instagram' : i % 3 === 1 ? 'whatsapp' : 'twitter';
    const planInteres = stage === 'cliente' || stage === 'pagado'
      ? (i % 3 === 0 ? 'fideliza_plus' : i % 3 === 1 ? 'fideliza' : 'control')
      : null;
    contacts.push({
      id: contactId,
      nombre, email, whatsapp,
      lifecycle_stage: stageMap[stage],
      fuente,
      plan_interes: planInteres,
      empresa, ciudad,
      created_at: daysAgo(createdDay),
    });

    if (stage === 'demo_agendada' || stage === 'demo_realizada' || stage === 'cliente' || stage === 'pagado') {
      const isFuture = stage === 'demo_agendada';
      const bookingDay = isFuture ? -Math.max(1, 4 - i) : Math.max(1, createdDay - 2);
      bookings.push({
        id: `demo-booking-${i}`,
        invitee_nombre: nombre,
        invitee_email: email,
        fecha: isFuture ? inDays(bookingDay) : daysAgo(bookingDay),
        hora_inicio: '15:00',
        estado: isFuture ? 'agendada' : 'realizada',
        created_at: daysAgo(createdDay - 1),
        contact_id: contactId,
      });
    }

    if (stage === 'cliente' || stage === 'pagado') {
      const monto = i % 3 === 0 ? 4900 : i % 3 === 1 ? 3500 : 1990;
      deals.push({
        id: `demo-deal-${i}`,
        nombre: `${empresa} · ${planInteres || 'fideliza'}`,
        valor_total: monto,
        stage: stage === 'pagado' ? 'won' : 'pending_payment',
        created_at: daysAgo(createdDay - 3),
        closed_at: stage === 'pagado' ? daysAgo(Math.max(1, createdDay - 8)) : null,
        contact_id: contactId,
      });
    }
  });

  return { contacts, bookings, deals };
};

export const demoLeads = buildDemoLeads();

// ─── Link stats ───
const buildDailyVisits = (): { day: string; visits: number }[] => {
  const out: { day: string; visits: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    // Curva creciente con variación
    const base = Math.max(2, Math.round(3 + (29 - i) * 0.25));
    const noise = (i * 7) % 5;
    out.push({ day: key, visits: base + noise });
  }
  return out;
};

export const demoLinkStats = {
  total: 142,
  unique: 89,
  recurring: 21,
  today: 6,
  week: 38,
  month: 142,
  last_visit_at: minsAgo(12),
  top_referrers: [
    { host: 'instagram.com', count: 88 },
    { host: 'web.whatsapp.com', count: 31 },
    { host: 'twitter.com', count: 14 },
    { host: 'linkedin.com', count: 6 },
    { host: 'google.com', count: 3 },
  ],
  daily: buildDailyVisits(),
  recent: [
    { when: minsAgo(12), referrer: 'instagram.com', visitor_short: 'a3f7c2', is_recurring: false },
    { when: minsAgo(48), referrer: 'web.whatsapp.com', visitor_short: 'b8d4e1', is_recurring: true },
    { when: hoursAgo(2), referrer: 'twitter.com', visitor_short: 'c9a1f5', is_recurring: false },
    { when: hoursAgo(5), referrer: 'instagram.com', visitor_short: 'd2b6e8', is_recurring: false },
    { when: hoursAgo(8), referrer: null, visitor_short: 'e5c7a4', is_recurring: false },
  ],
};

// ─── Content / puntos ───
import { CONTENT_TYPES as REAL_CONTENT_TYPES } from './content-types';

export const demoContent = {
  tipos: REAL_CONTENT_TYPES,
  items: [
    { id: 'd1', tipo: 'reel', plataforma: 'instagram', url: 'https://instagram.com/reel/demo1', puntos: 40, estado: 'approved', categoria: 'contenido', mes_acreditado: nowYM(), created_at: daysAgo(3), descripcion: 'Reel mostrando POS en mi tienda' },
    { id: 'd2', tipo: 'tiktok', plataforma: 'tiktok', url: 'https://tiktok.com/@demo/video/2', puntos: 25, estado: 'approved', categoria: 'contenido', mes_acreditado: nowYM(), created_at: daysAgo(7), descripcion: 'TikTok caso de uso' },
    { id: 'd3', tipo: 'post', plataforma: 'instagram', url: 'https://instagram.com/p/demo3', puntos: 12, estado: 'approved', categoria: 'contenido', mes_acreditado: nowYM(), created_at: daysAgo(11), descripcion: 'Post con foto del producto' },
    { id: 'd4', tipo: 'testimonial', plataforma: 'instagram', url: 'https://instagram.com/p/demo4', puntos: 10, estado: 'approved', categoria: 'contenido', mes_acreditado: nowYM(), created_at: daysAgo(17), descripcion: 'Testimonial cliente' },
    { id: 'd5', tipo: 'reel', plataforma: 'instagram', url: 'https://instagram.com/reel/demo5', puntos: 0, estado: 'pending_review', categoria: 'contenido', mes_acreditado: nowYM(), created_at: daysAgo(1), descripcion: 'Reel nuevo en revisión' },
  ],
  summary: {
    meta: 100,
    mes_actual: nowYM(),
    puntos_mes: 87,
    puntos_acumulados: 0,
    progreso_pct: 87,
    pending_count: 1,
    approved_count: 4,
    rejected_count: 0,
    required_this_month: 100,
    carry_deficit: 0,
    days_remaining: 22,
    days_into_month: 8,
    month_progress_pct: 27,
    reset_date: nextMonth1stISO(),
    consecutive_failed_months: 0,
    status_level: 'active',
    suspended: false,
    suspension_reason: null,
    historico: buildHistorico(),
  },
};

function nowYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nextMonth1stISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
}
function buildHistorico() {
  const now = new Date();
  const out: any[] = [];
  const pts = [110, 95, 105, 88, 120, 87]; // últimos 6 meses
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const p = pts[5 - i];
    out.push({
      mes: k,
      label: d.toLocaleString('es-MX', { month: 'long', year: 'numeric' }),
      puntos: p,
      contenido: p - 10,
      apoyo: 10,
      filantropia: 0,
      cumplido: p >= 100,
      es_actual: i === 0,
    });
  }
  return out;
}

// ─── Payments (5 pagos liquidados año) ───
export const demoPayments = {
  payments: [
    {
      payment_reference: 'OXXO-202604-001',
      paid_at: daysAgo(10),
      total: 3500,
      items: [
        { id: 'p1a', tipo: 'venta_directa', commission_amount: 3500, paid_at: daysAgo(10), payment_reference: 'OXXO-202604-001', nota: 'Plan Fideliza Plus · Vázquez Joyas', deal_id: 'demo-deal-3', booking_id: null, contact_id: 'demo-contact-3' },
      ],
    },
    {
      payment_reference: 'OXXO-202603-001',
      paid_at: daysAgo(40),
      total: 4900,
      items: [
        { id: 'p2a', tipo: 'venta_directa', commission_amount: 2450, paid_at: daysAgo(40), payment_reference: 'OXXO-202603-001', nota: 'Plan Fideliza Plus · Joyería Mariana', deal_id: 'demo-deal-0', booking_id: null, contact_id: 'demo-contact-0' },
        { id: 'p2b', tipo: 'venta_directa', commission_amount: 2450, paid_at: daysAgo(40), payment_reference: 'OXXO-202603-001', nota: 'Plan Fideliza Plus · Méndez Boutique', deal_id: 'demo-deal-1', booking_id: null, contact_id: 'demo-contact-1' },
      ],
    },
    {
      payment_reference: 'OXXO-202602-001',
      paid_at: daysAgo(70),
      total: 5600,
      items: [
        { id: 'p3a', tipo: 'venta_directa', commission_amount: 1750, paid_at: daysAgo(70), payment_reference: 'OXXO-202602-001', nota: 'Plan Fideliza · Café de Laura' },
        { id: 'p3b', tipo: 'venta_directa', commission_amount: 3850, paid_at: daysAgo(70), payment_reference: 'OXXO-202602-001', nota: 'Plan Fideliza Plus · Ramírez Tienda' },
      ],
    },
    {
      payment_reference: 'OXXO-202601-001',
      paid_at: daysAgo(100),
      total: 3500,
      items: [
        { id: 'p4a', tipo: 'venta_directa', commission_amount: 3500, paid_at: daysAgo(100), payment_reference: 'OXXO-202601-001', nota: 'Plan Fideliza Plus · cliente histórico' },
      ],
    },
  ],
  total_paid_lifetime: 17500,
};

// ─── Pending commissions (próximo pago breakdown) ───
export const demoPending = {
  earned: [
    { id: 'e1', tipo: 'venta_directa', commission_amount: 3500, status: 'earned', earned_at: daysAgo(3), nota: 'Plan Fideliza Plus · Vázquez Joyas', contact_nombre: 'Roberto Vázquez' },
  ],
  pending: [
    { id: 'p1', tipo: 'venta_directa', commission_amount: 1750, status: 'pending', created_at: daysAgo(2), nota: 'Plan Fideliza · esperando depósito · Mariana López', contact_nombre: 'Mariana López' },
  ],
};

// ─── Profile / Invitación demo ───
export const demoProfile = {
  user: { id: 'demo-partner-id', nombre: 'Andrea Araujo', email: 'andrea@ejemplo.mx', default_commission_pct: 50 },
  invitation: {
    id: 'demo-inv',
    numero: 'P-2026-0042',
    nombre: 'Andrea Araujo',
    tipo: 'embajador',
    slug_landing: 'andrea',
    comision_pct: 50,
    vigencia: '2026-05-01 / 2027-04-30',
    estado: 'accepted',
    empresa: 'Andrea Lifestyle',
    whatsapp: '+52 55 1234 5678',
    tabulador: null,
    created_at: daysAgo(180),
    aceptado_fecha: daysAgo(178),
  },
  partnerLandingUrl: 'https://www.sacscloud.com/p/andrea',
  payout: {
    metodo: 'transferencia',
    titular: 'Andrea Araujo Méndez',
    rfc: 'AAAM900101ABC',
    banco: 'BBVA',
    clabe: '012180001234562847',
  },
  direccion: {
    calle: 'Av. Reforma 250',
    colonia: 'Juárez',
    ciudad: 'Ciudad de México',
    estado: 'CDMX',
    cp: '06600',
    pais: 'México',
  },
  firma_base64: null,
  signed_at: daysAgo(178),
  approved_at: daysAgo(178),
};

// ─── Certifications (Lvl 2) — todas no compradas en demo ───
export const demoCertifications = {
  items: [],
  catalog: [
    { id: 'impl-1-suc',   nombre: 'Implementación 1 sucursal',   precio: 4900 },
    { id: 'impl-multi',   nombre: 'Multisucursal',               precio: 8900 },
    { id: 'migracion',    nombre: 'Migración de datos',          precio: 6900 },
    { id: 'ia-auto',      nombre: 'IA · Automatización',         precio: 7900 },
    { id: 'ia-consultor', nombre: 'IA · Consultor',              precio: 9900 },
  ],
};

// ─── Pipeline-aware: recent activity para HomeTab ───
export const demoActivity = [
  { when: hoursAgo(2),  type: 'sale',  text: 'Mariana López firmó contrato', detail: '$3,500 confirmados — Plan Fideliza Plus' },
  { when: hoursAgo(5),  type: 'booking', text: 'Carlos Méndez agendó demo', detail: 'Mañana 15:00 con Aaron' },
  { when: hoursAgo(22), type: 'trial', text: 'Laura Jiménez activó prueba gratis', detail: 'Día 1 de 14 — Café de Laura' },
  { when: daysAgo(2),   type: 'demo',  text: 'Roberto Vázquez completó demo', detail: 'Esperando propuesta · Vázquez Joyas (3 sucs)' },
  { when: daysAgo(3),   type: 'sale',  text: 'Vázquez Joyas firmó Plan Fideliza Plus', detail: '$4,900 — depósito en 1-3 días' },
];

// ─── Para LevelTab: cuenta SACS Plan Fideliza ───
export const demoSacsAccount = {
  active: true,
  plan: 'Plan Fideliza',
  activated_at: daysAgo(150),
  monthly_status: 'al corriente',
};

// ─── Tu nivel actual + progreso ───
export const demoLevel = {
  current: 1, // Lvl 1 · Referidor
  nombre: 'Partner Referidor',
  sucursales_activas: 2,
  certificaciones_completadas: 0,
  next_level: 2,
  next_level_label: 'Partner Certificado',
  next_level_requirement: 'Completar 1 certificación',
};
