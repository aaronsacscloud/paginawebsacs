// GET /api/partner-portal/push-public-key
// Devuelve la VAPID public key para que el cliente pueda crear la suscripción.

import type { APIRoute } from 'astro';
import { getPublicKey } from '../../../lib/push/send';

export const prerender = false;

export const GET: APIRoute = async () => {
  const key = getPublicKey();
  if (!key) {
    return new Response(JSON.stringify({ error: 'not_configured', message: 'VAPID keys not set in env' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ publicKey: key }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
