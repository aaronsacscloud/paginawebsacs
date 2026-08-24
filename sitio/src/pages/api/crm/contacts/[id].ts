import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { detectaHistorial, norm as normTxt, tel10, claveEmpresa, type Indices } from '../../../../lib/crm/lead-historial';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  // Get contact with company
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*, companies(*)')
    .eq('id', id)
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 404 });

  // Get deals
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false });

  // Get activities
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Get quotes
  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, numero, empresa, total, estado, created_at')
    .eq('contact_id', id)
    .order('created_at', { ascending: false });

  // Reuniones del lead: la ruta se apoya en ellas —demo agendada, si se
  // presentó— y sin traerlas habría que capturar a mano algo que ya está.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, fecha, hora_inicio, asunto, estado, google_meet_link, event_types(nombre, categoria)')
    .or(`contact_id.eq.${id}` + (contact.email ? `,invitee_email.eq.${contact.email}` : ''))
    .order('fecha', { ascending: false }).limit(10);

  // ── ¿Ya lo conocíamos? ────────────────────────────────────────────────────
  // Solo para leads, y con consultas DIRIGIDAS (por su correo, su teléfono y el
  // nombre de su empresa) en vez de traer toda la cartera: aquí es un contacto,
  // no un lote. Si algo falla, el aviso simplemente no sale — nunca tumba la
  // ficha, que es lo que la persona vino a ver.
  let historial: any = null;
  if (['lead', 'lead_calificado', 'oportunidad'].includes(String(contact.lifecycle_stage))) {
    try {
      const empresa: any = Array.isArray(contact.companies) ? contact.companies[0] : contact.companies;
      const tl = tel10(contact.whatsapp || contact.telefono);
      const kEmp = claveEmpresa(empresa?.nombre_comercial || empresa?.nombre);

      let qViejos = supabase.from('contacts').select('id, email, whatsapp, telefono, company_id, lifecycle_stage')
        .in('lifecycle_stage', ['cliente', 'churned']).is('archived_at', null).neq('id', id);
      const ors: string[] = [];
      if (contact.email) ors.push(`email.ilike.${contact.email}`);
      if (tl.length === 10) ors.push(`whatsapp.ilike.%${tl}%`, `telefono.ilike.%${tl}%`);
      const { data: viejos } = ors.length ? await qViejos.or(ors.join(',')).limit(20) : { data: [] as any[] };

      // Las empresas candidatas: la del lead, las de los contactos que cruzaron,
      // y las que se llaman parecido.
      const ids = [contact.company_id, ...(viejos || []).map((v: any) => v.company_id)].filter(Boolean);
      const { data: emps } = await supabase.from('companies')
        .select('id, nombre, nombre_comercial, estado_cuenta, arr').is('archived_at', null)
        .or([ids.length ? `id.in.(${ids.join(',')})` : '', kEmp.length >= 4 ? `nombre.ilike.%${(empresa?.nombre_comercial || empresa?.nombre || '').trim()}%` : ''].filter(Boolean).join(','))
        .limit(50);
      const compIds = (emps || []).map((e: any) => e.id);
      const { data: subs } = compIds.length
        ? await supabase.from('subscriptions').select('company_id').eq('estado', 'activa').in('company_id', compIds)
        : { data: [] as any[] };
      const conSub = new Set((subs || []).map((x: any) => x.company_id));

      const ix: Indices = { porCorreo: new Map(), porTelefono: new Map(), empresas: new Map(), porNombreEmpresa: new Map(), leadPorCorreo: new Map(), leadPorTelefono: new Map() };
      for (const e of (emps || [])) {
        const activa = conSub.has(e.id);
        ix.empresas.set(e.id, { nombre: e.nombre_comercial || e.nombre, estado_cuenta: e.estado_cuenta, arr: e.arr, activa });
        if (activa || ['activo', 'vencido', 'cancelado'].includes(String(e.estado_cuenta))) {
          const k = claveEmpresa(e.nombre_comercial || e.nombre);
          if (k.length >= 4 && e.id !== contact.company_id && !ix.porNombreEmpresa.has(k)) {
            ix.porNombreEmpresa.set(k, { company_id: e.id, nombre: e.nombre_comercial || e.nombre, estado_cuenta: e.estado_cuenta, activa });
          }
        }
      }
      for (const v of (viejos || [])) {
        const reg = { lifecycle: v.lifecycle_stage, company_id: v.company_id, contact_id: v.id };
        const em = normTxt(v.email); if (em && !ix.porCorreo.has(em)) ix.porCorreo.set(em, reg);
        const t2 = tel10(v.whatsapp || v.telefono); if (t2.length === 10 && !ix.porTelefono.has(t2)) ix.porTelefono.set(t2, reg);
      }
      // Las otras fichas de lead, de la más vieja a la más nueva: contra la
      // primera de cada correo/teléfono se decide si esta persona ya nos había
      // escrito. Es la cuarta llave y, medida en producción, la única que
      // encuentra algo — las tres de arriba dan cero sobre los leads abiertos.
      const { data: gemelos } = await supabase.from('contacts')
        .select('id, nombre, email, whatsapp, telefono, created_at')
        .in('lifecycle_stage', ['lead', 'lead_calificado', 'oportunidad']).is('archived_at', null)
        .order('created_at', { ascending: true }).limit(4000);
      for (const g of (gemelos || [])) {
        const reg = { contact_id: g.id, created_at: g.created_at, nombre: g.nombre };
        const em = normTxt(g.email); if (em && !ix.leadPorCorreo!.has(em)) ix.leadPorCorreo!.set(em, reg);
        const t3 = tel10(g.whatsapp || g.telefono); if (t3.length === 10 && !ix.leadPorTelefono!.has(t3)) ix.leadPorTelefono!.set(t3, reg);
      }
      historial = detectaHistorial({
        id: String(id), email: contact.email, whatsapp: contact.whatsapp, telefono: contact.telefono,
        company_id: contact.company_id, empresa_nombre: empresa?.nombre_comercial || empresa?.nombre || null,
        created_at: contact.created_at,
      }, ix);
    } catch { historial = null; }
  }

  return new Response(JSON.stringify({
    ...contact,
    historial,
    deals: deals || [],
    activities: activities || [],
    quotes: quotes || [],
    bookings: bookings || [],
  }));
};
