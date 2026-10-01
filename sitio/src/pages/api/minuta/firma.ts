// La FIRMA del cliente en la minuta, desde su liga pública (1-oct-2026).
//
// Igual que la de los reportes: nombre, trazo y la frase que aceptó, con
// fecha, IP y navegador. Se firma una vez; después la minuta queda cerrada.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { LEYENDA_FIRMA } from '../../../lib/crm/reporte-firma';
import { folioMinuta } from '../../../lib/crm/marca';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const TRAZO_MAX = 400_000;
const faltaSql = (m?: string) => /minuta_(revisados|firma|firmado_at)/i.test(String(m || '')) && /column|does not exist|schema cache/i.test(String(m || ''));

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

  const { data: bk, error } = await supabase.from('bookings')
    .select('id, fecha, company_id, invitee_nombre, invitee_empresa, minuta_firmado_at').eq('id', id).maybeSingle();
  if (error) return json({ ok: false, error: faltaSql(error.message) ? 'Todavía no se puede firmar: falta activarlo en el sistema.' : 'No se pudo guardar la firma.' }, 503);
  if (!bk) return json({ ok: false, error: 'Esa minuta ya no existe.' }, 404);
  if (bk.minuta_firmado_at) return json({ ok: false, error: 'Esta minuta ya está firmada.' }, 409);

  const ley = LEYENDA_FIRMA.minuta;
  const at = new Date().toISOString();
  const firma = {
    nombre, leyenda: ley.frase, trazo, at,
    ip: (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
    ua: (request.headers.get('user-agent') || '').slice(0, 300) || null,
  };
  const { data: ok, error: eU } = await supabase.from('bookings')
    .update({ minuta_firma: firma, minuta_firmado_at: at }).eq('id', id).is('minuta_firmado_at', null).select('id');
  if (eU) return json({ ok: false, error: faltaSql(eU.message) ? 'Todavía no se puede firmar: falta activarlo en el sistema.' : 'No se pudo guardar la firma.' }, 503);
  if (!ok?.length) return json({ ok: false, error: 'Esta minuta ya está firmada.' }, 409);

  const folio = folioMinuta(bk.id, bk.fecha);
  const cliente = bk.invitee_empresa || bk.invitee_nombre || 'El cliente';
  if (bk.company_id) {
    await supabase.from('activities').insert({
      company_id: bk.company_id, tipo: 'minuta_firma',
      titulo: `Minuta ${folio} firmada por ${nombre}`, automatico: true,
    }).then(() => {}, () => {});
  }
  await notificar({
    clave: 'minuta_firma:' + id, tipo: 'minuta_firma', nivel: 'info', destino: 'consultoria',
    company_id: bk.company_id || null,
    titulo: `${cliente} firmó la minuta · ${folio}`,
    detalle: `${nombre}: «${ley.frase}»`,
  });
  return json({ ok: true, firma: { nombre, leyenda: ley.frase, at } });
};
