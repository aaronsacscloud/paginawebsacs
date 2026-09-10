// WHATSAPP · Salud por línea (multilínea, idea 9). Cada hora: lee en Meta la calidad y el
// límite de mensajería de CADA número y lo guarda en wa_numeros. Disyuntor:
//   · calidad RED (o envío BLOQUEADO/LIMITADO por Meta) → la línea entra en pausa automática:
//     no salen masivos, cadencias de leads, prospección ni invitaciones de eventos por ahí
//     (el inbox y las citas siguen: son conversaciones que el cliente pidió).
//   · calidad GREEN y envío normal → se quita la pausa, solo si la puso el disyuntor
//     (una pausa puesta a mano se respeta).
// GET  (CRON_SECRET)  → { lineas: [{ id, calidad, tier, pausada, cambio }] }
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { saludNumero, infoNumero, resumirSalud } from '../../../lib/whatsapp/kapso-numero';
import { todasLasLineas, olvidarCacheLineas } from '../../../lib/whatsapp/linea';
import { notificar } from '../../../lib/crm/notificaciones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const MOTIVO_AUTO = 'auto: calidad baja en Meta';

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('No', { status: 401 });
  const lineas = (await todasLasLineas()).filter(l => l.activo);
  const salida: any[] = [];
  for (const l of lineas) {
    const [salud, info] = await Promise.all([saludNumero(l.id).catch(() => null), infoNumero(l.id).catch(() => null)]);
    if (!salud && !info) { salida.push({ id: l.id, error: 'Meta no contestó' }); continue; }
    const resumen = resumirSalud(salud, info);
    const calidad = info?.quality_rating || null;
    const tier = info?.messaging_limit_tier || salud?.checks?.phone_number_access?.details?.throughput_tier || null;
    const envio = salud?.checks?.messaging_health?.overall_status || null;
    const mal = calidad === 'RED' || envio === 'BLOCKED' || envio === 'LIMITED';
    const bien = calidad === 'GREEN' && (!envio || envio === 'AVAILABLE' || envio === 'OK');
    const { data: fila } = await supabase.from('wa_numeros').select('pausada, pausada_motivo').eq('phone_number_id', l.id).maybeSingle();
    const cambios: any = { calidad, tier, salud: { ...resumen, info, checks: salud?.checks || null }, salud_at: new Date().toISOString() };
    let cambio: string | null = null;
    if (mal && !fila?.pausada) { cambios.pausada = true; cambios.pausada_motivo = MOTIVO_AUTO; cambio = 'pausada'; }
    else if (bien && fila?.pausada && fila.pausada_motivo === MOTIVO_AUTO) { cambios.pausada = false; cambios.pausada_motivo = null; cambio = 'reanudada'; }
    await supabase.from('wa_numeros').update(cambios).eq('phone_number_id', l.id);
    if (cambio) {
      await notificar({
        clave: `wa_linea_salud:${l.id}:${cambio}:${new Date().toISOString().slice(0, 10)}`, tipo: 'wa_linea_salud', nivel: cambio === 'pausada' ? 'urgente' : 'info',
        titulo: cambio === 'pausada' ? `Línea ${l.numero} en pausa: calidad ${calidad || envio}` : `Línea ${l.numero} reanudada: calidad verde`,
        detalle: cambio === 'pausada' ? 'Meta bajó la calidad del número. Los masivos y las cadencias no salen por esta línea hasta que se recupere; el inbox sigue.' : 'La calidad volvió a verde: masivos y cadencias vuelven a salir por esta línea.',
        destino: 'wa-ajustes',
      }).catch(() => {});
    }
    salida.push({ id: l.id, numero: l.numero, calidad, tier, envio, pausada: cambios.pausada ?? fila?.pausada ?? false, cambio });
  }
  olvidarCacheLineas();
  return json({ ok: true, lineas: salida });
};
