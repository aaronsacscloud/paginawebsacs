// PUT /api/crm/espacio/lecturas { canal_id, hasta?: iso }   → "leí hasta aquí"
// PUT /api/crm/espacio/lecturas { canal_id, silenciar: bool }
// PUT /api/crm/espacio/lecturas { seguir: <mensaje_raiz_id>, on: bool }   → seguir/dejar un hilo
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, canalDe, puedeVerCanal } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

export const PUT: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));

  if (b.seguir) {
    if (!esUuid(b.seguir)) return json({ error: 'Hilo inválido' }, 400);
    if (b.on === false) await supabase.from('espacio_seguimientos').delete().eq('mensaje_raiz_id', b.seguir).eq('usuario_id', yo.id);
    else await supabase.from('espacio_seguimientos').upsert({ mensaje_raiz_id: b.seguir, usuario_id: yo.id }, { onConflict: 'mensaje_raiz_id,usuario_id' });
    return json({ ok: true });
  }

  const c = await canalDe(b.canal_id);
  if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);
  const row: any = { canal_id: c.id, usuario_id: yo.id };
  if (typeof b.silenciar === 'boolean') row.silenciado = b.silenciar;
  else {
    const hasta = b.hasta && !isNaN(Date.parse(b.hasta)) ? new Date(b.hasta) : new Date();
    row.ultimo_leido_at = hasta.toISOString();
    // Nunca retroceder la marca: dos pestañas abiertas no deben "des-leer".
    const { data: prev } = await supabase.from('espacio_lecturas').select('ultimo_leido_at').eq('canal_id', c.id).eq('usuario_id', yo.id).maybeSingle();
    if (prev && new Date(prev.ultimo_leido_at) > hasta) return json({ ok: true, sin_cambio: true });
    // La primera lectura de un canal de Sistema crea su renglón: nace silenciado.
    if (!prev && c.tipo === 'sistema') row.silenciado = true;
    // Los avisos de este canal ya no hacen falta en la campana.
    await supabase.from('crm_notificaciones').update({ leida_at: new Date().toISOString() })
      .eq('para', yo.id).is('leida_at', null).eq('metadata->>canal_id', c.id).lte('created_at', hasta.toISOString());
  }
  const { error } = await supabase.from('espacio_lecturas').upsert(row, { onConflict: 'canal_id,usuario_id' });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
