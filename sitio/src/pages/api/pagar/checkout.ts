// OUTBOUND · Checkout de una oferta in-app (PÚBLICO — lo llama la página embed
// dentro del modal de SACS3, sin cookie). Todo lo sensible (la oferta y su
// precio) se re-calcula server-side desde la BD confiable: del cliente solo
// llegan cuenta + campana (ids), jamás el monto. Crea la preferencia REAL de
// Mercado Pago; el webhook registra el cobro por external_reference.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { crearPreferenciaOferta } from '../../../lib/outbound/venta';
import { normCuenta } from '../../../lib/crm/sacs-cuentas';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Resuelve la campaña + su oferta + la empresa, todo desde la BD (confiable). */
export async function resolverOferta(campana: string, cuenta: string) {
  if (!/^[0-9a-f-]{36}$/i.test(campana)) throw new Error('Campaña inválida');
  const { data: c } = await supabase.from('inapp_campanas')
    .select('id, estado, contenido').eq('id', campana).maybeSingle();
  if (!c || c.estado === 'archivada') throw new Error('Campaña no disponible');
  const oferta = c.contenido?.oferta;
  if (!oferta || (!oferta.plan_slug && !(oferta.monto_base > 0))) throw new Error('Esta campaña no tiene una oferta con precio');

  const cu = normCuenta(cuenta);
  const { data: csa } = await supabase.from('company_sacs_accounts').select('company_id').eq('cuenta', cu).maybeSingle();
  let companyId = csa?.company_id || null;
  if (!companyId) {
    const { data: co } = await supabase.from('companies').select('id').eq('sacs_account', cu).maybeSingle();
    companyId = co?.id || null;
  }
  if (!companyId) throw new Error('No encontramos tu cuenta en el CRM');
  return { companyId, oferta, concepto: oferta.concepto || c.contenido?.titulo || 'Compra SACS' };
}

export const POST: APIRoute = async ({ request }) => {
  let body: any; try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
  try {
    const { companyId, oferta } = await resolverOferta(String(body.campana || ''), String(body.cuenta || ''));
    const origen = new URL(request.url).origin;
    const r = await crearPreferenciaOferta({ companyId, campanaId: String(body.campana), oferta, origen, email: body.email || null });
    return json({ ok: true, link: r.link, monto: r.monto });
  } catch (e: any) { return json({ error: e?.message || 'No se pudo iniciar el pago' }, 400); }
};
