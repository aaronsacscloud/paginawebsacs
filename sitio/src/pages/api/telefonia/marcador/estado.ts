// LLAMADAS INTELIGENTES · StatusCallback de la pata del contacto
// (initiated → ringing → answered → completed/busy/no-answer/failed).
import type { APIRoute } from 'astro';
import { procesarEstado } from '../../../../lib/telefonia/marcador';
import { leer, json } from './_comun';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const r = await leer(request, url, 'estado');
  if (r instanceof Response) return r;
  if (!r.item) return json({ ok: false }, 400);
  try { await procesarEstado(r.item, r.p); } catch (e: any) { return json({ ok: false, motivo: String(e?.message || e) }); }
  return json({ ok: true });
};
