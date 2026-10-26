// ══ CRON · Perfil del negocio para AXO (plan «AXO Gratis: conversión», REQ-03) ══════════════════════
//
// Diario (8:40 de CDMX). Por cada cliente con cuenta SACS arma su perfil (lib/crm/axo-perfil.ts: giro, cómo
// vende, sucursales, plan, etapa y señales de seguimiento) y lo manda a sacs_api, que lo guarda dentro de la
// cuenta en sacs3 y sacs5. Con eso AXO decide qué ofrecer y a quién darle seguimiento desde SU chat y SU
// WhatsApp. El CRM ya no le escribe al cliente por este camino.
//
// GET /api/cron/axo-perfil[?cuantas=N]
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { perfilDe, type EmpresaPerfil } from '../../../lib/crm/axo-perfil';
import { cuentasPorEmpresa, errorSacs, normCuenta } from '../../../lib/crm/sacs-cuentas';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  const ahora = Date.now();
  const tope = Math.min(500, Math.max(1, Number(url.searchParams.get('cuantas') || 400)));

  const { data: empresas, error } = await supabase.from('companies')
    .select('id, giro, sucursales, plan, estado_cuenta, tipo_cuenta, fecha_inicio, fecha_renovacion, dias_sin_venta, soporte_abiertos, soporte_estancado, propiedades, sacs_account')
    .not('sacs_account', 'is', null)
    .is('archived_at', null)
    .limit(tope);
  if (error) return json({ ok: false, error: error.message }, 500);

  // Cuentas internas o de prueba fuera: AXO no debe tratarlas como clientes.
  const lista = (empresas || []).filter((e: any) => !['interna', 'prueba'].includes((e.tipo_cuenta || '').toLowerCase()));
  const mapa = await cuentasPorEmpresa(lista.map((e: any) => e.id));
  const perfiles: { cuenta: string; perfil: Record<string, unknown> }[] = [];
  const vistas = new Set<string>();
  for (const e of lista as (EmpresaPerfil & { id: string; sacs_account: string })[]) {
    const perfil = perfilDe(e, ahora);
    const cuentas = (mapa[e.id]?.length ? mapa[e.id] : [normCuenta(e.sacs_account)]).filter(Boolean);
    for (const cuenta of cuentas) {
      if (vistas.has(cuenta)) continue;
      vistas.add(cuenta);
      perfiles.push({ cuenta, perfil });
    }
  }

  const out = { empresas: lista.length, cuentas: perfiles.length, sacs3: 0, sacs5: 0, errores: [] as string[] };
  // Lotes de 25 (tope del endpoint, que los guarda una por una para no golpear Mongo).
  for (let i = 0; i < perfiles.length; i += 25) {
    const lote = perfiles.slice(i, i + 25);
    try {
      const r = await fetch(SACS_API + '/interno/crm/perfil-negocio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ perfiles: lote }),
      });
      if (!r.ok) { out.errores.push(`lote ${i}: ${errorSacs(r.status)}`); continue; }
      const j = await r.json();
      for (const [cuenta, v] of Object.entries<any>(j.data || {})) {
        if (v.sacs3) out.sacs3++;
        if (v.sacs5) out.sacs5++;
        if (v.error) out.errores.push(`${cuenta}: ${v.error}`);
      }
    } catch (e: any) {
      out.errores.push(`lote ${i}: ${e?.message || String(e)}`);
    }
  }
  return json({ ok: true, ...out, errores: out.errores.slice(0, 30) });
};
