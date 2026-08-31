import { conMicroCache } from '../../../../lib/crm/micro-cache';
// WHATSAPP · La lista OMNICANAL del inbox: WhatsApp + correo, agrupados por
// CONTACTO (una fila por persona con sus canales juntos; sin contacto, una
// fila por conversación suelta). Federación pura: wa_conversaciones y
// email_conversations no se tocan, solo se leen juntas.
//
// GET ?filtro=todas|mias|sin_asignar|no_leidas|pospuestas & etapa=<lifecycle>
//     & search= & tipo= & plan= & etiqueta=<uuid> & asignado=<uuid|nadie>
//     & estado=abierta|pendiente|resuelta & sin_contacto=1 & limit & offset
//     (la búsqueda entra al historial de WhatsApp Y de correo)
// → { conversaciones: [fila unificada], counts }
//
// Fila unificada: { id, wa_id, email_id, canales:['wa','email'], telefono,
//   contacto, empresa, ultimo_mensaje_at/texto, ultimo_canal, no_leidos,
//   asignado_a, estado_crm, snooze_until }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { telefonoWhatsApp } from '../../../../lib/telefono';
import { cumpleVista, type ConfigVista } from '../../../../lib/whatsapp/filtros';

export const prerender = false;

// Caché de proceso (60 s) del set de conversaciones con nota interna.
let notasCache: { at: number; data: any[] } | null = null;
async function notasConCache(): Promise<{ data: any[] }> {
  if (notasCache && Date.now() - notasCache.at < 60_000) return { data: notasCache.data };
  const { data } = await supabase.from('wa_notas').select('conversation_id')
    .not('conversation_id', 'is', null).order('created_at', { ascending: false }).limit(1000);
  notasCache = { at: Date.now(), data: data || [] };
  return { data: notasCache.data };
}
/* ═══ Los números del propio equipo NO son bandeja ═══
 *
 * El CRM se manda avisos a sí mismo —«Aviso de tu cuenta del CRM: 1 lead sin
 * primer toque»— al WhatsApp de cada team_member, que es a donde `aviso-lead`
 * los envía. Esos hilos aparecían en el inbox como si fueran un cliente
 * esperando respuesta: ocupaban un renglón de la bandeja del día y sumaban a
 * los contadores de «no contestadas». Nadie le contesta a su propio sistema.
 *
 * La regla se saca de team_members, no de una lista escrita a mano: al dar de
 * alta a alguien con su número, su hilo desaparece del inbox solo, sin que
 * nadie se acuerde de marcarlo. Los mensajes SIGUEN llegando y guardándose —
 * esto solo decide qué se enseña.
 *
 * Se comparan los últimos 10 dígitos: en la base conviven "+52155…", "52155…"
 * y "55…" para el mismo teléfono, así que comparar el texto tal cual no
 * encuentra nada.
 */
const digitos = (t?: string | null) => String(t || '').replace(/\D/g, '').slice(-10);
let equipoCache: { at: number; tels: Set<string> } | null = null;
async function telsDelEquipo(): Promise<Set<string>> {
  if (equipoCache && Date.now() - equipoCache.at < 300_000) return equipoCache.tels;
  const { data } = await supabase.from('team_members')
    .select('whatsapp').not('whatsapp', 'is', null);
  const tels = new Set<string>((data || []).map((m: any) => digitos(m.whatsapp)).filter(Boolean));
  equipoCache = { at: Date.now(), tels };
  return tels;
}

const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const _GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const filtro = url.searchParams.get('filtro') || 'todas';
  const etapa = url.searchParams.get('etapa') || '';
  const search = (url.searchParams.get('search') || '').trim();
  const tipo = url.searchParams.get('tipo') || '';
  const plan = url.searchParams.get('plan') || '';
  const etiqueta = url.searchParams.get('etiqueta') || '';
  const asignado = url.searchParams.get('asignado') || '';
  const estado = url.searchParams.get('estado') || '';
  const sinContacto = url.searchParams.get('sin_contacto') === '1';
  // Vista custom (builder): ?vista=<json urlencoded> {modo, logica, condiciones}
  let vista: ConfigVista | null = null;
  try { const raw = url.searchParams.get('vista'); if (raw) vista = JSON.parse(raw); } catch { vista = null; }
  // MODO CONTADORES (?vistas=[{id,config}…]): el barra lateral necesitaba el
  // número de cada vista guardada y lo pedía llamando A ESTE MISMO endpoint una
  // vez por vista, en serie. Medido: 25 llamadas y 7.7 s solo para entrar al
  // inbox — y cada una reconstruía las MISMAS 1000 conversaciones, 1000 correos,
  // 600 contactos y 2000 visitas para devolver un entero. El universo se arma
  // una vez y los filtros, que ya eran en memoria, se aplican N veces sobre él.
  let vistasDefs: Array<{ id: string; config: any }> = [];
  try { const raw = url.searchParams.get('vistas'); if (raw) vistasDefs = JSON.parse(raw) || []; } catch { vistasDefs = []; }
  if (!Array.isArray(vistasDefs)) vistasDefs = [];
  // Para decidir qué enriquecimiento cargar hace falta mirar las condiciones de
  // TODAS las vistas, no solo las de la actual.
  const condsUnion = [
    ...(vista?.condiciones || []),
    ...vistasDefs.flatMap(d => (d?.config?.condiciones || [])),
  ];
  const usaCampo = (nombres: string[]) => condsUnion.some((c: any) => nombres.includes(c?.campo));
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const offset = Number(url.searchParams.get('offset') || 0);

  const SELECT_JOINS = 'contacts(id, nombre, apellido, email, lifecycle_stage, tipo, fuente, created_at, next_followup, owner_id, estatus_lead, respondio_at, retenido_hasta, prueba_estado, prueba_cuenta, prueba_fin), companies(id, nombre, nombre_comercial, plan, mrr, sucursales, giro, estado_cuenta, sacs_account, fecha_renovacion, dias_sin_venta, ultima_venta_at, last_payment_at, health_score)';
  const [{ data: convsWa, error }, { data: convsEm }, { data: lecturas }, { data: mencionesRaw }, { data: notasRaw }] = await Promise.all([
    supabase.from('wa_conversaciones').select(`*, ${SELECT_JOINS}`)
      .order('ultimo_mensaje_at', { ascending: false }).limit(1000),
    supabase.from('email_conversations').select(`*, ${SELECT_JOINS}`)
      .order('ultimo_mensaje_at', { ascending: false }).limit(1000),
    // 28) lecturas de ESTE usuario: el no-leído es personal
    user ? supabase.from('wa_lecturas').select('conversation_id, leido_at').eq('user_id', user.id) : Promise.resolve({ data: [] as any[] }),
    // 24) menciones @ a este usuario en notas (para "Requiere mi acción")
    user ? supabase.from('wa_notas').select('conversation_id, created_at').contains('menciones', [user.id]).order('created_at', { ascending: false }).limit(300) : Promise.resolve({ data: [] as any[] }),
    // E8.1) Qué conversaciones traen nota interna del equipo: hay que saberlo
    // ANTES de abrirla, no después de leerla entera. Con caché de 60 s: el
    // inbox se refresca cada 6 s y las notas casi no cambian — sin esto sería
    // una consulta de mil filas cada seis segundos por pestaña abierta.
    notasConCache(),
  ]);
  const telsEquipo = await telsDelEquipo();
  if (error) return json({ error: error.message }, 500);
  const leidoAt = new Map<string, string>((lecturas || []).map((l: any) => [l.conversation_id, l.leido_at]));
  // Conteo personal: entrantes desde mi última lectura. Si nunca la abrí, vale
  // el contador global (= entrantes desde nuestra última respuesta).
  const pendientesPersonal = new Map<string, number>();
  if (user && leidoAt.size) {
    const { data: n } = await supabase.rpc('wa_no_leidos_por_usuario', { uid: user.id });
    for (const r of n || []) pendientesPersonal.set(r.conversation_id, Number(r.n));
  }
  const conNota = new Set<string>((notasRaw || []).map((n: any) => String(n.conversation_id)));
  const mencionesPend = new Set<string>();
  for (const m of mencionesRaw || []) {
    const l = leidoAt.get(m.conversation_id);
    if (!l || m.created_at > l) mencionesPend.add(m.conversation_id);
  }

  const contactoDe = (c: any) => c.contacts ? {
    id: c.contacts.id,
    nombre: `${c.contacts.nombre || ''} ${c.contacts.apellido || ''}`.trim() || null,
    email: c.contacts.email, lifecycle_stage: c.contacts.lifecycle_stage, tipo: c.contacts.tipo,
  } : null;
  const empresaDe = (c: any) => c.companies ? {
    id: c.companies.id, nombre: c.companies.nombre_comercial || c.companies.nombre,
    plan: c.companies.plan, mrr: c.companies.mrr,
  } : null;
  const extraDe = (c: any) => ({
    fuente: c.contacts?.fuente || null, creado: c.contacts?.created_at || null,
    sucursales: c.companies?.sucursales ?? null, giro: c.companies?.giro || null,
    estado_cuenta: c.companies?.estado_cuenta || null, sacs_account: c.companies?.sacs_account || null,
    fecha_renovacion: c.companies?.fecha_renovacion || null, next_followup: c.contacts?.next_followup || null,
    owner_id: c.contacts?.owner_id || null, dias_sin_venta: c.companies?.dias_sin_venta ?? null,
    ultima_venta_at: c.companies?.ultima_venta_at || null, last_payment_at: c.companies?.last_payment_at || null,
    health_score: c.companies?.health_score ?? null,
    estatus_lead: c.contacts?.estatus_lead || null, respondio_at: c.contacts?.respondio_at || null,
    retenido_hasta: c.contacts?.retenido_hasta || null,
    ultimo_saliente_at: c.ultimo_saliente_at || null, cierre_categoria: c.cierre_categoria || null,
    etiquetas: [] as string[], etiquetas_conv: [] as string[],
  });

  // ── Filas base de WhatsApp ──
  const porClave = new Map<string, any>();
  for (const c of convsWa || []) {
    const fila = {
      id: c.id, wa_id: c.id, email_id: null as string | null, canales: ['wa'],
      telefono: c.telefono, estado: c.estado,
      ultimo_mensaje_at: c.ultimo_mensaje_at, ultimo_mensaje_texto: c.ultimo_mensaje_texto,
      ultima_direccion: c.ultima_direccion, ultimo_canal: 'wa',
      no_leidos: leidoAt.has(c.id) ? (pendientesPersonal.get(c.id) || 0) : (c.no_leidos || 0),
      ventana_expira_at: c.ultimo_entrante_at ? new Date(new Date(c.ultimo_entrante_at).getTime() + 24 * 3600e3).toISOString() : null,
      alerta: c.alerta || null, mencion: mencionesPend.has(c.id), tiene_notas: conNota.has(c.id),
      estado_crm: c.estado_crm || 'abierta', snooze_until: c.snooze_until || null,
      // La fila se arma con una lista EXPLÍCITA de campos, no con ...c: si no
      // se nombra aquí, el filtro de más abajo nunca lo ve. Marcar una
      // conversación como interna se guardaba bien y no pasaba nada.
      // Interna por marca manual O por ser un número del propio equipo. Lo
      // segundo no se puede desmarcar desde el hilo a propósito: si alguien lo
      // quitara, el aviso automático volvería a la bandeja al día siguiente.
      interna: !!c.interna || telsEquipo.has(digitos(c.telefono)),
      asignado_a: c.asignado_a, contact_id: c.contact_id, company_id: c.company_id,
      contacto: contactoDe(c), empresa: empresaDe(c),
      _extra: extraDe(c),
    };
    const clave = c.contact_id ? `ct:${c.contact_id}` : `wa:${c.id}`;
    const previa = porClave.get(clave);
    // Dos conversaciones WA del mismo contacto: la más reciente es el ancla,
    // los no-leídos se suman.
    if (!previa) porClave.set(clave, fila);
    else if (String(fila.ultimo_mensaje_at) > String(previa.ultimo_mensaje_at)) {
      porClave.set(clave, { ...fila, no_leidos: fila.no_leidos + previa.no_leidos });
    } else previa.no_leidos += fila.no_leidos;
  }

  // ── Sumar el canal de correo ──
  for (const ce of convsEm || []) {
    const clave = ce.contact_id ? `ct:${ce.contact_id}` : `em:${ce.id}`;
    const fila = porClave.get(clave);
    const noLeidoEm = ce.leida ? 0 : 1;
    if (fila) {
      if (!fila.canales.includes('email')) fila.canales.push('email');
      fila.email_id = fila.email_id || ce.id;
      fila.no_leidos += noLeidoEm;
      if (String(ce.ultimo_mensaje_at) > String(fila.ultimo_mensaje_at)) {
        fila.ultimo_mensaje_at = ce.ultimo_mensaje_at;
        fila.ultimo_mensaje_texto = ce.asunto || 'Correo';
        fila.ultimo_canal = 'email';
      }
    } else {
      porClave.set(clave, {
        id: ce.id, wa_id: null, email_id: ce.id, canales: ['email'],
        telefono: ce.email, estado: 'active',
        ultimo_mensaje_at: ce.ultimo_mensaje_at, ultimo_mensaje_texto: ce.asunto || 'Correo',
        ultima_direccion: null, ultimo_canal: 'email',
        no_leidos: noLeidoEm,
        estado_crm: ce.estado === 'cerrada' ? 'resuelta' : 'abierta', snooze_until: null,
        asignado_a: ce.asignado_a || null, contact_id: ce.contact_id, company_id: ce.company_id,
        contacto: contactoDe(ce), empresa: empresaDe(ce),
        _extra: extraDe(ce),
      });
    }
  }
  // Contactos SIN conversación (filas virtuales) cuando la vista los pide.
  if (vista && (vista.modo === 'todas' || vista.modo === 'solo_contactos')) {
    const { data: cts } = await supabase.from('contacts')
      .select('id, nombre, apellido, email, lifecycle_stage, tipo, fuente, created_at, next_followup, owner_id, estatus_lead, respondio_at, retenido_hasta, whatsapp, telefono, company_id, companies(id, nombre, nombre_comercial, plan, mrr, sucursales, giro, estado_cuenta, sacs_account, fecha_renovacion, dias_sin_venta, ultima_venta_at, last_payment_at, health_score)')
      .is('archived_at', null).limit(600);
    for (const ct of cts || []) {
      const clave = `ct:${ct.id}`;
      if (porClave.has(clave)) continue;   // ya tiene conversación
      const wrap = { contacts: ct, companies: ct.companies };
      porClave.set(clave, {
        id: `virtual:${ct.id}`, wa_id: null, email_id: null, canales: [], virtual: true,
        telefono: ct.whatsapp || ct.telefono || ct.email || '', estado: 'active',
        ultimo_mensaje_at: ct.created_at, ultimo_mensaje_texto: null,
        ultima_direccion: null, ultimo_canal: null, no_leidos: 0,
        estado_crm: 'abierta', snooze_until: null,
        asignado_a: null, contact_id: ct.id, company_id: ct.company_id,
        contacto: contactoDe(wrap), empresa: empresaDe(wrap), _extra: extraDe(wrap),
      });
    }
  }
  const todas = [...porClave.values()]
    .sort((a, b) => String(b.ultimo_mensaje_at || '').localeCompare(String(a.ultimo_mensaje_at || '')));

  // ── Contadores del rail sobre el universo unificado ──
  const ahora = new Date().toISOString();
  const pospuesta = (c: any) => c.snooze_until && c.snooze_until > ahora;
  // 24) "Requiere mi acción": el cliente habló y es mía (o de nadie), me
  // mencionaron, el seguimiento del contacto ya venció, o la ventana se cierra.
  const hoy = ahora.slice(0, 10);
  const requiereAccion = (c: any) => !c.virtual && c.estado_crm !== 'resuelta' && (
    (c.ultima_direccion === 'entrante' && (!c.asignado_a || (user && c.asignado_a === user.id))) ||
    (!!c.alerta && (!c.asignado_a || (user && c.asignado_a === user.id))) ||   // el último envío falló: alguien tiene que decidir
    c.mencion ||
    (!!c._extra?.next_followup && c._extra.next_followup <= hoy && (!c.asignado_a || (user && c.asignado_a === user.id))) ||
    (!!c.ventana_expira_at && c.ultima_direccion === 'entrante' && (new Date(c.ventana_expira_at).getTime() - Date.now()) < 4 * 3600e3 && new Date(c.ventana_expira_at).getTime() > Date.now())
  );
  const counts: any = { todas: 0, mias: 0, sin_asignar: 0, no_leidas: 0, sin_respuesta: 0, pospuestas: 0, accion: 0, internas: 0, por_etapa: {} as Record<string, number> };
  for (const c of todas) {
    // No cuentan en ninguna bandeja porque no son trabajo, pero SÍ se cuentan
    // aparte: esconder algo sin dejar ver cuánto escondiste es un agujero.
    if (c.interna) { counts.internas++; continue; }
    /* Un descalificado tampoco es trabajo. Alguien ya lo revisó y lo descartó,
       así que sumarlo a «sin respuesta» o «no contestadas» pide contestarle a
       quien ya se decidió que no. Se ve en su vista y en ningún otro lado —
       pero SÍ se cuenta para el ciclo de vida, o su propia vista no tendría
       número y el menú no la enseñaría. */
    if (c.contacto?.lifecycle_stage === 'descalificado') {
      if (c.estado_crm !== 'resuelta') counts.por_etapa.descalificado = (counts.por_etapa.descalificado || 0) + 1;
      continue;
    }
    if (c.virtual) continue;   // los contactos sin conversación no inflan las bandejas
    if (pospuesta(c)) { counts.pospuestas++; continue; }   // dormidas: solo su cajón
    counts.todas++;
    if (requiereAccion(c)) counts.accion++;
    if (user && c.asignado_a === user.id) counts.mias++;
    if (!c.asignado_a && c.estado_crm !== 'resuelta') counts.sin_asignar++;
    if (c.ultima_direccion === 'entrante' && c.estado_crm !== 'resuelta') counts.no_leidas++;   // el cliente habló y nadie contestó
    // El espejo: nosotros escribimos al último y ELLOS no volvieron. Son las
    // dos mitades del seguimiento y hasta ahora solo se contaba una, así que la
    // pantalla de Inicio no podía avisar de la que se queda sin cerrar.
    if (c.ultima_direccion === 'saliente' && c.estado_crm !== 'resuelta') counts.sin_respuesta++;
    /* El ciclo se cuenta SOLO sobre lo no resuelto, que es el universo al que
       lleva el menú de vistas. Contando también las resueltas, el menú decía
       «Oportunidades 6» y al entrar salían 0 — un número que no corresponde
       con lo que se ve es peor que no tener número. */
    const e = c.contacto?.lifecycle_stage;
    if (e && c.estado_crm !== 'resuelta') counts.por_etapa[e] = (counts.por_etapa[e] || 0) + 1;
  }

  // Etiquetas: si la vista o el filtro las usan, se cargan y se pegan a _extra.
  const vistaUsaEtiquetas = usaCampo(['etiqueta']);
  if (vistaUsaEtiquetas) {
    const ids = [...new Set(todas.map(c => c.company_id).filter(Boolean))];
    const { data: asig } = ids.length
      ? await supabase.from('crm_etiqueta_asignaciones')
          .select('etiqueta_id, entidad_id').eq('entidad', 'company').in('entidad_id', ids)
      : { data: [] as any[] };
    const mapa = new Map<string, string[]>();
    for (const a of asig || []) {
      const arr = mapa.get(a.entidad_id) || []; arr.push(a.etiqueta_id); mapa.set(a.entidad_id, arr);
    }
    for (const c of todas) if (c.company_id) c._extra.etiquetas = mapa.get(c.company_id) || [];
  }

  if (usaCampo(['visita_web'])) {
    const ids = todas.map(c => c.contact_id).filter(Boolean);
    if (ids.length) {
      // Última visita por contacto, en una sola pasada.
      const { data: vis } = await supabase.from('contact_visits')
        .select('contact_id, created_at').in('contact_id', ids)
        .order('created_at', { ascending: false }).limit(2000);
      const mapa = new Map<string, string>();
      for (const v of vis || []) if (v.contact_id && !mapa.has(v.contact_id)) mapa.set(v.contact_id, v.created_at);
      for (const c of todas) if (c.contact_id) c._extra.ultima_visita_web = mapa.get(c.contact_id) || null;
    }
  }

  // Llamadas (Leads v2): solo cuando la vista pregunta por el teléfono.
  if (usaCampo(['tuvo_llamada', 'tiene_minuta', 'ultima_llamada', 'min_llamadas'])) {
    const ids = todas.map(c => c.wa_id).filter(Boolean);
    const { data: ll } = ids.length
      ? await supabase.from('wa_llamadas').select('conversation_id, created_at, duracion_seg, minuta').in('conversation_id', ids)
      : { data: [] as any[] };
    const mapa = new Map<string, any>();
    for (const l of ll || []) {
      const a = mapa.get(l.conversation_id) || { n: 0, seg: 0, minuta: false, ult: null as string | null };
      a.n++; a.seg += l.duracion_seg || 0; a.minuta = a.minuta || !!l.minuta;
      if (!a.ult || l.created_at > a.ult) a.ult = l.created_at;
      mapa.set(l.conversation_id, a);
    }
    for (const c of todas) {
      const a = c.wa_id ? mapa.get(c.wa_id) : null;
      c._extra.llamadas_n = a?.n || 0; c._extra.llamadas_seg = a?.seg || 0;
      c._extra.llamada_con_minuta = a?.minuta || false; c._extra.ultima_llamada_at = a?.ult || null;
    }
  }

  if (usaCampo(['etiqueta_conv'])) {
    const ids = todas.map(c => c.wa_id).filter(Boolean);
    const { data: asig } = ids.length
      ? await supabase.from('crm_etiqueta_asignaciones').select('etiqueta_id, entidad_id').eq('entidad', 'wa_conversacion').in('entidad_id', ids)
      : { data: [] as any[] };
    const mapa = new Map<string, string[]>();
    for (const a of asig || []) { const arr = mapa.get(a.entidad_id) || []; arr.push(a.etiqueta_id); mapa.set(a.entidad_id, arr); }
    for (const c of todas) if (c.wa_id) c._extra.etiquetas_conv = mapa.get(c.wa_id) || [];
  }

  // Etiquetas de la empresa (solo si el filtro las pide: una query extra).
  // Se resuelve como MAPA etiqueta→empresas y no como un set suelto porque el
  // modo contadores cuenta varias vistas de un golpe y cada una puede pedir una
  // etiqueta distinta: así siguen siendo UNA consulta, no una por vista.
  const etiquetasPedidas = [...new Set([etiqueta, ...vistasDefs.map(d => String(d?.config?.etiqueta || ''))].filter(Boolean))];
  const porEtiqueta = new Map<string, Set<string>>();
  if (etiquetasPedidas.length) {
    const ids = [...new Set(todas.map(c => c.company_id).filter(Boolean))];
    const { data: asig } = ids.length
      ? await supabase.from('crm_etiqueta_asignaciones')
          .select('etiqueta_id, entidad_id').in('etiqueta_id', etiquetasPedidas).eq('entidad', 'company').in('entidad_id', ids)
      : { data: [] as any[] };
    for (const e of etiquetasPedidas) porEtiqueta.set(e, new Set());
    for (const a of asig || []) porEtiqueta.get(String(a.etiqueta_id))?.add(a.entidad_id);
  }
  const conEtiqueta: Set<string> | null = etiqueta ? (porEtiqueta.get(etiqueta) || new Set()) : null;

  // ── Filtro en memoria (el universo cabe) ──
  // Extraído a función para que el modo contadores lo aplique N veces sobre el
  // MISMO universo. La búsqueda de texto queda fuera a propósito: necesita dos
  // consultas al historial y se resuelve aparte, solo cuando de verdad se pide.
  const filtrar = (base: any[], f: {
    filtro?: string; etapa?: string; tipo?: string; plan?: string; etiqueta?: string;
    asignado?: string; estado?: string; sin_contacto?: boolean; vista?: ConfigVista | null;
  }) => {
    const fi = f.filtro || 'todas';
    let l = base;
    /* LAS INTERNAS, FUERA DE TODO. Son los avisos que el CRM se manda a sí
       mismo y los números de prueba: no son clientes y encabezaban «Sin
       respuesta» —porque nadie le contesta a un robot— empujando hacia abajo a
       quien sí espera. Se ven solo pidiéndolas por su nombre. */
    if (fi === 'internas') l = l.filter(c => c.interna);
    else l = l.filter(c => !c.interna);
    if (fi === 'pospuestas') l = l.filter(pospuesta);
    else if (fi !== 'internas') l = l.filter(c => !pospuesta(c));   // dormidas fuera de todo lo demás
    if (fi === 'mias' && user) l = l.filter(c => c.asignado_a === user.id);
    if (fi === 'sin_asignar') l = l.filter(c => !c.asignado_a && c.estado_crm !== 'resuelta');
    // «no_leidas» es el nombre viejo de la MISMA cola: el cliente escribió y
    // nadie contestó. Se conserva por compatibilidad y se le suma el espejo.
    if (fi === 'no_leidas' || fi === 'no_contestadas') l = l.filter(c => c.ultima_direccion === 'entrante' && c.estado_crm !== 'resuelta');
    if (fi === 'sin_respuesta') l = l.filter(c => c.ultima_direccion === 'saliente' && c.estado_crm !== 'resuelta');
    if (fi === 'accion') l = l.filter(requiereAccion);
    if (f.etapa) l = l.filter(c => c.contacto?.lifecycle_stage === f.etapa);
    /* Los descalificados solo se ven cuando se piden. En cualquier otra vista
       —incluida «todas»— se van: ya se decidió que no, y tenerlos en medio
       obliga a volver a decidirlo cada vez que se abre el inbox. */
    else l = l.filter(c => c.contacto?.lifecycle_stage !== 'descalificado');
    if (f.tipo) l = l.filter(c => c.contacto?.tipo === f.tipo);
    if (f.plan) l = l.filter(c => c.empresa?.plan === f.plan);
    if (f.etiqueta) { const set = porEtiqueta.get(f.etiqueta) || new Set<string>(); l = l.filter(c => c.company_id && set.has(c.company_id)); }
    if (f.asignado === 'nadie') l = l.filter(c => !c.asignado_a);
    else if (f.asignado) l = l.filter(c => c.asignado_a === f.asignado);
    if (f.estado) l = l.filter(c => (c.estado_crm || 'abierta') === f.estado);
    if (f.sin_contacto) l = l.filter(c => !c.contact_id);
    if (f.vista) {
      if (f.vista.modo === 'solo_contactos') l = l.filter(c => c.virtual);
      else if (f.vista.modo !== 'todas') l = l.filter(c => !c.virtual);
      l = l.filter(c => cumpleVista(c, f.vista!, user?.id || null));
    } else l = l.filter(c => !c.virtual);
    return l;
  };

  // ── MODO CONTADORES: N vistas, un solo universo ──
  if (vistasDefs.length) {
    const contadores: Record<string, number> = {};
    for (const d of vistasDefs) {
      const cfg = d?.config || {};
      // Una vista guardada puede traer texto de búsqueda. Es raro, y cuando
      // pasa se cuenta sin él en vez de disparar dos consultas por vista: el
      // contador diría de más, así que se marca para que la barra no lo pinte
      // como exacto en lugar de mentir en silencio.
      contadores[String(d?.id)] = filtrar(todas, {
        filtro: cfg.filtro, etapa: cfg.etapa, tipo: cfg.tipo, plan: cfg.plan,
        etiqueta: cfg.etiqueta, asignado: cfg.asignado, estado: cfg.estado,
        sin_contacto: cfg.sin_contacto === '1' || cfg.sin_contacto === true,
        vista: cfg.condiciones ? cfg : null,
      }).length;
    }
    return json({ contadores, con_busqueda: vistasDefs.filter(d => d?.config?.search).map(d => String(d.id)) });
  }

  let lista = filtrar(todas, {
    filtro, etapa, tipo, plan, etiqueta, asignado, estado,
    sin_contacto: sinContacto, vista,
  });
  if (search) {
    const q = search.toLowerCase();
    const qLimpio = q.replace(/[%,()]/g, '');
    const qTel = telefonoWhatsApp(search);
    // Historial COMPLETO de ambos canales (índice trigram en wa_mensajes).
    const [{ data: hitsWa }, { data: hitsEm }] = await Promise.all([
      supabase.from('wa_mensajes').select('conversation_id')
        .or(`cuerpo.ilike.%${qLimpio}%,transcript.ilike.%${qLimpio}%`).limit(400),
      supabase.from('email_messages').select('conversation_id')
        .or(`cuerpo_texto.ilike.%${qLimpio}%,asunto.ilike.%${qLimpio}%`).limit(400),
    ]);
    const enWa = new Set((hitsWa || []).map((h: any) => h.conversation_id));
    const enEm = new Set((hitsEm || []).map((h: any) => h.conversation_id));
    lista = lista.filter(c =>
      (c.contacto?.nombre || '').toLowerCase().includes(q) ||
      (c.empresa?.nombre || '').toLowerCase().includes(q) ||
      (c.ultimo_mensaje_texto || '').toLowerCase().includes(q) ||
      (c.wa_id && enWa.has(c.wa_id)) ||
      (c.email_id && enEm.has(c.email_id)) ||
      String(c.telefono || '').includes(qTel || search.replace(/\D/g, '') || '∅'));
  }

  // Orden en el servidor: con paginación, ordenar la página en el front mentía.
  const orden = url.searchParams.get('orden') || 'recientes';
  if (orden === 'antiguas') lista.reverse();
  if (orden === 'az' || orden === 'za') {
    lista.sort((a: any, b: any) => String(a.contacto?.nombre || a.telefono || '').localeCompare(String(b.contacto?.nombre || b.telefono || ''), 'es'));
    if (orden === 'za') lista.reverse();
  }
  return json({ conversaciones: lista.slice(offset, offset + limit), counts, total_filtrado: lista.length, hay_mas: offset + limit < lista.length });
};

// REGLA DE VELOCIDAD: lectura pesada founder-only → micro-caché 10s en la instancia.
export const GET = conMicroCache('wa/inbox', 10000, _GET as any);
