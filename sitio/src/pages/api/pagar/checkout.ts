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
    .select('id, estado, contenido, materializada').eq('id', campana).maybeSingle();
  if (!c || c.estado === 'archivada') throw new Error('Campaña no disponible');
  const oferta = c.contenido?.oferta;
  if (!oferta || (!oferta.plan_slug && !(oferta.monto_base > 0))) throw new Error('Esta campaña no tiene una oferta con precio');

  const cu = normCuenta(cuenta);
  // PERTENENCIA: la cuenta debe estar en la audiencia CONGELADA de la campaña.
  // Sin esto, cualquiera que conozca el UUID de una campaña con precio
  // promocional podría pagar ese precio con su cuenta (arbitraje de precio
  // entre dos ofertas del mismo producto). Si la campaña nunca se congeló
  // (materializada ausente), se permite — no romper pruebas/campañas viejas.
  const lista: string[] = Array.isArray(c.materializada?.cuentas_lista) ? c.materializada.cuentas_lista.map(normCuenta) : [];
  if (lista.length && lista.indexOf(cu) === -1) {
    throw new Error('Esta oferta no está disponible para tu cuenta');
  }

  const { data: csa } = await supabase.from('company_sacs_accounts').select('company_id').eq('cuenta', cu).maybeSingle();
  let companyId = csa?.company_id || null;
  if (!companyId) {
    const { data: co } = await supabase.from('companies').select('id').eq('sacs_account', cu).maybeSingle();
    companyId = co?.id || null;
  }
  if (!companyId) throw new Error('No encontramos tu cuenta en el CRM');
  return { companyId, oferta, concepto: oferta.concepto || c.contenido?.titulo || 'Compra SACS' };
}

// Rate limit best-effort por IP: el endpoint es público y crea preferencias
// REALES de MP. No frena un ataque distribuido, pero corta el spam trivial.
const _hits = new Map<string, number[]>();
function pasaLimite(ip: string): boolean {
  const ahora = Date.now();
  const arr = (_hits.get(ip) || []).filter(t => ahora - t < 60000);
  if (arr.length >= 10) { _hits.set(ip, arr); return false; }
  arr.push(ahora); _hits.set(ip, arr);
  return true;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida';
  if (!pasaLimite(ip)) return json({ error: 'Demasiados intentos, espera un momento' }, 429);
  let body: any; try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
  try {
    const { companyId, oferta } = await resolverOferta(String(body.campana || ''), String(body.cuenta || ''));
    const origen = new URL(request.url).origin;
    const r = await crearPreferenciaOferta({ companyId, campanaId: String(body.campana), oferta, origen, email: body.email || null });
    return json({ ok: true, link: r.link, monto: r.monto });
  } catch (e: any) { return json({ error: e?.message || 'No se pudo iniciar el pago' }, 400); }
};
