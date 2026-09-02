// TRABAJO INTELIGENTE · «Silenciar IA con este lead» (y volver a activarla).
// POST { contact_id, silenciar: true|false, motivo? }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!b.contact_id) return json({ error: 'Falta contact_id' }, 400);
  const silenciar = b.silenciar !== false;
  const ahora = new Date().toISOString();
  const { error } = await supabase.from('ti_perfil').upsert({ contact_id: b.contact_id, silenciar_ia: silenciar, updated_at: ahora }, { onConflict: 'contact_id' });
  if (error) return json({ error: error.message }, 500);
  if (silenciar) {
    // Lo que iba a salir para este lead se detiene.
    await supabase.from('ti_envios').update({ estado: 'vetado', vetado_por: user.id, motivo_veto: 'IA silenciada para este lead', updated_at: ahora }).eq('contact_id', b.contact_id).eq('estado', 'pendiente');
  }
  await supabase.from('ia_log').insert({ accion: silenciar ? 'ia_silenciada' : 'ia_reactivada', contact_id: b.contact_id, razon: String(b.motivo || '').slice(0, 200) || null, detalle: { por: user.id } });
  return json({ ok: true, silenciar });
};
