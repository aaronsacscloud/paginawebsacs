// PUT /api/crm/espacio/presencia { estado?: activo|ausente|fuera, dispositivo?: 'movil'|'escritorio' }
//
// Latido cada 60 s mientras la pestaña está viva; `fuera` al cerrarla
// (sendBeacon). Lo que se lee en el árbol es esto; el Presence de Realtime,
// cuando está, solo lo hace instantáneo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, emitir } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

export const PUT: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const estado = ['activo', 'ausente', 'fuera'].includes(b.estado) ? b.estado : 'activo';
  const { data: prev } = await supabase.from('espacio_presencia').select('estado').eq('usuario_id', yo.id).maybeSingle();
  const { error } = await supabase.from('espacio_presencia').upsert({
    usuario_id: yo.id, visto_at: new Date().toISOString(), estado,
    dispositivo: b.dispositivo === 'movil' ? 'movil' : 'escritorio',
  }, { onConflict: 'usuario_id' });
  if (error) return json({ error: error.message }, 500);
  if (prev?.estado !== estado) await emitir({ tipo: 'presencia' });
  return json({ ok: true });
};

// sendBeacon manda POST; se acepta igual.
export const POST = PUT;
