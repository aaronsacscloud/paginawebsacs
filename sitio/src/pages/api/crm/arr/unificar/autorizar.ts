// El cliente autoriza la propuesta de unificación desde su documento.
//
// No aplica nada: solo deja constancia de que dijo que sí, con nombre y fecha.
// Aplicar sigue siendo un acto del CRM —hay que cobrar— y separar las dos cosas
// es lo que permite mandar la propuesta sin miedo.
//
// POST { id, nombre }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  const nombre = String(b?.nombre || '').trim().slice(0, 120);
  if (!id) return json({ error: 'Falta la propuesta.' }, 400);
  if (!nombre) return json({ error: 'Escribe tu nombre para autorizar.' }, 400);

  const { data: prop } = await supabase.from('unificaciones').select('id, estado').eq('id', id).maybeSingle();
  if (!prop) return json({ error: 'Esa propuesta ya no existe.' }, 404);
  if (prop.estado === 'aplicada') return json({ error: 'Esta propuesta ya se aplicó.' }, 409);
  if (prop.estado === 'cancelada') return json({ error: 'Esta propuesta ya no está vigente.' }, 409);
  if (prop.estado === 'autorizada') return json({ ok: true, ya: true });

  const { error } = await supabase.from('unificaciones')
    .update({ estado: 'autorizada', autorizada_at: new Date().toISOString(), autorizada_por: nombre })
    .eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
