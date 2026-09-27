// La FIRMA del cliente, desde la liga pública del reporte.
//
// Una firma electrónica simple: su nombre, su trazo y la frase que aceptó, con
// fecha, IP y navegador. Se guarda APARTE de la foto del documento (`hechos`):
// la firma no cambia lo que dice el reporte, lo acusa.
//
// Se firma una vez. Después el documento queda cerrado —ni otra firma ni más
// «revisado»—, porque lo que el cliente firmó tiene que seguir siendo lo que
// se ve.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { LEYENDA_FIRMA } from '../../../lib/crm/reporte-firma';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
// Un trazo de firma en PNG pesa 5–40 KB; 400 KB es holgura, no un límite que se toque.
const TRAZO_MAX = 400_000;
const faltaSql = (m?: string) => /revisados|firmado_at|firma/i.test(String(m || '')) && /column|does not exist|schema cache/i.test(String(m || ''));

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.reporte_id || '');
  const nombre = String(b?.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const trazo = String(b?.trazo || '');
  if (!UUID.test(id)) return json({ ok: false, error: 'Petición inválida.' }, 400);
  if (nombre.length < 3) return json({ ok: false, error: 'Escribe tu nombre completo.' }, 400);
  if (b?.acepto !== true) return json({ ok: false, error: 'Marca la casilla para confirmar.' }, 400);
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(trazo) || trazo.length > TRAZO_MAX) {
    return json({ ok: false, error: 'Dibuja tu firma en el recuadro.' }, 400);
  }

  const { data: rep, error } = await supabase.from('reportes_trabajo')
    .select('id, tipo, folio, company_id, firmado_at, hechos').eq('id', id).maybeSingle();
  if (error) return json({ ok: false, error: faltaSql(error.message) ? 'Todavía no se puede firmar: falta activarlo en el sistema.' : 'No se pudo guardar la firma.' }, 503);
  if (!rep) return json({ ok: false, error: 'Ese reporte ya no existe.' }, 404);
  const ley = LEYENDA_FIRMA[rep.tipo];
  if (!ley) return json({ ok: false, error: 'Este documento no se firma.' }, 400);
  if (rep.firmado_at) return json({ ok: false, error: 'Este reporte ya está firmado.' }, 409);

  const at = new Date().toISOString();
  const firma = {
    nombre,
    leyenda: ley.frase,
    trazo,
    at,
    ip: (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
    ua: (request.headers.get('user-agent') || '').slice(0, 300) || null,
  };
  // Solo si sigue sin firmar: dos pestañas firmando a la vez dejan UNA firma.
  const { data: ok, error: eU } = await supabase.from('reportes_trabajo')
    .update({ firma, firmado_at: at }).eq('id', id).is('firmado_at', null).select('id');
  if (eU) return json({ ok: false, error: faltaSql(eU.message) ? 'Todavía no se puede firmar: falta activarlo en el sistema.' : 'No se pudo guardar la firma.' }, 503);
  if (!ok?.length) return json({ ok: false, error: 'Este reporte ya está firmado.' }, 409);

  // Que el consultor se entere sin ir a buscarlo: en el timeline y en la campana.
  const cliente = rep.hechos?.cliente || 'El cliente';
  if (rep.company_id) {
    await supabase.from('activities').insert({
      company_id: rep.company_id, tipo: 'reporte_firma',
      titulo: `Reporte ${rep.folio} firmado por ${nombre}`, automatico: true,
    }).then(() => {}, () => {});
  }
  await notificar({
    clave: 'reporte_firma:' + id, tipo: 'reporte_firma', nivel: 'info', destino: 'consultoria',
    company_id: rep.company_id || null,
    titulo: `${cliente} firmó ${ley.titulo.toLowerCase()} · ${rep.folio}`,
    detalle: `${nombre}: «${ley.frase}»`,
  });
  return json({ ok: true, firma: { nombre, leyenda: ley.frase, at } });
};
