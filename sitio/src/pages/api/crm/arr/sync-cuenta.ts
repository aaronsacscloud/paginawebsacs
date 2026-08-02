// POST /api/crm/arr/sync-cuenta {company_id} — sincroniza AHORA la actividad de
// TODAS las cuentas SACS de una empresa (on-demand, sin esperar el cron de 6h).
// Trae el historial real (última venta, ventas 30d, módulos, usuarios,
// sucursales), lo agrega si el cliente opera varias cuentas y recalcula el
// health score. Devuelve la actividad para dar contexto inmediato.
import type { APIRoute } from 'astro';
import { sincronizarEmpresa } from '../../../../lib/crm/sync-empresa';

export const prerender = false;
function json(o: any, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const companyId = body?.company_id;
  if (!companyId) return json({ error: 'company_id requerido' }, 400);
  try {
    const r = await sincronizarEmpresa(companyId);
    if (r?.error) return json(r, r.error === 'empresa no encontrada' ? 404 : 502);
    if (r?.sin_cuentas) return json({ error: 'La empresa no tiene cuenta SACS ligada.' }, 400);
    if (r?.sin_datos) return json({ ok: true, sin_datos: true, cuentas: r.cuentas, mensaje: 'Cuentas ligadas, pero SACS aún no devuelve actividad.' });
    return json(r);
  } catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
};
