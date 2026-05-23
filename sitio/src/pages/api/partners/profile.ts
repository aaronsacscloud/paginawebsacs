// Perfil del partner autenticado · GET devuelve datos visibles + branding,
// PATCH actualiza los campos editables por el partner (hoy: logo_url).
//
// Auth: cookie sacs_session (via getCurrentUser). Partner solo puede leer/editar
// su propio perfil. Founder/CS pueden pasar ?id=<uuid> para ver/editar a otros.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { getPartnerProfile } from '../../../lib/partners/profile';

export const prerender = false;

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function resolveTargetId(user: any, url: URL): string | null {
  const requested = url.searchParams.get('id');
  if (!requested) return user.id;
  if (user.role === 'founder' || user.role === 'cs') return requested;
  if (requested === user.id) return user.id;
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const targetId = resolveTargetId(user, new URL(request.url));
  if (!targetId) return json({ error: 'No autorizado' }, 403);
  const profile = await getPartnerProfile(targetId);
  if (!profile) return json({ error: 'Perfil no encontrado' }, 404);
  return json(profile);
};

export const PATCH: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const targetId = resolveTargetId(user, new URL(request.url));
  if (!targetId) return json({ error: 'No autorizado' }, 403);

  // Whitelist de campos editables por el partner — todo lo demás se ignora silenciosamente.
  const patch: Record<string, any> = {};
  if ('logo_url' in body) {
    const v = body.logo_url;
    if (v === null || v === '') patch.logo_url = null;
    else if (typeof v === 'string' && /^https?:\/\//.test(v) && v.length < 1000) patch.logo_url = v;
    else return json({ error: 'logo_url debe ser una URL válida o vacía' }, 422);
  }
  if (!Object.keys(patch).length) return json({ error: 'Sin cambios' }, 400);

  const { error } = await supabase
    .from('team_members')
    .update(patch)
    .eq('id', targetId);
  if (error) return json({ error: error.message }, 500);

  const profile = await getPartnerProfile(targetId);
  return json(profile);
};
