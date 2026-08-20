// POST /api/automations/activate — activar un embudo.
//
// ⚠️ ESTE ARCHIVO SE REESCRIBIÓ POR UNA RAZÓN GRAVE.
//
// La versión anterior, al activar, barría `contacts` COMPLETO sin filtro de
// fecha e inscribía a todos con `next_action_at = ahora`. Mientras nadie
// procesaba las inscripciones eso era inocuo — pero desde que existe el
// runner (`lib/email/embudos.ts` + `/api/cron/email-embudos`), activar un
// embudo habría mandado un correo de bienvenida a los ~280 contactos que
// llevan años en el CRM, cinco minutos después del clic. Sin deshacer.
//
// Ahora delega en `embudos.activar()`, que estampa `activado_at`/`cursor_at`
// y garantiza el ARRANQUE LIMPIO: solo entra quien califique DESPUÉS de
// activar. La inscripción la hace el cron, no este endpoint.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { activar, pausar } from '../../../lib/email/embudos';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const { automation_id, estado } = body;
  if (!automation_id) return json({ error: 'automation_id is required' }, 400);

  const { data: automation } = await supabase
    .from('automations').select('id, nombre, estado').eq('id', automation_id).maybeSingle();
  if (!automation) return json({ error: 'Automation not found' }, 404);

  // Pausar / archivar: no tocan a quien ya va en camino, solo dejan de avanzar.
  if (estado && estado !== 'activo') {
    await pausar(automation_id);
    await supabase.from('automations').update({ estado }).eq('id', automation_id);
    return json({ ok: true, estado });
  }

  const r = await activar(automation_id);
  if (!r.ok) return json({ error: r.error }, 400);

  const { data: actualizado } = await supabase
    .from('automations').select('*').eq('id', automation_id).maybeSingle();

  return json({
    ok: true,
    automation: actualizado,
    inscritos: 0,
    // El mensaje es parte del arreglo: quien activa tiene que saber que NO se
    // le va a escribir a la cartera histórica.
    mensaje: 'Activado. Solo entrarán los contactos que califiquen a partir de ahora — a los que ya estaban en el CRM no se les enviará nada.',
  });
};
