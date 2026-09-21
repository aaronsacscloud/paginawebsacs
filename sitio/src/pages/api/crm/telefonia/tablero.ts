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

    /* ① REUNIONES · las que salieron de llamar y todavía no pasan.
       ⚠️ NO basta con `origen = 'llamada'`. Esa marca la pone el cierre con IA
       al agendar solo desde la cabina, y se pierde justo en el caso que más
       importa: la demo de Maela Sport salió de una llamada de 19 minutos, pero
       como la minuta falló se agendó A MANO desde la página pública y quedó
       como `origen = 'publico'`. En la pantalla no aparecía — la cita más
       trabajada del día, invisible en la pestaña que existe para verlas.
       Se traen TODAS las próximas y se filtra después por evidencia: quién
       habló de verdad con la cabina antes de que se agendara. */
    supabase.from('bookings')
      .select('id, fecha, hora_inicio, invitee_nombre, invitee_empresa, invitee_whatsapp, estado, google_event_id, host_id, contact_id, asunto, origen, created_at, event_types(nombre)')
      .gte('fecha', hoy)
      .not('estado', 'in', '("cancelada","no_asistio","reagendada")')
      .order('fecha').order('hora_inicio').limit(400),

    /* ② SEGUIMIENTOS · lo prometido al hablar y todavía sin hacer.
       Entran TAMBIÉN las vencidas, y salen primero. Una pestaña de «próximas»
       que esconde las que ya se pasaron es exactamente como se pierden: hoy
       hay 6 vencidas y 0 próximas — con el filtro de «sólo futuras» esta
       pantalla se vería vacía y en paz. */
    supabase.from('ti_tareas')
      .select('id, tipo, vence_at, estado, owner_id, contact_id, payload')
      .eq('estado', 'pendiente').eq('payload->>de_llamada', 'true')
      .order('vence_at').limit(300),

    /* ③ CON QUIÉN SE HABLÓ DE VERDAD. Alimenta a la vez las oportunidades y la
       atribución de las reuniones.
       ⚠️ `en_linea_at` NO alcanza: se pone al descolgar. Con esa regla entraba
       tetetlán | Concept store, que fue una llamada de SIETE SEGUNDOS —colgó—,
       y el dueño lo cazó: «sí es una oportunidad, pero no salió del sistema de
       llamadas inteligentes». Se usa el mismo criterio que el resto del CRM
       (`informe.ts`): más de 20 segundos y que no haya contestado una máquina.
       Dos definiciones de «contestó» darían dos pantallas que se desmienten. */
    supabase.from('tel_sesion_items')
      .select('contact_id, en_linea_at, duracion_seg, nota, nombre, empresa, telefono, answered_by')
      .not('contact_id', 'is', null).not('en_linea_at', 'is', null)
      .gt('duracion_seg', 20)
      .gte('en_linea_at', desde).order('en_linea_at', { ascending: false }).limit(1000),

    /* ④ LISTAS · las jornadas, con lo que falta de cada una.
       Las archivadas no salen: son las de prueba que el dueño quiso fuera de la
       vista (21-sep-2026). Archivadas y no borradas porque guardan ~130
       llamadas reales de las que cuelgan las minutas, las grabaciones y lo que
       leen las otras pestañas — ver la migración `jornadas-archivar`. */
    supabase.from('tel_sesiones')
      .select('id, nombre, estado, total, contestadas, buzon, sin_contestar, porteros, invalidos, segundos_hablados, costo_usd, created_at, iniciada_at, terminada_at, owner_id, pausa_motivo, modo')
      .is('archivada_at', null)
      .order('created_at', { ascending: false }).limit(40),
  ]);

  const nombreDe = (id?: string | null) => (equipo || []).find(e => e.id === id)?.nombre || null;

  /* Con quién se habló de verdad, y CUÁNDO fue la primera vez. La fecha importa
     para las reuniones: una cita agendada ANTES de la llamada no salió de la
     llamada, salió de otra cosa. */
  const maquina = (x: any) => /^machine_/.test(String(x?.answered_by || ''));
  const hablo = new Map<string, string>();   // contact_id → primera conversación
  for (const i of hablados || []) {
    if (maquina(i)) continue;
    const k = String(i.contact_id);
    const t = String(i.en_linea_at);
    if (!hablo.has(k) || t < hablo.get(k)!) hablo.set(k, t);
  }

  // ── ① Reuniones ───────────────────────────────────────────────────────────
  const reuniones = (citas || [])
    /* LA ATRIBUCIÓN, POR EVIDENCIA Y NO POR UNA MARCA. Entra si el sistema la
       agendó (`origen = 'llamada'`) O si con esa persona se habló por la cabina
       ANTES de que la cita existiera. Lo segundo es lo que rescata la demo de
       Maela Sport, agendada a mano porque la minuta falló. */
    .map((b: any) => {
      const t = hablo.get(String(b.contact_id || ''));
      const porLlamada = b.origen === 'llamada';
      const trasLlamada = !!t && !!b.created_at && t <= String(b.created_at);
      return { b, porLlamada, trasLlamada };
    })
    .filter(x => x.porLlamada || x.trasLlamada)
    .map(({ b, porLlamada }: any) => ({
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
    /* De dónde salió, dicho en pantalla: una agendada a mano después de hablar
       cuenta igual, pero no es lo mismo — y si aparecen muchas «a mano» es que
       el cierre con IA está fallando, que es justo lo que pasó esta semana. */
    atribucion: porLlamada ? 'automatica' : 'a_mano',
  }));

  /* ── ② SEGUIMIENTOS · SÓLO LO ACCIONABLE ─────────────────────────────────
     Regla del dueño (21-sep-2026): «las de llamadas de seguimiento solo debe
     mostrarme las que son del mismo día o los días siguientes, para ver
     únicamente info accionable».
     Lo vencido NO se borra —sería perderlo—: sale del listado y se cuenta
     aparte, para poder mirarlo cuando uno quiera y no cuando estorba. La
     pantalla lo enseña con un botón, no escondido. */
  const finVentana = new Date(Date.now() + 7 * 86400e3).toISOString();
  const todas = (tareas || []).map((t: any) => {
    const p = t.payload || {};
    return {
      id: t.id,
      cuando: t.vence_at,
      vencida: String(t.vence_at || '') < ahora,
      tipo: t.tipo,
      quien: p.nombre || p.quien || null,
      /* El número vive en `whatsapp` dentro del payload (así lo escribe el
         cierre); `telefono` casi nunca está. Se miran los dos o el botón de
         «Llamar ahora» se queda sin a quién marcar. */
      telefono: p.whatsapp || p.telefono || null,
      que: p.titulo || p.que || p.detalle || (t.tipo === 'llamada' ? 'Llamar de vuelta' : 'Responder'),
      duenio: nombreDe(t.owner_id) || 'Sin dueño',
      contact_id: t.contact_id || null,
    };
  });
  const seguimientos = todas.filter(s => !s.vencida && String(s.cuando || '') <= finVentana);
  const vencidos = todas.filter(s => s.vencida);

  // ── ③ Oportunidades ───────────────────────────────────────────────────────
  /* Un contacto puede haber hablado tres veces: nos quedamos con la ÚLTIMA
     conversación, que es la que explica dónde está hoy. */
  const ultima = new Map<string, any>();
  for (const i of hablados || []) if (!ultima.has(String(i.contact_id))) ultima.set(String(i.contact_id), i);

  let oportunidades: any[] = [];
  let descalificados: any[] = [];
  const ids = [...ultima.keys()];
  if (ids.length) {
    /* En tandas de 150: `.in()` con una lista larga revienta la URL de
       PostgREST — la misma regla que ya se aprendió en el ABM. */
    const filas: any[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase.from('contacts')
        .select('id, nombre, apellido, telefono, whatsapp, email, lifecycle_stage, giro, sucursales_interes, owner_id, company_id, descarte_categoria, calificacion_motivo, companies(nombre_comercial, nombre)')
        .in('id', ids.slice(i, i + 150))
        /* Las que avanzaron. `rezagado` y `descalificado` no entran: son el
           resultado normal de llamar, no una oportunidad, y con ellas dentro
           esta pestaña sería otra vez la lista de todo el mundo. */
        /* Los que AVANZARON y los que se DESCARTARON, en la misma consulta:
           son las dos caras de haber llamado, y separarlas en dos viajes a la
           base para partirlas después sería pagar dos veces lo mismo.
           `rezagado` sigue fuera: no es un desenlace, es el estado normal de
           quien todavía no contesta. */
        .in('lifecycle_stage', ['oportunidad', 'en_cotizacion', 'cliente', 'descalificado', 'perdido'])
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
    const armar = (c: any) => {
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
        /* El porqué del descarte. Medido: `descarte_categoria`, `desenlace` y
           `calificacion_motivo` están VACÍOS en los diez descalificados que
           pasaron por la cabina — nadie los llena a mano al colgar. Lo único
           que explica el caso es la nota del cierre con IA, así que es eso lo
           que se enseña, y no un campo bonito que siempre saldría «—». */
        motivo: c.descarte_categoria || c.calificacion_motivo || null,
      };
    };
    const porEtapa = (e: string[]) => filas.filter((c: any) => e.includes(c.lifecycle_stage))
      .map(armar).sort((a, b) => String(b.hablamos || '').localeCompare(String(a.hablamos || '')));
    oportunidades = porEtapa(['oportunidad', 'en_cotizacion', 'cliente']);
    descalificados = porEtapa(['descalificado', 'perdido']);
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
    reuniones, seguimientos, vencidos, oportunidades, descalificados, listas,
    /* Los contadores de las pestañas salen de aquí y no de `array.length` en
       el navegador, para que el número y la tabla no se puedan contradecir. */
    conteos: {
      reuniones: reuniones.length,
      seguimientos: seguimientos.length,
      seguimientos_vencidos: vencidos.length,
      oportunidades: oportunidades.length,
      descalificados: descalificados.length,
      listas: listas.length,
      listas_reanudables: listas.filter(l => l.reanudable).length,
    },
  });
};
