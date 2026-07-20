// /api/crm/arr/conciliacion — el descubridor de ARR no registrado.
// GET: cuentas SACS con ventas 30d SIN suscripción registrada, con su volumen
//      y clasificación actual (si la hay).
// POST: { cuenta, accion } donde accion = 'clasificar' {tipo} | 'crear_sub'
//      {nombre_plan, ciclo, precio, contacto_nombre?, email?}.
// Clasificación en companies.tipo_cuenta si la columna existe; si no, cae a
// metadata en actividad (degradación honesta hasta aplicar el SQL 2).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = import.meta.env.CRM_SYNC_SECRET || 'sacs-crm-sync-2026';
const TIPOS = ['cliente', 'cortesia', 'prueba', 'interna', 'socio', 'sin_clasificar'];

export const GET: APIRoute = async () => {
  // 1 · cuentas activas reales desde sacs_api
  const res = await fetch(SACS_API + '/interno/crm/cuentas-activas', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET }, body: '{}',
  });
  if (!res.ok) return new Response(JSON.stringify({ error: 'sacs_api HTTP ' + res.status }), { status: 502 });
  const j = await res.json();
  const activas: any[] = j.data || [];

  // 2 · cuentas ya ligadas a una suscripción NO cancelada
  const { data: subs } = await supabase.from('subscriptions')
    .select('estado, companies(sacs_account)').neq('estado', 'cancelada');
  const ligadas = new Set((subs || []).map((s: any) => s.companies?.sacs_account).filter(Boolean));

  // 3 · clasificación previa (companies por sacs_account)
  const { data: comps } = await supabase.from('companies').select('id, sacs_account, tipo_cuenta, nombre').not('sacs_account', 'is', null);
  const compPorCuenta: Record<string, any> = {};
  (comps || []).forEach((c: any) => { if (c.sacs_account) compPorCuenta[c.sacs_account] = c; });

  const sinSub = activas.filter(a => !ligadas.has(a.cuenta)).map(a => ({
    ...a,
    company_id: compPorCuenta[a.cuenta]?.id || null,
    tipo_cuenta: compPorCuenta[a.cuenta]?.tipo_cuenta || 'sin_clasificar',
  }));
  const pendientes = sinSub.filter(x => x.tipo_cuenta === 'sin_clasificar' || x.tipo_cuenta == null);

  return new Response(JSON.stringify({
    cuentas_activas: activas.length,
    con_suscripcion: activas.length - sinSub.length,
    sin_suscripcion: sinSub.length,
    sin_clasificar: pendientes.length,
    data: sinSub,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const cuenta = String(body?.cuenta || '').trim().toLowerCase();
  if (!cuenta) return new Response(JSON.stringify({ error: 'cuenta requerida' }), { status: 400 });

  // company de la cuenta (crear si no existe)
  let { data: co } = await supabase.from('companies').select('id, tipo_cuenta').eq('sacs_account', cuenta).maybeSingle();
  if (!co) {
    const ins = await supabase.from('companies').insert({ nombre: cuenta, sacs_account: cuenta, estado_cuenta: 'prospecto' }).select('id, tipo_cuenta').single();
    if (ins.error) return new Response(JSON.stringify({ error: ins.error.message }), { status: 500 });
    co = ins.data;
  }

  if (body.accion === 'clasificar') {
    const tipo = TIPOS.includes(body.tipo) ? body.tipo : 'sin_clasificar';
    const upd = await supabase.from('companies').update({ tipo_cuenta: tipo }).eq('id', co.id);
    if (upd.error) {
      const msg = String(upd.error.message || '');
      if (/tipo_cuenta/.test(msg)) {
        return new Response(JSON.stringify({ error: 'Falta la columna companies.tipo_cuenta — aplica migration-2026-07-crm-arr-2.sql en el SQL Editor.' }), { status: 409 });
      }
      return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
    await supabase.from('activities').insert({
      tipo: 'sistema', titulo: `Cuenta ${cuenta} clasificada como: ${tipo}`,
      company_id: co.id, automatico: true, metadata: { conciliacion: true, tipo },
    }).select().maybeSingle();
    return new Response(JSON.stringify({ ok: true, tipo }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (body.accion === 'crear_sub') {
    const ciclo = body.ciclo === 'anual' ? 'anual' : 'mensual';
    const precio = Number(body.precio) || 0;
    const mrr = ciclo === 'anual' ? precio / 12 : precio;
    // contacto opcional
    let contactId: string | null = null;
    const email = String(body.email || '').trim().toLowerCase();
    if (email) {
      const { data: c } = await supabase.from('contacts').select('id').ilike('email', email).maybeSingle();
      if (c) contactId = c.id;
      else {
        const { data: nc } = await supabase.from('contacts').insert({ nombre: body.contacto_nombre || email, email, tipo: 'cliente', lifecycle_stage: 'cliente', company_id: co.id }).select('id').maybeSingle();
        contactId = nc?.id || null;
      }
    }
    const { data: ns, error: se } = await supabase.from('subscriptions').insert({
      company_id: co.id, contact_id: contactId,
      nombre_plan: String(body.nombre_plan || 'Licencia SACS').slice(0, 160),
      ciclo, estado: 'programada', precio,
      mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      proxima_factura: new Date().toISOString().slice(0, 10),
      monto_proximo: precio,
      notas: 'Creada desde Conciliación (cuenta activa sin suscripción).',
    }).select('id').single();
    if (se) return new Response(JSON.stringify({ error: se.message }), { status: 500 });
    await supabase.from('companies').update({ tipo_cuenta: 'cliente' }).eq('id', co.id).select().maybeSingle();
    await supabase.from('activities').insert({
      tipo: 'sistema', titulo: `Suscripción creada desde Conciliación para ${cuenta} (${body.nombre_plan || 'Licencia SACS'})`,
      company_id: co.id, automatico: true, metadata: { conciliacion: true, subscription_id: ns.id },
    }).select().maybeSingle();
    return new Response(JSON.stringify({ ok: true, subscription_id: ns.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'accion inválida' }), { status: 400 });
};
