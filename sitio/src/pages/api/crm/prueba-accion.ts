/**
 * POST /api/crm/prueba-accion — mover una prueba gratis que ya existe.
 *
 *   { contact_id, accion: 'extender'|'terminar'|'cancelar'|'reactivar'|'convertir', dias? }
 *
 * Vive aparte de `/api/crm/sacs-prueba` porque son dos cosas distintas: aquel
 * CREA una cuenta en SACS (efecto irreversible en otro sistema), este mueve el
 * estado de una que ya existe. Meterlos juntos obligaría a que la pantalla que
 * solo quiere extender tres días cargue con el permiso de crear cuentas.
 *
 * Todo pasa por `lib/crm/prueba.ts`: las cinco acciones dejan actividad en la
 * ficha —que es la misma que pinta el inbox— y las que tocan la cuenta de SACS
 * lo hacen por el mismo camino que usa el cron.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import {
  CAMPOS_PRUEBA, extenderPrueba, terminarPrueba, reactivarPrueba, convertirPrueba, DIAS_PRUEBA,
} from '../../../lib/crm/prueba';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 403);
  const quien = (user as any).email || (user as any).id || null;

  const b = await request.json().catch(() => ({}));
  const accion = String(b.accion || '').trim();
  const contactId = String(b.contact_id || '').trim();
  if (!contactId) return json({ error: 'Falta el contacto' }, 400);

  const { data: c } = await supabase.from('contacts').select(CAMPOS_PRUEBA).eq('id', contactId).maybeSingle();
  if (!c) return json({ error: 'No encontré ese contacto' }, 404);
  if (!c.prueba_estado) return json({ error: 'Ese contacto no tiene una prueba registrada.' }, 409);

  /* Tope de 60 días igual que en el alta: una «prueba» de un año no es una
     prueba, es una cuenta gratis, y esa decisión no debería colarse por un
     campo de texto. */
  const dias = Math.max(1, Math.min(60, Number(b.dias) || DIAS_PRUEBA));

  switch (accion) {
    case 'extender':
      if (c.prueba_estado !== 'activa') return json({ error: 'Esa prueba ya no está activa. Usa «reabrir».' }, 409);
      return json({ ok: true, ...(await extenderPrueba(c, dias, quien)) });

    case 'terminar':
      if (c.prueba_estado !== 'activa') return json({ error: 'Esa prueba ya está cerrada.' }, 409);
      return json({ ok: true, ...(await terminarPrueba(c, { motivo: 'manual', quien })) });

    /* Cancelar ≠ terminar. Terminar es que se acabó el tiempo; cancelar es que
       el cliente dijo que no antes de tiempo. La cuenta se bloquea igual, pero
       el reporte de conversión necesita saber cuál fue cuál. */
    case 'cancelar':
      if (c.prueba_estado !== 'activa') return json({ error: 'Esa prueba ya está cerrada.' }, 409);
      return json({ ok: true, ...(await terminarPrueba(c, { motivo: 'cancelada', quien })) });

    case 'reactivar':
      if (c.prueba_estado === 'activa') return json({ error: 'Esa prueba sigue viva: extiéndela en vez de reabrirla.' }, 409);
      return json({ ok: true, ...(await reactivarPrueba(c, dias, quien)) });

    case 'convertir':
      return json({ ok: true, ...(await convertirPrueba(c, quien)) });

    default:
      return json({ error: 'Acción no válida.' }, 400);
  }
};
