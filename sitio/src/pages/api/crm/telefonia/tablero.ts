/* LLAMADAS INTELIGENTES · LO QUE SALIÓ DE LLAMAR, EN CUATRO LISTAS.
 *
 * PEDIDO DEL DUEÑO (21-sep-2026): «quita los cards que aparecen de KPIs y sólo
 * vamos a agregar un data table que muestre en tabs: reuniones agendadas (por
 * llamada inteligente, que son próximas); en otro, llamadas de seguimiento
 * próximas; en otro, oportunidades (que se generaron por las llamadas
 * inteligentes, pero que aparezcan los datos de los usuarios); y otro tab que
 * muestre las listas generadas y el status de cada una, si falta reanudar
 * alguna. Y todo eso que sea fácil de entender».
 *
 * EL CAMBIO DE FONDO, Y POR QUÉ ES UNA MEJORA
 * Lo que había eran seis cifras de treinta días —24 conversaciones, 96 minutos,
 * 8 citas— y con ninguna se podía hacer nada: dicen cómo vas, no a quién le
 * toca. Aquí cada renglón es una persona con nombre, y cada pestaña contesta
 * una pregunta que sí tiene siguiente paso:
 *
 *   ¿A quién voy a ver?          → reuniones
 *   ¿A quién le dije que llamo?  → seguimientos
 *   ¿Quién avanzó por llamarle?  → oportunidades
 *   ¿Qué lista dejé a medias?    → listas
 *
 * LA REGLA QUE DECIDE SI UNA FILA ENTRA: que se pueda rastrear hasta una
 * llamada de la cabina. Nada de «todas las reuniones» ni «todas las tareas»:
 * esta pantalla responde por lo que produjo LLAMAR, y mezclar lo que llegó por
 * otro lado la vuelve otro tablero general de los que ya hay tres.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const hoyCdmx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const hoy = hoyCdmx();
  const ahora = new Date().toISOString();
  /* 90 días hacia atrás para buscar quién habló con la cabina: es el horizonte
     en el que una llamada todavía explica una oportunidad. Más allá, la
     atribución es una casualidad con fecha. */
  const desde = new Date(Date.now() - 90 * 86400e3).toISOString();

  const [{ data: equipo }, { data: citas }, { data: tareas }, { data: hablados }, { data: sesiones }] = await Promise.all([
    supabase.from('team_members').select('id, nombre').limit(80),

    /* ① REUNIONES · las que NACIERON de una llamada y todavía no pasan.
       `origen = 'llamada'` lo pone el cierre con IA al agendar desde la cabina:
       es la marca que separa «salió de llamar» de «se agendó desde la web». */
    supabase.from('bookings')
      .select('id, fecha, hora_inicio, invitee_nombre, invitee_empresa, invitee_whatsapp, estado, google_event_id, host_id, contact_id, asunto, event_types(nombre)')
      .eq('origen', 'llamada').gte('fecha', hoy)
      .not('estado', 'in', '("cancelada","no_asistio","reagendada")')
      .order('fecha').order('hora_inicio').limit(200),

    /* ② SEGUIMIENTOS · lo prometido al hablar y todavía sin hacer.
       Entran TAMBIÉN las vencidas, y salen primero. Una pestaña de «próximas»
       que esconde las que ya se pasaron es exactamente como se pierden: hoy
       hay 6 vencidas y 0 próximas — con el filtro de «sólo futuras» esta
       pantalla se vería vacía y en paz. */
    supabase.from('ti_tareas')
      .select('id, tipo, vence_at, estado, owner_id, contact_id, payload')
      .eq('estado', 'pendiente').eq('payload->>de_llamada', 'true')
      .order('vence_at').limit(200),

    /* ③ OPORTUNIDADES · con quién se HABLÓ de verdad (`en_linea_at`), no a
       quién se marcó. La etapa la filtramos después, ya con el contacto. */
    supabase.from('tel_sesion_items')
      .select('contact_id, en_linea_at, duracion_seg, nota, nombre, empresa, telefono')
      .not('contact_id', 'is', null).not('en_linea_at', 'is', null)
      .gte('en_linea_at', desde).order('en_linea_at', { ascending: false }).limit(1000),

    /* ④ LISTAS · las jornadas, con lo que falta de cada una. */
    supabase.from('tel_sesiones')
      .select('id, nombre, estado, total, contestadas, buzon, sin_contestar, porteros, invalidos, segundos_hablados, costo_usd, created_at, iniciada_at, terminada_at, owner_id, pausa_motivo, modo')
      .order('created_at', { ascending: false }).limit(40),
  ]);

  const nombreDe = (id?: string | null) => (equipo || []).find(e => e.id === id)?.nombre || null;

  // ── ① Reuniones ───────────────────────────────────────────────────────────
  const reuniones = (citas || []).map((b: any) => ({
    id: b.id,
    fecha: b.fecha,
    hora: String(b.hora_inicio || '').slice(0, 5),
    quien: b.invitee_nombre || 'Sin nombre',
    empresa: b.invitee_empresa || null,
    telefono: b.invitee_whatsapp || null,
    tipo: b.event_types?.nombre || b.asunto || 'Reunión',
    host: nombreDe(b.host_id) || 'Sin anfitrión',
    estado: b.estado,
    /* Sin evento de Google la cita existe sólo en el CRM: no le suena a nadie,
       ni a nosotros ni al cliente. Es el dato que más veces salva una cita. */
    en_google: !!b.google_event_id,
    contact_id: b.contact_id || null,
    es_hoy: b.fecha === hoy,
  }));

  // ── ② Seguimientos ────────────────────────────────────────────────────────
  const seguimientos = (tareas || []).map((t: any) => {
    const p = t.payload || {};
    return {
      id: t.id,
      cuando: t.vence_at,
      vencida: String(t.vence_at || '') < ahora,
      tipo: t.tipo,
      quien: p.nombre || p.quien || null,
      telefono: p.telefono || null,
      que: p.titulo || p.que || p.detalle || (t.tipo === 'llamada' ? 'Llamar de vuelta' : 'Responder'),
      duenio: nombreDe(t.owner_id) || 'Sin dueño',
      contact_id: t.contact_id || null,
    };
  });

  // ── ③ Oportunidades ───────────────────────────────────────────────────────
  /* Un contacto puede haber hablado tres veces: nos quedamos con la ÚLTIMA
     conversación, que es la que explica dónde está hoy. */
  const ultima = new Map<string, any>();
  for (const i of hablados || []) if (!ultima.has(String(i.contact_id))) ultima.set(String(i.contact_id), i);

  let oportunidades: any[] = [];
  const ids = [...ultima.keys()];
  if (ids.length) {
    /* En tandas de 150: `.in()` con una lista larga revienta la URL de
       PostgREST — la misma regla que ya se aprendió en el ABM. */
    const filas: any[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase.from('contacts')
        .select('id, nombre, apellido, telefono, whatsapp, email, lifecycle_stage, giro, sucursales_interes, owner_id, company_id, companies(nombre_comercial, nombre)')
        .in('id', ids.slice(i, i + 150))
        /* Las que avanzaron. `rezagado` y `descalificado` no entran: son el
           resultado normal de llamar, no una oportunidad, y con ellas dentro
           esta pestaña sería otra vez la lista de todo el mundo. */
        .in('lifecycle_stage', ['oportunidad', 'en_cotizacion', 'cliente'])
        .is('archived_at', null);
      filas.push(...(data || []));
    }
    /* El dinero, si ya hay una oportunidad abierta con monto. Se pide sólo para
       estos contactos: la tabla entera no hace falta. */
    const dinero = new Map<string, any>();
    if (filas.length) {
      const { data: ds } = await supabase.from('deals')
        .select('contact_id, nombre, valor_mensual, valor_total, pipeline_stage, stage, created_at')
        .in('contact_id', filas.map(f => f.id)).is('archived_at', null)
        .order('created_at', { ascending: false });
      for (const d of ds || []) if (!dinero.has(String(d.contact_id))) dinero.set(String(d.contact_id), d);
    }
    oportunidades = filas.map((c: any) => {
      const i = ultima.get(String(c.id));
      const d = dinero.get(String(c.id));
      return {
        contact_id: c.id,
        quien: `${c.nombre || ''} ${c.apellido || ''}`.trim() || i?.nombre || 'Sin nombre',
        empresa: c.companies?.nombre_comercial || c.companies?.nombre || i?.empresa || null,
        telefono: c.telefono || c.whatsapp || i?.telefono || null,
        email: c.email || null,
        etapa: c.lifecycle_stage,
        giro: c.giro || null,
        sucursales: c.sucursales_interes ?? null,
        duenio: nombreDe(c.owner_id) || 'Sin dueño',
        hablamos: i?.en_linea_at || null,
        minutos: i?.duracion_seg ? Math.round(i.duracion_seg / 60) : null,
        /* La nota del cierre con IA: es lo que hace que este renglón se
           entienda sin abrir nada. Recortada, que aquí es una tabla. */
        nota: i?.nota ? String(i.nota).split('\n')[0].slice(0, 260) : null,
        monto: d ? Number(d.valor_mensual || d.valor_total || 0) || null : null,
        deal: d?.nombre || null,
      };
    }).sort((a, b) => String(b.hablamos || '').localeCompare(String(a.hablamos || '')));
  }

  // ── ④ Listas ──────────────────────────────────────────────────────────────
  /* Cuántos quedaron SIN MARCAR en cada jornada. Es el dato que contesta «¿me
     falta reanudar alguna?», y no se puede sacar de `tel_sesiones`: sus
     contadores cuentan resultados, no lo que nunca se intentó. */
  const pendientePorSesion = new Map<string, number>();
  const idsSes = (sesiones || []).map(s => s.id);
  if (idsSes.length) {
    const { data: pend } = await supabase.from('tel_sesion_items')
      .select('sesion_id').in('sesion_id', idsSes.slice(0, 150)).eq('estado', 'pendiente').limit(5000);
    for (const p of pend || []) pendientePorSesion.set(String(p.sesion_id), (pendientePorSesion.get(String(p.sesion_id)) || 0) + 1);
  }
  const listas = (sesiones || []).map((s: any) => {
    const faltan = pendientePorSesion.get(String(s.id)) || 0;
    const viva = ['activa', 'pausada'].includes(String(s.estado));
    return {
      id: s.id,
      nombre: s.nombre || 'Jornada',
      fecha: String(s.created_at || '').slice(0, 10),
      estado: s.estado,
      /* «Se puede reanudar» no es lo mismo que «está viva»: una jornada
         terminada con gente sin marcar también se puede retomar, y ésa es
         justo la que se pierde de vista. */
      reanudable: faltan > 0,
      viva,
      total: Number(s.total || 0),
      contestadas: Number(s.contestadas || 0),
      buzon: Number(s.buzon || 0),
      sin_contestar: Number(s.sin_contestar || 0),
      faltan,
      minutos: Math.round(Number(s.segundos_hablados || 0) / 60),
      costo: Number(s.costo_usd || 0),
      duenio: nombreDe(s.owner_id) || 'Sin dueño',
      motivo_pausa: s.pausa_motivo || null,
      modo: s.modo || null,
    };
  });

  return json({
    ok: true, hoy,
    reuniones, seguimientos, oportunidades, listas,
    /* Los contadores de las pestañas salen de aquí y no de `array.length` en
       el navegador, para que el número y la tabla no se puedan contradecir. */
    conteos: {
      reuniones: reuniones.length,
      seguimientos: seguimientos.length,
      seguimientos_vencidos: seguimientos.filter(s => s.vencida).length,
      oportunidades: oportunidades.length,
      listas: listas.length,
      listas_reanudables: listas.filter(l => l.reanudable).length,
    },
  });
};
