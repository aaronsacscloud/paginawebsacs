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

const DEFAULT_TEMPLATES: Record<string, any> = {
  embajador: {
    comision_pct: 50,
    costo_unico: 0,
    costo_mensual: 0,
    beneficios: [
      { icon: 'percent',   title: '50% de comisión por venta directa',           detail: 'Sobre cada cliente cerrado a través de tu link único de partner. Se calcula sobre el monto efectivamente cobrado al cliente.' },
      { icon: 'reward',    title: 'Comisión por reunión agendada',               detail: 'Bono fijo cada vez que un prospecto referido por ti agenda una demo en nuestro calendario oficial.' },
      { icon: 'reward',    title: 'Comisión por reunión completada',             detail: 'Bono adicional cuando el prospecto asiste y completa el demo válido con SACS.' },
      { icon: 'link',      title: 'Landing page personalizada con tu link',     detail: 'Tu propia página dentro de SACS con tu nombre, foto y link único (sacscloud.com/p/tu-slug). Cada visita y registro queda atribuido automáticamente a ti.' },
      { icon: 'dashboard', title: 'Portal de partner con métricas en tiempo real', detail: 'Dashboard personal con visitas a tu landing, registros generados, prospectos calificados, conversiones, comisiones acumuladas y pagos liquidados — todo actualizado al instante.' },
      { icon: 'academy',   title: 'Acceso a Academia SACS y capacitaciones',     detail: 'Cursos en línea, playbooks por vertical, demos grabadas y certificación oficial de embajador.' },
      { icon: 'gift',      title: 'Plan Fideliza incluido',                      detail: 'Acceso completo al plan Fideliza para tu propio negocio durante toda tu participación. Valor de $18,000 MXN al año.' },
      { icon: 'calendar',  title: 'Reunión trimestral con el equipo SACS',       detail: 'Sesión cada 3 meses para compartir mejoras, casos de éxito y feedback directo con el equipo de producto y dirección.' },
      { icon: 'broadcast', title: 'Difusión en el canal SACS',                   detail: 'Republicamos tu contenido en nuestras redes sociales. El alcance es variable y orgánico — puede sumar miles de views adicionales según el contenido.' },
      { icon: 'wallet',    title: 'Pagos automáticos cada 30 días',              detail: 'Comisiones y bonos liquidados por transferencia cada 30 días, con desglose detallado de cada concepto, cliente y referido. Visible siempre desde tu portal.' },
    ],
    compromisos: [
      { title: 'Cuota mínima anual de 10 sucursales',          detail: 'Mínimo 10 sucursales activas vendidas en cualquier plan durante los primeros 12 meses. Pueden ser 10 clientes con 1 sucursal cada uno, 1 cliente con 10 sucursales, o cualquier combinación. Esto es lo que hace al programa sustentable para ambos lados.', frequency: 'Anual' },
      { title: 'Generar 100 puntos al mes en contenido',     detail: 'Cada tipo de contenido vale puntos distintos (story 10 · tutorial 15 · caso de uso 20 · webinar 40 · mini-documental 50). Meta mensual: 100 puntos. Si haces más, los puntos se acumulan al siguiente mes. SACS te envía cada mes 3-5 palabras clave a posicionar para enfocar el contenido.', frequency: 'Mensual · 100 pts' },
      { title: 'Reportar tus links en el portal',            detail: 'Subir el link de cada pieza al portal (tab "Reportar contenido") para que admin SACS valide y otorgue los puntos.', frequency: 'Por contenido' },
      { title: 'Publicar en tus redes sociales',             detail: 'Publicar los videos en tus propias redes (Instagram, TikTok, YouTube o LinkedIn) y compartir con tu audiencia.', frequency: 'Mensual' },
      { title: 'Enviarnos los archivos originales',          detail: 'Compartir con SACS los archivos originales de cada video para que también los publiquemos en nuestros canales y multiplicar el alcance.', frequency: 'Mensual' },
      { title: 'Responder a leads asignados en menos de 24 h', detail: 'Cuando SACS te asigne un lead calificado, contactarlo en menos de 24 horas hábiles. Si no puedes en ese plazo, marcarlo en el portal para reasignar y no enfriar la oportunidad.', frequency: 'Por lead' },
      { title: 'Reporte mensual de actividad',               detail: 'Compartir un resumen mensual desde tu portal: contenido publicado, engagement, leads contactados y feedback. Es lo que nos permite mejorar el programa contigo.', frequency: 'Mensual' },
      { title: 'Representar bien la marca SACS',             detail: 'Hablar siempre de forma positiva y profesional sobre la plataforma. Mantener un tono respetuoso al referirte a competidores, clientes y comunidad.', frequency: 'Continuo' },
      { title: 'Uso correcto del logotipo',                  detail: 'Aplicar el logotipo SACS solo en su versión oficial, sin deformar, recolorear ni mezclar con elementos no aprobados. Respetar áreas de protección.', frequency: 'Continuo' },
      { title: 'Uso correcto de tipografías y guidelines',   detail: 'Respetar el manual de marca: tipografías oficiales, paleta de colores, espaciado, fotografía e iconografía aprobada.', frequency: 'Continuo' },
      { title: 'Asistir al kick-off de embajadores',         detail: 'Sesión inicial de 60 minutos para conocer el modelo, los materiales de marca y las mejores prácticas para representar SACS.', frequency: 'Una vez' },
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
      { icon: 'leads', title: 'Leads asignados', detail: 'Recibe oportunidades calificadas de tu zona o vertical.' },
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

    // Strip auto_approve if false (defensive: column may not exist yet in some DBs)
    if (clean.auto_approve === false || clean.auto_approve === undefined) {
      delete clean.auto_approve;
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
