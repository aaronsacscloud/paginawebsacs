// ══ Mandarle al cliente sus horarios como lista tocable ════════════════════
//
// El camino viejo era: el agente manda los horarios en texto, el cliente
// contesta «el martes a las 5», y alguien tiene que volver a entrar a agendar.
// Aquí el cliente TOCA un horario y con eso queda: el webhook lo reserva con
// el mismo `/api/scheduling/book` de siempre —así corre entera la cadena que
// ya existe: correo con invitación, WhatsApp de confirmación, secuencia de
// «demo agendada»— sin que nadie más intervenga.
//
// POST { conversation_id | telefono, slug?, dias?, email?, nombre?, empresa? }
//   → arma la oferta, la guarda y manda la lista interactiva.
// GET  ?conversation_id=… → la última oferta de esa conversación (para la UI).
//
// Meta manda: lista de 10 filas como máximo, título de 24 caracteres y
// descripción de 72. Por eso el título es la hora y el día va en la sección.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { enviarInteractivo, usarNumero, KapsoError } from '../../../../lib/whatsapp/kapso-api';
import { registrarMensaje } from '../../../../lib/whatsapp/espejo';
import { telefonoWhatsApp } from '../../../../lib/telefono';
import { getSessionFromRequest } from '../../../../lib/auth/session';
import { fechaLarga, horaAmPm } from '../../../../lib/crm/confirmacion-cita';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Un id de fila cabe en 200 caracteres; con esto sobra y se lee en el log. */
const idFila = (oferta: string, n: number) => `ag:${oferta.slice(0, 8)}:${n}`;

export const GET: APIRoute = async ({ url }) => {
  const conv = url.searchParams.get('conversation_id');
  if (!conv) return json({ oferta: null });
  const { data } = await supabase.from('wa_agenda_ofertas')
    .select('id, estado, opciones, elegido, booking_id, created_at, expira_at')
    .eq('conversation_id', conv).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return json({ oferta: data || null });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const yo = await getSessionFromRequest(request).catch(() => null);

  // ── A quién y por dónde ──
  let convId: string | null = b.conversation_id ? String(b.conversation_id) : null;
  let telefono: string | null = b.telefono ? String(b.telefono) : null;
  let contactId: string | null = null;
  let phoneNumberId: string | null = null;
  if (convId) {
    const { data: c } = await supabase.from('wa_conversaciones')
      .select('id, telefono, contact_id, phone_number_id').eq('id', convId).maybeSingle();
    if (!c) return json({ error: 'La conversación no existe' }, 404);
    telefono = (c as any).telefono; contactId = (c as any).contact_id || null;
    phoneNumberId = (c as any).phone_number_id || null;
  }
  const destino = telefonoWhatsApp(telefono || '');
  if (!destino) return json({ error: 'Esta conversación no tiene un WhatsApp al cual mandar' }, 400);

  // ── Los datos del invitado. El correo NO es opcional: la reserva lo exige
  // porque ahí llega la invitación de calendario, y sin él el cliente tocaría
  // un horario para nada. Se pide en la pantalla, no aquí. ──
  let nombre = String(b.nombre || '').trim();
  let email = String(b.email || '').trim().toLowerCase();
  let empresa = String(b.empresa || '').trim();
  if (contactId && (!nombre || !email || !empresa)) {
    // El nombre de la empresa vive en `companies`, no en el contacto.
    const { data: ct } = await supabase.from('contacts')
      .select('nombre, apellido, email, companies(nombre, nombre_comercial)').eq('id', contactId).maybeSingle();
    if (ct) {
      nombre = nombre || `${(ct as any).nombre || ''} ${(ct as any).apellido || ''}`.trim();
      email = email || String((ct as any).email || '').trim().toLowerCase();
      const co: any = (ct as any).companies;
      empresa = empresa || String(co?.nombre_comercial || co?.nombre || '').trim();
    }
  }
  if (!email || !/.+@.+\..+/.test(email)) {
    return json({ error: 'Falta el correo del cliente: ahí le llega la invitación de calendario.', falta_email: true }, 400);
  }
  if (!nombre) nombre = destino;

  // ── Los huecos libres, del mismo motor que la página pública ──
  const slug = String(b.slug || 'demo');
  const dias = Math.min(Math.max(Number(b.dias || 3), 1), 14);
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const desde = iso(hoy);
  const hasta = iso(new Date(hoy.getTime() + (dias - 1) * 86400000));
  const base = new URL(request.url).origin;
  const libres = await fetch(`${base}/api/scheduling/available-slots?slug=${encodeURIComponent(slug)}&from=${desde}&to=${hasta}&tz=America/Mexico_City`)
    .then(r => r.json()).catch(() => null);
  if (!libres || libres.error) return json({ error: libres?.error || 'No se pudo leer la agenda' }, 502);

  // Máximo 2 por día para que la lista ofrezca DÍAS distintos y no diez horas
  // del mismo martes; tope de 10, que es el límite de Meta.
  const opciones: { n: number; fecha: string; hora: string }[] = [];
  for (const fecha of Object.keys(libres.dates || {}).sort()) {
    const horas: string[] = (libres.dates[fecha] || []).slice(0, 2);
    for (const hora of horas) {
      if (opciones.length >= 10) break;
      opciones.push({ n: opciones.length + 1, fecha, hora: String(hora).slice(0, 5) });
    }
    if (opciones.length >= 10) break;
  }
  if (!opciones.length) return json({ error: 'No hay horarios libres en ese rango. Prueba con más días.' }, 409);

  // ── Se guarda ANTES de mandar: si el mensaje sale y el guardado falla, el
  // cliente toca un horario que nadie sabe interpretar. ──
  const expira = new Date(Date.now() + Math.min(dias, 7) * 86400000).toISOString();
  const { data: oferta, error: errOferta } = await supabase.from('wa_agenda_ofertas').insert({
    conversation_id: convId, contact_id: contactId, telefono: destino,
    event_type_slug: slug, invitee_nombre: nombre, invitee_email: email,
    invitee_empresa: empresa || null, opciones, expira_at: expira,
    creada_por: (yo as any)?.nombre || (yo as any)?.email || null,
  }).select('id').single();
  if (errOferta || !oferta) return json({ error: errOferta?.message || 'No se pudo guardar la oferta' }, 500);

  // ── La lista: una sección por día, la hora como título ──
  const porDia = new Map<string, { n: number; hora: string }[]>();
  for (const o of opciones) {
    const arr = porDia.get(o.fecha) || []; arr.push({ n: o.n, hora: o.hora }); porDia.set(o.fecha, arr);
  }
  const nombreCorto = String(nombre).trim().split(/\s+/)[0];
  const interactivo = {
    tipo: 'lista' as const,
    header: 'Elige tu horario',
    cuerpo: `${nombreCorto}, estos son los horarios que tengo libres. Toca el que te quede mejor y queda agendado al instante — te llega la confirmación por WhatsApp y por correo.`,
    footer: 'Horario de la Ciudad de México',
    boton: 'Ver horarios',
    secciones: [...porDia.entries()].map(([fecha, horas]) => ({
      // 24 caracteres: «miércoles 3 de septiembre» no cabe, se recorta el día.
      titulo: fechaLarga(fecha).slice(0, 24),
      filas: horas.map(h => ({ id: idFila(oferta.id, h.n), titulo: horaAmPm(h.hora) })),
    })),
  };

  try {
    usarNumero(phoneNumberId);
    const r = await enviarInteractivo(destino, interactivo);
    const wamid = r?.messages?.[0]?.id;
    if (wamid) {
      await supabase.from('wa_agenda_ofertas').update({ wamid }).eq('id', oferta.id);
      await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino, direccion: 'saliente',
        tipo: 'interactive', cuerpo: interactivo.cuerpo, status: 'sent',
        autor: (yo as any)?.nombre || 'Agenda',
        metadata: { interactivo: 'list', oferta_agenda: oferta.id, opciones },
      });
    }
    return json({ ok: true, oferta_id: oferta.id, opciones });
  } catch (e: any) {
    // La oferta queda anulada: si no, el cliente nunca la ve pero el sistema
    // cree que hay una viva y no deja mandar otra.
    await supabase.from('wa_agenda_ofertas').update({ estado: 'fallida' }).eq('id', oferta.id);
    if (e instanceof KapsoError && /window|24/i.test(e.message)) {
      return json({ error: 'La ventana de 24 h está cerrada: manda antes una plantilla para reabrir la conversación.', ventana_cerrada: true }, 422);
    }
    return json({ error: e?.message || 'No se pudo mandar la lista' }, 502);
  }
};
