// POST /api/crm/leads/tiktok-import — pegado MANUAL de un CSV de TikTok.
//
// La vía normal es automática (la hoja de Google + el cron
// /api/cron/tiktok-leads). Esto queda para dos casos que la automatización no
// cubre: el HISTÓRICO de leads que ya estaban en TikTok antes de conectarla, y
// el día que la hoja falle y haya que meter algo a mano sin esperar.
//
// Body JSON: { csv: string, dry_run?: boolean }
//   dry_run = true es el DEFAULT. Primero se ve el cruce, luego se escribe: un
//   CSV con los encabezados en otro idioma puede mapear el teléfono al campo
//   equivocado, y eso en dry_run se ve antes de ensuciar el CRM.
import type { APIRoute } from 'astro';
import { leadsDesdeCSV } from '../../../../lib/crm/tiktok-leads';
import { importarLeadsTikTok } from '../../../../lib/crm/importar-tiktok';

export const prerender = false;

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const csv = String(body?.csv || '').trim();
  if (!csv) return json({ error: 'Falta el CSV. Descárgalo en TikTok Ads Manager → Herramientas → Formularios instantáneos → Descargar clientes potenciales.' }, 400);

  const { leads, encabezados, descartadas, pruebas } = leadsDesdeCSV(csv);
  if (!leads.length) {
    return json({
      error: 'No se reconoció ningún lead con correo o teléfono.',
      encabezados_leidos: encabezados,
      filas_descartadas: descartadas,
    }, 400);
  }

  const dry_run = body?.dry_run !== false;
  const r = await importarLeadsTikTok(leads, { dry_run, via: 'csv' });

  return json({
    ok: true, dry_run,
    filas_descartadas: descartadas,
    pruebas_descartadas: pruebas,
    encabezados_leidos: encabezados,
    ...r,
  });
};
