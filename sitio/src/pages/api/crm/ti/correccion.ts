// TRABAJO INTELIGENTE · «Esto hubiera contestado yo» — la lección de máxima
// prioridad del agente. Se guarda como ejemplo aprobado de ese estado; si el
// envío sigue pendiente, además se reemplaza el mensaje.
// POST { envio_id?, contact_id?, estado?, situacion?, respuesta, mensaje_lead? }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const respuesta = String(b.respuesta || '').trim();
  if (respuesta.length < 2) return json({ error: 'Escribe la respuesta que tú hubieras dado' }, 400);
  const ahora = new Date().toISOString();
  const criterio = String(b.criterio || '').trim().slice(0, 600);
  let envio: any = null;
  if (b.envio_id) {
    const { data } = await supabase.from('ti_envios').select('*').eq('id', b.envio_id).maybeSingle();
    envio = data;
  }
  const estado = b.estado || envio?.salida?.estado || 'descubriendo';
  const { data: ej, error } = await supabase.from('ia_ejemplos').insert({
    estado, situacion: b.situacion || envio?.salida?.objetivo || 'Corrección del dueño desde el panel',
    mensaje_lead: b.mensaje_lead || envio?.salida?.ultimo_mensaje || null, respuesta, pulida: respuesta,
    por_que: `${criterio ? `CRITERIO: ${criterio}\n` : ''}${envio ? `El dueño corrigió al agente. El agente había propuesto: ${envio.mensaje}` : 'El dueño escribió la respuesta ideal para este caso'}`,
    fuente: 'correccion_dueno', contact_id: b.contact_id || envio?.contact_id || null, conversation_id: envio?.conversation_id || null,
    estado_rev: 'aprobado', revisado_at: ahora,
  }).select('id').single();
  if (error) return json({ error: error.message }, 500);
  if (envio && envio.estado === 'pendiente') {
    await supabase.from('ti_envios').update({ mensaje: respuesta, mensaje_original: envio.mensaje_original || envio.mensaje, editado_por: user.id, updated_at: ahora }).eq('id', envio.id);
  }
  await supabase.from('ia_log').insert({ accion: 'correccion_dueno', contact_id: envio?.contact_id || b.contact_id || null, contenido: respuesta, detalle: { ejemplo_id: ej.id, envio_id: envio?.id || null } });
  return json({ ok: true, ejemplo_id: ej.id });
};
