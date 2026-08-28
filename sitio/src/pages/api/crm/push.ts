// ══ Push del CRM: alta, baja y llave pública ═══════════════════════════════
//
// El portal de partners ya tenía push; el CRM no. Esto es lo mismo pero con
// su propia tabla (`crm_push_subscriptions`) porque quien recibe es el EQUIPO,
// no un partner, y el destino es /admin/crm.
//
//   GET  /api/crm/push            → { publicKey }  (para suscribirse)
//   POST /api/crm/push            → alta de la suscripción del navegador
//   DELETE /api/crm/push?endpoint= → baja (el usuario apagó los avisos)
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getPublicKey } from '../../../lib/push/send';

export const prerender = false;

const j = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

/** El equipo se identifica por la cookie de sesión del CRM. */
function quien(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/sacs_session=([^;]+)/);
  return m ? m[1].slice(0, 120) : null;
}

export const GET: APIRoute = async () => {
  const key = getPublicKey();
  if (!key) return j({ error: 'sin_vapid', mensaje: 'Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en el entorno' }, 503);
  return j({ publicKey: key });
};

export const POST: APIRoute = async ({ request }) => {
  const usuario = quien(request);
  if (!usuario) return j({ error: 'sin_sesion' }, 401);
  const b = await request.json().catch(() => null);

  // Prueba: manda un push real a este navegador para comprobar de una vez que
  // las llaves, el service worker y el permiso quedaron bien. Sin esto, la
  // única forma de saberlo es esperar a que entre un lead.
  if (b?.prueba) {
    const { pushAlEquipo } = await import('../../../lib/crm/push-crm');
    const r = await pushAlEquipo({
      title: 'Avisos activados',
      body: 'Así se verá cuando entre un lead nuevo.',
      url: '/admin/crm?tab=pipeline',
      tag: 'prueba',
    });
    return j({ ok: r.enviados > 0, ...r });
  }
  const endpoint = b?.subscription?.endpoint;
  const p256dh = b?.subscription?.keys?.p256dh;
  const auth = b?.subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return j({ error: 'suscripcion_incompleta' }, 400);

  const { error } = await supabase.from('crm_push_subscriptions').upsert({
    usuario, endpoint, p256dh, auth,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 200),
    fallos: 0,
  }, { onConflict: 'endpoint' });
  if (error) return j({ error: error.message }, 500);
  return j({ ok: true });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) return j({ error: 'falta_endpoint' }, 400);
  await supabase.from('crm_push_subscriptions').delete().eq('endpoint', endpoint);
  return j({ ok: true });
};
