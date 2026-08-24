// LEADS · Borrar un lead y todo lo suyo.
//   POST { contact_id, ensayo?: true, confirmar?: string }
//     · ensayo (default true) → NO borra: devuelve el inventario exacto.
//     · confirmar → obligatorio SOLO si el lead trae dinero de por medio.
//
// Es DESTRUCTIVO e irreversible, igual que el borrado de un cliente. No es un
// archivado: para eso ya está unir fichas, que archiva la duplicada apuntando a
// la que se quedó. Aquí se borra porque lo que se quiere borrar son los leads de
// prueba, y un lead de prueba archivado sigue apareciendo en cualquier consulta
// que alguien escriba mañana sin acordarse del filtro.
//
// El candado NO es un modal de "¿estás seguro?" para todos por igual: un lead
// de prueba sin nada detrás no merece que le escribas el nombre, y uno con una
// cotización de $47,900 no merece un solo clic. El peso lo decide el inventario.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/* Lo que cuelga de un contacto por FK NO ACTION: la base no lo borra sola, así
 * que hay que quitarlo antes o el delete falla. Las de SET NULL y CASCADE no
 * están aquí a propósito — un ticket de soporte no se borra porque se borre el
 * contacto; se queda sin dueño, que es lo correcto. */
const HIJOS: { tabla: string; col: string; label: string; pesa?: boolean }[] = [
  { tabla: 'activities', col: 'contact_id', label: 'Actividades' },
  { tabla: 'bookings', col: 'contact_id', label: 'Reuniones' },
  { tabla: 'automation_enrollments', col: 'contact_id', label: 'Inscripciones a automatizaciones' },
  { tabla: 'churn_events', col: 'contact_id', label: 'Eventos de churn' },
  { tabla: 'email_sends', col: 'contact_id', label: 'Correos enviados' },
  { tabla: 'email_unsubscribes', col: 'contact_id', label: 'Bajas de correo' },
  { tabla: 'partner_invitations', col: 'contact_id', label: 'Invitaciones de partner' },
  { tabla: 'partner_commissions', col: 'contact_id', label: 'Comisiones de partner', pesa: true },
  { tabla: 'payments', col: 'contact_id', label: 'Pagos', pesa: true },
  { tabla: 'quotes', col: 'contact_id', label: 'Cotizaciones', pesa: true },
  { tabla: 'deals', col: 'contact_id', label: 'Oportunidades', pesa: true },
];

/* Las once cuentas van EN PARALELO. En fila tardaban lo suficiente como para
 * que el modal siguiera diciendo "Revisando qué tiene…" cuando ya querías darle
 * a Eliminar: once viajes de ida y vuelta a la base, uno detrás de otro, para
 * once números que no dependen entre sí. */
async function inventario(id: string) {
  const cuentas = await Promise.all(HIJOS.map(async h => {
    const { count } = await supabase.from(h.tabla).select('id', { count: 'exact', head: true }).eq(h.col, id);
    return { label: h.label, n: count || 0, pesa: !!h.pesa };
  }));
  return cuentas.filter(x => x.n > 0);
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autorizado' }, 401);
  const b = await request.json().catch(() => ({}));
  const id = b.contact_id;
  if (!id) return json({ error: 'Falta el lead.' }, 400);

  const { data: c } = await supabase.from('contacts')
    .select('id, nombre, apellido, email, lifecycle_stage, company_id, archived_at').eq('id', id).maybeSingle();
  if (!c) return json({ error: 'Ese lead ya no existe.' }, 404);

  // Un cliente no se borra desde la lista de leads: ahí hay suscripciones,
  // pagos y facturas, y el borrado en cascada de un cliente es otra pantalla
  // con otro candado.
  if (c.lifecycle_stage === 'cliente') {
    return json({ error: 'Ya es cliente: se borra desde su ficha en Clientes, que sí borra la suscripción y los pagos.' }, 400);
  }

  const filas = await inventario(id);
  const pesa = filas.some(f => f.pesa);
  const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ').trim();

  const ensayo = b.ensayo !== false;
  if (ensayo) return json({ ok: true, ensayo: true, nombre, email: c.email, inventario: filas, pide_confirmacion: pesa });

  if (pesa) {
    const esperado = (nombre || c.email || '').trim().toLowerCase();
    if (String(b.confirmar || '').trim().toLowerCase() !== esperado) {
      return json({ error: `Este lead tiene cotizaciones o pagos. Escribe «${nombre || c.email}» para confirmar.`, pide_confirmacion: true }, 400);
    }
  }

  // Hijos primero: las FKs son NO ACTION y el delete del contacto fallaría.
  // Las cotizaciones tienen a su vez hijos en CASCADE (cobros programados,
  // gestiones de cobranza), así que la base los limpia sola al caer la
  // cotización — por eso `quotes` va antes que `contacts` y no hace falta más.
  for (const h of HIJOS) {
    const { error } = await supabase.from(h.tabla).delete().eq(h.col, id);
    if (error) return json({ error: `No se pudo limpiar ${h.label.toLowerCase()}: ${error.message}` }, 500);
  }
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, borrado: nombre || c.email, inventario: filas });
};
