// GET/POST /api/crm/email/segmentos-listos — audiencias de un clic.
//
// Cada una responde a una oportunidad de dinero concreta que hoy existe en la
// base y que nadie está trabajando porque armar el segmento a mano toma
// tiempo. No inventan datos: se apoyan en lo que el CRM ya guarda.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { resolverMiembros, type Definicion } from '../../../../lib/email/segmentos';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

interface Listo { id: string; nombre: string; para_que: string; definicion: Definicion }

export const CATALOGO: Listo[] = [
  {
    id: 'renovaciones_90',
    nombre: 'Renovaciones próximas (90 días)',
    para_que: 'El dinero más barato de defender: ya es tuyo y solo hay que no perderlo. Úsalo con el embudo de renovación.',
    definicion: { grupos: [{ condiciones: [
      { sujeto: 'suscripcion', campo: 'estado', operador: 'es', valor: 'activa' },
      { sujeto: 'suscripcion', campo: 'proxima_factura', operador: 'en_los_proximos_dias', valor: 90 },
    ] }] },
  },
  {
    id: 'pendientes_pago',
    nombre: 'Con pago pendiente',
    para_que: 'Cobranza. Mándales la secuencia de recuperación — va como correo de relación, así que no la frena el límite semanal.',
    definicion: { grupos: [{ condiciones: [
      { sujeto: 'suscripcion', campo: 'estado', operador: 'es', valor: 'pendiente_pago' },
    ] }] },
  },
  {
    id: 'expansion',
    nombre: 'Clientes que ya crecieron',
    para_que: 'Expansión: cuentas activas con varias sucursales. Venderle más a quien ya te compra es lo más barato del funnel.',
    definicion: { grupos: [{ condiciones: [
      { sujeto: 'empresa', campo: 'estado_cuenta', operador: 'es', valor: 'activo' },
      { sujeto: 'empresa', campo: 'sucursales', operador: 'mayor_que', valor: 1 },
    ] }] },
  },
  {
    id: 'cotizacion_fria',
    nombre: 'Vieron la cotización y no contestaron',
    para_que: 'Abrieron tu propuesta y se quedaron callados. Es el momento exacto de un correo, y hoy nadie lo manda.',
    // Se apoya en la SEÑAL (abrió la cotización), no en la etapa del pipeline:
    // esa hay que moverla a mano y casi nunca se mueve. Con la etapa daba 0
    // aunque hubiera gente abriendo cotizaciones cada semana.
    definicion: { grupos: [{ condiciones: [
      { sujeto: 'actividad', campo: 'cotizacion_vista', operador: 'en_los_ultimos_dias', valor: 30 },
      { sujeto: 'contacto', campo: 'lifecycle_stage', operador: 'no_es', valor: 'cliente' },
    ] }] },
  },
  {
    id: 'leads_calientes',
    nombre: 'Leads calientes (por comportamiento)',
    para_que: 'Los que están mirando precios y haciendo clic ahora mismo. Es a quien hay que llamar hoy.',
    // Por PUNTAJE, no solo por clic: el clic tarda en existir (el sistema
    // acaba de nacer) mientras que las visitas y las cotizaciones ya se están
    // registrando hoy.
    definicion: { grupos: [{ condiciones: [
      { sujeto: 'contacto', campo: 'lifecycle_stage', operador: 'no_es', valor: 'cliente' },
      { sujeto: 'actividad', campo: 'intencion', operador: 'mayor_que', valor: 40 },
    ] }] },
  },
  {
    id: 'sin_reunion',
    nombre: 'Leads sin reunión agendada',
    para_que: 'Dejaron sus datos y nunca agendaron. El embudo de bienvenida es para ellos.',
    definicion: { grupos: [{ condiciones: [
      { sujeto: 'contacto', campo: 'lifecycle_stage', operador: 'es', valor: 'lead' },
      { sujeto: 'reunion', campo: 'tiene', operador: 'no_existe' },
    ] }] },
  },
];

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);

  // Cada uno se resuelve para enseñar a cuánta gente alcanzaría HOY: un
  // segmento sugerido que dice "0 personas" no se crea, y eso ahorra ruido.
  const con = [];
  for (const s of CATALOGO) {
    let total = 0;
    try { total = (await resolverMiembros(t, s.definicion, 5000)).length; } catch { /* uno malo no tumba la lista */ }
    const { data: ya } = await supabase.from('email_segments')
      .select('id').eq('tenant_id', t.id).eq('nombre', s.nombre).is('archived_at', null).maybeSingle();
    con.push({ id: s.id, nombre: s.nombre, para_que: s.para_que, total, ya_existe: !!ya, segment_id: ya?.id || null });
  }
  return json({ segmentos: con });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  const listo = CATALOGO.find(s => s.id === body?.id);
  if (!listo) return json({ error: 'No existe ese segmento.' }, 404);

  const { data: ya } = await supabase.from('email_segments')
    .select('id').eq('tenant_id', t.id).eq('nombre', listo.nombre).is('archived_at', null).maybeSingle();
  if (ya) return json({ segmento: ya, ya_existia: true });

  const miembros = await resolverMiembros(t, listo.definicion, 20000);
  const { data, error } = await supabase.from('email_segments').insert({
    tenant_id: t.id, nombre: listo.nombre, descripcion: listo.para_que,
    definicion: listo.definicion, ultimo_conteo: miembros.length, ultimo_conteo_at: new Date().toISOString(),
  }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ segmento: data, total: miembros.length }, 201);
};
