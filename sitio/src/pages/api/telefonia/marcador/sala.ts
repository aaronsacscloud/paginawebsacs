// LLAMADAS INTELIGENTES · Lo que pasa en la sala de conferencia: quién entra,
// quién sale, cuándo se acaba. Es cómo se sabe que el vendedor está listo
// (y cuándo se fue).
import type { APIRoute } from 'astro';
import { procesarSala } from '../../../../lib/telefonia/marcador';
import { leer, json } from './_comun';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const r = await leer(request, url, 'sala');
  if (r instanceof Response) return r;
  if (!r.sesion) return json({ ok: false }, 400);
  try { await procesarSala(r.sesion, r.p); } catch (e: any) { return json({ ok: false, motivo: String(e?.message || e) }); }
  return json({ ok: true });
};
