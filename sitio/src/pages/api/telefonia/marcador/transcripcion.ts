// LLAMADAS INTELIGENTES · La transcripción en vivo de lo que dice el contacto.
// Llega fragmento por fragmento (parciales y finales); cada uno pasa por los
// oídos y, si ya se sabe quién contestó, se actúa.
import type { APIRoute } from 'astro';
import { procesarTranscripcion } from '../../../../lib/telefonia/marcador';
import { leer, json } from './_comun';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const r = await leer(request, url, 'transcripcion');
  if (r instanceof Response) return r;
  if (!r.item) return json({ ok: false }, 400);
  try { await procesarTranscripcion(r.item, r.p); } catch (e: any) { return json({ ok: false, motivo: String(e?.message || e) }); }
  return json({ ok: true });
};
