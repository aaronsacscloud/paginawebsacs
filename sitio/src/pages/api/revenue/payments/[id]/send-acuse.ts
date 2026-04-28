import type { APIRoute } from 'astro';
import { sendAcuseEmail } from '../../../../../lib/payments/send-acuse';

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing payment id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const result = await sendAcuseEmail(id);
  const status = result.ok ? 200 : 400;
  return new Response(JSON.stringify(result), { status, headers: { 'Content-Type': 'application/json' } });
};
