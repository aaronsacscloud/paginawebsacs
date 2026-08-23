// WHATSAPP · Presencia en el hilo: "Luis está viendo / escribiendo…".
// POST { conversation_id, escribiendo?: boolean } — el front lo manda cada 5 s
// mientras tiene el hilo abierto y al teclear. El hilo devuelve a los demás.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const yo = await getCurrentUser(request).catch(() => null);
  if (!yo || !b.conversation_id) return new Response('{}', { status: 200 });
  const ahora = new Date().toISOString();
  await supabase.from('wa_presencia').upsert({
    conversation_id: b.conversation_id, user_id: yo.id, nombre: (yo as any).nombre || yo.email || 'Alguien',
    visto_at: ahora, ...(b.escribiendo ? { escribiendo_at: ahora } : {}),
  }, { onConflict: 'conversation_id,user_id' });
  return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
};
