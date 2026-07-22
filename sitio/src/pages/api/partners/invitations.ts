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
  'auto_approve',
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

// Embed un password inicial dentro del campo `notas` (en su sección meta jsonb).
// Se borra al aprobar la invitación. NO es un mecanismo de almacenamiento
// permanente — solo es para mover la pw del form admin al flujo de aprobación
// sin agregar columna nueva a la DB.
const NOTAS_SEP = '\n---SACS-META---\n';
function embedInitialPassword(notas: string | null | undefined, plainPw: string): string {
  let plain = notas || '';
  let meta: Record<string, any> = {};
  if (notas) {
    const idx = notas.indexOf(NOTAS_SEP);
    if (idx >= 0) {
      plain = notas.slice(0, idx);
      try { meta = JSON.parse(notas.slice(idx + NOTAS_SEP.length)); } catch { meta = {}; }
    }
  }
  meta.initial_password = plainPw;
  meta.initial_password_set_at = new Date().toISOString();
  return `${plain}${NOTAS_SEP}${JSON.stringify(meta)}`;
}

const DEFAULT_TEMPLATES: Record<string, any> = {
  embajador: {
    comision_pct: 50,
    costo_unico: 0,
    costo_mensual: 0,
    beneficios: [
      { icon: 'gift',      title: 'Plan Fideliza gratis · sistema SACS completo', detail: 'Te activamos una cuenta SACS en plan Fideliza para usar en tu propio negocio: POS, inventario multi-sucursal, e-commerce, CRM, lealtad, marketing. Costo público: $14,000 MXN/año. Para ti: gratis durante toda tu participación.', value_label: 'Vale $14,000 MXN/año · Gratis' },
      { icon: 'link',      title: 'Landing personalizada con tu link único',     detail: 'Tu propia página dentro de SACS con tu nombre, foto y link único (sacscloud.com/p/tu-slug). Cada visita y registro queda atribuido automáticamente a ti — sin códigos, sin formularios extra.' },
      { icon: 'dashboard', title: 'Portal de partner con métricas en tiempo real', detail: 'Dashboard personal con visitas a tu landing, registros generados, prospectos calificados, conversiones, comisiones acumuladas y pagos liquidados — todo actualizado al instante.' },
      { icon: 'academy',   title: 'Acceso a Academia SACS y capacitaciones',     detail: 'Cursos en línea, playbooks por vertical, demos grabadas y certificación oficial de embajador. Te enviamos cada mes 3-5 palabras clave para enfocar el contenido.' },
      { icon: 'broadcast', title: 'Difusión en el canal SACS',                   detail: 'Republicamos tu contenido en nuestras redes sociales. El alcance es variable y orgánico — puede sumar miles de views adicionales según el contenido.' },
      { icon: 'calendar',  title: 'Reunión trimestral con el equipo SACS',       detail: 'Sesión cada 3 meses para compartir mejoras, casos de éxito y feedback directo con el equipo de producto y dirección.' },
      { icon: 'wallet',    title: 'Liquidación automática cada 30 días',         detail: 'Pagos de comisiones y bonos por transferencia cada 30 días con desglose detallado de cada concepto, cliente y referido — visible siempre desde tu portal.' },
    ],
    compromisos: [
      { title: 'Cuota mínima anual de 10 sucursales',          detail: 'Mínimo 10 sucursales activas vendidas en cualquier plan durante los primeros 12 meses. Pueden ser 10 clientes con 1 sucursal cada uno, 1 cliente con 10 sucursales, o cualquier combinación. Esto es lo que hace al programa sustentable para ambos lados.', frequency: 'Anual' },
      { title: 'Generar 100 puntos al mes con contenido o acciones', detail: 'Cada mes acumulas mínimo 100 puntos en tres formas posibles: contenido publicado, acciones de promoción (demos, eventos, reseñas, intros) o actividades filantrópicas (refugios, comedores, mentorías, voluntariado). No tienes que ser sólo creador — apoyar también suma. Cada acción la subes desde tu panel de partner; sin reporte no se acreditan puntos. Si haces más de 100, el excedente se acumula al siguiente mes.', frequency: 'Mensual · 100 pts', ctaLabel: 'Ver el catálogo completo de puntos →', ctaTab: 'contenido' },
      { title: 'Reportar tu actividad en el portal',         detail: 'Subir el link, foto o evidencia de cada acción (contenido, apoyo o filantropía) desde el tab "Reportar actividad" de tu panel para que admin SACS valide y otorgue los puntos.', frequency: 'Por acción' },
      { title: 'Difusión: en tus redes o las del canal SACS', detail: 'Hay dos formas de hacer difusión y ambas suman. Publicas el contenido en tus propias redes (Instagram, TikTok, YouTube o LinkedIn) o nos envías los archivos originales para que lo publiquemos desde el canal SACS y multipliquemos el alcance. Lo importante es que se difunda — y la difusión te genera más visitas a tu link, más demos agendadas y más comisión.', frequency: 'Continuo' },
      { title: 'Cuidar la marca SACS',                       detail: 'Lo que publicas como embajador suma o resta a la marca. Producción cuidada, mensajes alineados al manual, sin polémicas innecesarias, respeto a competidores, clientes y comunidad. Si dudas, lo revisamos juntos antes de publicar.', frequency: 'Continuo' },
      { title: 'Uso correcto del logotipo y tipografías',    detail: 'Aplicar el logotipo SACS solo en su versión oficial. Respetar tipografías, paleta y guidelines del manual de marca.', frequency: 'Continuo' },
    ],
    tabulador: {
      prueba_gratis: 250,
      demo_completada: 300,
      venta_directa_pct: 50,
      moneda: 'MXN',
      notas: 'Pagos cada 30 días por transferencia bancaria, con desglose detallado por concepto y cliente visible siempre en tu portal de partner. Bono por prueba gratis se acredita cuando un usuario referido se registra y activa una prueba gratuita en SACS. Bono por demo completada se acredita al cierre del demo válido (mínimo 25 min con tomador de decisión presente). Comisión por venta directa se acredita al cobrar la primera factura del cliente cerrado.',
    },
    terminos: `Programa Embajador SACS — Términos y Condiciones

1. Vigencia y evaluación. El programa tiene vigencia indefinida sujeta a evaluación trimestral del cumplimiento de compromisos por parte de SACS Cloud. SACS se reserva el derecho de revisar el desempeño cada 90 días.

2. Comisiones y pagos. Las comisiones se calculan sobre el monto efectivamente cobrado a clientes referidos (vía link único o atribución manual). El pago se realiza por transferencia bancaria cada 30 días naturales contados desde el inicio del programa, con desglose detallado por concepto, cliente y referido visible siempre desde el portal del partner. Cada liquidación va contra emisión de recibo o factura del embajador.

3. Landing page y portal del partner. SACS habilitará al embajador (i) una landing page personalizada con su nombre y link único bajo el dominio sacscloud.com, y (ii) un portal de partner con métricas en tiempo real (visitas, registros, prospectos, conversiones, comisiones devengadas y pagos liquidados). El embajador es responsable de la información, fotografía y biografía que comparta para su landing.

4. Cumplimiento de compromisos.
   (i) Cuota anual mínima: el embajador se compromete a generar la venta de al menos 10 sucursales activas en SACS durante los primeros 12 meses del programa, en cualquier plan disponible y bajo cualquier combinación (clientes con una o varias sucursales). Esta meta hace al programa sustentable para ambas partes y desbloquea la renovación automática.
   (ii) Si el embajador deja de cumplir los compromisos de contenido por dos (2) meses consecutivos, SACS notificará por escrito y otorgará un periodo de regularización de 30 días naturales antes de pausar los beneficios.
   (iii) Si al cumplirse 12 meses el embajador no alcanza la cuota mínima, SACS y el embajador acordarán un plan de recuperación de 90 días o, en su defecto, terminarán el acuerdo conforme a la cláusula 8.

5. Confidencialidad. El embajador se compromete a no divulgar información estratégica, comercial o financiera de SACS Cloud, sus clientes o aliados, que reciba durante su participación en el programa.

6. Imagen y propiedad intelectual. SACS otorga al embajador una licencia limitada, no exclusiva y revocable para usar la marca SACS conforme al manual de marca durante la vigencia del programa. La propiedad intelectual de los videos creados por el embajador permanece del embajador, quien otorga a SACS una licencia perpetua, mundial y libre de regalías para republicar y promocionar dichos videos en cualquier canal de SACS.

7. Exclusividad parcial. Durante la vigencia del programa, el embajador no representará simultáneamente plataformas competidoras directas (POS / SaaS retail mexicano) sin autorización previa por escrito de SACS.

8. Terminación. Cualquiera de las partes podrá terminar el acuerdo con 30 días de aviso por escrito. Las comisiones devengadas hasta el momento de la terminación se pagarán conforme al ciclo regular y serán visibles en el portal hasta su liquidación.

9. No relación laboral. Este acuerdo no constituye relación laboral, mercantil-asociativa ni de mandato entre las partes. El embajador actúa como colaborador independiente y es responsable de sus propias obligaciones fiscales.

10. Datos personales. El tratamiento de datos personales se rige por el Aviso de Privacidad publicado en sacscloud.com/privacidad.

11. Jurisdicción. Para la interpretación y cumplimiento de este acuerdo, las partes se someten a las leyes y tribunales de la Ciudad de México.`,
  },
  distribuidor: {
    comision_pct: 30,
    costo_unico: 0,
    costo_mensual: 0,
    beneficios: [
      { icon: 'percent', title: '30% de comisión recurrente', detail: 'Sobre el MRR de cada cliente que cierres mientras siga activo.' },
      { icon: 'academy', title: 'Certificación oficial SACS', detail: 'Academia + examen para aparecer en el directorio de partners.' },
      { icon: 'leads', title: 'Leads asignados (opcional)', detail: 'No es un compromiso de SACS. Según tu desempeño y tu expertise en un giro, SACS puede empezar a enviarte oportunidades calificadas para que las atiendas y las sumes a tu cartera.', value_label: 'Según desempeño' },
    ],
    compromisos: [
      { title: 'Vender', detail: 'Mínimo 2 nuevos clientes por trimestre.', frequency: 'Trimestral' },
      { title: 'Implementar', detail: 'Acompañar al cliente las primeras 4 semanas post-venta.', frequency: 'Por cliente' },
    ],
    tabulador: {
      prueba_gratis: 0,
      demo_completada: 300,
      venta_directa_pct: 30,
      moneda: 'MXN',
    },
    terminos: 'Comisión recurrente sobre MRR cobrado mientras el cliente esté activo y al corriente.',
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

  // Enrich con interest score: el MAX score de cualquier sesión + flag de "intentó firmar"
  const invitations = data || [];
  if (invitations.length === 0) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const invitationIds = invitations.map((i: any) => i.id);
  const memberIds = invitations.map((i: any) => i.team_member_id).filter(Boolean) as string[];

  // ─── 1. Interest sessions (mismo que antes) ─────────────────
  let scoreMap = new Map<string, any>();
  let countMap = new Map<string, number>();
  try {
    const { data: sessions } = await supabase
      .from('partner_invitation_sessions')
      .select('invitation_id, interest_score, signature_attempted_at, contract_checkbox_at, total_active_seconds, contract_modal_opens, started_at')
      .in('invitation_id', invitationIds)
      .order('interest_score', { ascending: false });

    for (const s of (sessions || [])) {
      const inv = s.invitation_id;
      countMap.set(inv, (countMap.get(inv) || 0) + 1);
      const cur = scoreMap.get(inv);
      if (!cur || (s.interest_score || 0) > (cur.interest_score || 0)) {
        scoreMap.set(inv, s);
      }
    }
  } catch { /* tabla puede no existir aún */ }

  // ─── 2. Member stats (login + activity) ─────────────────────
  // Para los partners que ya tienen team_member creado, traemos last_login_at
  // y el contador real de leads/demos/clientes atribuidos a ellos.
  const memberMap = new Map<string, { last_login_at: string | null; created_at: string; activo: boolean }>();
  const leadsCountMap = new Map<string, number>();
  const bookingsAgendadasMap = new Map<string, number>();
  const bookingsRealizadasMap = new Map<string, number>();
  const clientesCountMap = new Map<string, number>();
  const commsPendingMap = new Map<string, number>();
  const commsEarnedMap = new Map<string, number>();
  const commsPaidMap = new Map<string, number>();

  if (memberIds.length > 0) {
    try {
      const [
        membersRes,
        contactsRes,
        bookingsAgRes,
        bookingsReRes,
        dealsRes,
        commsRes,
      ] = await Promise.all([
        supabase
          .from('team_members')
          .select('id, last_login_at, created_at, activo')
          .in('id', memberIds),
        supabase
          .from('contacts')
          .select('referrer_partner_id')
          .in('referrer_partner_id', memberIds),
        supabase
          .from('bookings')
          .select('referrer_partner_id')
          .in('referrer_partner_id', memberIds)
          .in('estado', ['agendada', 'confirmada']),
        supabase
          .from('bookings')
          .select('referrer_partner_id')
          .in('referrer_partner_id', memberIds)
          .eq('estado', 'realizada'),
        supabase
          .from('deals')
          .select('referrer_partner_id, stage, closed_at')
          .in('referrer_partner_id', memberIds),
        supabase
          .from('partner_commissions')
          .select('partner_id, status, commission_amount')
          .in('partner_id', memberIds)
          .neq('status', 'cancelled'),
      ]);

      for (const m of (membersRes.data || [])) {
        memberMap.set(m.id, {
          last_login_at: m.last_login_at,
          created_at: m.created_at,
          activo: m.activo !== false,
        });
      }
      const tally = (map: Map<string, number>, rows: any[] | null | undefined, key: string) => {
        for (const r of (rows || [])) {
          const k = r[key];
          if (k) map.set(k, (map.get(k) || 0) + 1);
        }
      };
      tally(leadsCountMap,         contactsRes.data,    'referrer_partner_id');
      tally(bookingsAgendadasMap,  bookingsAgRes.data,  'referrer_partner_id');
      tally(bookingsRealizadasMap, bookingsReRes.data,  'referrer_partner_id');
      for (const d of (dealsRes.data || [])) {
        const isWon = d.stage === 'cerrada_ganada' || d.stage === 'won' ||
          (d.closed_at && d.stage !== 'cerrada_perdida' && d.stage !== 'lost');
        if (isWon && d.referrer_partner_id) {
          clientesCountMap.set(d.referrer_partner_id, (clientesCountMap.get(d.referrer_partner_id) || 0) + 1);
        }
      }
      for (const c of (commsRes.data || [])) {
        const k = c.partner_id;
        const amt = Number(c.commission_amount || 0);
        if (!k) continue;
        if (c.status === 'pending') commsPendingMap.set(k, (commsPendingMap.get(k) || 0) + amt);
        else if (c.status === 'earned') commsEarnedMap.set(k, (commsEarnedMap.get(k) || 0) + amt);
        else if (c.status === 'paid')   commsPaidMap.set(k,   (commsPaidMap.get(k)   || 0) + amt);
      }
    } catch (e) {
      console.warn('[partners/invitations] member stats enrichment failed:', e);
    }
  }

  // ─── 3. Construir respuesta enriquecida ────────────────────
  const enriched = invitations.map((inv: any) => {
    const best = scoreMap.get(inv.id);
    const memberId = inv.team_member_id as string | null;
    const memberInfo = memberId ? memberMap.get(memberId) : null;
    const leads = memberId ? (leadsCountMap.get(memberId) || 0) : 0;
    const demosAg = memberId ? (bookingsAgendadasMap.get(memberId) || 0) : 0;
    const demosRe = memberId ? (bookingsRealizadasMap.get(memberId) || 0) : 0;
    const clientes = memberId ? (clientesCountMap.get(memberId) || 0) : 0;
    return {
      ...inv,
      interest_score: best ? (best.interest_score || 0) : 0,
      interest_signature_attempted: !!best?.signature_attempted_at,
      interest_contract_accepted: !!best?.contract_checkbox_at,
      interest_modal_opens: best?.contract_modal_opens || 0,
      interest_active_seconds: best?.total_active_seconds || 0,
      interest_sessions: countMap.get(inv.id) || 0,
      // Stats vivas del partner (solo presentes si ya hay team_member)
      member_last_login_at: memberInfo?.last_login_at || null,
      member_created_at: memberInfo?.created_at || null,
      member_activo: memberInfo ? memberInfo.activo : null,
      stats_leads: leads,
      stats_demos_agendadas: demosAg,
      stats_demos_realizadas: demosRe,
      stats_clientes: clientes,
      stats_comm_pending: memberId ? (commsPendingMap.get(memberId) || 0) : 0,
      stats_comm_earned:  memberId ? (commsEarnedMap.get(memberId)  || 0) : 0,
      stats_comm_paid:    memberId ? (commsPaidMap.get(memberId)    || 0) : 0,
    };
  });
  return new Response(JSON.stringify(enriched), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
      estado: 'sent',  // al crearse, la invitación nace ACTIVA — el link ya funciona
      pais: 'MX',
      ...tpl,
      ...body,
    };

    const clean = pick(merged, INVITATION_FIELDS);
    // Si el founder definió contraseña inicial, la embebemos en notas.meta
    // (se mueve a un campo controlado del approve-invitation y se borra al aprobar)
    if (body.initial_password && typeof body.initial_password === 'string' && body.initial_password.length >= 6) {
      clean.notas = embedInitialPassword(clean.notas, body.initial_password);
    }
    if (!clean.nombre) {
      return new Response(JSON.stringify({ error: 'nombre is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!clean.vigencia) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      clean.vigencia = d.toISOString().slice(0, 10);
    }

    // Strip auto_approve if false (defensive: column may not exist yet in some DBs)
    if (clean.auto_approve === false || clean.auto_approve === undefined) {
      delete clean.auto_approve;
    }

    const user = await getCurrentUser(request);
    const insertPayload: Record<string, any> = { ...clean };
    if (user?.id) insertPayload.invited_by = user.id;

    // Retry loop por colisión de folio + fallback si falla por columna desconocida
    let lastErr: any = null;
    let stripAutoApprove = false;
    for (let i = 0; i < 6; i++) {
      const numero = await nextNumero();
      const payload = stripAutoApprove ? (() => { const p = { ...insertPayload, numero }; delete p.auto_approve; return p; })() : { ...insertPayload, numero };
      const { data, error } = await supabase
        .from('partner_invitations')
        .insert(payload)
        .select()
        .single();
      if (!error) {
        return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      lastErr = error;
      // If column auto_approve doesn't exist yet, retry without it
      if (error.message && /auto_approve/i.test(error.message) && !stripAutoApprove) {
        stripAutoApprove = true;
        continue;
      }
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

    // Si el founder está actualizando la pw inicial, la embebemos en notas.meta
    if (body.initial_password && typeof body.initial_password === 'string' && body.initial_password.length >= 6 && user && (user.role === 'founder' || user.role === 'cs')) {
      // Necesitamos las notas actuales para fusionar correctamente
      const { data: cur } = await supabase.from('partner_invitations').select('notas').eq('id', id).maybeSingle();
      clean.notas = embedInitialPassword(cur?.notas, body.initial_password);
    }

    // Strip auto_approve if false (defensive: column may not exist yet in some DBs)
    if (clean.auto_approve === false || clean.auto_approve === undefined) {
      delete clean.auto_approve;
    }

    if (Object.keys(clean).length === 0) {
      // Most common cause: admin UI sent the PUT without `x-user-id: founder`,
      // so the role check above downgraded to PUBLIC_FIELDS and none of the
      // submitted keys matched. Without this guard, Supabase would run
      // `update({})` and return 0 rows → cryptic "Cannot coerce the result
      // to a single JSON object".
      return new Response(JSON.stringify({ error: 'no_editable_fields_in_payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let { data, error } = await supabase
      .from('partner_invitations')
      .update(clean)
      .eq('id', id)
      .select()
      .single();

    // Retry without auto_approve if the column doesn't exist yet
    if (error && error.message && /auto_approve/i.test(error.message)) {
      const retry = { ...clean }; delete retry.auto_approve;
      const r = await supabase.from('partner_invitations').update(retry).eq('id', id).select().single();
      data = r.data; error = r.error;
    }

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

// DELETE /api/partners/invitations?id=X
// Hard delete de la invitación + cascade completo. Solo founder/cs.
//
// Orden de borrado (siempre best-effort, ignora errores de FK ausentes):
//   1. partner_invitation_sessions (tracking de interés)
//   2. Si invitación tiene team_member_id: borra dependencias del partner
//      (content_submissions, partner_strikes, team_member_sessions, partner_payouts, etc.)
//   3. El team_member
//   4. La invitación
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'founder' && user.role !== 'cs')) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // Carga la invitación para saber si tiene team_member_id
    const { data: inv } = await supabase
      .from('partner_invitations')
      .select('id, team_member_id, numero, nombre')
      .eq('id', id)
      .maybeSingle();

    if (!inv) {
      return new Response(JSON.stringify({ error: 'invitation_not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const teamMemberId: string | null = (inv as any).team_member_id || null;

    // 1. Sesiones de tracking (FK CASCADE pero por si acaso)
    await supabase.from('partner_invitation_sessions').delete().eq('invitation_id', id).then(() => null, () => null);

    // 2. Si hay partner asociado, borra todas sus dependencias.
    //    Cada delete es best-effort: si la tabla no existe o no tiene esa FK, sigue.
    if (teamMemberId) {
      const cascadeTables: Array<{ table: string; column: string }> = [
        // Tracking / commitments del partner
        { table: 'content_submissions',    column: 'partner_id' },
        { table: 'partner_strikes',        column: 'partner_id' },
        { table: 'partner_payouts',        column: 'partner_id' },
        { table: 'partner_commissions',    column: 'partner_id' },
        { table: 'partner_referrals',      column: 'inviter_id' },
        { table: 'partner_referrals',      column: 'invitee_id' },
        // Auth y sesiones
        { table: 'team_member_sessions',   column: 'team_member_id' },
        { table: 'password_reset_tokens',  column: 'team_member_id' },
        { table: 'partner_certifications', column: 'partner_id' },
        // Cualquier link público alojado por slug
        { table: 'partner_landing_visits', column: 'partner_id' },
      ];
      for (const { table, column } of cascadeTables) {
        try {
          await supabase.from(table).delete().eq(column, teamMemberId);
        } catch { /* tabla puede no existir, ignorar */ }
      }

      // 3. Borra el team_member
      const { error: tmError } = await supabase.from('team_members').delete().eq('id', teamMemberId);
      // Si falla por FK constraint (alguna tabla que olvidamos arriba), lo
      // marcamos inactivo en lugar de borrarlo — al menos queda "tombstoned"
      if (tmError) {
        try {
          await supabase.from('team_members').update({ activo: false }).eq('id', teamMemberId);
        } catch { /* no hacemos nada */ }
      }
    }

    // 4. La invitación
    const { error } = await supabase.from('partner_invitations').delete().eq('id', id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      deleted_invitation: inv.numero,
      deleted_partner: !!teamMemberId,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
