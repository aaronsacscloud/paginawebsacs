/**
 * El SEGUNDO paso del primer mensaje: revisar si el de marketing llegó.
 *
 * Corre cada 5 minutos; cada fila trae su propia hora de revisión (10 minutos
 * después del envío, configurable en Secuencias). No se revisa al enviar
 * porque Meta acepta el mensaje y recién después reporta que el usuario tiene
 * el marketing bloqueado: al momento del envío todavía no se sabe.
 *
 * Ver `lib/crm/primer-mensaje.ts` para el flujo completo.
 */
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { revisarPrimerosMensajes } from '../../../lib/crm/primer-mensaje';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const res = await revisarPrimerosMensajes();
    return new Response(JSON.stringify({ ok: true, ...res }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
};
