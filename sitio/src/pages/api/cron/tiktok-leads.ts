// GET /api/cron/tiktok-leads — los leads de TikTok Ads entran SOLOS.
//
// La cadena completa:
//   TikTok Ads (formulario instantáneo)
//     → Zapier / Make escribe una fila en una hoja de Google
//     → este cron la lee cada 15 min y crea el contacto en el CRM
//     → escribe de vuelta el resultado en la columna "CRM" de la hoja.
//
// Por qué una hoja de por medio y no un webhook directo: la hoja es un registro
// visible y auditable que sobrevive a una caída de este endpoint. Si el cron
// falla tres horas, los leads siguen ahí y entran en la siguiente corrida —
// con un webhook a secas, esos leads se habrían perdido sin que nadie lo note.
//
// La marca en la hoja es CONVENIENCIA, no el candado: el anti-duplicado real
// vive en el CRM (lead_id + índice único uq_contacts_tiktok_lead). Si la cuenta
// de servicio solo tiene permiso de lectura, el cron avisa y sigue funcionando.
//
// Configuración (variables de entorno):
//   TIKTOK_LEADS_SHEET_ID     id de la hoja (el trozo largo de su URL)
//   TIKTOK_LEADS_SHEET_RANGE  opcional; por omisión la primera pestaña, A:Z
//   GOOGLE_SERVICE_ACCOUNT_B64  ya existía en el proyecto
// La hoja debe estar COMPARTIDA (como editor) con el correo de la cuenta de
// servicio. Sin eso Google responde 403 y no entra ni un lead.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { leerRango, escribirCeldas, primeraPestana, letraColumna, correoDeServicio } from '../../../lib/google-sheets';
import { mapearLead, normalizarLlave } from '../../../lib/crm/tiktok-leads';
import { importarLeadsTikTok } from '../../../lib/crm/importar-tiktok';

export const prerender = false;

const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

/** Encabezados que marcan la fila como ya procesada. */
const COL_ESTADO = ['crm', 'estado_crm', 'importado', 'estado'];

export const GET: APIRoute = async ({ url, request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);

  // ?dry=1 corre el cruce sin escribir nada — la forma de probar en producción
  // sin ensuciar el CRM ni la hoja.
  const dry_run = url.searchParams.get('dry') === '1';

  const sheetId = (import.meta.env.TIKTOK_LEADS_SHEET_ID || '').trim();
  if (!sheetId) {
    return json({
      error: 'Falta TIKTOK_LEADS_SHEET_ID en el entorno.',
      pista: 'Es el trozo largo de la URL de la hoja: docs.google.com/spreadsheets/d/<ESTO>/edit',
      comparte_la_hoja_con: correoDeServicio(),
    }, 500);
  }

  let pestana = (import.meta.env.TIKTOK_LEADS_SHEET_RANGE || '').trim();
  try {
    if (!pestana) {
      const p = await primeraPestana(sheetId);
      pestana = p ? `${p}!A:Z` : 'A:Z';
    }
  } catch (e: any) {
    return json({
      error: 'No se pudo abrir la hoja.',
      detalle: e?.message || String(e),
      comparte_la_hoja_con: correoDeServicio(),
    }, 500);
  }

  let filas: string[][];
  try { filas = await leerRango(sheetId, pestana); }
  catch (e: any) {
    return json({ error: 'No se pudo leer la hoja.', detalle: e?.message || String(e), comparte_la_hoja_con: correoDeServicio() }, 500);
  }

  if (filas.length < 2) return json({ ok: true, mensaje: 'La hoja no tiene filas de datos todavía.', filas: filas.length });

  const encabezados = filas[0].map(h => String(h || '').trim());
  // La columna de estado: la que ya exista, o una nueva al final. Se agrega al
  // FINAL a propósito — insertarla en medio correría las columnas que Zapier
  // escribe por posición y el siguiente lead entraría descuadrado.
  let iEstado = encabezados.findIndex(h => COL_ESTADO.includes(normalizarLlave(h)));
  const estadoNueva = iEstado < 0;
  if (estadoNueva) iEstado = encabezados.length;

  const nombrePestana = pestana.split('!')[0];
  const colEstado = letraColumna(iEstado);

  // ── Filas pendientes ────────────────────────────────────────────────────
  const pendientes: any[] = [];
  let yaMarcadas = 0, sinContacto = 0, pruebas = 0;
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    if (!f.some(c => String(c || '').trim())) continue;          // fila vacía
    if (String(f[iEstado] || '').trim()) { yaMarcadas++; continue; }

    const obj: Record<string, string> = {};
    encabezados.forEach((h, j) => { obj[h] = f[j] ?? ''; });
    const lead: any = mapearLead(obj);
    if (!lead.email && !lead.whatsapp) { sinContacto++; continue; }
    // TikTok manda una fila dummy cuando alguien prueba el formulario. No es
    // una persona: si entra, infla el conteo y baja el costo por lead a mentira.
    if (lead.es_prueba) { pruebas++; continue; }
    lead._fila = i + 1;                                          // fila real de la hoja (1-based)
    pendientes.push(lead);
  }

  if (!pendientes.length) {
    return json({ ok: true, mensaje: 'Nada nuevo.', filas_datos: filas.length - 1, ya_marcadas: yaMarcadas, sin_contacto: sinContacto, pruebas });
  }

  const r = await importarLeadsTikTok(pendientes, { dry_run, via: 'hoja' });

  // ── Marca de vuelta en la hoja ──────────────────────────────────────────
  let marcado: any = { intentado: false };
  if (!dry_run) {
    const hoy = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const celdas = r.reporte
      .filter(f => f.fila)
      .map(f => ({
        rango: `${nombrePestana}!${colEstado}${f.fila}`,
        valor: f.accion === 'error' ? `error: ${(f.error || '').slice(0, 120)}` : `${f.accion} · ${hoy}`,
      }));
    if (estadoNueva) celdas.push({ rango: `${nombrePestana}!${colEstado}1`, valor: 'CRM' });
    const w = await escribirCeldas(sheetId, celdas);
    marcado = { intentado: true, ...w };
    if (!w.ok) marcado.aviso = 'La hoja no se pudo marcar (¿la cuenta de servicio es solo lector?). Los leads SÍ entraron; el anti-duplicado del CRM evita que se repitan.';
  }

  return json({
    ok: true, dry_run,
    hoja: { id: sheetId, pestana, columna_estado: colEstado, ya_marcadas: yaMarcadas, sin_contacto: sinContacto, pruebas },
    ...r,
    marcado,
  });
};
