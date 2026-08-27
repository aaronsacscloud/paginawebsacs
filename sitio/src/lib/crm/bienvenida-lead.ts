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

// La plantilla PREESTABLECIDA del correo: se usa cuando el módulo está activo
// y el usuario no ha escrito la suya. Variables: {{nombre}} y {{campana}}.
export const EMAIL_BIENVENIDA_DEFAULT = {
  asunto: 'Recibimos tu registro, {{nombre}} — Sacscloud',
  cuerpo: `Hola {{nombre}},

Te escribimos de Sacscloud: recibimos el registro que llenaste en TikTok y quedó completo.

Un asesor te va a contactar por WhatsApp para resolver tus dudas y enseñarte cómo funciona el sistema en un negocio como el tuyo. Si prefieres adelantarte, responde este correo y te atendemos por aquí.

Equipo Sacscloud
www.sacscloud.com`,
};

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
  const html = texto.split(/\n{2,}/).map(p2 => `<p style="margin:0 0 14px;font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#2a2733">${p2.replace(/\n/g, '<br>')}</p>`).join('');
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
