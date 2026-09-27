// «Revisado» por renglón, desde la liga pública del reporte.
//
// Solo en Trabajo en curso y Reporte de entregas (dueño, 27-sep-2026): son los
// documentos que se leen punto por punto. El ejecutivo se firma entero.
//
// Sin sesión, igual que la reacción: la liga es del cliente. Por eso se valida
// todo contra el propio reporte —la llave tiene que ser de un renglón que
// exista en SU foto— y una vez firmado ya no se mueve nada: lo que firmó es lo
// que había revisado.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { CON_REVISADO, llaveEntrega, llaveTrabajo } from '../../../lib/crm/reporte-firma';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
/* La llave del renglón. En entregas, su posición en la foto (la foto no
   cambia, así que la posición tampoco); en curso, el folio de la orden. */
const LLAVE = /^(e:\d{1,4}|c:[A-Za-z0-9-]{1,40})$/;

/** ¿Falla porque la columna todavía no existe? El código puede llegar antes que el SQL. */
const faltaSql = (m?: string) => /revisados|firmado_at|firma/i.test(String(m || '')) && /column|does not exist|schema cache/i.test(String(m || ''));

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.reporte_id || '');
  const llave = String(b?.llave || '');
  const si = b?.revisado !== false;
  if (!UUID.test(id) || !LLAVE.test(llave)) return json({ ok: false, error: 'Petición inválida.' }, 400);

  const { data: rep, error } = await supabase.from('reportes_trabajo')
    .select('id, tipo, hechos, revisados, firmado_at').eq('id', id).maybeSingle();
  if (error) return json({ ok: false, error: faltaSql(error.message) ? 'Todavía no se puede marcar: falta activarlo en el sistema.' : 'No se pudo guardar.' }, 503);
  if (!rep) return json({ ok: false, error: 'Ese reporte ya no existe.' }, 404);
  if (!CON_REVISADO.includes(rep.tipo)) return json({ ok: false, error: 'Este documento no se revisa por punto.' }, 400);
  if (rep.firmado_at) return json({ ok: false, error: 'Este reporte ya está firmado: ya no se puede cambiar.' }, 409);

  // La llave tiene que ser de un renglón de ESTE reporte.
  const h = rep.hechos || {};
  const existe = rep.tipo === 'entregas'
    ? (h.entregas || []).some((_: any, i: number) => llaveEntrega(i) === llave)
    : (h.trabajos || []).some((t: any, i: number) => llaveTrabajo(t, i) === llave);
  if (!existe) return json({ ok: false, error: 'Ese punto no está en este reporte.' }, 400);

  const rev: Record<string, string> = { ...(rep.revisados || {}) };
  if (si) rev[llave] = new Date().toISOString(); else delete rev[llave];

  // Condicionado a que siga SIN firmar: si firmó entre la lectura y esto, no se toca.
  const { data: ok, error: eU } = await supabase.from('reportes_trabajo')
    .update({ revisados: rev }).eq('id', id).is('firmado_at', null).select('id');
  if (eU) return json({ ok: false, error: faltaSql(eU.message) ? 'Todavía no se puede marcar: falta activarlo en el sistema.' : 'No se pudo guardar.' }, 503);
  if (!ok?.length) return json({ ok: false, error: 'Este reporte ya está firmado: ya no se puede cambiar.' }, 409);
  return json({ ok: true, revisados: Object.keys(rev).length });
};
