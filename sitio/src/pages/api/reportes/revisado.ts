// «Revisado» por renglón, desde la liga pública del reporte.
//
// Solo en Trabajo en curso y Reporte de entregas (dueño, 27-sep-2026): son los
// documentos que se leen punto por punto. El ejecutivo se firma entero.
//
// Sin sesión, igual que la reacción: la liga es del cliente. Por eso se valida
// todo contra el propio reporte —la llave tiene que ser de un renglón que
// exista en SU foto— y una vez firmado ya no se mueve nada: lo que firmó es lo
// que había revisado.
//
// Se guarda como EVENTO en `activities` (1-oct-2026, ver reporte-revision.ts):
// así queda CUÁNDO se revisó cada punto, que es lo que el dueño quiere ver por
// dentro, y no depende de columnas nuevas en `reportes_trabajo`.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { CON_REVISADO } from '../../../lib/crm/reporte-firma';
import { EV, leerRevision, registrar, renglonDe } from '../../../lib/crm/reporte-revision';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
/* La llave del renglón. En entregas, su posición en la foto (la foto no
   cambia, así que la posición tampoco); en curso, el folio de la orden. */
const LLAVE = /^(e:\d{1,4}|c:[A-Za-z0-9-]{1,40})$/;

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.reporte_id || '');
  const llave = String(b?.llave || '');
  const si = b?.revisado !== false;
  if (!UUID.test(id) || !LLAVE.test(llave)) return json({ ok: false, error: 'Petición inválida.' }, 400);

  const { data: rep } = await supabase.from('reportes_trabajo')
    .select('id, tipo, folio, company_id, hechos').eq('id', id).maybeSingle();
  if (!rep) return json({ ok: false, error: 'Ese reporte ya no existe.' }, 404);
  if (!CON_REVISADO.includes(rep.tipo)) return json({ ok: false, error: 'Este documento no se revisa por punto.' }, 400);

  const titulo = renglonDe(rep, llave);
  if (!titulo) return json({ ok: false, error: 'Ese punto no está en este reporte.' }, 400);

  const rv = await leerRevision(id);
  if (rv.firma) return json({ ok: false, error: 'Este reporte ya está firmado: ya no se puede cambiar.' }, 409);
  // Sin cambio, sin evento: dos clics seguidos no llenan la bitácora de ruido.
  if (!!rv.revisados[llave] === si) return json({ ok: true, revisados: Object.keys(rv.revisados).length });

  const { error } = await registrar({
    tipo: EV.revisado, reporteId: id, companyId: rep.company_id || null,
    titulo: `${si ? 'Revisó' : 'Desmarcó'} «${titulo}» · ${rep.folio}`,
    metadata: { llave, revisado: si, titulo, folio: rep.folio },
  });
  if (error) return json({ ok: false, error: 'No se pudo guardar.' }, 503);
  return json({ ok: true, revisados: Object.keys(rv.revisados).length + (si ? 1 : -1) });
};
