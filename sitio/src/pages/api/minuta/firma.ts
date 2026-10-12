// La FIRMA y AUTORIZACIÓN del cliente en una minuta de CONSULTORÍA (12-oct-2026).
// Nombre, trazo, la frase que aceptó, fecha, IP y navegador. Una sola vez:
// después la minuta queda cerrada. Se guarda en la bitácora de `activities`.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { folioMinuta } from '../../../lib/crm/marca';
import { esConsultoria } from '../../../lib/crm/reuniones';
import { EVM, LEYENDA_MINUTA, leerRevisionMinuta, registrarMinuta } from '../../../lib/crm/minuta-revision';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
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
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(trazo) || trazo.length > TRAZO_MAX) return json({ ok: false, error: 'Dibuja tu firma en el recuadro.' }, 400);

  const { data: bk } = await supabase.from('bookings')
    .select('id, fecha, company_id, invitee_nombre, invitee_empresa, minuta, event_types(categoria)').eq('id', id).maybeSingle();
  if (!bk) return json({ ok: false, error: 'Esa minuta ya no existe.' }, 404);
  if (!esConsultoria((bk as any).event_types?.categoria) || (bk.minuta as any)?.firma === false) return json({ ok: false, error: 'Esta minuta no se firma.' }, 400);

  const rv = await leerRevisionMinuta(id);
  if (rv.firma) return json({ ok: false, error: 'Esta minuta ya está firmada.' }, 409);

  const at = new Date().toISOString();
  const firma = {
    nombre, leyenda: LEYENDA_MINUTA.frase, trazo, at, comentario,
    ip: (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
    ua: (request.headers.get('user-agent') || '').slice(0, 300) || null,
  };
  const folio = folioMinuta(bk.id, bk.fecha);
  const { error } = await registrarMinuta({ tipo: EVM.firma, bookingId: id, companyId: bk.company_id || null, titulo: `Minuta ${folio} firmada y autorizada por ${nombre}`, metadata: { firma, folio } });
  if (error) return json({ ok: false, error: 'No se pudo guardar la firma.' }, 503);

  const cliente = bk.invitee_empresa || bk.invitee_nombre || 'El cliente';
  await notificar({
    clave: 'minuta_firma:' + id, tipo: 'minuta_firma', nivel: 'info', destino: 'consultoria', company_id: bk.company_id || null,
    titulo: `${cliente} firmó y autorizó la minuta · ${folio}`,
    detalle: `${nombre}: «${LEYENDA_MINUTA.frase}»${comentario ? ` · ${comentario.slice(0, 200)}` : ''}`,
  });
  return json({ ok: true, firma: { nombre, leyenda: LEYENDA_MINUTA.frase, at, comentario } });
};
