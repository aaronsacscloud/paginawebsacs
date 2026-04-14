import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const tipo = url.searchParams.get('tipo');
  const lifecycle = url.searchParams.get('lifecycle_stage');

  let query = supabase
    .from('contacts')
    .select('nombre, apellido, email, whatsapp, tipo, lifecycle_stage, lead_score, giro, plan_interes, fuente, created_at, companies(nombre, plan)')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (tipo) query = query.eq('tipo', tipo);
  if (lifecycle) query = query.eq('lifecycle_stage', lifecycle);

  const { data } = await query;

  const header = 'Nombre,Apellido,Email,WhatsApp,Tipo,Lifecycle,Score,Giro,Plan Interes,Fuente,Empresa,Plan Empresa,Creado';
  const rows = (data || []).map((c: any) => [
    c.nombre, c.apellido || '', c.email || '', c.whatsapp || '',
    c.tipo, c.lifecycle_stage, c.lead_score,
    c.giro || '', c.plan_interes || '', c.fuente || '',
    c.companies?.nombre || '', c.companies?.plan || '',
    c.created_at?.slice(0, 10) || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="contacts-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
};
