// La FIRMA del cliente, desde la liga pública del reporte.
//
// Una firma electrónica simple: su nombre, su trazo y la frase que aceptó, con
// fecha, IP y navegador —y, si quiso, un comentario final—. No cambia lo que
// dice el reporte (la foto en `hechos`), lo acusa.
//
// Se guarda como EVENTO de la revisión en `activities` (1-oct-2026, ver
// reporte-revision.ts): queda en la Actividad de la cuenta con su hora y no
// depende de columnas nuevas. Se firma una vez; después el documento queda
// cerrado —ni otra firma, ni más «revisado», ni comentarios—.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { leyendaDe } from '../../../lib/crm/reporte-firma';
import { EV, leerRevision, registrar } from '../../../lib/crm/reporte-revision';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
// Un trazo de firma en PNG pesa 5–40 KB; 400 KB es holgura, no un límite que se toque.
const TRAZO_MAX = 400_000;

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.reporte_id || '');
  const nombre = String(b?.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const trazo = String(b?.trazo || '');
  const comentario = String(b?.comentario || '').trim().slice(0, 1000) || null;
  if (!UUID.test(id)) return json({ ok: false, error: 'Petición inválida.' }, 400);
  if (nombre.length < 3) return json({ ok: false, error: 'Escribe tu nombre completo.' }, 400);
  if (b?.acepto !== true) return json({ ok: false, error: 'Marca la casilla para confirmar.' }, 400);
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(trazo) || trazo.length > TRAZO_MAX) {
    return json({ ok: false, error: 'Dibuja tu firma en el recuadro.' }, 400);
  }

  const { data: rep } = await supabase.from('reportes_trabajo')
    .select('id, tipo, folio, company_id, hechos').eq('id', id).maybeSingle();
  if (!rep) return json({ ok: false, error: 'Ese reporte ya no existe.' }, 404);
  const ley = leyendaDe(rep);
  if (!ley) return json({ ok: false, error: 'Este documento no se firma.' }, 400);

  const rv = await leerRevision(id);
  if (rv.firma) return json({ ok: false, error: 'Este reporte ya está firmado.' }, 409);

  const at = new Date().toISOString();
  const firma = {
    nombre, leyenda: ley.frase, trazo, at, comentario,
    revisados: Object.keys(rv.revisados).length,
    ip: (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
    ua: (request.headers.get('user-agent') || '').slice(0, 300) || null,
  };
  const { error } = await registrar({
    tipo: EV.firma, reporteId: id, companyId: rep.company_id || null,
    titulo: `Reporte ${rep.folio} firmado por ${nombre}`,
    metadata: { firma, folio: rep.folio },
  });
  if (error) return json({ ok: false, error: 'No se pudo guardar la firma.' }, 503);

  // Dos pestañas firmando a la vez: la PRIMERA firma es la que vale (armar()
  // se queda con la primera), así que la segunda no cambia nada.
  const cliente = rep.hechos?.cliente || 'El cliente';
  await notificar({
    clave: 'reporte_firma:' + id, tipo: 'reporte_firma', nivel: 'info', destino: 'consultoria',
    company_id: rep.company_id || null,
    titulo: `${cliente} firmó ${ley.titulo.toLowerCase()} · ${rep.folio}`,
    detalle: `${nombre}: «${ley.frase}»${comentario ? ` · Comentario: ${comentario.slice(0, 200)}` : ''}`,
  });
  return json({ ok: true, firma: { nombre, leyenda: ley.frase, at, comentario } });
};
