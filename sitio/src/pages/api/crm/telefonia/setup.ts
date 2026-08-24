// TELEFONÍA · Estado de configuración para la sección de Configuración.
import type { APIRoute } from 'astro';
import { telefoniaConfigurada, telefoniaFaltantes, NUMERO, twilioRest, TWIML_APP_SID } from '../../../../lib/telefonia/twilio';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async () => {
  const configurada = telefoniaConfigurada();
  let saldo: string | null = null, webhook_ok: boolean | null = null;
  if (configurada) {
    try { const b = await twilioRest('/Balance.json'); saldo = `${Number(b.balance).toFixed(2)} ${b.currency}`; } catch { /* sin permiso de saldo */ }
    try {
      const apps = await twilioRest(`/Applications/${TWIML_APP_SID}.json`);
      webhook_ok = /sacscloud\.com\/api\/telefonia\/voz/.test(apps?.voice_url || '');
    } catch { webhook_ok = null; }
  }
  return json({ configurada, faltantes: telefoniaFaltantes(), numero: NUMERO || null, saldo, webhook_ok });
};
