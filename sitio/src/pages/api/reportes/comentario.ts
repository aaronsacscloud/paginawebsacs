// COMENTARIO del cliente sobre un punto del reporte —o sobre el reporte
// entero (llave «general»)—, desde la liga pública (dueño, 1-oct-2026).
//
// Un comentario es justo lo que el consultor tiene que leer HOY: se guarda en
// la bitácora de la revisión (activities) y además avisa por la campana.
// Firmado el reporte ya no se comenta por aquí: la firma trae su propio
// comentario final.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { CON_REVISADO } from '../../../lib/crm/reporte-firma';
import { EV, leerRevision, registrar, renglonDe } from '../../../lib/crm/reporte-revision';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const LLAVE = /^(general|e:\d{1,4}|c:[A-Za-z0-9-]{1,40})$/;
const MAX = 1000;

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.reporte_id || '');
  const llave = String(b?.llave || '');
  const texto = String(b?.texto || '').replace(/\s+\n/g, '\n').trim().slice(0, MAX);
  if (!UUID.test(id) || !LLAVE.test(llave)) return json({ ok: false, error: 'Petición inválida.' }, 400);
  if (texto.length < 2) return json({ ok: false, error: 'Escribe tu comentario.' }, 400);

  const { data: rep } = await supabase.from('reportes_trabajo')
    .select('id, tipo, folio, company_id, hechos').eq('id', id).maybeSingle();
  if (!rep) return json({ ok: false, error: 'Ese reporte ya no existe.' }, 404);
  if (!CON_REVISADO.includes(rep.tipo)) return json({ ok: false, error: 'Este documento no recibe comentarios.' }, 400);

  const titulo = llave === 'general' ? 'el reporte' : renglonDe(rep, llave);
  if (!titulo) return json({ ok: false, error: 'Ese punto no está en este reporte.' }, 400);

  const rv = await leerRevision(id);
  if (rv.firma) return json({ ok: false, error: 'Este reporte ya está firmado. Contéstanos el correo si quieres agregar algo.' }, 409);
  // Un mismo comentario dos veces (doble clic, red lenta) no se duplica.
  if ((rv.comentarios[llave] || []).some(c => c.texto === texto)) return json({ ok: true, comentario: { texto, at: new Date().toISOString() } });

  const at = new Date().toISOString();
  const { error } = await registrar({
    tipo: EV.comentario, reporteId: id, companyId: rep.company_id || null,
    titulo: `Comentó ${llave === 'general' ? 'el reporte' : `«${titulo}»`} · ${rep.folio}`,
    metadata: { llave, texto, titulo, folio: rep.folio },
  });
  if (error) return json({ ok: false, error: 'No se pudo guardar el comentario.' }, 503);

  await notificar({
    clave: `reporte_comentario:${id}:${llave}:${at}`, tipo: 'reporte_comentario', nivel: 'alerta', destino: 'consultoria',
    company_id: rep.company_id || null,
    titulo: `${rep.hechos?.cliente || 'El cliente'} comentó ${llave === 'general' ? 'su reporte' : `«${titulo}»`} · ${rep.folio}`,
    detalle: texto.slice(0, 280),
  });
  return json({ ok: true, comentario: { texto, at } });
};
