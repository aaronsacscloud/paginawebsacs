// LLAMADAS INTELIGENTES · AsyncAmdStatusCallback: la segunda opinión de
// Twilio sobre si contestó una persona o una máquina.
import type { APIRoute } from 'astro';
import { procesarAmd } from '../../../../lib/telefonia/marcador';
import { leer, json } from './_comun';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const r = await leer(request, url, 'amd');
  if (r instanceof Response) return r;
  if (!r.item) return json({ ok: false }, 400);
  try { await procesarAmd(r.item, r.p); } catch (e: any) { return json({ ok: false, motivo: String(e?.message || e) }); }
  return json({ ok: true });
};
