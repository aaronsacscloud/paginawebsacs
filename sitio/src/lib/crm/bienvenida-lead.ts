// LEADS · El primer mensaje AUTOMÁTICO al lead que se registró por TikTok.
//
// TODO se maneja desde el módulo: WhatsApp ▸ Configuración ▸ Automatización
// ("Bienvenida a leads de TikTok"): ahí se prende/apaga y se elige QUÉ
// plantilla UTILITY se manda — sin tocar código. Va por plantilla porque las
// de marketing las rechaza Meta ("healthy ecosystem"); al responder el lead
// se abre la ventana de 24 h y la conversación sigue libre.
//
// NO cuenta como toque humano (actividad tipo bienvenida_wa, fuera de la
// lista de toques): el lead sigue en "Nuevos sin primer toque" hasta que un
// humano lo trabaje o él responda — la automatización abre, no vende.
import { supabase } from '../supabase';
import { enviarPlantilla } from '../whatsapp/kapso-api';
import { resolverTenant } from '../email/tenant';
import { enviarCorreo } from '../email/pipeline';

// La plantilla PREESTABLECIDA del correo. El cuerpo (editable en el módulo)
// es SOLO la parte personal de arriba; el diseño —cinta de marca, imagen,
// aviso de WhatsApp, botón de demo y sellos de confianza— lo pone siempre
// la plantilla visual de abajo. Variables: {{nombre}} y {{campana}}.
export const EMAIL_BIENVENIDA_DEFAULT = {
  asunto: '{{nombre}}, recibimos tu registro — te leemos por WhatsApp',
  cuerpo: `Hola {{nombre}}, ¡qué gusto saludarte!

Vimos tu registro en TikTok y queremos presentarnos bien: Sacscloud no es un punto de venta tradicional — es la evolución de los sistemas de retail.

Es la forma moderna de operar tu marca: vendes en tienda, en línea y hasta en TikTok Shop con todo sincronizado, y controlas inventarios, administración y equipo desde un solo lugar — desde 1 tienda hasta cientos, en varios países o continentes. No hay límite a lo que quieras crecer y crear con Sacscloud.

Y el sistema se adapta a ti, no al revés: flujos avanzados según el giro en que te encuentres — eso hace posible la verdadera automatización — con IA integrada que te ayuda dentro del sistema todos los días. Lo implementamos contigo paso a paso, para que tu operación crezca sin saturarte.`,
};

/** El correo ARMADO: diseño de documento del cliente (email-safe: tablas + inline). */
function htmlBienvenida(intro: string): string {
  const parrafos = intro.split(/\n{2,}/).map(p2 =>
    `<p style="margin:0 0 16px;font:16px/1.65 -apple-system,'Segoe UI',Roboto,sans-serif;color:#2a2733">${p2.replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f3f8">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Tu asesor te escribe por WhatsApp en unos minutos — y tu demo en vivo está a un click.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f8"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ececf1">
      <tr><td height="6" style="height:6px;background:#9B8CFA;background:linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,rgba(244,168,205,.9));font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:26px 34px 0">
        <div style="font:800 20px/1 -apple-system,'Segoe UI',Roboto,sans-serif;color:#5B4BD6;letter-spacing:-.02em">Sacscloud</div>
        <div style="font:600 11px/1 -apple-system,'Segoe UI',Roboto,sans-serif;color:#a5a2af;margin-top:5px;letter-spacing:.06em;text-transform:uppercase">El sistema de las marcas de retail en México</div>
      </td></tr>
      <tr><td style="padding:22px 34px 0">${parrafos}</td></tr>
      <tr><td style="padding:6px 34px 0">
        <img src="https://www.sacscloud.com/images/hero-sacs-store.webp" width="532" alt="Una tienda operando con Sacscloud: el punto de venta en una tablet" style="width:100%;max-width:532px;border-radius:12px;display:block;border:1px solid #ececf1">
      </td></tr>
      <tr><td style="padding:18px 34px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#EEECFE;border-radius:12px;padding:14px 18px">
          <p style="margin:0;font:600 14.5px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:#4536BE">📲 En unos minutos te va a llegar un WhatsApp de tu asesor, desde nuestro número oficial. Por ahí te acompañamos en todo — respóndele con confianza.</p>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:22px 34px 0">
        <p style="margin:0 0 14px;font:16px/1.65 -apple-system,'Segoe UI',Roboto,sans-serif;color:#2a2733">El mejor siguiente paso es una <b>demo en vivo</b>: vemos TU negocio, entendemos tus procesos y los ejecutamos en el sistema en tiempo real — sales viendo tu operación ya funcionando y con un plan claro de implementación.</p>
      </td></tr>
      <tr><td align="center" style="padding:6px 34px 8px">
        <a href="https://www.sacscloud.com/contacto" style="display:inline-block;background:#9B8CFA;color:#ffffff;text-decoration:none;font:800 16px/1 -apple-system,'Segoe UI',Roboto,sans-serif;padding:15px 34px;border-radius:12px">Agendar mi demo →</a>
        <div style="font:600 12px/1 -apple-system,'Segoe UI',Roboto,sans-serif;color:#8a8590;margin-top:9px">20 minutos · sin costo · con tu propio negocio</div>
      </td></tr>
      <tr><td style="padding:16px 34px 0">
        <p style="margin:0;font:15px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;color:#55515f"><b>P.D.</b> Si prefieres, responde este correo contándonos de tu negocio y te atendemos por aquí — lo leemos personalmente.</p>
      </td></tr>
      <tr><td style="padding:22px 34px 26px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0eff5"><tr>
          <td align="center" style="padding-top:18px;width:33%">
            <div style="font:800 17px/1 -apple-system,'Segoe UI',Roboto,sans-serif;color:#5B4BD6">+14 años</div>
            <div style="font:600 11px/1.4 -apple-system,'Segoe UI',Roboto,sans-serif;color:#8a8590;margin-top:4px">acompañando al retail</div>
          </td>
          <td align="center" style="padding-top:18px;width:33%">
            <div style="font:800 17px/1 -apple-system,'Segoe UI',Roboto,sans-serif;color:#5B4BD6">★ 4.8/5</div>
            <div style="font:600 11px/1.4 -apple-system,'Segoe UI',Roboto,sans-serif;color:#8a8590;margin-top:4px">en Google Reviews</div>
          </td>
          <td align="center" style="padding-top:18px;width:33%">
            <div style="font:800 17px/1 -apple-system,'Segoe UI',Roboto,sans-serif;color:#5B4BD6">3,000+ marcas</div>
            <div style="font:600 11px/1.4 -apple-system,'Segoe UI',Roboto,sans-serif;color:#8a8590;margin-top:4px">han operado con nosotros</div>
          </td>
        </tr></table>
      </td></tr>
    </table>
    <p style="margin:14px 0 0;font:500 11.5px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#a5a2af">Sacscloud · www.sacscloud.com · Recibiste este correo porque te registraste en nuestra campaña.</p>
  </td></tr></table></body></html>`;
}

/** Correo de bienvenida al lead de TikTok (config del módulo; preset editable). */
export async function enviarCorreoBienvenidaTikTok(contactId: string, email: string, nombre?: string | null, campana?: string | null) {
  const { data: cfg } = await supabase.from('wa_config')
    .select('email_bienvenida_tiktok_activa, email_bienvenida_asunto, email_bienvenida_cuerpo').eq('id', 1).maybeSingle();
  if (!cfg?.email_bienvenida_tiktok_activa) return { ok: false, motivo: 'apagada' };
  const t = await resolverTenant();
  if (!t) return { ok: false, motivo: 'sin_tenant' };
  const pon = (x: string) => x
    .replace(/\{\{nombre\}\}/g, String(nombre || '').trim().split(/\s+/)[0] || 'hola')
    .replace(/\{\{campana\}\}/g, campana || 'nuestra campaña');
  const asunto = pon(cfg.email_bienvenida_asunto || EMAIL_BIENVENIDA_DEFAULT.asunto);
  const texto = pon(cfg.email_bienvenida_cuerpo || EMAIL_BIENVENIDA_DEFAULT.cuerpo);
  const html = htmlBienvenida(texto);
  const r = await enviarCorreo({ tenantId: t.id, para: email, asunto, html, texto, categoria: 'relacion', contactId } as any);
  if (!(r as any)?.enviado) return { ok: false, motivo: (r as any)?.motivo || 'error' };
  await supabase.from('activities').insert({
    contact_id: contactId, tipo: 'bienvenida_email', automatico: true,
    titulo: 'Correo de bienvenida automático', metadata: { asunto },
  }).then(() => {});
  return { ok: true };
}

export async function enviarBienvenidaTikTok(contactId: string, telefono: string, nombre?: string | null) {
  const { data: cfg } = await supabase.from('wa_config')
    .select('bienvenida_tiktok_activa, bienvenida_tiktok_plantilla').eq('id', 1).maybeSingle();
  if (!cfg?.bienvenida_tiktok_activa || !cfg?.bienvenida_tiktok_plantilla) return { ok: false, motivo: 'apagada' };

  const primerNombre = String(nombre || '').trim().split(/\s+/)[0] || '👋';
  try {
    await enviarPlantilla(telefono, cfg.bienvenida_tiktok_plantilla, 'es_MX', [primerNombre]);
  } catch (e: any) {
    console.warn('[bienvenida-tiktok] plantilla falló:', e?.message || e);
    return { ok: false, motivo: String(e?.message || e).slice(0, 200) };
  }
  await supabase.from('activities').insert({
    contact_id: contactId, tipo: 'bienvenida_wa', automatico: true,
    titulo: `Bienvenida automática por WhatsApp (plantilla ${cfg.bienvenida_tiktok_plantilla})`,
    metadata: { plantilla: cfg.bienvenida_tiktok_plantilla, telefono },
  }).then(() => {});
  return { ok: true, plantilla: cfg.bienvenida_tiktok_plantilla };
}

/** Prueba del correo de bienvenida: lo manda TAL CUAL a la dirección dada. */
export async function probarCorreoBienvenida(para: string) {
  const t = await resolverTenant();
  if (!t) return { ok: false, motivo: 'sin_tenant' };
  const pon = (x: string) => x.replace(/\{\{nombre\}\}/g, 'María').replace(/\{\{campana\}\}/g, 'Campaña nuevos leads');
  const { data: cfg } = await supabase.from('wa_config').select('email_bienvenida_asunto, email_bienvenida_cuerpo').eq('id', 1).maybeSingle();
  const asunto = pon(cfg?.email_bienvenida_asunto || EMAIL_BIENVENIDA_DEFAULT.asunto);
  const texto = pon(cfg?.email_bienvenida_cuerpo || EMAIL_BIENVENIDA_DEFAULT.cuerpo);
  const r = await enviarCorreo({ tenantId: t.id, para, asunto, html: htmlBienvenida(texto), texto, categoria: 'relacion' } as any);
  return { ok: !!(r as any)?.enviado, motivo: (r as any)?.motivo || null, detalle: (r as any)?.detalle || null };
}
