// GET /api/cron/de-latido — ¿el motor sigue vivo?
//
// Es un cron PROPIO y no un paso del ciclo, y esa es la decisión que importa:
// un vigilante que se ejecuta desde la cola no puede avisar cuando el muerto es
// la cola. Si el latido fuera una acción más, un worker caído se llevaría por
// delante también al que tenía que delatarlo, y el sistema se quedaría callado
// exactamente igual que si todo fuera bien.
//
// Cada 30 minutos. Cuesta unos centavos al mes —los 24 crons del proyecto suman
// ~$1— y es lo único que distingue «tranquilo» de «muerto», que desde fuera se
// ven igual.
//
// Avisa como mucho una vez al día (la clave de la notificación lleva la fecha):
// un motor callado tres días avisando cada media hora convierte la campana en
// ruido, y entonces el dueño deja de mirarla justo cuando hace falta.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { tomar, diagnosticar } from '../../../lib/demanda/latido';
import { notificar } from '../../../lib/crm/notificaciones';
import '../../../lib/demanda/registro';

export const prerender = false;
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  try {
    const l = await tomar();
    const pistas = l.vivo ? [] : await diagnosticar(l);

    if (!l.vivo) {
      await notificar({
        clave: `de_latido:${new Date().toISOString().slice(0, 10)}`,
        tipo: 'demanda_latido', nivel: 'alerta',
        titulo: 'El motor de demanda no está latiendo bien',
        detalle: [...l.problemas, ...pistas].join(' · ').slice(0, 900),
        destino: 'de-sistema',
      });
    }

    // 200 aunque no esté vivo: el cron SÍ funcionó, y devolver 500 haría que
    // Vercel lo marque como fallido y confunda «el vigilante se cayó» con «lo
    // que vigila está mal», que es justo la distinción que este endpoint existe
    // para hacer.
    return json({ ok: true, ...l, pistas });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
};
