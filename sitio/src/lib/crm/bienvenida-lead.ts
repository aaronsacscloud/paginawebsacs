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
