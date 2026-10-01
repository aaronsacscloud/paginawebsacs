// «De acuerdo» por acuerdo, desde la liga pública de la minuta (1-oct-2026).
//
// Mismo trato que el «revisado» de los reportes: sin sesión —la liga es del
// cliente—, la llave tiene que ser de un acuerdo que exista en SU minuta, y una
// vez firmada ya no se mueve nada.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { llaveAcuerdo } from '../../../lib/crm/reporte-firma';
import { vinetas } from '../../../lib/crm/marca';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const LLAVE = /^a:\d{1,3}$/;
const faltaSql = (m?: string) => /minuta_(revisados|firma|firmado_at)/i.test(String(m || '')) && /column|does not exist|schema cache/i.test(String(m || ''));

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.reporte_id || '');
  const llave = String(b?.llave || '');
  const si = b?.revisado !== false;
  if (!UUID.test(id) || !LLAVE.test(llave)) return json({ ok: false, error: 'Petición inválida.' }, 400);

  const { data: bk, error } = await supabase.from('bookings')
    .select('id, minuta, minuta_revisados, minuta_firmado_at').eq('id', id).maybeSingle();
  if (error) return json({ ok: false, error: faltaSql(error.message) ? 'Todavía no se puede marcar: falta activarlo en el sistema.' : 'No se pudo guardar.' }, 503);
  if (!bk) return json({ ok: false, error: 'Esa minuta ya no existe.' }, 404);
  if (bk.minuta_firmado_at) return json({ ok: false, error: 'Esta minuta ya está firmada: ya no se puede cambiar.' }, 409);

  const acuerdos = vinetas((bk.minuta as any)?.acuerdos);
  if (!acuerdos.some((_, i) => llaveAcuerdo(i) === llave)) return json({ ok: false, error: 'Ese acuerdo no está en esta minuta.' }, 400);

  const rev: Record<string, string> = { ...(bk.minuta_revisados || {}) };
  if (si) rev[llave] = new Date().toISOString(); else delete rev[llave];

  const { data: ok, error: eU } = await supabase.from('bookings')
    .update({ minuta_revisados: rev }).eq('id', id).is('minuta_firmado_at', null).select('id');
  if (eU) return json({ ok: false, error: faltaSql(eU.message) ? 'Todavía no se puede marcar: falta activarlo en el sistema.' : 'No se pudo guardar.' }, 503);
  if (!ok?.length) return json({ ok: false, error: 'Esta minuta ya está firmada: ya no se puede cambiar.' }, 409);
  return json({ ok: true, revisados: Object.keys(rev).length });
};
