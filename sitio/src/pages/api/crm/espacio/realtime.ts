// GET /api/crm/espacio/realtime → { url, key } o { url: null }
//
// La ÚNICA llave que llega al navegador. Solo sirve para el socket de Realtime
// (señales con ids y presencia): todas las tablas tienen RLS sin políticas
// para anon, así que con ella no se lee nada. Si la variable no está puesta,
// el panel cae a un poll de 30 s y funciona igual, solo que no al instante.
import type { APIRoute } from 'astro';
import { json, quien } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const url = (import.meta.env.SUPABASE_URL || '').trim();
  const key = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return json({ url: null, key: null, motivo: 'sin_llave' });
  return json({ url, key });
};
