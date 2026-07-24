// GET /api/crm/arr/export-clientes — CSV de los clientes REALES (companies con
// suscripción) junto con su contacto principal, para enriquecer teléfono/WhatsApp
// y demás datos en Excel y volver a subirlo con /api/crm/arr/import-telefonos.
//
// Incluye `company_id` y `contact_id` como LLAVES ESTABLES para el round-trip:
// el reimport actualiza exactamente ese contacto (o crea uno si la empresa no
// tiene). NO edites esas dos columnas al llenar el Excel.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const q = (v: any) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

export const GET: APIRoute = async ({ url }) => {
  // ?todos=1 incluye también empresas sin suscripción (leads/prospectos).
  const todos = url.searchParams.get('todos') === '1';

  const mkSel = (c: string) => 'id, nombre, sacs_account, plan, estado_cuenta, arr, ' + c + ', subscriptions(id)';
  const C_NEW = 'contacts(id, nombre, apellido, email, telefono, whatsapp, es_principal, created_at)';
  const C_OLD = 'contacts(id, nombre, apellido, email, telefono, whatsapp, created_at)';
  let res = await supabase.from('companies').select(mkSel(C_NEW)).is('archived_at', null);
  if (res.error && /es_principal|column|schema cache/i.test(res.error.message || '')) {
    res = await supabase.from('companies').select(mkSel(C_OLD)).is('archived_at', null);
  }
  const { data: companies, error } = res;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const header = ['company_id', 'contact_id', 'cuenta_sacs', 'empresa', 'contacto_nombre',
    'email', 'telefono', 'whatsapp', 'plan', 'estado', 'arr'];

  const filas = (companies || [])
    .filter((c: any) => todos || (c.subscriptions || []).length > 0)
    .sort((a: any, b: any) => Number(b.arr || 0) - Number(a.arr || 0))
    .map((c: any) => {
      // Contacto principal = el marcado es_principal; fallback: el más antiguo.
      const contacto = (c.contacts || []).find((x: any) => x.es_principal)
        || (c.contacts || [])
          .slice()
          .sort((x: any, y: any) => String(x.created_at || '').localeCompare(String(y.created_at || '')))[0] || null;
      const nombre = contacto ? [contacto.nombre, contacto.apellido].filter(Boolean).join(' ') : '';
      return [
        c.id, contacto?.id || '', c.sacs_account || '', c.nombre || '', nombre,
        contacto?.email || '', contacto?.telefono || '', contacto?.whatsapp || '',
        c.plan || '', c.estado_cuenta || '', c.arr || 0,
      ].map(q).join(',');
    });

  // BOM para que Excel abra los acentos bien.
  const csv = '\ufeff' + [header.map(q).join(','), ...filas].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-crm-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
