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
import { permisosDe, type Seccion } from './lib/crm/permisos';

// Prefijos 100% admin (todo lo que cuelga de aquí exige founder/cs).
const ADMIN_PREFIXES = [
  '/api/crm/',        // contactos, deals, empresas, ARR, reportes, búsqueda, pipelines…
  '/api/agents/',     // agentes IA (config/runs/trigger)
  '/api/automations/',// automatizaciones (listar/crear/editar/enroll) — solo admin, sin auth propia
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
  // Endpoints SOLO-founder/cs de gestión de partners (defensa en profundidad
  // sobre la auth propia del handler): fijar contraseña, recuperar acceso y
  // onboarding crean/toman cuentas de partner → nunca anónimos ni partners.
  '/api/partners/set-password',
  '/api/partners/recover-access',
  '/api/partners/onboarding',
  '/api/get-leads',
  '/api/update-lead',
  '/api/add-note',
]);

// Rutas que exigen una SESIÓN REAL (cualquier rol: founder/cs/partner) — el
// portal del partner. Sin gatearlas, dependían solo de getCurrentUser; ahora el
// middleware rechaza también a cualquier anónimo, en profundidad.
const SESSION_PREFIXES = [
  '/api/partner-portal/',
];

// Rutas exactas que exigen sesión de CUALQUIER rol (el partner sube su logo
// desde el portal, el admin desde el CRM) — NO deben caer en el gate admin de
// /api/revenue/* que rechaza a partners.
const SESSION_EXACT = new Set([
  '/api/revenue/upload-logo',
]);

// /api/revenue/* es admin (RevenueHub) SALVO estas rutas públicas (el CLIENTE
// las usa desde una cotización pública, o Stripe desde su webhook).
const REVENUE_PUBLIC = new Set([
  '/api/revenue/quote-view',
  '/api/revenue/quote-comments',
  '/api/revenue/request-reactivation',
  '/api/revenue/payment-comprobante',
  '/api/revenue/stripe-webhook',
  // Mercado Pago avisa desde sus servidores, sin sesión. Su candado es la firma
  // HMAC que valida el propio handler (y el índice único que impide duplicar el
  // pago si el aviso llega dos veces), no esta lista.
  '/api/revenue/mercadopago-webhook',
  '/api/revenue/create-payment-link',
]);

function needsAdmin(path: string): boolean {
  if (SESSION_EXACT.has(path)) return false; // sesión cualquier-rol, no admin
  if (ADMIN_PREFIXES.some(p => path.startsWith(p))) return true;
  if (ADMIN_EXACT.has(path)) return true;
  if (path.startsWith('/api/revenue/') && !REVENUE_PUBLIC.has(path)) return true;
  return false;
}

// ── Permiso por SECCIÓN ───────────────────────────────────────────────────
// Esconder un renglón del menú no protege nada: la API sigue contestando a
// quien escriba la URL. Aquí cada ruta admin se mapea a la sección del sistema
// a la que pertenece, y el permiso se revisa de verdad: 'no' no entra, 'ver'
// solo lee (GET/HEAD) y 'edit' puede escribir.
//
// Lo que no aparezca en esta tabla NO queda abierto: cae en 'config', la
// sección más restringida, así que una ruta nueva sin clasificar se lee como
// administración y solo la ve quien administra.
const SECCION_POR_RUTA: { pre: string; sec: Seccion }[] = [
  // Cuentas
  { pre: '/api/crm/contactos', sec: 'cuentas' },
  { pre: '/api/crm/empresas', sec: 'cuentas' },
  { pre: '/api/crm/clientes', sec: 'cuentas' },
  { pre: '/api/crm/leads', sec: 'cuentas' },
  { pre: '/api/crm/deals', sec: 'cuentas' },
  { pre: '/api/crm/oportunidades', sec: 'cuentas' },
  { pre: '/api/crm/reuniones', sec: 'cuentas' },
  { pre: '/api/crm/actividad', sec: 'cuentas' },
  { pre: '/api/crm/search', sec: 'cuentas' },
  { pre: '/api/crm/etiquetas', sec: 'cuentas' },
  { pre: '/api/get-leads', sec: 'cuentas' },
  { pre: '/api/update-lead', sec: 'cuentas' },
  { pre: '/api/add-note', sec: 'cuentas' },
  // Facturación
  { pre: '/api/revenue/', sec: 'facturacion' },
  { pre: '/api/crm/arr', sec: 'facturacion' },
  { pre: '/api/crm/cobranza', sec: 'facturacion' },
  { pre: '/api/crm/pagos', sec: 'facturacion' },
  { pre: '/api/crm/suscripciones', sec: 'facturacion' },
  { pre: '/api/crm/unificar', sec: 'facturacion' },
  // Acompañamiento
  { pre: '/api/crm/mejoras', sec: 'acompanamiento' },
  { pre: '/api/crm/consultoria', sec: 'acompanamiento' },
  { pre: '/api/crm/expansion', sec: 'acompanamiento' },
  { pre: '/api/crm/salud', sec: 'acompanamiento' },
  // Automatización
  { pre: '/api/automations/', sec: 'automatizacion' },
  { pre: '/api/agents/', sec: 'automatizacion' },
  { pre: '/api/crm/email', sec: 'automatizacion' },
  { pre: '/api/crm/outbound', sec: 'automatizacion' },
  // Colaboradores
  { pre: '/api/partners/', sec: 'colaboradores' },
  { pre: '/api/crm/comisiones', sec: 'colaboradores' },
  // Configuración (lo demás cae aquí por omisión)
  { pre: '/api/crm/usuarios', sec: 'config' },
  { pre: '/api/crm/propiedades', sec: 'config' },
  { pre: '/api/crm/pipelines', sec: 'config' },
];

// El propio perfil se edita siempre: es de uno mismo, no una sección del
// sistema. Sin esta salida, alguien sin permiso de Configuración no podría
// cambiarse ni la foto.
const SIN_SECCION = new Set([
  '/api/crm/perfil', '/api/auth/yo', '/api/revenue/upload-logo',
  // La marca de los documentos es de cada persona, no del sistema: quien no
  // administra la configuración igual tiene que poder poner su logo.
  '/api/crm/marca',
]);

// Definir un campo o una etapa es configurar; LEERLOS es usar el CRM. La ficha
// del cliente y el tablero de oportunidades piden estas rutas para saber qué
// columnas pintar: si se gatean como Configuración, quien solo opera cuentas ve
// la pantalla vacía. Se gatea la escritura, no la lectura.
const LECTURA_LIBRE = new Set(['/api/crm/propiedades', '/api/crm/pipelines']);

function seccionDe(path: string): Seccion | null {
  if (SIN_SECCION.has(path)) return null;
  for (const r of SECCION_POR_RUTA) if (path.startsWith(r.pre)) return r.sec;
  return 'config';
}

const forbidden = (msg: string) =>
  new Response(JSON.stringify({ error: msg }), { status: 403, headers: { 'Content-Type': 'application/json' } });

function needsSession(path: string): boolean {
  return SESSION_PREFIXES.some(p => path.startsWith(p)) || SESSION_EXACT.has(path);
}

// ── CSRF propio (sustituye a `security.checkOrigin` de Astro) ─────────────
// Astro rechazaba todo POST con cuerpo de formulario sin `Origin` del mismo
// sitio. Correcto para un formulario del navegador, fatal para un webhook
// servidor-a-servidor: SendGrid manda multipart/form-data SIN `Origin`, así
// que la bandeja de respuestas devolvía 403 en silencio.
//
// Aquí se conserva la protección con la misma regla, pero con salida para las
// rutas que EXISTEN para recibir de fuera. Esas no quedan desprotegidas: cada
// una valida lo suyo (firma del proveedor o token HMAC), que es más fuerte que
// mirar una cabecera.
const CT_FORMULARIO = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
const WEBHOOKS_PUBLICOS = new Set([
  '/api/email/inbound',            // SendGrid Inbound Parse (multipart, sin Origin)
  '/api/email/sendgrid-webhook',   // eventos de entrega (firma Ed25519)
  '/api/email/baja-one-click',     // RFC 8058: lo llama el proveedor de correo
]);

function csrfSospechoso(request: Request, url: URL): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return false;
  if (WEBHOOKS_PUBLICOS.has(url.pathname)) return false;
  const ct = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!CT_FORMULARIO.includes(ct)) return false;   // JSON nunca fue el vector
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host !== url.host; } catch { return true; }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  if (csrfSospechoso(context.request, context.url)) {
    return new Response('Cross-site form submission forbidden', { status: 403 });
  }
  const admin = needsAdmin(path);
  const session = needsSession(path);
  if (!admin && !session) return next();

  const user = await getSessionFromRequest(context.request);
  if (!user) return forbidden('No autenticado. Inicia sesión en /admin/login.');
  // Rutas admin: rechazan a partners. Rutas de sesión (portal): cualquier rol
  // autenticado pasa (el endpoint ya scopea por user.id de la sesión).
  if (admin && user.role === 'partner') return forbidden('No autorizado (solo administradores).');

  // Permiso por sección. Solo sobre rutas admin: el portal del partner ya se
  // scopea por su propio id.
  if (admin) {
    const sec = seccionDe(path);
    if (sec) {
      const escribe = !['GET', 'HEAD', 'OPTIONS'].includes(context.request.method);
      // La lectura de catálogos pasa antes que nada: sin ella, quien opera
      // cuentas no puede ni pintar las columnas de su tablero.
      if (!escribe && LECTURA_LIBRE.has(path)) return next();
      const permisos = permisosDe({ rol: user.role, permisos: user.permisos });
      const nivel = permisos[sec];
      if (nivel === 'no') return forbidden('Tu usuario no tiene acceso a esta sección.');
      if (escribe && nivel !== 'edit') return forbidden('Tu usuario puede ver esta sección, pero no modificarla.');
    }
  }
  return next();
});
