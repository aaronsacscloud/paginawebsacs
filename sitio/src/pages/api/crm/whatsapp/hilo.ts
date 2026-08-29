// WHATSAPP · Un hilo OMNICANAL: mensajes de WhatsApp, correos del mismo
// contacto, notas internas, eventos de sistema y la ventana de 24 h.
//
// GET ?id=<wa_conversation_id> | ?email_id=<email_conversation_id>
//   → { conversacion, mensajes, correos, eventos, notas, ventana, canales }
//   Abrir MARCA leído en ambos canales (wa.no_leidos=0, email.leida=true).
// PUT { id, asignado_a? | estado_crm? | snooze_until? | ... } — whitelist;
//   asignación/estado/snooze dejan su EVENTO de sistema en el hilo.
import type { APIRoute } from 'astro';
import { marcarLeido } from '../../../../lib/whatsapp/kapso-api';
import { sincronizarEstadoKapso, sincronizarAsignacionKapso, sincronizarContactoKapso, preferenciasMarketingKapso } from '../../../../lib/whatsapp/kapso-sync';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { resolverTenant, puedeEnviar } from '../../../../lib/email/tenant';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await getCurrentUser(request).catch(() => null);
  const id = url.searchParams.get('id');
  const emailId = url.searchParams.get('email_id');
  if (!id && !emailId) return json({ error: 'Falta id o email_id' }, 400);

  // ── El ancla: la conversación de WhatsApp, o una de email (fila email-only) ──
  let conv: any = null;
  let soloEmail: any = null;
  if (id) {
    const { data } = await supabase.from('wa_conversaciones')
      .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, tipo, company_id, wa_optout), companies(id, nombre, nombre_comercial, plan, mrr, sucursales, giro, estado_cuenta, fecha_renovacion, rfc, razon_social, sacs_account)')
      .eq('id', id).maybeSingle();
    conv = data;
    if (!conv) return json({ error: 'Conversación no encontrada' }, 404);
  } else {
    const { data } = await supabase.from('email_conversations')
      .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, tipo, company_id, wa_optout), companies(id, nombre, nombre_comercial, plan, mrr, sucursales, giro, estado_cuenta, fecha_renovacion, rfc, razon_social, sacs_account)')
      .eq('id', emailId).maybeSingle();
    soloEmail = data;
    if (!soloEmail) return json({ error: 'Conversación no encontrada' }, 404);
    // Forma compatible con el front: una "conversacion" sin teléfono utilizable.
    conv = {
      id: null, email_only_id: soloEmail.id, telefono: soloEmail.email,
      contact_id: soloEmail.contact_id, company_id: soloEmail.company_id,
      contacts: soloEmail.contacts, companies: soloEmail.companies,
      estado: 'active', estado_crm: soloEmail.estado === 'cerrada' ? 'resuelta' : 'abierta',
      no_leidos: soloEmail.leida ? 0 : 1, asignado_a: soloEmail.asignado_a || null,
      snooze_until: null, ultimo_mensaje_at: soloEmail.ultimo_mensaje_at,
    };
  }

  // ── Los CORREOS del mismo contacto (o del mismo email si es email-only) ──
  const contactId = conv.contact_id;
  const emailContacto = conv.contacts?.email || (soloEmail ? soloEmail.email : null);
  let convsEmail: any[] = [];
  if (soloEmail) convsEmail = [soloEmail];
  else if (contactId || emailContacto) {
    const q = supabase.from('email_conversations').select('*').order('ultimo_mensaje_at', { ascending: false }).limit(5);
    const { data } = contactId
      ? await q.eq('contact_id', contactId)
      : await q.eq('email', emailContacto);
    convsEmail = data || [];
  }
  // El equipo y los correos SOLO se piden si hay conversación de email. Antes
  // se traía la tabla team_members completa en CADA apertura de hilo —incluidas
  // las de puro WhatsApp, que son la mayoría— y encima en un viaje aparte,
  // esperando. Y los mensajes de cada conversación de correo iban en un `for`
  // con await adentro: uno detrás de otro. Medido: /hilo tardaba ~800 ms
  // encadenando 5-7 viajes a Supabase que no dependían entre sí.
  const correos: any[] = [];
  if (convsEmail.length) {
    // autor de email_messages es UUID de team_members: se resuelve a nombre aquí.
    const [{ data: equipo }, ...porConv] = await Promise.all([
      supabase.from('team_members').select('id, nombre'),
      ...convsEmail.map((ce: any) => supabase.from('email_messages')
        .select('id, direccion, de_email, para_email, asunto, cuerpo_texto, adjuntos, autor, created_at')
        .eq('conversation_id', ce.id).order('created_at', { ascending: true }).limit(200)),
    ]);
    const nombreDe = (uid?: string | null) => (equipo || []).find((m: any) => m.id === uid)?.nombre || null;
    convsEmail.forEach((ce: any, i: number) => {
      correos.push({
        conversacion: { id: ce.id, asunto: ce.asunto, estado: ce.estado, email: ce.email },
        mensajes: ((porConv[i] as any)?.data || []).map((m: any) => ({ ...m, autor: nombreDe(m.autor) })),
      });
    });
  }

  // ── Mensajes de WhatsApp + notas + eventos (solo con ancla de WhatsApp) ──
  // Los N más NUEVOS (desc + reverse): ordenar ascendente y cortar dejaba
  // fuera justo el mensaje que acaba de llegar en hilos largos.
  // `?before=<created_at>` trae la página anterior para "Cargar más arriba".
  const before = url.searchParams.get('before');
  const PAGINA = 150;
  const qMsj = supabase.from('wa_mensajes')
    .select('id, kapso_message_id, direccion, tipo, cuerpo, transcript, media_url, media_id, mime, filename, autor, status, error, enviado_at, created_at, metadata, borrado_at')
    .eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(PAGINA + 1);
  const [{ data: msjDesc }, { data: notasDesc }, { data: eventosDesc }] = conv.id ? await Promise.all([
    before ? qMsj.lt('created_at', before) : qMsj,
    // 19) Las notas son del CONTACTO: se ven desde cualquier hilo suyo.
    (conv.contact_id
      ? supabase.from('wa_notas').select('id, autor, texto, created_at, conversation_id').or(`conversation_id.eq.${conv.id},contact_id.eq.${conv.contact_id}`)
      : supabase.from('wa_notas').select('id, autor, texto, created_at, conversation_id').eq('conversation_id', conv.id)
    ).order('created_at', { ascending: false }).limit(200),
    supabase.from('wa_eventos')
      .select('id, tipo, detalle, autor, created_at')
      .eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(200),
  ]) : [{ data: [] }, { data: [] }, { data: [] }] as any;
  const hayMas = (msjDesc || []).length > PAGINA;
  const mensajes = (msjDesc || []).slice(0, PAGINA).reverse();
  const notas = (notasDesc || []).reverse();
  const eventos: any[] = (eventosDesc || []).reverse();
  if (before) return json({ mensajes, hay_mas: hayMas });

  // Ventana de 24 h desde el último entrante de WhatsApp.
  // Por HORA REAL del mensaje, no por orden de llegada: un replay viejo que
  // entra al final no puede cerrar la ventana.
  const entrantes = (mensajes || []).filter((m: any) => m.direccion === 'entrante');
  const ultimoEntrante = entrantes.reduce((u: any, m: any) => (!u || new Date(m.enviado_at || m.created_at) > new Date(u.enviado_at || u.created_at)) ? m : u, null as any);
  const base = Math.max(ultimoEntrante ? new Date(ultimoEntrante.enviado_at || ultimoEntrante.created_at).getTime() : 0, conv.ultimo_entrante_at ? new Date(conv.ultimo_entrante_at).getTime() : 0);
  const expira = base + 24 * 3600 * 1000;
  const ventana = { abierta: base > 0 && Date.now() < expira, expira_at: base ? new Date(expira).toISOString() : null };

  // ── Canales disponibles para el composer ──
  const t = await resolverTenant().catch(() => null);
  const correoOk = !!emailContacto && !!t && puedeEnviar(t);
  const canales = {
    whatsapp: !!conv.id,
    correo: {
      ok: correoOk,
      email: emailContacto || null,
      // El hilo abierto (si hay) al que respondería el composer en modo Correo.
      conversation_id: convsEmail.find(c => c.estado === 'abierta')?.id || null,
      motivo: !emailContacto ? 'El contacto no tiene email'
        : (!t || !puedeEnviar(t)) ? 'Configura el remitente en Email → Ajustes' : null,
    },
  };

  // ── Marcar leído: personal (wa_lecturas) + global (compat) ──
  // Abrir el hilo NO toca el contador global (es "sin responder" del equipo):
  // solo registra MI lectura. Así el chat que abre Aaron sigue nuevo para Luis.
  // ⚠️ SOLO con ?marcar=1. Traer el hilo y DARLO POR LEÍDO no son la misma
  // acción, y confundirlas costaba caro: la precarga del inbox pide /hilo cuando
  // el dedo apenas roza una fila o cuando la fila se asoma al hacer scroll, así
  // que conversaciones que NADIE abrió se marcaban leídas y —peor— se le
  // mandaban PALOMITAS AZULES al cliente por WhatsApp. Es decirle "ya te leímos"
  // sin que sea cierto. Abrir la conversación manda marcar=1; precargar y
  // paginar hacia atrás, no.
  const marcar = url.searchParams.get('marcar') === '1';
  if (conv.id && marcar) {
    let yaLeido = false;
    if (yo) {
      const { data: lec } = await supabase.from('wa_lecturas').select('leido_at').eq('conversation_id', conv.id).eq('user_id', yo.id).maybeSingle();
      yaLeido = !!(lec?.leido_at && conv.ultimo_entrante_at && lec.leido_at >= conv.ultimo_entrante_at);
      await supabase.from('wa_lecturas').upsert({ conversation_id: conv.id, user_id: yo.id, leido_at: new Date().toISOString() }, { onConflict: 'conversation_id,user_id' });
    }
    conv.no_leidos = 0;   // para ESTE usuario, ya lo vio
    // Palomitas azules para el cliente: el último entrante se marca leído en Meta (una vez por entrante nuevo).
    if (!yaLeido && ultimoEntrante?.kapso_message_id) marcarLeido(ultimoEntrante.kapso_message_id).catch(() => {});
  }

  // 6) Presencia: quién más tiene abierto este hilo (últimos 20 s) y si escribe.
  let presencia: any[] = [];
  if (conv.id) {
    const hace20 = new Date(Date.now() - 20e3).toISOString();
    const { data: pres } = await supabase.from('wa_presencia').select('user_id, nombre, visto_at, escribiendo_at')
      .eq('conversation_id', conv.id).gte('visto_at', hace20);
    presencia = (pres || []).filter(p => !yo || p.user_id !== yo.id)
      .map(p => ({ ...p, escribiendo: !!p.escribiendo_at && (Date.now() - new Date(p.escribiendo_at).getTime()) < 8e3 }));
  }

  // 10) Reuniones del contacto como eventos del hilo (agendadas / canceladas).
  if (conv.contact_id) {
    const { data: bks } = await supabase.from('bookings').select('id, fecha, hora_inicio, estado, asunto, created_at, google_meet_link, event_type_id')
      .eq('contact_id', conv.contact_id).order('created_at', { ascending: false }).limit(10);
    for (const b of bks || []) eventos.push({
      id: `bk-${b.id}`, tipo: 'reunion', created_at: b.created_at, autor: null,
      detalle: `${b.estado === 'cancelada' ? 'Reunión cancelada' : 'Reunión agendada'}: ${new Date(b.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} ${String(b.hora_inicio || '').slice(0, 5)}${b.asunto ? ` · ${b.asunto}` : ''}`,
      meet: b.google_meet_link || null,
    });
    eventos.sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));
  }
  // 10b) Minutas de llamadas: evento expandible a la hora en que terminó la llamada.
  if (conv.id) {
    const { data: lls } = await supabase.from('wa_llamadas')
      .select('call_id, canal, direccion, duracion_seg, ended_at, created_at, minuta, siguiente_paso, atendida_por_nombre')
      .eq('conversation_id', conv.id).not('minuta', 'is', null).order('created_at', { ascending: false }).limit(10);
    for (const l of lls || []) {
      const dur = l.duracion_seg ? `${Math.floor(l.duracion_seg / 60)} min ${l.duracion_seg % 60} s` : '';
      eventos.push({
        id: `min-${l.call_id}`, tipo: 'minuta', created_at: l.ended_at || l.created_at, autor: l.atendida_por_nombre,
        detalle: `Minuta de la llamada ${(l as any).canal === 'telefono' ? 'telefónica ' : ''}${l.direccion === 'saliente' ? 'realizada' : 'recibida'}${dur ? ` (${dur})` : ''}`,
        minuta: l.minuta, siguiente_paso: l.siguiente_paso || null,
      });
    }
  }

  // 11) Campañas EN el hilo: los masivos de WhatsApp y los correos de campaña
  // aparecen en la conversación a la hora en que le llegaron a ESTE contacto,
  // y los programados que aún no salen se avisan aparte (banner del hilo).
  const campanasProximas: any[] = [];
  if (conv.telefono) {
    const { data: dests } = await supabase.from('wa_broadcast_destinatarios')
      .select('id, telefono, status, delivered_at, read_at, error_message, broadcast_id, wa_broadcasts(id, nombre, plantilla_nombre, status, scheduled_at, created_at, sent_at)')
      .eq('telefono', conv.telefono).limit(25);
    for (const d of dests || []) {
      const bc: any = (d as any).wa_broadcasts;
      if (!bc || bc.status === 'borrador') continue;
      if (bc.status === 'programado' && bc.scheduled_at) {
        if (new Date(bc.scheduled_at) > new Date()) campanasProximas.push({ destinatario_id: d.id, broadcast_id: bc.id, nombre: bc.nombre, plantilla: bc.plantilla_nombre, scheduled_at: bc.scheduled_at });
        continue;
      }
      const cuando = d.delivered_at || bc.sent_at || bc.scheduled_at || bc.created_at;
      const que = d.status === 'failed' ? `no le llegó${d.error_message ? ` (${d.error_message})` : ''}`
        : d.status === 'suppressed' ? 'se omitió (pidió no recibir marketing)'
        : (d as any).read_at ? 'le llegó y lo leyó' : d.delivered_at ? 'le llegó' : d.status === 'sent' ? 'se le envió' : 'pendiente de salir';
      eventos.push({ id: `bc-${d.id}`, tipo: 'campana', created_at: cuando, autor: null,
        detalle: `Masivo «${bc.nombre}»${bc.plantilla_nombre ? ` · plantilla ${bc.plantilla_nombre}` : ''}: ${que}` });
    }
  }
  if (conv.contact_id) {
    const { data: envs } = await supabase.from('email_sends')
      .select('id, estado, sent_at, opened_at, clicked_at, created_at, email_templates(nombre, asunto)')
      .eq('contact_id', conv.contact_id).order('created_at', { ascending: false }).limit(15);
    for (const en of envs || []) {
      if (['queued', 'failed'].includes(String(en.estado))) continue;
      const t: any = (en as any).email_templates;
      const que = en.clicked_at ? 'lo abrió y dio clic' : en.opened_at ? 'lo abrió' : en.estado === 'bounced' ? 'rebotó' : 'enviado';
      eventos.push({ id: `em-${en.id}`, tipo: 'campana', created_at: en.sent_at || en.created_at, autor: null,
        detalle: `Correo «${t?.asunto || t?.nombre || 'campaña'}»: ${que}` });
    }
  }
  eventos.sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));

  const sinLeer = convsEmail.filter(c => !c.leida).map(c => c.id);
  if (sinLeer.length) await supabase.from('email_conversations').update({ leida: true }).in('id', sinLeer);

  // ¿Está navegando el sitio AHORA? (últimos 5 min). El poll del hilo corre
  // cada 3 s, así que el badge aparece y desaparece prácticamente en vivo.
  let webEnVivo: string | null = null;
  if (conv.contact_id) {
    const { data: v } = await supabase.from('contact_visits')
      .select('ruta, titulo, created_at').eq('contact_id', conv.contact_id)
      .gte('created_at', new Date(Date.now() - 5 * 60e3).toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (v) webEnVivo = v.titulo || v.ruta;
  }

  let marketing: any = null;
  if (conv.id && conv.telefono) marketing = await preferenciasMarketingKapso(conv.telefono).catch(() => null);
  return json({ conversacion: conv, mensajes, hay_mas: hayMas, correos, eventos, notas, ventana, canales, presencia, marketing, campanas_proximas: campanasProximas, web_en_vivo: webEnVivo, yo: yo ? { id: yo.id, rol: (yo as any).rol || null } : null });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const user = await getCurrentUser(request);
  const autor = user?.nombre || user?.email || 'equipo';
  const cambios: any = {};
  const eventos: Array<{ tipo: string; detalle: string }> = [];

  // Whitelist explícita: lo que el inbox puede tocar de una conversación.
  if ('asignado_a' in b) {
    cambios.asignado_a = b.asignado_a || null;
    if (b.asignado_a) {
      const { data: m } = await supabase.from('team_members').select('nombre').eq('id', b.asignado_a).maybeSingle();
      eventos.push({ tipo: 'asignada', detalle: `Asignada a ${m?.nombre || 'alguien'}` });
    } else eventos.push({ tipo: 'asignada', detalle: 'Sin asignar' });
  }
  if ('estado' in b && ['active', 'ended'].includes(b.estado)) cambios.estado = b.estado;
  if ('estado_crm' in b && ['abierta', 'pendiente', 'resuelta'].includes(b.estado_crm)) {
    cambios.estado_crm = b.estado_crm;
    if (b.estado_crm === 'resuelta') {
      // Nota de cierre categorizada: de aquí salen las métricas de "por qué se cierra".
      cambios.cierre_categoria = b.cierre_categoria ? String(b.cierre_categoria).slice(0, 80) : null;
      cambios.cierre_nota = b.cierre_nota ? String(b.cierre_nota).slice(0, 1000) : null;
      eventos.push({ tipo: 'estado', detalle: `Marcada como resuelta${cambios.cierre_categoria ? ` · ${cambios.cierre_categoria}` : ''}${cambios.cierre_nota ? ` — ${cambios.cierre_nota}` : ''}` });
    } else {
      if (b.estado_crm === 'abierta') { cambios.cierre_categoria = null; cambios.cierre_nota = null; }
      eventos.push({ tipo: 'estado', detalle: `Marcada como ${b.estado_crm}` });
    }
  }
  if ('snooze_until' in b) {
    cambios.snooze_until = b.snooze_until || null;
    eventos.push({
      tipo: 'snooze',
      detalle: b.snooze_until
        ? `Pospuesta hasta ${new Date(b.snooze_until).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : 'Despertada',
    });
  }
  if ('no_leidos' in b) cambios.no_leidos = Math.max(0, Number(b.no_leidos) || 0);
  // Ligar la conversación a un contacto recién creado (adopción manual).
  if ('contact_id' in b) cambios.contact_id = b.contact_id || null;
  if ('company_id' in b) cambios.company_id = b.company_id || null;
  if (!Object.keys(cambios).length) return json({ error: 'Nada que cambiar' }, 400);

  const { error } = await supabase.from('wa_conversaciones').update(cambios).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  // Etapa E: Kapso se entera (estado, asignación, contacto ligado). Best effort.
  const avisos: string[] = [];
  const { data: cv } = await supabase.from('wa_conversaciones').select('kapso_conversation_id, telefono, contact_id, company_id, contacts(nombre, apellido, lifecycle_stage), companies(nombre, nombre_comercial, plan)').eq('id', b.id).maybeSingle();
  if (cv) {
    if ('estado_crm' in cambios) sincronizarEstadoKapso(cv.kapso_conversation_id, cambios.estado_crm).catch(() => {});
    if ('asignado_a' in cambios) { const r = await sincronizarAsignacionKapso(cv.kapso_conversation_id, cambios.asignado_a).catch(() => ({ ok: false, motivo: 'Kapso no respondió' })); if (!r.ok && r.motivo && !/sin kapso_conversation_id/.test(r.motivo)) avisos.push(r.motivo); }
    if ('contact_id' in cambios && cv.contact_id) {
      const c: any = cv.contacts, e: any = cv.companies;
      sincronizarContactoKapso(cv.telefono, { nombre: c ? `${c.nombre || ''} ${c.apellido || ''}`.trim() : null, empresa: e?.nombre_comercial || e?.nombre || null, etapa: c?.lifecycle_stage || null, contact_id: cv.contact_id, company_id: cv.company_id, plan: e?.plan || null }).catch(() => {});
      // Las notas del hilo pasan a ser del contacto recién ligado.
      await supabase.from('wa_notas').update({ contact_id: cv.contact_id }).eq('conversation_id', b.id).is('contact_id', null);
    }
  }
  for (const e of eventos) {
    await supabase.from('wa_eventos').insert({ conversation_id: b.id, tipo: e.tipo, detalle: e.detalle, autor });
  }
  return json({ ok: true, avisos });
};
