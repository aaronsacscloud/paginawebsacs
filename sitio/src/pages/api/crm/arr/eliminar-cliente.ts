// POST /api/crm/arr/eliminar-cliente — BORRADO EN CASCADA de un cliente.
//
// Elimina la empresa y TODO lo que representa su relación con nosotros:
// contactos, suscripciones, pagos, facturas, cotizaciones, oportunidades,
// reuniones, actividades, notas, comisiones, señales, movimientos MRR, etc.
// Es DESTRUCTIVO e IRREVERSIBLE — no hay soft-delete aquí (para "sacarlo de la
// lista sin perder el histórico" existe `eliminar-duplicado`, que archiva).
//
// Body: { company_id, dry_run?: true, confirmar?: string }
//   · dry_run: true  → NO borra; devuelve el inventario exacto de filas que caerían.
//   · confirmar      → obligatorio para borrar de verdad: debe coincidir con el
//                      nombre de la empresa o su cuenta SACS (evita el clic accidental).
//
// NO toca la cuenta de SACS (Mongo): el cliente sigue operando su sistema; esto
// solo borra el CRM. Y NO registra churn_event (borrar ≠ cancelar), para no
// ensuciar las métricas de retención con un registro que dejó de existir.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getSessionFromRequest } from '../../../../lib/auth/session';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

/* ── Orden de borrado: hijos primero (las FKs son NO ACTION, no CASCADE) ──
 * `keys` son las columnas por las que esa tabla cuelga del cliente; se combinan
 * con OR, así una fila ligada por dos vías se cuenta y se borra una sola vez. */
type Paso = { tabla: string; label: string; keys: string[] };
const PASOS: Paso[] = [
  { tabla: 'activities',             label: 'Actividades / timeline',   keys: ['company_id', 'contact_id', 'deal_id', 'quote_id'] },
  { tabla: 'agent_runs',             label: 'Ejecuciones de agentes IA', keys: ['company_id', 'contact_id', 'deal_id'] },
  { tabla: 'bookings',               label: 'Reuniones agendadas',      keys: ['contact_id', 'deal_id'] },
  { tabla: 'partner_commissions',    label: 'Comisiones de partner',    keys: ['contact_id', 'deal_id'] },
  { tabla: 'subscription_addons',    label: 'Add-ons de suscripción',   keys: ['company_id', 'subscription_id'] },
  { tabla: 'discounts',              label: 'Descuentos',               keys: ['company_id', 'subscription_id'] },
  { tabla: 'mrr_movements',          label: 'Movimientos de MRR',       keys: ['company_id', 'subscription_id'] },
  { tabla: 'churn_events',           label: 'Eventos de churn',         keys: ['company_id', 'contact_id', 'subscription_id'] },
  { tabla: 'invoices',               label: 'Facturas',                 keys: ['company_id', 'contact_id', 'quote_id'] },
  { tabla: 'payments',               label: 'Pagos registrados',        keys: ['company_id', 'contact_id', 'subscription_id', 'quote_id'] },
  { tabla: 'expansion_signals',      label: 'Señales de expansión',     keys: ['company_id', 'contact_id'] },
  { tabla: 'product_events',         label: 'Eventos de producto',      keys: ['company_id', 'contact_id'] },
  { tabla: 'automation_enrollments', label: 'Inscripciones a automatizaciones', keys: ['contact_id'] },
  { tabla: 'email_sends',            label: 'Correos enviados',         keys: ['contact_id'] },
  { tabla: 'email_unsubscribes',     label: 'Bajas de correo',          keys: ['contact_id'] },
  { tabla: 'client_board_nodes',     label: 'Notas y archivos',         keys: ['company_id'] },
  { tabla: 'uso_snapshots',          label: 'Snapshots de uso',         keys: ['company_id'] },
  { tabla: 'subscriptions',          label: 'Suscripciones',            keys: ['company_id', 'contact_id'] },
  { tabla: 'quotes',                 label: 'Cotizaciones',             keys: ['company_id', 'contact_id', 'deal_id'] },
  { tabla: 'deals',                  label: 'Oportunidades',            keys: ['company_id', 'contact_id'] },
  // `id` = los contactos sueltos (sin empresa) que solo colgaban de este cliente;
  // se resuelven en recolectar() y no dejan huérfanos al borrar.
  { tabla: 'contacts',               label: 'Contactos',                keys: ['company_id', 'id'] },
];

// Filtro PostgREST `or=(...)` a partir de las llaves que sí tienen valores.
function orFiltro(keys: string[], ids: Record<string, string[]>): string | null {
  const terms = keys
    .map(k => ({ k, v: ids[k] || [] }))
    .filter(x => x.v.length > 0)
    .map(x => x.v.length === 1 ? `${x.k}.eq.${x.v[0]}` : `${x.k}.in.(${x.v.join(',')})`);
  return terms.length ? terms.join(',') : null;
}

// Tabla/columna inexistente (esquema viejo) → se ignora, no rompe el borrado.
const ausente = (m: string) => /does not exist|schema cache|relation .* not found|column/i.test(m || '');

async function contar(tabla: string, filtro: string): Promise<number | null> {
  const { count, error } = await supabase.from(tabla).select('id', { count: 'exact', head: true }).or(filtro);
  if (error) return ausente(error.message) ? null : null;
  return count || 0;
}

async function borrar(tabla: string, filtro: string): Promise<{ n: number; error?: string }> {
  const { data, error } = await supabase.from(tabla).delete().or(filtro).select('id');
  if (error) return ausente(error.message) ? { n: 0 } : { n: 0, error: error.message };
  return { n: (data || []).length };
}

/* Reúne los ids de todo lo que cuelga del cliente. Los contactos se limitan a
 * los de ESTA empresa (o sueltos ligados a sus subs/deals/cotizaciones) para que
 * un contacto compartido con otra empresa nunca se vaya de rebote. */
async function recolectar(companyId: string) {
  const { data: cts } = await supabase.from('contacts').select('id').eq('company_id', companyId);
  const contactIds = new Set<string>((cts || []).map((c: any) => c.id));

  // Contactos "sueltos" (sin empresa) referenciados por filas de esta empresa.
  const sueltos = new Set<string>();
  for (const t of ['subscriptions', 'deals', 'quotes', 'payments']) {
    const { data } = await supabase.from(t).select('contact_id').eq('company_id', companyId).not('contact_id', 'is', null);
    for (const r of data || []) if (r.contact_id && !contactIds.has(r.contact_id)) sueltos.add(r.contact_id);
  }
  if (sueltos.size) {
    const { data } = await supabase.from('contacts').select('id, company_id').in('id', [...sueltos]);
    for (const c of data || []) if (!c.company_id || c.company_id === companyId) contactIds.add(c.id);
  }
  const contacts = [...contactIds];

  const orCo = (extra?: string) => [`company_id.eq.${companyId}`, ...(extra ? [extra] : [])].join(',');
  const porContacto = contacts.length ? `contact_id.in.(${contacts.join(',')})` : '';

  const { data: subs } = await supabase.from('subscriptions').select('id').or(orCo(porContacto));
  const { data: deals } = await supabase.from('deals').select('id').or(orCo(porContacto));
  const dealIds = (deals || []).map((d: any) => d.id);

  const orQ = [orCo(porContacto), ...(dealIds.length ? [`deal_id.in.(${dealIds.join(',')})`] : [])].filter(Boolean).join(',');
  const { data: quotes } = await supabase.from('quotes').select('id').or(orQ);

  return {
    company_id: [companyId],
    id: contacts,               // solo lo usa el paso `contacts`
    contact_id: contacts,
    subscription_id: (subs || []).map((s: any) => s.id),
    deal_id: dealIds,
    quote_id: (quotes || []).map((q: any) => q.id),
  } as Record<string, string[]>;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionFromRequest(request);
  if (!user || user.role === 'partner') return json({ error: 'No autorizado.' }, 403);

  const body = await request.json().catch(() => ({} as any));
  const companyId: string = body?.company_id;
  const dry = !!body?.dry_run;
  if (!companyId) return json({ error: 'company_id requerido' }, 400);

  try {
    const { data: co } = await supabase.from('companies').select('id, nombre, sacs_account').eq('id', companyId).maybeSingle();
    if (!co) return json({ error: 'Cliente no encontrado (¿ya se eliminó?)' }, 404);

    const etiqueta = co.sacs_account || co.nombre || '';
    if (!dry) {
      const esperado = String(body?.confirmar || '').trim().toLowerCase();
      const validos = [co.nombre, co.sacs_account].filter(Boolean).map((s: string) => s.trim().toLowerCase());
      if (!esperado || !validos.includes(esperado)) {
        return json({ error: `Confirmación incorrecta: escribe exactamente "${etiqueta}" para eliminar.` }, 400);
      }
    }

    const ids = await recolectar(companyId);

    // ── Modo inventario: qué caería, sin tocar nada ──
    if (dry) {
      const detalle: any[] = [];
      for (const p of PASOS) {
        const f = orFiltro(p.keys, ids);
        if (!f) continue;
        const n = await contar(p.tabla, f);
        if (n) detalle.push({ tabla: p.tabla, label: p.label, n });
      }
      return json({ ok: true, dry: true, empresa: co.nombre, etiqueta, detalle, total: detalle.reduce((a, d) => a + d.n, 0) });
    }

    // ── Borrado real ──
    // 1) Referencias que NO se borran, solo se desligan: la invitación de partner
    //    y el regalo son del programa de partners, no del cliente.
    if (ids.contact_id.length) {
      try { await supabase.from('partner_invitations').update({ contact_id: null }).in('contact_id', ids.contact_id); } catch { /* opcional */ }
      try { await supabase.from('gifts').update({ redeemed_by_contact: null }).in('redeemed_by_contact', ids.contact_id); } catch { /* opcional */ }
    }
    // 2) deals ⇄ quotes se referencian mutuamente: hay que romper el ciclo antes
    //    de borrar cualquiera de los dos (si no, la FK bloquea el DELETE).
    if (ids.quote_id.length) { try { await supabase.from('deals').update({ quote_id: null }).in('quote_id', ids.quote_id); } catch { /* noop */ } }
    if (ids.deal_id.length) { try { await supabase.from('quotes').update({ deal_id: null }).in('deal_id', ids.deal_id); } catch { /* noop */ } }

    const borrado: any[] = [];
    const errores: any[] = [];
    for (const p of PASOS) {
      const f = orFiltro(p.keys, ids);
      if (!f) continue;
      const r = await borrar(p.tabla, f);
      if (r.error) errores.push({ tabla: p.tabla, error: r.error });
      else if (r.n) borrado.push({ tabla: p.tabla, label: p.label, n: r.n });
    }
    if (errores.length) {
      return json({ error: 'No se pudo completar el borrado: ' + errores.map(e => `${e.tabla} (${e.error})`).join('; '), parcial: borrado }, 500);
    }

    const { error: eCo } = await supabase.from('companies').delete().eq('id', companyId);
    if (eCo) return json({ error: 'Quedó todo borrado menos la empresa: ' + eCo.message, parcial: borrado }, 500);
    borrado.push({ tabla: 'companies', label: 'Cliente', n: 1 });

    console.log(`[crm] cliente eliminado en cascada: ${etiqueta} (${companyId}) por ${user.email || user.id} — ${borrado.reduce((a, b) => a + b.n, 0)} filas`);
    return json({ ok: true, empresa: co.nombre, etiqueta, borrado, total: borrado.reduce((a, b) => a + b.n, 0) });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
