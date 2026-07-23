// Middleware de autorización para los ENDPOINTS ADMIN del CRM.
//
// Cierra el hueco: hasta ahora /api/crm/*, /api/revenue/* (admin) y varios
// /api/partners/* respondían SIN sesión — un partner o un anónimo con la URL
// leía datos del CRM directo por API, aunque no viera la página.
//
// Requiere una SESIÓN REAL por cookie (sacs_session) con rol founder/cs. NO
// acepta el header x-user-id (ese era justo el bypass: cualquiera podía mandar
// 'x-user-id: founder'). Un partner logueado también se rechaza (403).
//
// Diseño CONSERVADOR: solo se gatean prefijos/rutas EXPLÍCITAMENTE admin. Todo
// lo demás (login, portal del partner, captura de leads, onboarding de
// partners, webhooks de Stripe, vista PÚBLICA de cotizaciones) pasa intacto.
import { defineMiddleware } from 'astro:middleware';
import { getSessionFromRequest } from './lib/auth/session';

// Prefijos 100% admin (todo lo que cuelga de aquí exige founder/cs).
const ADMIN_PREFIXES = [
  '/api/crm/',        // contactos, deals, empresas, ARR, reportes, búsqueda, pipelines…
  '/api/agents/',     // agentes IA (config/runs/trigger)
];

// Rutas admin SUELTAS (fuera de los prefijos): partner-management y los
// endpoints legacy de leads del CRM (get-leads/update-lead/add-note NO tenían
// ninguna auth y solo los usa el admin LeadsTable — el dato "leads" que se
// quiere blindar). El resto de /api/partners/* es partner-facing o público
// (apply, accept/decline, onboarding, profile, commissions, dashboard).
const ADMIN_EXACT = new Set([
  '/api/partners/invitations',
  '/api/partners/approve-invitation',
  '/api/partners/detail',
  '/api/partners/provision-fideliza',
  '/api/partners/rachas-filantropia',
  '/api/partners/content-review',
  '/api/get-leads',
  '/api/update-lead',
  '/api/add-note',
]);

// /api/revenue/* es admin (RevenueHub) SALVO estas rutas públicas (el CLIENTE
// las usa desde una cotización pública, o Stripe desde su webhook).
const REVENUE_PUBLIC = new Set([
  '/api/revenue/quote-view',
  '/api/revenue/quote-comments',
  '/api/revenue/request-reactivation',
  '/api/revenue/payment-comprobante',
  '/api/revenue/stripe-webhook',
  '/api/revenue/create-payment-link',
]);

function needsAdmin(path: string): boolean {
  if (ADMIN_PREFIXES.some(p => path.startsWith(p))) return true;
  if (ADMIN_EXACT.has(path)) return true;
  if (path.startsWith('/api/revenue/') && !REVENUE_PUBLIC.has(path)) return true;
  return false;
}

const forbidden = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), { status: 403, headers: { 'Content-Type': 'application/json' } });

// Acceso por llave secreta (mismo patrón que los crons de SACS) para UN solo
// endpoint de carga de datos, autorizado por el dueño. Temporal: se retira al
// terminar la carga de enriquecimiento.
const KEY_BYPASS = new Set(['/api/crm/arr/enriquecer-whatsapp']);
const ENRICH_KEY = 'sacs-arr-2026';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  if (!needsAdmin(path)) return next();

  if (KEY_BYPASS.has(path) && context.url.searchParams.get('key') === ENRICH_KEY) return next();

  const user = await getSessionFromRequest(context.request);
  if (!user) return forbidden('No autenticado. Inicia sesión en /admin/login.');
  if (user.role === 'partner') return forbidden('No autorizado (solo administradores).');
  // founder / cs → pasa
  return next();
});
