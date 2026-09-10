// TELEFONÍA · Generar (o rehacer) el PDF de la minuta de una llamada y decidir
// su entrega. POST { call_id }.
//
// Normalmente esto corre solo, en cuanto Claude termina de redactar la minuta.
// Este endpoint es la puerta manual para los dos casos en que hace falta:
// una llamada vieja que quedó sin documento, y un envío que falló y se quiere
// reintentar sin esperar a nada.
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { generarYEntregarMinuta } from '../../../../lib/minuta/entrega';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const b = await request.json().catch(() => ({}));
  const callId = String(b.call_id || '').trim();
  if (!/^CA[0-9a-f]{32}$/i.test(callId)) return json({ error: 'call_id inválido' }, 400);

  const r = await generarYEntregarMinuta(callId);
  return json(r);
};
