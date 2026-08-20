// /api/crm/email/lists — listas estáticas (miembros fijos, puestos a mano).
//
// Un segmento responde "quién cumple X hoy"; una lista responde "estos, los
// que yo escogí". Las dos alimentan campañas y embudos igual.
//
// El import de CSV valida sintaxis, avisa de buzones de función y liga por
// correo con los contactos que ya existen (para que la campaña sepa de qué
// empresa es cada quién y pueda aplicar el cap por empresa).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { esRoleAccount, normalizarEmail } from '../../../../lib/email/pipeline';
import { parsearCSV, normalizarLlave } from '../../../../lib/crm/tiktok-leads';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const id = url.searchParams.get('id');

  if (id) {
    const { data: lista } = await supabase.from('email_lists').select('*').eq('id', id).eq('tenant_id', t.id).maybeSingle();
    if (!lista) return json({ error: 'No existe esa lista.' }, 404);
    const { data: miembros } = await supabase.from('email_list_members')
      .select('id, email, nombre, contact_id').eq('list_id', id).order('created_at', { ascending: false }).limit(5000);
    return json({ lista, miembros: miembros || [] });
  }

  const { data } = await supabase.from('email_lists').select('*, email_list_members(count)')
    .eq('tenant_id', t.id).is('archived_at', null).order('created_at', { ascending: false });
  return json({
    listas: (data || []).map((l: any) => ({ ...l, total: l.email_list_members?.[0]?.count || 0, email_list_members: undefined })),
  });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));

  // Alta de lista
  if (!body.list_id) {
    if (!body?.nombre?.trim()) return json({ error: 'Ponle nombre a la lista.' }, 400);
    const { data, error } = await supabase.from('email_lists')
      .insert({ tenant_id: t.id, nombre: body.nombre.trim(), descripcion: body.descripcion || null })
      .select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ lista: data }, 201);
  }

  // Agregar miembros: contactos existentes, correos sueltos o un CSV.
  const entradas: Array<{ email: string; nombre?: string | null; contact_id?: string | null }> = [];

  for (const cid of (body.contact_ids || [])) {
    const { data: c } = await supabase.from('contacts').select('id, email, nombre, apellido').eq('id', cid).maybeSingle();
    if (c?.email) entradas.push({ email: c.email, nombre: [c.nombre, c.apellido].filter(Boolean).join(' '), contact_id: c.id });
  }
  for (const e of (body.emails || [])) entradas.push({ email: String(e) });

  if (body.csv) {
    const filas = parsearCSV(String(body.csv));
    if (filas.length > 1) {
      const enc = filas[0].map((h: string) => normalizarLlave(h));
      const iMail = enc.findIndex((h: string) => ['email', 'correo', 'correo_electronico', 'e_mail'].includes(h));
      const iNom = enc.findIndex((h: string) => ['nombre', 'name', 'nombre_completo'].includes(h));
      for (const f of filas.slice(1)) {
        const email = iMail >= 0 ? f[iMail] : f.find((x: string) => EMAIL_RE.test(x));
        if (email) entradas.push({ email, nombre: iNom >= 0 ? f[iNom] : null });
      }
    }
  }

  const reporte = { agregados: 0, duplicados: 0, invalidos: [] as string[], role_accounts: [] as string[] };
  const vistos = new Set<string>();

  for (const e of entradas) {
    const email = normalizarEmail(e.email);
    if (!EMAIL_RE.test(email)) { reporte.invalidos.push(e.email); continue; }
    if (vistos.has(email)) { reporte.duplicados++; continue; }
    vistos.add(email);
    // Los buzones de función se avisan pero NO se bloquean aquí: el pipeline
    // los rechazará al enviar. Meterlos permite verlos y decidir.
    if (esRoleAccount(email)) reporte.role_accounts.push(email);

    let contactId = e.contact_id || null;
    if (!contactId) {
      const { data: c } = await supabase.from('contacts').select('id').eq('email', email).limit(1).maybeSingle();
      contactId = c?.id || null;
    }
    const { error } = await supabase.from('email_list_members').insert({
      list_id: body.list_id, email, nombre: e.nombre || null, contact_id: contactId, agregado_por: body.origen || 'panel',
    });
    if (error) { if (/duplicate|23505/i.test(error.message)) reporte.duplicados++; }
    else reporte.agregados++;
  }
  return json({ ok: true, ...reporte });
};

export const DELETE: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const miembro = url.searchParams.get('miembro');
  const id = url.searchParams.get('id');
  if (miembro) {
    // Verificando el dueño: borrar por id a secas dejaba quitar miembros de la
    // lista de otro inquilino con solo conocer el id de la fila.
    const { data: m } = await supabase.from('email_list_members')
      .select('id, email_lists!inner(tenant_id)').eq('id', miembro).maybeSingle();
    if (!m || (m as any).email_lists?.tenant_id !== t.id) return json({ error: 'No existe ese miembro.' }, 404);
    await supabase.from('email_list_members').delete().eq('id', miembro);
    return json({ ok: true });
  }
  if (id) { await supabase.from('email_lists').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', t.id); return json({ ok: true }); }
  return json({ error: 'Falta el id.' }, 400);
};
