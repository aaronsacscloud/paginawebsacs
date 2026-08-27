// GET /api/cron/tiktok-estatus-hoja — escribe el estatus del lead en la hoja
// que TikTok lee.
//
// La cuenta tiene la integración "Signal postback" de TikTok apuntando a estos
// Google Sheets: TikTok los relee cada ~10 minutos y toma de ahí en qué etapa
// va cada lead. Es la vía que la cuenta YA tiene conectada — no necesita el
// permiso de la API sobre el dataset, que es el que falta.
//
// Y según la documentación de TikTok basta con "Lead Id, Email, Phone o Click
// Id" para identificar al lead: por eso esta vía alcanza también a los que
// entraron sin lead_id, que son la mayoría de los históricos.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { leerRango, escribirCeldas, primeraPestana, letraColumna } from '../../../lib/google-sheets';
import { ETAPAS_A_TIKTOK } from '../../../lib/crm/tiktok-crm-events';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

const COL_ESTATUS = 'TikTok Lead Status';
const COL_ETAPA = 'ETAPA DE CICLO DE VIDA';
const norm = (s: string) => String(s || '').trim().toLowerCase();

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);

  const sheetId = String(import.meta.env.TIKTOK_LEADS_SHEET_ID || '').trim();
  if (!sheetId) return json({ ok: false, msg: 'Falta TIKTOK_LEADS_SHEET_ID' });

  const pestana = await primeraPestana(sheetId);
  const filas = await leerRango(sheetId, `${pestana}!A:Z`);
  if (!filas?.length) return json({ ok: false, msg: 'La hoja está vacía.' });

  const enc = filas[0].map((x: any) => String(x || '').trim());
  const iMail = enc.findIndex(h => /^correo/i.test(h));
  let iEstatus = enc.findIndex(h => norm(h) === norm(COL_ESTATUS));
  let iEtapa = enc.findIndex(h => norm(h) === norm(COL_ETAPA));
  if (iMail < 0) return json({ ok: false, msg: 'No encuentro la columna CORREO en la hoja.' });
  // Las columnas se crean si no existen: la hoja es de TikTok y alguien pudo
  // renombrarlas. Se agregan al final para no recorrer las que ya lee TikTok.
  if (iEstatus < 0) { iEstatus = enc.length; enc.push(COL_ESTATUS); }
  if (iEtapa < 0) { iEtapa = enc.length; enc.push(COL_ETAPA); }

  // Las etapas de todos los correos de la hoja, de una sola consulta.
  const correos = filas.slice(1).map((f: any[]) => norm(f[iMail])).filter(Boolean);
  const etapas = new Map<string, string>();
  for (let i = 0; i < correos.length; i += 300) {
    const { data } = await supabase.from('contacts')
      .select('email, lifecycle_stage').in('email', correos.slice(i, i + 300));
    for (const c of data || []) if (c.email) etapas.set(norm(c.email), c.lifecycle_stage || '');
  }

  const celdas: { rango: string; valor: string }[] = [];
  const av = { filas: filas.length - 1, escritas: 0, sinCambio: 0, sinContacto: 0, sinEtapaUtil: 0 };

  for (let n = 1; n < filas.length; n++) {
    const f = filas[n] || [];
    const mail = norm(f[iMail]);
    if (!mail) continue;
    const etapa = etapas.get(mail);
    if (etapa === undefined) { av.sinContacto++; continue; }

    // Solo se reportan las etapas que enseñan algo. "lead" es el estado en que
    // TikTok ya lo entregó: escribirlo no le dice nada nuevo y ensucia la señal.
    const estatus = ETAPAS_A_TIKTOK[etapa];
    if (!estatus) { av.sinEtapaUtil++; continue; }

    // Idempotente: si la celda ya dice lo mismo no se toca. Sin esto, cada
    // corrida reescribiría las 83 filas y TikTok volvería a procesarlas.
    if (String(f[iEstatus] || '').trim() === estatus &&
        String(f[iEtapa] || '').trim() === etapa) { av.sinCambio++; continue; }

    celdas.push({ rango: `${pestana}!${letraColumna(iEstatus)}${n + 1}`, valor: estatus });
    celdas.push({ rango: `${pestana}!${letraColumna(iEtapa)}${n + 1}`, valor: etapa });
    av.escritas++;
  }

  // Los encabezados, por si hubo que crear alguna columna.
  celdas.push({ rango: `${pestana}!${letraColumna(iEstatus)}1`, valor: COL_ESTATUS });
  celdas.push({ rango: `${pestana}!${letraColumna(iEtapa)}1`, valor: COL_ETAPA });

  const r = celdas.length ? await escribirCeldas(sheetId, celdas) : { ok: true };
  return json({ ok: r.ok, error: (r as any).error, ...av, columna_estatus: letraColumna(iEstatus) });
};
