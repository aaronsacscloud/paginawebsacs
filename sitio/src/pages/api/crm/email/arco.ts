// GET  /api/crm/email/arco?email=…            — TODO lo que tenemos de una persona
// POST /api/crm/email/arco {email, accion}    — oposicion | cancelacion
//
// La LFPDPPP promete acceso, rectificación, cancelación y oposición. El aviso
// de privacidad ya describía el procedimiento, pero cumplirlo era un rato de
// alguien buscando a mano en seis tablas — y lo que se hace a mano se hace mal
// y tarde. Aquí se responde en una consulta.
//
// La diferencia que importa:
//   OPOSICIÓN  deja de tratar sus datos para marketing. Se queda el registro
//              de la baja: sin él volveríamos a escribirle mañana.
//   CANCELACIÓN borra el rastro de comportamiento. NO borra lo que la ley
//              obliga a conservar —facturación, contratos— ni la supresión.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { darDeBaja } from '../../../../lib/email/bajas';
import { detenerRecorridos } from '../../../../lib/email/detener';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

async function contactoDe(email: string) {
  const { data } = await supabase.from('contacts')
    .select('id, nombre, email, whatsapp, fuente, utm_source, utm_campaign, created_at, intencion, visitor_id, propiedades')
    .eq('email', email).limit(1).maybeSingle();
  return data;
}

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return json({ error: 'Falta el correo.' }, 400);

  const c = await contactoDe(email);
  if (!c) return json({ email, encontrado: false, nota: 'No tenemos datos personales asociados a este correo.' });

  const [visitas, correos, actividades, supresion, recorridos] = await Promise.all([
    supabase.from('contact_visits').select('ruta, origen, segundos, created_at')
      .eq('contact_id', c.id).order('created_at', { ascending: false }).limit(1000),
    supabase.from('email_sends').select('asunto, estado, created_at, opened_at, clicked_at')
      .eq('contact_id', c.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('activities').select('tipo, titulo, created_at')
      .eq('contact_id', c.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('email_suppressions').select('motivo, origen, created_at').eq('email', email).limit(20),
    supabase.from('automation_enrollments').select('estado, enrolled_at, unenrollment_reason, automations(nombre)')
      .eq('contact_id', c.id).limit(100),
  ]);

  return json({
    email, encontrado: true, generado_at: new Date().toISOString(),
    persona: c,
    navegacion: visitas.data || [],
    correos_recibidos: correos.data || [],
    actividades: actividades.data || [],
    recorridos_automaticos: recorridos.data || [],
    baja: supresion.data || [],
    explicacion: {
      navegacion: 'Páginas que visitó en nuestro sitio, con cuánto tiempo estuvo y de dónde llegó. Se vinculan a su persona desde el momento en que nos dejó su correo, incluidas las visitas anteriores a ese momento.',
      intencion: 'Puntaje calculado con esas señales; se usa para priorizar a quién contacta nuestro equipo.',
      recorridos_automaticos: 'Secuencias de correo en las que entró de forma automática y por qué salió de ellas.',
    },
  });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  const email = String(body?.email || '').trim().toLowerCase();
  const accion = String(body?.accion || '');
  if (!email) return json({ error: 'Falta el correo.' }, 400);
  if (!['oposicion', 'cancelacion'].includes(accion)) return json({ error: 'Acción desconocida.' }, 400);

  const c = await contactoDe(email);
  const hecho: string[] = [];

  // Oposición y cancelación empiezan igual: dejar de escribirle YA.
  await darDeBaja({ tenantId: t.id, email, contactId: c?.id || null, origen: 'arco:' + accion });
  hecho.push('Se le dejó de enviar correo de marketing');
  if (c?.id) {
    const n = await detenerRecorridos(c.id, 'baja', { soloSiParar: false, tenantId: t.id });
    if (n) hecho.push(`${n} recorrido(s) automático(s) detenidos`);
  }

  if (accion === 'cancelacion' && c?.id) {
    const { data: borradas } = await supabase.from('contact_visits').delete().eq('contact_id', c.id).select('id');
    hecho.push(`${(borradas || []).length} registros de navegación eliminados`);
    await supabase.from('contacts').update({
      intencion: 0, intencion_at: null, visitor_id: null,
      pages_visited: null, page_count: 0, total_time_on_site: 0,
    }).eq('id', c.id);
    hecho.push('Puntaje de interés e identificador de navegación eliminados');
    await supabase.from('activities').delete().eq('contact_id', c.id).in('tipo', ['page_visit', 'email_open', 'email_click']);
    hecho.push('Actividades de seguimiento eliminadas');
  }

  // La supresión SOBREVIVE a la cancelación a propósito: es el único registro
  // que impide volver a escribirle mañana. Borrarla sería cumplir el trámite
  // y romper el derecho.
  return json({
    ok: true, email, accion, hecho,
    conservado: accion === 'cancelacion'
      ? 'Se conserva el registro de su baja (para no volver a contactarle) y la información fiscal o contractual que la ley obliga a resguardar.'
      : 'Se conserva su ficha; solo se detuvo el tratamiento con fines de marketing.',
  });
};
