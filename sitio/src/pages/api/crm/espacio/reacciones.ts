// POST /api/crm/espacio/reacciones { mensaje_id, emoji }  → pone o quita (toggle)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, emitir, canalDe, puedeVerCanal, pasaRitmo, LIMITES } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

// Un emoji (con o sin modificador de tono/variante). Sin texto suelto.
const EMOJI = /^(\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*$/u;

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const emoji = String(b.emoji || '');
  if (!esUuid(b.mensaje_id) || !emoji || emoji.length > 16 || !EMOJI.test(emoji)) return json({ error: 'Reacción inválida' }, 400);
  if (!pasaRitmo(`rx:${yo.id}`, LIMITES.reacciones_por_minuto)) return json({ error: 'Muy rápido' }, 429);
  const { data: m } = await supabase.from('espacio_mensajes').select('id, canal_id, borrado_at').eq('id', b.mensaje_id).maybeSingle();
  if (!m || m.borrado_at) return json({ error: 'Mensaje no encontrado' }, 404);
  const c = await canalDe(m.canal_id);
  if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);

  const { data: ya } = await supabase.from('espacio_reacciones').select('emoji').eq('mensaje_id', m.id).eq('usuario_id', yo.id).eq('emoji', emoji).maybeSingle();
  if (ya) await supabase.from('espacio_reacciones').delete().eq('mensaje_id', m.id).eq('usuario_id', yo.id).eq('emoji', emoji);
  else {
    const { error } = await supabase.from('espacio_reacciones').insert({ mensaje_id: m.id, usuario_id: yo.id, emoji });
    if (error && !/duplicate/i.test(error.message)) return json({ error: error.message }, 500);
  }
  await emitir({ tipo: 'reaccion', canal_id: m.canal_id, id: m.id });
  return json({ ok: true, puesta: !ya });
};
