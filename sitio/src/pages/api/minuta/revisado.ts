// «De acuerdo» por acuerdo, desde la liga pública de una minuta de
// CONSULTORÍA. Sin sesión —la liga es del cliente—: la llave tiene que ser de
// un acuerdo que exista en SU minuta, y firmada ya no se mueve nada.
// Se guarda en la bitácora de `activities` (ver minuta-revision.ts).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { llaveAcuerdo } from '../../../lib/crm/reporte-firma';
import { vinetas } from '../../../lib/crm/marca';
import { esConsultoria } from '../../../lib/crm/reuniones';
import { EVM, leerRevisionMinuta, registrarMinuta } from '../../../lib/crm/minuta-revision';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const LLAVE = /^a:\d{1,3}$/;

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.reporte_id || '');
  const llave = String(b?.llave || '');
  const si = b?.revisado !== false;
  if (!UUID.test(id) || !LLAVE.test(llave)) return json({ ok: false, error: 'Petición inválida.' }, 400);

  const { data: bk } = await supabase.from('bookings')
    .select('id, company_id, minuta, event_types(categoria)').eq('id', id).maybeSingle();
  if (!bk) return json({ ok: false, error: 'Esa minuta ya no existe.' }, 404);
  if (!esConsultoria((bk as any).event_types?.categoria) || (bk.minuta as any)?.firma === false) return json({ ok: false, error: 'Esta minuta no se firma.' }, 400);
  const acuerdos = vinetas((bk.minuta as any)?.acuerdos);
  const i = acuerdos.findIndex((_, k) => llaveAcuerdo(k) === llave);
  if (i < 0) return json({ ok: false, error: 'Ese acuerdo no está en esta minuta.' }, 400);

  const rv = await leerRevisionMinuta(id);
  if (rv.firma) return json({ ok: false, error: 'Esta minuta ya está firmada: ya no se puede cambiar.' }, 409);
  if (!!rv.revisados[llave] === si) return json({ ok: true, revisados: Object.keys(rv.revisados).length });

  const { error } = await registrarMinuta({
    tipo: EVM.revisado, bookingId: id, companyId: bk.company_id || null,
    titulo: `${si ? 'De acuerdo con' : 'Quitó su acuerdo de'} «${acuerdos[i].slice(0, 80)}» · minuta`,
    metadata: { llave, revisado: si, titulo: acuerdos[i].slice(0, 140) },
  });
  if (error) return json({ ok: false, error: 'No se pudo guardar.' }, 503);
  return json({ ok: true, revisados: Object.keys(rv.revisados).length + (si ? 1 : -1) });
};
