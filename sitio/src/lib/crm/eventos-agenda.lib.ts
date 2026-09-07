// Lo que se AGENDA alrededor de una feria: la demo desde el stand (punto 2) y
// la cita en el stand antes de la feria (punto 3). Las dos son bookings reales
// —salen en Reuniones, mandan recordatorio, se cancelan con su liga— y aquí
// solo vive lo que bookings no sabe: de qué edición vienen y a qué registro
// pertenecen.
import { randomBytes } from 'node:crypto';
import { supabase } from '../supabase';
import { marcarAgendado } from './estatus-live';
import { telE164, tel10, registrar } from './eventos.lib';

const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
export const sumarMin = (hora: string, min: number) => { const [h, m] = hora.slice(0, 5).split(':').map(Number); const t = (h * 60 + m + min) % (24 * 60); return hhmm(Math.floor(t / 60), t % 60); };
const token = () => randomBytes(24).toString('base64url');
const HORA_RE = /^\d{2}:\d{2}$/;
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

async function tipoPorSlug(slug: string) {
  const { data } = await supabase.from('event_types').select('id, nombre, duracion_minutos').eq('slug', slug).maybeSingle();
  return data;
}

/** Inserta el booking con la forma que espera el resto del CRM (misma que reuniones.ts). */
async function crearBooking(o: {
  tipoId: string; fecha: string; hora: string; duracion: number; hostId: string | null; por: string;
  nombre?: string | null; email?: string | null; whatsapp?: string | null; empresa?: string | null; giro?: string | null; notas?: string | null;
  contactId?: string | null; companyId?: string | null; asunto: string; origen: string; atribucion?: any;
}) {
  const { data, error } = await supabase.from('bookings').insert({
    event_type_id: o.tipoId, host_id: o.hostId, consultor_id: o.hostId,
    fecha: o.fecha, hora_inicio: o.hora.slice(0, 5), hora_fin: sumarMin(o.hora, o.duracion),
    timezone_host: 'America/Mexico_City', timezone_invitado: 'America/Mexico_City',
    invitee_nombre: o.nombre || null, invitee_email: o.email || null, invitee_whatsapp: o.whatsapp || null,
    invitee_empresa: o.empresa || null, invitee_giro: o.giro || null, invitee_notas: o.notas || null,
    contact_id: o.contactId || null, company_id: o.companyId || null,
    asunto: o.asunto, estado: 'agendada', origen: o.origen,
    estado_hist: [{ estado: 'agendada', at: new Date().toISOString(), por: o.por }],
    token_cancelar: token(), token_reagendar: token(),
    atribucion: o.atribucion || null,
  }).select('id, fecha, hora_inicio, hora_fin, token_cancelar').single();
  if (error) throw new Error(error.message);
  return data;
}

/** Punto 2 · Demo agendada desde el stand para alguien que ya se registró. */
export async function agendarDemo(registroId: string, o: { fecha: string; hora: string; duracion?: number; en_stand?: boolean; host_id?: string | null; nota?: string | null }, yo: { id: string; nombre?: string | null }) {
  if (!DIA_RE.test(o.fecha) || !HORA_RE.test(o.hora)) return { ok: false, motivo: 'Falta el día o la hora.' };
  const { data: r } = await supabase.from('ev_registros').select('id, edicion_id, contact_id, company_id, nombre, email, whatsapp, empresa, giro, demo_booking_id, ev_ediciones(nombre, stand_numero, ev_eventos(slug, nombre))').eq('id', registroId).maybeSingle();
  if (!r) return { ok: false, motivo: 'El registro no existe.' };
  if (r.demo_booking_id) {
    const { data: prev } = await supabase.from('bookings').select('estado').eq('id', r.demo_booking_id).maybeSingle();
    if (prev && !['cancelada', 'reagendada', 'no_asistio', 'no_show'].includes(prev.estado)) return { ok: false, motivo: 'Ya tiene una demo agendada. Cancélala en Reuniones si quieres otra.' };
  }
  const tipo = await tipoPorSlug('demo');
  if (!tipo) return { ok: false, motivo: 'No existe el tipo de reunión «demo».' };
  const ed: any = r.ev_ediciones;
  const evento = ed?.ev_eventos?.nombre || 'la feria';
  const duracion = Math.min(180, Math.max(15, Number(o.duracion) || (o.en_stand ? 30 : tipo.duracion_minutos || 60)));
  // Dueño de la demo: quien la agenda, salvo que el contacto ya tenga dueño.
  let host = o.host_id || null;
  if (!host && r.contact_id) { const { data: c } = await supabase.from('contacts').select('owner_id').eq('id', r.contact_id).maybeSingle(); host = c?.owner_id || null; }
  host ||= yo.id;
  let bk: any;
  try {
    bk = await crearBooking({
      tipoId: tipo.id, fecha: o.fecha, hora: o.hora, duracion, hostId: host, por: yo.nombre || 'CRM',
      nombre: r.nombre, email: r.email, whatsapp: r.whatsapp, empresa: r.empresa, giro: r.giro, notas: o.nota || null,
      contactId: r.contact_id, companyId: r.company_id,
      asunto: o.en_stand ? `Demo en el stand${ed?.stand_numero ? ' ' + ed.stand_numero : ''} · ${evento}` : `Demo · ${evento}`,
      origen: 'evento', atribucion: { canal: 'evento', evento: ed?.ev_eventos?.slug, edicion_id: r.edicion_id, registro_id: r.id },
    });
  } catch (e: any) { return { ok: false, motivo: String(e?.message || e) }; }
  const ahora = new Date().toISOString();
  await supabase.from('ev_registros').update({ demo_at: ahora, demo_booking_id: bk.id, contactado_at: ahora, contactado_por: yo.id, updated_at: ahora }).eq('id', registroId);
  if (r.contact_id) {
    await supabase.from('activities').insert({ contact_id: r.contact_id, tipo: 'demo_agendada', titulo: `Demo agendada ${o.en_stand ? 'en el stand' : 'desde la feria'} · ${evento} · ${o.fecha} ${o.hora}`, automatico: false, metadata: { booking_id: bk.id, edicion_id: r.edicion_id, registro_id: r.id, actor: yo.id } }).then(() => {}, () => {});
    await marcarAgendado(r.contact_id).catch(() => {});
    const { data: c } = await supabase.from('contacts').select('lifecycle_stage').eq('id', r.contact_id).maybeSingle();
    if (c && ['lead', 'lead_calificado'].includes(c.lifecycle_stage)) {
      await supabase.from('contacts').update({ lifecycle_stage: 'oportunidad', next_followup: o.fecha, proximo_paso: `Demo ${o.fecha} ${o.hora}` }).eq('id', r.contact_id);
      await supabase.from('activities').insert({ contact_id: r.contact_id, tipo: 'etapa_cambio', titulo: 'Promovido a Oportunidad: agendó demo en la feria', automatico: true, metadata: { regla: 'booking_creado', actor: 'sistema' } }).then(() => {}, () => {});
    } else await supabase.from('contacts').update({ next_followup: o.fecha, proximo_paso: `Demo ${o.fecha} ${o.hora}` }).eq('id', r.contact_id);
  }
  // La confirmación sale por el MISMO camino que cualquier cita (texto o plantilla, espejada en el inbox).
  let confirmacion: { ok: boolean; motivo?: string } = { ok: false, motivo: 'sin WhatsApp' };
  if (r.whatsapp) {
    const { confirmarCitaPorWhatsApp } = await import('./confirmacion-cita');
    confirmacion = await confirmarCitaPorWhatsApp(bk.id, { lugar: o.en_stand ? `Stand${ed?.stand_numero ? ' ' + ed.stand_numero : ''} de Sacscloud en ${evento}` : null });
  }
  return { ok: true, booking_id: bk.id, confirmacion };
}

/** Los huecos del stand para un día: horario_stand de la edición menos las citas ya tomadas. */
export async function huecosDelStand(edicionId: string, dia: string) {
  const { data: ed } = await supabase.from('ev_ediciones').select('inicio, fin, horario_stand').eq('id', edicionId).maybeSingle();
  if (!ed || !DIA_RE.test(dia)) return [];
  if (dia < ed.inicio || dia > (ed.fin || ed.inicio)) return [];
  const h = (ed.horario_stand || {}) as any;
  const desde = HORA_RE.test(String(h.desde || '')) ? h.desde : '10:00';
  const hasta = HORA_RE.test(String(h.hasta || '')) ? h.hasta : '18:00';
  const paso = Math.min(60, Math.max(10, Number(h.duracion) || 15));
  const { data: citas } = await supabase.from('ev_citas').select('hora').eq('edicion_id', edicionId).eq('dia', dia).neq('estado', 'cancelada');
  const cupo = Math.max(1, Number(h.cupo) || 1);          // cuántas personas a la vez (2 si hay dos en el stand)
  const cuenta: Record<string, number> = {};
  for (const c of citas || []) { const k = String(c.hora).slice(0, 5); cuenta[k] = (cuenta[k] || 0) + 1; }
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const ahoraHM = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour12: false }).slice(0, 5);
  const out: { hora: string; libre: boolean }[] = [];
  for (let t = desde; t < hasta; t = sumarMin(t, paso)) {
    if (t < desde) break;                                   // dio la vuelta a medianoche
    const pasada = dia === hoy && t <= ahoraHM;
    out.push({ hora: t, libre: !pasada && (cuenta[t] || 0) < cupo });
    if (out.length > 80) break;
  }
  return out;
}

/** Punto 3 · Cita en el stand antes de la feria (desde la liga pública o desde el CRM). */
async function hostDelStand(edicionId: string, dia: string, hora: string, decisionPor: string | null): Promise<string | null> {
  const { data: turnos } = await supabase.from('ev_turnos').select('usuario_id, desde, hasta').eq('edicion_id', edicionId).eq('dia', dia).order('desde');
  const enTurno = (turnos || []).find(t => String(t.desde).slice(0, 5) <= hora && String(t.hasta).slice(0, 5) > hora);
  if (enTurno?.usuario_id) return enTurno.usuario_id;
  if (decisionPor) return decisionPor;
  const { data: f } = await supabase.from('team_members').select('id').eq('activo', true).eq('rol', 'founder').order('created_at').limit(1).maybeSingle();
  return f?.id || null;
}

export async function crearCita(edicionId: string, o: { dia: string; hora: string; nombre?: string; empresa?: string; whatsapp?: string; email?: string; giro?: string; nota?: string; origen?: 'liga' | 'invitacion' | 'crm'; contact_id?: string | null }, por: string, hostId: string | null) {
  if (!DIA_RE.test(o.dia) || !HORA_RE.test(o.hora)) return { ok: false, motivo: 'Falta el día o la hora.' };
  const nombre = String(o.nombre || '').trim().slice(0, 120);
  const wa = telE164(o.whatsapp);
  const email = String(o.email || '').trim().toLowerCase().slice(0, 160) || null;
  if (!nombre) return { ok: false, motivo: 'Falta el nombre.' };
  if (!wa && !email) return { ok: false, motivo: 'Deja un WhatsApp o un correo para confirmarte.' };
  const huecos = await huecosDelStand(edicionId, o.dia);
  const hueco = huecos.find(h => h.hora === o.hora);
  if (!hueco) return { ok: false, motivo: 'Esa hora no está en el horario del stand.' };
  if (!hueco.libre) return { ok: false, motivo: 'Esa hora ya se ocupó. Elige otra.' };
  const { data: ed } = await supabase.from('ev_ediciones').select('id, nombre, stand_numero, sede, ciudad, ev_eventos(slug, nombre, decision_por)').eq('id', edicionId).maybeSingle();
  if (!ed) return { ok: false, motivo: 'La edición no existe.' };
  const evento = (ed as any).ev_eventos?.nombre || 'la feria';
  // Quién atiende: el que está de turno a esa hora; si no hay turnos, quien decidió
  // ir; y si tampoco, el primer fundador activo. bookings.host_id no admite nulo y
  // la cita pública llega sin sesión.
  const host = hostId || await hostDelStand(ed.id, o.dia, o.hora, (ed as any).ev_eventos?.decision_por || null);
  if (!host) return { ok: false, motivo: 'No hay nadie que pueda atender la cita.' };
  // Contacto: el que ya existe (por WhatsApp o correo) o uno nuevo como lead.
  let contactId: string | null = o.contact_id || null;
  let companyId: string | null = null;
  if (!contactId) {
    let q = supabase.from('contacts').select('id, company_id, nombre').is('archived_at', null).limit(1);
    if (wa) q = q.or(`whatsapp.ilike.%${tel10(wa)}%,telefono.ilike.%${tel10(wa)}%`); else q = q.eq('email', email!);
    const { data: c } = await q.maybeSingle();
    if (c) { contactId = c.id; companyId = c.company_id; }
  } else { const { data: c } = await supabase.from('contacts').select('company_id').eq('id', contactId).maybeSingle(); companyId = c?.company_id || null; }
  if (!contactId) {
    const { data: nuevo } = await supabase.from('contacts').insert({
      nombre, email, whatsapp: wa, tipo: 'lead', lifecycle_stage: 'lead', estatus_lead: 'nuevo', estatus_lead_at: new Date().toISOString(), giro: String(o.giro || '').slice(0, 60) || null,
      fuente: `evento:${(ed as any).ev_eventos?.slug || 'evento'}`, fuente_detalle: evento, utm_source: 'evento', utm_campaign: (ed as any).ev_eventos?.slug || null, origen_alta: 'evento', campana: ed.nombre,
      owner_id: host, next_followup: o.dia, proximo_paso: `Cita en el stand ${o.dia} ${o.hora} · ${evento}`,
      // Agendó él mismo: hay consentimiento implícito para confirmarle la cita.
      wa_optout: false,
      propiedades: { evento: { slug: (ed as any).ev_eventos?.slug, nombre: evento, edicion: ed.nombre, edicion_id: ed.id, modo: 'cita' } },
    }).select('id').single();
    contactId = nuevo?.id || null;
    if (contactId) await supabase.from('activities').insert({ contact_id: contactId, tipo: 'evento', titulo: `Agendó cita en el stand · ${evento}`, automatico: true, metadata: { edicion_id: ed.id } }).then(() => {}, () => {});
  }
  const tipo = await tipoPorSlug('cita-stand');
  if (!tipo) return { ok: false, motivo: 'Falta el tipo de reunión «cita-stand».' };
  let bk: any;
  try {
    bk = await crearBooking({
      tipoId: tipo.id, fecha: o.dia, hora: o.hora, duracion: tipo.duracion_minutos || 15, hostId: host, por,
      nombre, email, whatsapp: wa, empresa: String(o.empresa || '').slice(0, 120) || null, giro: String(o.giro || '').slice(0, 60) || null, notas: String(o.nota || '').slice(0, 400) || null,
      contactId, companyId, asunto: `Cita en el stand${ed.stand_numero ? ' ' + ed.stand_numero : ''} · ${evento}`,
      origen: 'evento', atribucion: { canal: 'evento', evento: (ed as any).ev_eventos?.slug, edicion_id: ed.id, cita: true },
    });
  } catch (e: any) { return { ok: false, motivo: String(e?.message || e) }; }
  const { data: cita, error } = await supabase.from('ev_citas').insert({
    edicion_id: ed.id, booking_id: bk.id, contact_id: contactId, nombre, empresa: String(o.empresa || '').slice(0, 120) || null, whatsapp: wa, email,
    giro: String(o.giro || '').slice(0, 60) || null, dia: o.dia, hora: o.hora, origen: o.origen || 'liga', nota: String(o.nota || '').slice(0, 400) || null,
  }).select('id').single();
  if (error) return { ok: false, motivo: error.message };
  if (contactId) await marcarAgendado(contactId).catch(() => {});
  let confirmacion: { ok: boolean; motivo?: string } = { ok: false, motivo: 'sin WhatsApp' };
  if (wa) {
    const { confirmarCitaPorWhatsApp } = await import('./confirmacion-cita');
    confirmacion = await confirmarCitaPorWhatsApp(bk.id, { lugar: `Stand${ed.stand_numero ? ' ' + ed.stand_numero : ''} de Sacscloud en ${evento}${ed.sede ? ', ' + ed.sede : ''}` });
  }
  return { ok: true, cita_id: cita.id, booking_id: bk.id, token_cancelar: bk.token_cancelar, confirmacion };
}

/** «Llegó»: la cita se vuelve registro (el contacto ya existe) y el booking pasa a asistió. */
export async function citaLlego(citaId: string, extra: Record<string, any>, yo: { id: string; nombre?: string | null }) {
  const { data: c } = await supabase.from('ev_citas').select('*').eq('id', citaId).maybeSingle();
  if (!c) return { ok: false, motivo: 'La cita no existe.' };
  if (c.registro_id) return { ok: true, id: c.registro_id, ya: true };
  const r = await registrar({
    edicion_id: c.edicion_id, modo: 'stand', capturado_via: 'cita', cita_booking_id: c.booking_id,
    nombre: extra.nombre || c.nombre, empresa: extra.empresa || c.empresa, whatsapp: extra.whatsapp || c.whatsapp || undefined, email: extra.email || c.email || undefined, giro: extra.giro || c.giro || undefined,
    puesto: extra.puesto, sucursales: extra.sucursales, sistema_actual: extra.sistema_actual, ciudad: extra.ciudad, instagram: extra.instagram,
    temperatura: extra.temperatura || 'caliente', quiere_demo: extra.quiere_demo, interes: extra.interes, nota: extra.nota,
    consentimiento: extra.consentimiento, consentimiento_version: extra.consentimiento_version,
    capturado_por: yo.id, capturado_por_nombre: yo.nombre || null,
  });
  if (!r.ok) return r;
  const ahora = new Date().toISOString();
  await supabase.from('ev_citas').update({ estado: 'llego', registro_id: r.id, updated_at: ahora }).eq('id', citaId);
  if (c.booking_id) await supabase.from('bookings').update({ estado: 'asistio' }).eq('id', c.booking_id).in('estado', ['agendada', 'confirmada', 'pendiente']);
  return r;
}
