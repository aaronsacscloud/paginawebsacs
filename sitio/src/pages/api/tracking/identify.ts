import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { registrarVisita, ligarVisitasPrevias } from '../../../lib/email/senales';
import { verificarSv } from '../../../lib/tracking/identidad';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { email, visitor_id: vidCuerpo, page_url, page_title, referrer, segundos, sv } = await request.json();

  // Misma cookie que lee save-lead: si el cuerpo no trae id, la cookie sí.
  const cookieVid = /(?:^|;\s*)sacs_vid=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1];
  const visitor_id = vidCuerpo || (cookieVid ? decodeURIComponent(cookieVid) : null);

  if (!email && !visitor_id) {
    return new Response(JSON.stringify({ error: 'email or visitor_id required' }), { status: 400 });
  }

  // ⚠️ ESTE ENDPOINT ES PÚBLICO Y ANÓNIMO — el sitio lo llama desde el
  // navegador de cualquiera, así que NO puede confiar en el `email` que le
  // manden. Sin este candado, un extraño podía repetir el POST con el correo
  // de un cliente y: llenarle visitas falsas, moverle "último contacto",
  // ponerlo en 100 de intención (= CALIENTE, encabezando la lista de a quién
  // llamar) y, lo peor, inscribirlo en automatizaciones con disparador de
  // visita — o sea, provocar CORREOS REALES a un cliente por orden de un
  // desconocido. Verificado contra producción antes de este cambio.
  //
  // La regla: un correo solo se acepta si el propio navegador ya lo tenía
  // (misma sesión, mismo origen). Sin esa prueba, la visita se guarda como
  // ANÓNIMA — se mide igual, pero no se le cuelga a nadie.
  // Se EXIGE la cabecera. Antes bastaba con no mandarla —`!origen` daba por
  // bueno el correo— y eso es justo lo que hace curl, Postman o cualquier
  // script: el ataque que este bloque dice cerrar seguía abierto de par en
  // par. Verificado contra producción antes del arreglo.
  //
  // Un navegador real SIEMPRE manda Origin en un POST con JSON; una petición
  // sin él no viene de nuestro sitio.
  const origen = (request.headers.get('origin') || '').replace(/\/$/, '');
  const sitio = (import.meta.env.PUBLIC_SITE_URL || 'https://www.sacscloud.com').replace(/\/$/, '');
  const mismoOrigen = !!origen && (origen === sitio || /^https?:\/\/localhost(:\d+)?$/.test(origen));
  const emailConfiable = mismoOrigen ? email : null;

  // El `sv` viene firmado por nosotros en los links de correo y WhatsApp: es
  // la ÚNICA forma de saber quién navega sin depender de que el navegador
  // diga la verdad. Si la firma no cuadra, se ignora y la visita sigue anónima.
  const contactIdFirmado = verificarSv(sv);

  // La visita se guarda SIEMPRE, se conozca o no a la persona. Antes se tiraba
  // si no había contacto: se perdía justo el recorrido más interesante, el de
  // antes de convertirse en lead. Cuando esa persona deja su correo, esas
  // visitas anónimas se le ligan hacia atrás (ligarVisitasPrevias).
  try {
    let ruta = String(page_url || '/');
    try { const u = new URL(ruta); ruta = u.pathname + (u.search || ''); } catch { /* ya venía relativa */ }
    await registrarVisita({
      contactId: contactIdFirmado || undefined,
      visitorId: visitor_id || null, email: emailConfiable, ruta,
      titulo: page_title || null, referrer: referrer || null,
      segundos: Number.isFinite(Number(segundos)) && Number(segundos) > 0 ? Math.min(3600, Number(segundos)) : null,
    });
  } catch { /* medir nunca puede tumbar la petición */ }

  // Find contact
  let contact: any = null;
  if (contactIdFirmado) {
    const { data } = await supabase.from('contacts').select('id, company_id, nombre, visitor_id').eq('id', contactIdFirmado).maybeSingle();
    contact = data;
    // Se recuerda el navegador: a partir de aquí, sus visitas de este equipo se
    // identifican solas aunque entre por Google y sin ningún link nuestro.
    if (contact && visitor_id && contact.visitor_id !== visitor_id) {
      await supabase.from('contacts').update({ visitor_id }).eq('id', contact.id).then(() => {}, () => {});
    }
  }
  if (!contact && emailConfiable) {
    const { data } = await supabase.from('contacts').select('id, company_id, nombre').eq('email', emailConfiable).limit(1).single();
    contact = data;
  }
  if (!contact && visitor_id) {
    const { data } = await supabase.from('contacts').select('id, company_id, nombre').eq('visitor_id', visitor_id).limit(1).single();
    contact = data;
  }

  if (!contact) {
    return new Response(JSON.stringify({ identified: false }));
  }

  // Ya sabemos quién es: recuperar lo que navegó cuando era anónimo.
  if (visitor_id) { try { await ligarVisitasPrevias(visitor_id, contact.id); } catch {} }

  // Log page visit activity
  await supabase.from('activities').insert({
    contact_id: contact.id,
    company_id: contact.company_id,
    tipo: 'page_visit',
    titulo: `Visito: ${page_title || page_url || 'sitio web'}`,
    metadata: { page_url, page_title, referrer, timestamp: new Date().toISOString() },
    automatico: true,
  });

  // Update last_seen
  await supabase.from('contacts').update({
    last_contact_at: new Date().toISOString()
  }).eq('id', contact.id);

  // Check for automations triggered by website visit
  try {
    const { data: automations } = await supabase
      .from('automations')
      .select('id, enrollment_triggers, suppression_stages')
      .eq('estado', 'activo');

    for (const auto of (automations || [])) {
      const triggers = Array.isArray(auto.enrollment_triggers) ? auto.enrollment_triggers : auto.enrollment_triggers ? [auto.enrollment_triggers] : [];
      const shouldEnroll = triggers.some((t: any) => t.type === 'website_visit');
      if (!shouldEnroll) continue;

      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('automation_id', auto.id)
        .eq('contact_id', contact.id)
        .eq('estado', 'activo')
        .limit(1)
        .single();

      if (existing) continue;

      const { data: firstStep } = await supabase
        .from('automation_steps')
        .select('id')
        .eq('automation_id', auto.id)
        .is('parent_step_id', null)
        .order('orden')
        .limit(1)
        .single();

      if (firstStep) {
        await supabase.from('automation_enrollments').insert({
          automation_id: auto.id,
          contact_id: contact.id,
          current_step_id: firstStep.id,
          next_action_at: new Date().toISOString(),
          enrollment_trigger: { type: 'website_visit', page_url },
        }).then(() => {}, () => {});   // duplicados: se ignoran
      }
    }
  } catch {}

  return new Response(JSON.stringify({ identified: true, contact_id: contact.id }));
};
