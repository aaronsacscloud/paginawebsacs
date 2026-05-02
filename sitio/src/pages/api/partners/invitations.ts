// Partner Invitations API
// GET  /api/partners/invitations            → list all (or filter by ?id=X to fetch one)
// POST /api/partners/invitations            → create new invitation (founder)
// PUT  /api/partners/invitations            → update invitation by id (founder, or public when accepting)

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

const INVITATION_FIELDS = [
  'tipo', 'nombre', 'email', 'whatsapp', 'empresa', 'ciudad', 'pais',
  'comision_pct', 'moneda', 'costo_unico', 'costo_mensual',
  'slug_landing', 'vigencia',
  'beneficios', 'compromisos', 'tabulador', 'terminos',
  'notas', 'template', 'estado',
  'aceptado_por', 'aceptado_fecha', 'decline_motivo', 'decline_detalle',
  'team_member_id', 'contact_id',
];

const PUBLIC_FIELDS = [
  'estado', 'aceptado_por', 'aceptado_fecha',
  'decline_motivo', 'decline_detalle', 'notas',
];

function pick(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of fields) if (f in obj) result[f] = obj[f];
  return result;
}

const DEFAULT_TEMPLATES: Record<string, any> = {
  embajador: {
    comision_pct: 50,
    costo_unico: 0,
    costo_mensual: 0,
    beneficios: [
      { icon: 'gift', title: 'Sistema SACS gratis', detail: 'Accede al SaaS completo sin costo durante tu programa de embajador.' },
      { icon: 'percent', title: '50% de comisión', detail: 'Sobre cada venta directa que generes a través de tu link único.' },
      { icon: 'academy', title: 'Capacitación premium', detail: 'Academia SACS, playbooks, demos grabadas y soporte directo del equipo.' },
      { icon: 'community', title: 'Comunidad de embajadores', detail: 'Networking, sesiones mensuales, casos de éxito y mentoría.' },
      { icon: 'reward', title: 'Recompensas por demo', detail: 'Bonos por cada demo agendada y completada según tabulador.' },
    ],
    compromisos: [
      { title: 'Crear contenido', detail: 'Publica de 3 a 4 videos al mes sobre SACS en tus redes (Instagram, TikTok, YouTube o LinkedIn).', frequency: 'Mensual' },
      { title: 'Mantener nivel', detail: 'Cumple con la cuota de contenido para conservar acceso gratis al sistema y al 50% de comisión.', frequency: 'Continuo' },
      { title: 'Asistir a kick-off', detail: 'Sesión de onboarding de 60 min para aprender el modelo, materiales y cómo presentar SACS.', frequency: 'Una vez' },
    ],
    tabulador: {
      demo_agendada: 200,
      demo_completada: 500,
      venta_directa_pct: 50,
      moneda: 'MXN',
      notas: 'Pagos mensuales. Demo agendada se paga al confirmarse; demo completada al cierre del demo válido. Comisión por venta directa al cobrar la primera factura.',
    },
    terminos: 'Programa de embajadores sujeto a cumplimiento de compromisos de contenido y representación de marca. Las recompensas se pagan mensualmente vía transferencia. SACS se reserva el derecho de revisar el desempeño cada 90 días.',
  },
  distribuidor: {
    comision_pct: 30,
    costo_unico: 5000,
    costo_mensual: 0,
    beneficios: [
      { icon: 'percent', title: '30% de comisión recurrente', detail: 'Sobre el MRR de cada cliente que cierres mientras siga activo.' },
      { icon: 'academy', title: 'Certificación oficial SACS', detail: 'Academia + examen para aparecer en el directorio de partners.' },
      { icon: 'leads', title: 'Leads asignados', detail: 'Recibe oportunidades calificadas de tu zona o vertical.' },
    ],
    compromisos: [
      { title: 'Vender', detail: 'Mínimo 2 nuevos clientes por trimestre.', frequency: 'Trimestral' },
      { title: 'Implementar', detail: 'Acompañar al cliente las primeras 4 semanas post-venta.', frequency: 'Por cliente' },
    ],
    tabulador: {
      demo_agendada: 0,
      demo_completada: 300,
      venta_directa_pct: 30,
      moneda: 'MXN',
    },
    terminos: 'Cuota única de certificación. Comisión recurrente sobre MRR cobrado mientras el cliente esté activo y al corriente.',
  },
};

async function nextNumero(): Promise<string> {
  const { data } = await supabase.from('partner_invitations').select('numero');
  let max = 0;
  for (const row of data || []) {
    const m = String(row?.numero || '').match(/(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `PA-${String(max + 1).padStart(3, '0')}`;
}

export const GET: APIRoute = async ({ request, url }) => {
  const id = url.searchParams.get('id');
  const slug = url.searchParams.get('slug');

  if (id) {
    const { data, error } = await supabase
      .from('partner_invitations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    if (!data) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (slug) {
    const { data } = await supabase
      .from('partner_invitations')
      .select('*')
      .eq('slug_landing', slug)
      .maybeSingle();
    if (!data) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // List — admin only
  const user = await getCurrentUser(request);
  if (user && user.role === 'partner') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const estado = url.searchParams.get('estado');
  const tipo = url.searchParams.get('tipo');

  let query = supabase
    .from('partner_invitations')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (estado) query = query.eq('estado', estado);
  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query.limit(500);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const tipo = body.tipo || 'embajador';
    const tpl = DEFAULT_TEMPLATES[tipo] || DEFAULT_TEMPLATES.embajador;

    const merged: Record<string, any> = {
      tipo,
      moneda: 'MXN',
      template: 'modern',
      estado: 'draft',
      pais: 'MX',
      ...tpl,
      ...body,
    };

    const clean = pick(merged, INVITATION_FIELDS);
    if (!clean.nombre) {
      return new Response(JSON.stringify({ error: 'nombre is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!clean.vigencia) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      clean.vigencia = d.toISOString().slice(0, 10);
    }

    const user = await getCurrentUser(request);
    const insertPayload: Record<string, any> = { ...clean };
    if (user?.id) insertPayload.invited_by = user.id;

    // Retry loop por colisión de folio
    let lastErr: any = null;
    for (let i = 0; i < 6; i++) {
      const numero = await nextNumero();
      const { data, error } = await supabase
        .from('partner_invitations')
        .insert({ ...insertPayload, numero })
        .select()
        .single();
      if (!error) {
        return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      lastErr = error;
      if (error.code !== '23505') break;
    }
    return new Response(JSON.stringify({ error: lastErr?.message || 'failed_to_create' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const user = await getCurrentUser(request);
    // Public access is allowed only for accept/decline transitions on a single record.
    const fields = (user && (user.role === 'founder' || user.role === 'cs')) ? INVITATION_FIELDS : PUBLIC_FIELDS;
    const clean = pick(body, fields);

    const { data, error } = await supabase
      .from('partner_invitations')
      .update(clean)
      .eq('id', id)
      .select()
      .single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
