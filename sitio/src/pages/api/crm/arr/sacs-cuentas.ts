// Cuentas de SACS de un cliente (un dueño puede operar varias).
//   GET    ?company_id=…            → lista con su actividad individual
//   POST   {company_id, cuenta}     → agrega una cuenta (valida que exista en SACS)
//   DELETE ?id=…                    → desliga una cuenta (no borra nada de SACS)
//   PUT    {id}                     → marcarla como principal
// Cualquier cambio re-sincroniza al cliente para que el agregado quede al día.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { normCuenta, errorSacs } from '../../../../lib/crm/sacs-cuentas';
import { sincronizarEmpresa } from '../../../../lib/crm/sync-empresa';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id');
  if (!companyId) return json({ error: 'company_id requerido' }, 400);
  const { data, error } = await supabase.from('company_sacs_accounts')
    .select('id, cuenta, es_principal, actividad, sync_at')
    .eq('company_id', companyId)
    .order('es_principal', { ascending: false }).order('created_at');
  if (error) return json({ error: error.message, data: [] }, 200); // migración sin correr → el front cae a sacs_account
  return json({ data: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const companyId = body?.company_id;
  const cuenta = normCuenta(body?.cuenta);
  if (!companyId || !cuenta) return json({ error: 'company_id y cuenta requeridos' }, 400);

  // ¿Ya es de alguien más? El índice único lo impediría igual, pero un mensaje
  // que diga DE QUIÉN evita el "no me deja y no sé por qué".
  const { data: ya } = await supabase.from('company_sacs_accounts')
    .select('company_id, companies(nombre)').eq('cuenta', cuenta).maybeSingle();
  if (ya) {
    if (ya.company_id === companyId) return json({ error: 'Ese cliente ya tiene esa cuenta.' }, 400);
    const otro: any = Array.isArray(ya.companies) ? ya.companies[0] : ya.companies;
    return json({ error: `La cuenta "${cuenta}" ya está ligada a ${otro?.nombre || 'otro cliente'}. Quítala de allá primero.` }, 409);
  }

  // Validar contra SACS: ligar un subdominio con typo deja al cliente con una
  // cuenta fantasma que nunca sincroniza y nadie vuelve a revisar.
  try {
    const res = await fetch(SACS_API + '/interno/crm/actividad', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ accounts: [cuenta] }),
    });
    if (!res.ok) return json({ error: errorSacs(res.status) + ' No se pudo verificar la cuenta.' }, 502);
    const j = await res.json();
    if (!(j.data || {})[cuenta]) return json({ error: `SACS no conoce la cuenta "${cuenta}". Revisa el subdominio.` }, 404);
  } catch (e: any) {
    return json({ error: 'No se pudo verificar contra SACS: ' + (e?.message || e) }, 502);
  }

  const { count } = await supabase.from('company_sacs_accounts')
    .select('id', { count: 'exact', head: true }).eq('company_id', companyId);
  const primera = (count || 0) === 0;

  const { error } = await supabase.from('company_sacs_accounts')
    .insert({ company_id: companyId, cuenta, es_principal: primera });
  if (error) return json({ error: error.message }, 500);
  // La primera cuenta también es la principal de la empresa (compatibilidad).
  if (primera) await supabase.from('companies').update({ sacs_account: cuenta }).eq('id', companyId);

  const r = await sincronizarEmpresa(companyId);
  return json({ ok: true, cuenta, ...r });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const id = body?.id;
  if (!id) return json({ error: 'id requerido' }, 400);
  const { data: fila } = await supabase.from('company_sacs_accounts').select('id, company_id, cuenta').eq('id', id).maybeSingle();
  if (!fila) return json({ error: 'cuenta no encontrada' }, 404);
  await supabase.from('company_sacs_accounts').update({ es_principal: false }).eq('company_id', fila.company_id);
  await supabase.from('company_sacs_accounts').update({ es_principal: true }).eq('id', id);
  await supabase.from('companies').update({ sacs_account: fila.cuenta }).eq('id', fila.company_id);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  const { data: fila } = await supabase.from('company_sacs_accounts').select('id, company_id, cuenta, es_principal').eq('id', id).maybeSingle();
  if (!fila) return json({ error: 'cuenta no encontrada' }, 404);

  const { error } = await supabase.from('company_sacs_accounts').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);

  // Si se fue la principal, asciende otra (o la empresa se queda sin cuenta).
  if (fila.es_principal) {
    const { data: resto } = await supabase.from('company_sacs_accounts')
      .select('id, cuenta').eq('company_id', fila.company_id).order('created_at').limit(1);
    const nueva = (resto || [])[0];
    if (nueva) {
      await supabase.from('company_sacs_accounts').update({ es_principal: true }).eq('id', nueva.id);
      await supabase.from('companies').update({ sacs_account: nueva.cuenta }).eq('id', fila.company_id);
    } else {
      await supabase.from('companies').update({ sacs_account: null, actividad: null }).eq('id', fila.company_id);
    }
  }
  const r = await sincronizarEmpresa(fila.company_id);
  return json({ ok: true, ...r });
};
