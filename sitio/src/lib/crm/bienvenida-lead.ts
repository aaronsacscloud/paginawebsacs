// LEADS · El primer mensaje AUTOMÁTICO al lead que se registró por TikTok.
//
// Va por plantilla UTILITY (las de marketing las rechaza Meta por "healthy
// ecosystem"): confirma el registro que ÉL hizo y lo invita a responder —
// al contestar se abre la ventana de 24 h y la conversación sigue libre.
// Hay 4 candidatas en revisión de Meta: se intenta en orden de preferencia
// y la primera aprobada se recuerda para las siguientes.
//
// NO cuenta como toque humano (actividad tipo bienvenida_wa, fuera de la
// lista de toques): el lead sigue en "Nuevos sin primer toque" hasta que un
// humano lo trabaje o él responda — la automatización abre, no vende.
import { supabase } from '../supabase';
import { enviarPlantilla } from '../whatsapp/kapso-api';

const CANDIDATAS = [
  'registro_tiktok_recibido',
  'solicitud_informacion_seguimiento',
  'registro_confirmacion_datos',
  'solicitud_asignada_asesor',
];
let aprobada: string | null = null;

export async function enviarBienvenidaTikTok(contactId: string, telefono: string, nombre?: string | null) {
  const primerNombre = String(nombre || '').trim().split(/\s+/)[0] || '👋';
  const orden = aprobada ? [aprobada, ...CANDIDATAS.filter(x => x !== aprobada)] : CANDIDATAS;
  for (const pl of orden) {
    try {
      await enviarPlantilla(telefono, pl, 'es_MX', [primerNombre]);
      aprobada = pl;
      await supabase.from('activities').insert({
        contact_id: contactId, tipo: 'bienvenida_wa', automatico: true,
        titulo: `Bienvenida automática por WhatsApp (plantilla ${pl})`,
        metadata: { plantilla: pl, telefono },
      }).then(() => {});
      return { ok: true, plantilla: pl };
    } catch { /* siguiente candidata (aún no aprobada o rechazada) */ }
  }
  return { ok: false };
}
