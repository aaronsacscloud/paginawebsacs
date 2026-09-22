// Mandarle a un contacto el link para que agende SOLO una reunión.
//
// POST { contact_id, slug }  → correo con el link (con su nombre y correo ya
// puestos, para que no tenga que escribirlos) y un toque en su ficha.
//
// Nació con el link de consultoría: el cliente elige su hora dentro de los
// horarios de atención, y la reunión cae en el Google del anfitrión sin
// encimarse con lo que ya tiene.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { sendEmail } from '../../../lib/email';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (t: any) => String(t || '').replace(/[&<>"]/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const contactId = String(b?.contact_id || '');
  const slug = String(b?.slug || 'consultoria');
  if (!UUID.test(contactId)) return json({ error: 'Falta el contacto.' }, 400);

  const { data: et } = await supabase.from('event_types')
    .select('nombre, slug, duracion_minutos, anfitrion_nombre').eq('slug', slug).eq('activo', true).maybeSingle();
  if (!et) return json({ error: 'Ese tipo de reunión no existe o está apagado.' }, 404);

  const { data: c } = await supabase.from('contacts')
    .select('id, nombre, apellido, email, company_id').eq('id', contactId).maybeSingle();
  if (!c) return json({ error: 'Ese contacto ya no existe.' }, 404);
  const para = String(c.email || '').trim();
  if (!CORREO.test(para)) return json({ error: 'Ese contacto no tiene un correo válido. Mándale el link por WhatsApp.' }, 400);

  const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ');
  const q = new URLSearchParams({ email: para, ...(nombre ? { nombre } : {}) });
  const liga = new URL(request.url).origin + '/agendar/' + et.slug + '?' + q;
  const quien = et.anfitrion_nombre ? ' con ' + esc(et.anfitrion_nombre) : '';

  const html = '<!doctype html><html><body style="margin:0;padding:0;background:#eef0f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;padding:28px 12px"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">'
    + '<tr><td style="height:4px;background:linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,#F4A8CD)"></td></tr>'
    + '<tr><td style="padding:26px 28px 6px">'
    + '<h1 style="margin:0;font-size:21px;line-height:1.3;color:#231d40">Agenda tu ' + esc(String(et.nombre).toLowerCase()) + quien + '</h1>'
    + '<p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#514c63">' + (c.nombre ? 'Hola ' + esc(c.nombre) + ', ' : '')
    + 'elige el día y la hora que mejor te acomoden. Son ' + (et.duracion_minutos || 60) + ' minutos por videollamada y te llega la invitación a tu calendario.</p></td></tr>'
    + '<tr><td align="center" style="padding:22px 28px 26px">'
    + '<a href="' + liga + '" style="display:inline-block;background:#5B4BD6;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px">Elegir mi horario</a>'
    + '<p style="margin:14px 0 0;font-size:12px;color:#928da4">O copia esta liga:<br>' + esc(liga) + '</p></td></tr>'
    + '<tr><td style="padding:14px 28px;background:#faf9fe;border-top:1px solid #ecebf3;font-size:12px;color:#928da4"><b style="color:#514c63">Sacscloud</b></td></tr>'
    + '</table></td></tr></table></body></html>';

  // Es a UNA persona, a pedido de quien la atiende: servicio, no campaña.
  const r = await sendEmail({
    to: para, subject: 'Agenda tu ' + String(et.nombre).toLowerCase() + ' con Sacs',
    html, text: 'Elige tu horario: ' + liga, categoria: 'agenda', transaccional: true,
  });
  if (r.status === 'failed') return json({ error: r.error || 'No se pudo enviar el correo.' }, 502);

  await supabase.from('activities').insert({
    contact_id: c.id, company_id: c.company_id || null, tipo: 'link_agenda_enviado',
    titulo: 'Se le mandó el link para agendar ' + String(et.nombre).toLowerCase(), automatico: true,
  }).then(() => {}, () => {});

  return json({ ok: true, para, liga });
};
