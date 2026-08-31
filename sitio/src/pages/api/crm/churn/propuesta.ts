// CHURN · la propuesta de rescate.
//
// NO es un motor de documentos nuevo: es una COTIZACIÓN con forma de rescate.
// El sistema de cotizaciones ya hace las cinco cosas que hacen falta y está
// vivo (51 documentos, 17 aceptadas con firma, 5 con aperturas del cliente):
// PDF, link público, conteo de vistas que ignora al equipo, aceptación
// firmada y cron de recordatorios. Un segundo motor daría dos PDFs, dos
// rastreos y dos verdades sobre si el cliente ya lo vio.
//
// Lo que sí es distinto: una cotización dice «esto cuesta». Una propuesta de
// rescate dice «esto no te cuesta POR AHORA, esto nos comprometemos a hacer,
// y a partir de esta fecha vuelves a pagar esto».
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { anotar } from '../../../../lib/crm/churn.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/* El catálogo de compromisos. Sale de lo que MIDIÓ el módulo: el 65% del MRR
   perdido se fue por servicio y cero por precio, así que esto —y no el
   descuento— es lo que de verdad rescata. Se puede escribir uno libre. */
export const COMPROMISOS = [
  'Consultoría de arranque con un consultor asignado',
  'Acompañamiento semanal el primer mes',
  'Migración de tu catálogo, la hacemos nosotros',
  'Capacitación al equipo en sucursal',
  'Un canal directo de soporte, sin fila',
  'Revisión de tu operación y plan de mejora',
];

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const caso = url.searchParams.get('caso');
  if (!caso) return json({ error: 'Falta el caso.' }, 400);
  const { data } = await supabase.from('quotes')
    .select('id, numero, estado, total, vigencia, created_at, vistas, primera_vista_at, ultima_vista_at, aceptado_por, aceptado_fecha, rechazado_fecha, rescate_desde, rescate_hasta, rescate_mrr_regreso, rescate_compromisos, rescate_esperamos')
    .eq('churn_caso_id', caso).order('created_at', { ascending: false });
  return json({ data: data || [], compromisos: COMPROMISOS });
};

/**
 * El folio de las propuestas va aparte de las cotizaciones (RES-, no COT-):
 * son documentos distintos, se cuentan distinto, y compartir la serie haría
 * que «llevamos 60 cotizaciones» incluyera rescates que no vendieron nada.
 * Mismo patrón de reintento que el folio de cotizaciones: dos personas
 * creando a la vez no pueden quedarse con el mismo número.
 */
async function siguienteFolio(): Promise<string> {
  const { data } = await supabase.from('quotes').select('numero').eq('tipo', 'rescate');
  let max = 0;
  for (const r of data || []) {
    const m = String(r?.numero || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `RES-${String(max + 1).padStart(3, '0')}`;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));

  const { data: caso } = await supabase.from('churn_casos')
    .select('*, companies(id, nombre, nombre_comercial)').eq('id', b.caso_id).single();
  if (!caso) return json({ error: 'No existe ese caso.' }, 404);
  if (['estable', 'irrecuperable'].includes(caso.etapa)) {
    return json({ error: 'Ese caso está cerrado: no se le manda una propuesta.' }, 400);
  }

  const meses = Number(b.meses || 0);
  const hasta = b.rescate_hasta || (meses > 0
    ? new Date(Date.now() + meses * 30 * 86400000).toISOString().slice(0, 10) : null);
  if (!hasta) return json({ error: 'Dile hasta cuándo va el período sin costo.', campo: 'rescate_hasta' }, 400);
  if (String(hasta) <= new Date().toISOString().slice(0, 10)) {
    return json({ error: 'La fecha de fin tiene que ser futura.', campo: 'rescate_hasta' }, 400);
  }
  const vuelve = Number(b.rescate_mrr_regreso);
  if (!Number.isFinite(vuelve) || vuelve <= 0) {
    return json({ error: 'Di a cuánto vuelve a pagar al terminar (más de cero). Sin eso, acepta sin saber a qué vuelve.', campo: 'rescate_mrr_regreso' }, 400);
  }
  const compromisos: string[] = Array.isArray(b.rescate_compromisos) ? b.rescate_compromisos.filter(Boolean) : [];
  /* Sin compromisos, esto es un descuento disfrazado — y a esta gente el
     descuento no la rescata: se fueron por servicio. */
  if (!compromisos.length) return json({ error: 'Elige al menos una cosa a la que nos comprometemos: sin eso, la propuesta es solo un descuento.', campo: 'rescate_compromisos' }, 400);

  const desde = b.rescate_desde || new Date().toISOString().slice(0, 10);
  const emp = caso.companies || {};

  // La propuesta anterior queda REEMPLAZADA, no borrada: el historial tiene
  // que poder decir qué se le ofreció antes y por qué no bastó.
  await supabase.from('quotes').update({ estado: 'expired' })
    .eq('churn_caso_id', caso.id).in('estado', ['draft', 'sent']);

  const { data: q, error } = await supabase.from('quotes').insert({
    tipo: 'rescate',
    numero: await siguienteFolio(),
    churn_caso_id: caso.id,
    company_id: caso.company_id,
    contact_id: b.contact_id || null,
    empresa: emp.nombre_comercial || emp.nombre || '',
    contacto: b.contacto || '',
    email: b.email || '',
    whatsapp: b.whatsapp || '',
    plan: b.plan || 'Rescate',
    estado: 'draft',
    // El total es CERO durante el período: es el punto de la propuesta.
    total: 0, subtotal: 0, precio_unitario: 0, descuento_pct: 100,
    moneda: 'MXN',
    vigencia: b.vigencia || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    rescate_desde: desde,
    rescate_hasta: hasta,
    rescate_mrr_regreso: vuelve,
    rescate_compromisos: compromisos,
    rescate_esperamos: String(b.rescate_esperamos || '').trim() || null,
    condiciones: String(b.condiciones || '').trim() || null,
    created_via: 'churn',
  }).select('id, numero').single();
  if (error) return json({ error: error.message }, 500);

  await supabase.from('churn_casos').update({ propuesta_id: q.id, updated_at: new Date().toISOString() }).eq('id', caso.id);
  await anotar(caso, 'nota', 'Propuesta de rescate creada',
    `Sin costo hasta ${hasta} · vuelve a $${vuelve.toLocaleString('es-MX')} · ${compromisos.length} compromisos`, false);

  return json({ ok: true, id: q.id, numero: q.numero, url: `/cotizacion/${q.id}` });
};

/** Marcarla como enviada (el envío en sí lo hace el inbox o el correo). */
export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const { data: q } = await supabase.from('quotes').select('id, churn_caso_id, estado').eq('id', b.id).single();
  if (!q) return json({ error: 'No existe esa propuesta.' }, 404);

  if (b.accion === 'enviada') {
    if (q.estado === 'draft') await supabase.from('quotes').update({ estado: 'sent' }).eq('id', q.id);
    const { data: caso } = await supabase.from('churn_casos').select('id, company_id, etapa').eq('id', q.churn_caso_id).single();
    if (caso) {
      await anotar(caso, 'nota', 'Propuesta de rescate enviada', String(b.via || ''), false);
      /* Mandarla ES un contacto: el caso pasa a conciliación solo, igual que
         al registrar una llamada. */
      if (caso.etapa === 'detectado') {
        const { camposDeTransicion } = await import('../../../../lib/crm/churn.reglas');
        await supabase.from('churn_casos').update(camposDeTransicion('conciliacion')).eq('id', caso.id).eq('etapa', 'detectado');
      }
    }
    return json({ ok: true });
  }
  return json({ error: 'Acción desconocida.' }, 400);
};
