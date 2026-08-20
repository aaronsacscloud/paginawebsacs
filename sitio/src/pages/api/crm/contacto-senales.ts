// GET /api/crm/contacto-senales?id=<contact_id>
//
// Todo lo que hizo una persona, en una sola respuesta: su puntaje de intención
// con el porqué, y la línea de tiempo unificada de las cinco fuentes.
//
// Existe para que la ficha del contacto deje de ser cinco pestañas que hay que
// cruzar a mano antes de una llamada.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { calcularIntencion, timeline } from '../../../lib/email/senales';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta el id del contacto.' }, 400);

  const { data: c } = await supabase.from('contacts')
    .select('id, nombre, apellido, email, intencion, intencion_at, intencion_motivos, lifecycle_stage')
    .eq('id', id).maybeSingle();
  if (!c) return json({ error: 'No existe ese contacto.' }, 404);

  // Se recalcula al abrir la ficha: el cron lo mantiene al día para las listas,
  // pero quien está mirando a esta persona AHORA merece el número de ahora.
  const intencion = await calcularIntencion(id);

  // El guardado va detrás de ?persistir=1 y NUNCA en el GET simple: un GET que
  // escribe se salta el gate de escritura del middleware, así que un permiso
  // de solo-lectura terminaba modificando `contacts`. El número fresco se
  // devuelve igual; lo que no se hace es persistirlo sin permiso.
  if (url.searchParams.get('persistir') === '1' && intencion.puntaje !== c.intencion) {
    await supabase.from('contacts').update({
      intencion: intencion.puntaje, intencion_at: new Date().toISOString(), intencion_motivos: intencion.motivos,
    }).eq('id', id);
  }

  return json({
    contacto: { ...c, intencion: intencion.puntaje },
    intencion,
    temperatura: intencion.puntaje >= 60 ? 'caliente' : intencion.puntaje >= 25 ? 'tibio' : 'frío',
    timeline: await timeline(id),
  });
};
