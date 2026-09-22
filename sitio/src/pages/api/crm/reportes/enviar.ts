// Mandarle al cliente la liga de su reporte de trabajo.
//
// El correo NO lleva el reporte adentro: lleva la liga. Es a propósito —así se
// puede saber cuándo lo abrió, que es la mitad del valor de esto— y además un
// correo con veinte renglones de tabla se rompe en la mitad de los clientes de
// correo.
//
// Es TRANSACCIONAL: el reporte del trabajo que ya pagó no es marketing, y una
// baja de campaña no puede dejar a alguien sin él.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { sendEmail } from '../../../../lib/email';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fLarga = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  : '';

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!UUID.test(id)) return json({ error: 'Falta el reporte.' }, 400);

  const { data: rep } = await supabase.from('reportes_trabajo')
    .select('id, tipo, folio, desde, hasta, hechos, company_id, contact_id').eq('id', id).maybeSingle();
  if (!rep) return json({ error: 'Ese reporte ya no existe.' }, 404);

  // A quién. Si no lo mandan: al lead del reporte, o al contacto principal de la cuenta.
  let para = String(b?.para || '').trim();
  if (!para && rep.tipo === 'lead') {
    para = String((rep.hechos as any)?.contacto?.email || '').trim();
    if (!para && rep.contact_id) {
      const { data: ct } = await supabase.from('contacts').select('email').eq('id', rep.contact_id).maybeSingle();
      para = String(ct?.email || '').trim();
    }
    if (!CORREO.test(para)) return json({ error: 'Ese lead no tiene un correo valido. Mándale la liga por WhatsApp.' }, 400);
  }
  if (!para) {
    const { data: ct } = await supabase.from('contacts')
      .select('email, es_principal').eq('company_id', rep.company_id)
      .is('archived_at', null).not('email', 'is', null)
      .order('es_principal', { ascending: false }).limit(1).maybeSingle();
    para = String(ct?.email || '').trim();
  }
  if (!CORREO.test(para)) return json({ error: 'No hay a quien mandarselo: la cuenta no tiene un correo valido.' }, 400);

  const h: any = rep.hechos || {};
  const base = new URL(request.url).origin;
  const liga = base + '/reporte/' + rep.id;
  // Tres cifras y un boton. El detalle esta en la liga; meterlo aqui solo hace
  // que el correo se rompa y que nadie entre a verlo.
  const cifra = (n: number | string, l: string, color: string) =>
    '<td align="center" style="padding:12px 6px;border:1px solid #ecebf3;border-radius:10px">'
    + '<div style="font-size:22px;font-weight:800;color:' + color + '">' + n + '</div>'
    + '<div style="font-size:11px;color:#928da4">' + l + '</div></td>';


  /* El del LEAD es otro correo: no hay periodo ni entregas que contar. Lleva
     lo que se habló y la oferta con su fecha, que es lo que lo hace abrirlo. */
  if (rep.tipo === 'lead') {
    const pct = Number(h.descuento?.pct || 0);
    const vence = fLarga(h.descuento?.vigencia);
    // Nombre y empresa los escribió alguien a mano: se escapan antes del HTML.
    const esc = (t: any) => String(t || '').replace(/[&<>"]/g, (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
    const nombre = esc(String(h.lead || '').split(' ')[0]);
    const titulo = 'Lo que platicamos' + (h.empresa ? ' sobre ' + esc(h.empresa) : '') + ', y cómo lo resolvemos';
    const htmlL = '<!doctype html><html><body style="margin:0;padding:0;background:#eef0f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;padding:28px 12px"><tr><td align="center">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">'
      + '<tr><td style="height:4px;background:linear-gradient(90deg,#4FBF95,#EFA6CA 55%,#D9538E)"></td></tr>'
      + '<tr><td style="padding:26px 28px 8px">'
      + '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#928da4">Tu sesión · ' + rep.folio + '</div>'
      + '<h1 style="margin:12px 0 0;font-size:22px;line-height:1.25;color:#231d40">' + titulo + '</h1>'
      + '<p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#514c63">' + (nombre ? 'Hola ' + nombre + ', ' : '')
      + 'gracias por tu tiempo en la ' + String(h.sesion?.tipo || 'sesión').toLowerCase() + ' del ' + fLarga(h.sesion?.fecha)
      + '. Te dejamos en una liga lo que nos contaste y cómo lo resuelve Sacs, punto por punto.</p></td></tr>'
      + '<tr><td style="padding:18px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      + cifra(h.total_pedidos || 0, 'cosas que nos pediste', '#1E8A63') + '<td style="width:8px"></td>'
      + cifra(h.ya_existen || 0, 'ya existen en Sacs', '#1E8A63') + '<td style="width:8px"></td>'
      + cifra(pct + '%', 'en tu licencia anual', '#D9538E')
      + '</tr></table></td></tr>'
      + '<tr><td align="center" style="padding:22px 28px 26px">'
      + '<a href="' + liga + '" style="display:inline-block;background:#1E8A63;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px">Ver mi resumen</a>'
      + (vence ? '<p style="margin:12px 0 0;font-size:13px;color:#D9538E;font-weight:600">El ' + pct + '% por asistir a la sesión vale hasta el ' + vence + '.</p>' : '')
      + '<p style="margin:14px 0 0;font-size:12px;color:#928da4">O copia esta liga:<br>' + liga + '</p></td></tr>'
      + '<tr><td style="padding:14px 28px;background:#faf9fe;border-top:1px solid #ecebf3;font-size:12px;color:#928da4">'
      + '<b style="color:#514c63">Sacscloud</b> · Tu sesión · ' + rep.folio + '</td></tr>'
      + '</table></td></tr></table></body></html>';
    const textoL = titulo + '\n\n' + (h.total_pedidos || 0) + ' cosas que nos pediste · ' + (h.ya_existen || 0) + ' ya existen en Sacs · '
      + pct + '% en tu licencia anual' + (vence ? ' (vale hasta el ' + vence + ')' : '') + '\n\nVer mi resumen: ' + liga + '\n\nSacscloud · ' + rep.folio;
    const rl = await sendEmail({
      to: para, subject: 'Tu sesión con Sacs: lo que platicamos' + (pct ? ' · ' + pct + '% en tu licencia' : ''),
      html: htmlL, text: textoL, categoria: 'reporte', transaccional: true,
    });
    if (rl.status === 'failed') return json({ error: rl.error || 'No se pudo enviar el correo.' }, 502);
    await supabase.from('reportes_trabajo').update({
      estado: 'enviado', enviado_at: new Date().toISOString(), enviado_a: para,
    }).eq('id', rep.id);
    // Cuenta como toque del lead: va a su ficha, no a una cuenta que no tiene.
    await supabase.from('activities').insert({
      contact_id: rep.contact_id, company_id: rep.company_id, tipo: 'reporte_enviado',
      titulo: 'Se le mando el reporte de su sesion ' + rep.folio, automatico: true,
    }).then(() => {}, () => {});
    return json({ ok: true, para, liga, estado: rl.status });
  }
  const cliente = h.cliente || 'tu cuenta';
  const periodo = fLarga(rep.desde) + ' al ' + fLarga(rep.hasta);
  /* Dos documentos, dos correos. Las tres cifras del de trabajo —entregas,
     cortesías, folios de soporte— no aplican al de entregas, que no sabe nada
     de soporte; ahí la tercera cifra es cuántas traen VIDEO, que es la razón
     por la que el cliente va a abrir la liga. */
  const esEntregas = rep.tipo === 'entregas';
  const entregadas = esEntregas
    ? (h.entregas || [])
    : (h.entregadas || []).filter((m: any) => m.visible_cliente !== false);
  const cortesias = esEntregas ? Number(h.cortesias || 0) : entregadas.filter((m: any) => m.cortesia).length;
  const folios = h.soporte?.folios || 0;
  const conVideo = Number(h.con_video || 0);

  const kicker = esEntregas ? 'Reporte de entregas' : 'Reporte de trabajo';
  const encabezado = esEntregas
    ? 'Esto es lo que se entrego en ' + cliente
    : 'Esto es lo que se trabajo en ' + cliente;

  const html = '<!doctype html><html><body style="margin:0;padding:0;background:#eef0f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;padding:28px 12px"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">'
    + '<tr><td style="height:4px;background:linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,#F4A8CD)"></td></tr>'
    + '<tr><td style="padding:26px 28px 8px">'
    + '<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#928da4">' + kicker + ' · ' + rep.folio + '</div>'
    + '<h1 style="margin:12px 0 0;font-size:22px;line-height:1.25;color:#231d40">' + encabezado + '</h1>'
    + '<p style="margin:8px 0 0;font-size:15px;color:#514c63">Del ' + periodo + '.</p></td></tr>'
    + '<tr><td style="padding:18px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    + cifra(entregadas.length, esEntregas ? 'entregas' : 'mejoras entregadas', '#5B4BD6') + '<td style="width:8px"></td>'
    + cifra(cortesias, 'sin costo adicional', '#1E8A63') + '<td style="width:8px"></td>'
    + cifra(esEntregas ? conVideo : folios, esEntregas ? 'con video' : 'folios de soporte', '#5B4BD6')
    + '</tr></table></td></tr>'
    + '<tr><td align="center" style="padding:22px 28px 26px">'
    + '<a href="' + liga + '" style="display:inline-block;background:#9B8CFA;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px">'
    + (esEntregas ? 'Ver las entregas' : 'Ver el reporte completo') + '</a>'
    + '<p style="margin:14px 0 0;font-size:12px;color:#928da4">O copia esta liga:<br>' + liga + '</p></td></tr>'
    + '<tr><td style="padding:14px 28px;background:#faf9fe;border-top:1px solid #ecebf3;font-size:12px;color:#928da4">'
    + '<b style="color:#514c63">Sacscloud</b> · ' + kicker + ' · ' + rep.folio + '</td></tr>'
    + '</table></td></tr></table></body></html>';

  const texto = encabezado + '\n' + periodo + '\n\n'
    + entregadas.length + (esEntregas ? ' entregas · ' : ' mejoras entregadas · ') + cortesias + ' sin costo adicional · '
    + (esEntregas ? conVideo + ' con video' : folios + ' folios de soporte') + '\n\n'
    + (esEntregas ? 'Ver las entregas: ' : 'Ver el reporte completo: ') + liga + '\n\nSacscloud · ' + rep.folio;

  const r = await sendEmail({
    to: para,
    subject: (esEntregas ? 'Tus entregas · ' : 'Tu reporte de trabajo · ') + periodo,
    html, text: texto,
    categoria: 'reporte',
    transaccional: true,
  });

  if (r.status === 'failed') return json({ error: r.error || 'No se pudo enviar el correo.' }, 502);

  await supabase.from('reportes_trabajo').update({
    estado: 'enviado', enviado_at: new Date().toISOString(), enviado_a: para,
  }).eq('id', rep.id);

  await supabase.from('activities').insert({
    company_id: rep.company_id, tipo: 'reporte_enviado',
    titulo: 'Se le mando el ' + (esEntregas ? 'reporte de entregas ' : 'reporte ') + rep.folio, automatico: true,
  }).then(() => {}, () => {});

  return json({ ok: true, para, liga, estado: r.status });
};
