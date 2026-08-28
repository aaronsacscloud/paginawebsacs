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
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const offset = Number(url.searchParams.get('offset') || 0);

  const SELECT_JOINS = 'contacts(id, nombre, apellido, email, lifecycle_stage, tipo, fuente, created_at, next_followup, owner_id, estatus_lead, respondio_at, retenido_hasta), companies(id, nombre, nombre_comercial, plan, mrr, sucursales, giro, estado_cuenta, sacs_account, fecha_renovacion, dias_sin_venta, ultima_venta_at, last_payment_at, health_score)';
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
    // ANTES de abrirla, no después de leerla entera.
    supabase.from('wa_notas').select('conversation_id').not('conversation_id', 'is', null).order('created_at', { ascending: false }).limit(1000),
  ]);
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
  const counts: any = { todas: 0, mias: 0, sin_asignar: 0, no_leidas: 0, pospuestas: 0, accion: 0, por_etapa: {} as Record<string, number> };
  for (const c of todas) {
    if (c.virtual) continue;   // los contactos sin conversación no inflan las bandejas
    if (pospuesta(c)) { counts.pospuestas++; continue; }   // dormidas: solo su cajón
    counts.todas++;
    if (requiereAccion(c)) counts.accion++;
    if (user && c.asignado_a === user.id) counts.mias++;
    if (!c.asignado_a && c.estado_crm !== 'resuelta') counts.sin_asignar++;
    if (c.ultima_direccion === 'entrante' && c.estado_crm !== 'resuelta') counts.no_leidas++;   // "Sin respuesta": el cliente habló y nadie contestó
    const e = c.contacto?.lifecycle_stage;
    if (e) counts.por_etapa[e] = (counts.por_etapa[e] || 0) + 1;
  }

  // Etiquetas: si la vista o el filtro las usan, se cargan y se pegan a _extra.
  const vistaUsaEtiquetas = !!vista?.condiciones?.some(c => c.campo === 'etiqueta');
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

  if (vista?.condiciones?.some(c => c.campo === 'visita_web')) {
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
  if (vista?.condiciones?.some(c => ['tuvo_llamada', 'tiene_minuta', 'ultima_llamada', 'min_llamadas'].includes(c.campo))) {
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

  if (vista?.condiciones?.some(c => c.campo === 'etiqueta_conv')) {
    const ids = todas.map(c => c.wa_id).filter(Boolean);
    const { data: asig } = ids.length
      ? await supabase.from('crm_etiqueta_asignaciones').select('etiqueta_id, entidad_id').eq('entidad', 'wa_conversacion').in('entidad_id', ids)
      : { data: [] as any[] };
    const mapa = new Map<string, string[]>();
    for (const a of asig || []) { const arr = mapa.get(a.entidad_id) || []; arr.push(a.etiqueta_id); mapa.set(a.entidad_id, arr); }
    for (const c of todas) if (c.wa_id) c._extra.etiquetas_conv = mapa.get(c.wa_id) || [];
  }

  // Etiquetas de la empresa (solo si el filtro las pide: una query extra).
  let conEtiqueta: Set<string> | null = null;
  if (etiqueta) {
    const ids = [...new Set(todas.map(c => c.company_id).filter(Boolean))];
    const { data: asig } = ids.length
      ? await supabase.from('crm_etiqueta_asignaciones')
          .select('entidad_id').eq('etiqueta_id', etiqueta).eq('entidad', 'company').in('entidad_id', ids)
      : { data: [] as any[] };
    conEtiqueta = new Set((asig || []).map((a: any) => a.entidad_id));
  }

  // ── Filtro + búsqueda en memoria (el universo cabe) ──
  let lista = todas;
  if (filtro === 'pospuestas') lista = lista.filter(pospuesta);
  else lista = lista.filter(c => !pospuesta(c));   // dormidas fuera de todo lo demás
  if (filtro === 'mias' && user) lista = lista.filter(c => c.asignado_a === user.id);
  if (filtro === 'sin_asignar') lista = lista.filter(c => !c.asignado_a && c.estado_crm !== 'resuelta');
  // «no_leidas» es el nombre viejo de la MISMA cola: el cliente escribió y
  // nadie contestó. Se conserva por compatibilidad y se le suma el espejo.
  if (filtro === 'no_leidas' || filtro === 'no_contestadas') lista = lista.filter(c => c.ultima_direccion === 'entrante' && c.estado_crm !== 'resuelta');
  if (filtro === 'sin_respuesta') lista = lista.filter(c => c.ultima_direccion === 'saliente' && c.estado_crm !== 'resuelta');
  if (filtro === 'accion') lista = lista.filter(requiereAccion);
  if (etapa) lista = lista.filter(c => c.contacto?.lifecycle_stage === etapa);
  if (tipo) lista = lista.filter(c => c.contacto?.tipo === tipo);
  if (plan) lista = lista.filter(c => c.empresa?.plan === plan);
  if (conEtiqueta) lista = lista.filter(c => c.company_id && conEtiqueta!.has(c.company_id));
  if (asignado === 'nadie') lista = lista.filter(c => !c.asignado_a);
  else if (asignado) lista = lista.filter(c => c.asignado_a === asignado);
  if (estado) lista = lista.filter(c => (c.estado_crm || 'abierta') === estado);
  if (sinContacto) lista = lista.filter(c => !c.contact_id);
  if (vista) {
    if (vista.modo === 'solo_contactos') lista = lista.filter(c => c.virtual);
    else if (vista.modo !== 'todas') lista = lista.filter(c => !c.virtual);
    lista = lista.filter(c => cumpleVista(c, vista!, user?.id || null));
  } else lista = lista.filter(c => !c.virtual);
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
