// LATIDO del agente (decisión 2026-09-03): si el observador no corre o no entra ningún mensaje en horas hábiles, avisar.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { leerConfig } from '../../../lib/crm/ti/motor';
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const cfg: any = await leerConfig();
  const ahora = Date.now();
  const res: any = { ok: true };
  const marcas = [cfg.observado_hasta, cfg.observador_marca, cfg.agente_marca].map((x: any) => Date.parse(x || 0) || 0);
  const ultimoTick = Math.max(...marcas);
  const hoyKey = new Date(ahora - 6 * 3600e3).toISOString().slice(0, 13);
  const horaCd = (new Date(ahora).getUTCHours() - 6 + 24) % 24, dow = new Date(ahora - 6 * 3600e3).getUTCDay();
  const habil = dow >= 1 && dow <= 5 && horaCd >= 9 && horaCd < 18;
  res.ultimo_tick_min = ultimoTick ? Math.round((ahora - ultimoTick) / 60000) : null;
  if (cfg.agente_activo === true && ultimoTick && ahora - ultimoTick > 10 * 60e3) {
    const nueva = await notificar({ clave: `sistema_latido:${hoyKey}`, tipo: 'sistema_latido', nivel: 'urgente', titulo: `El agente lleva ${res.ultimo_tick_min} min sin correr`, detalle: 'El observador (cron de cada 2 min) no ha marcado un tick. Mientras, nadie contesta a los leads ni salen los envíos aprobados.', metadata: { origen: 'agente', que_hacer: 'Revisa Vercel → Crons y el último deploy; si el cron corre pero falla, mira los logs de /api/cron/ti-observador.' } });
    res.aviso_tick = nueva;
    if (nueva) { try { const { enviarTexto } = await import('../../../lib/whatsapp/kapso-api'); const tel = String(cfg.dueno_whatsapp || (cfg.agente_prueba_telefonos || [])[0] || '').replace(/\D/g, ''); if (tel) await enviarTexto(tel, `Aviso del sistema: el agente lleva ${res.ultimo_tick_min} min sin correr. Revisa Vercel → Crons.`); } catch { /* fuera de ventana */ } }
  }
  if (habil) {
    const { data: ult } = await supabase.from('wa_mensajes').select('created_at').eq('direccion', 'entrante').order('created_at', { ascending: false }).limit(1);
    const hace = (ult || []).length ? (ahora - Date.parse(ult![0].created_at)) / 3600e3 : null;
    res.ultimo_entrante_h = hace == null ? null : Math.round(hace * 10) / 10;
    if (hace != null && hace > 3) res.aviso_entrantes = await notificar({ clave: `sistema_sin_entrantes:${hoyKey}`, tipo: 'sistema_sin_entrantes', nivel: 'alerta', titulo: `Sin mensajes entrantes desde hace ${Math.round(hace)} h en horario hábil`, detalle: 'Puede ser un día tranquilo, o que el webhook de WhatsApp dejó de entregar. Conviene mandar un mensaje de prueba desde el carril de pruebas.', metadata: { origen: 'agente', que_hacer: 'Escribe desde el número de pruebas al WhatsApp de ventas; si no aparece en el inbox en 1 min, revisa el webhook en Kapso.' } });
  }
  return json(res);
};
