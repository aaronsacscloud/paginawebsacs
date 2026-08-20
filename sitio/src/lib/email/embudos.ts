// RUNTIME DE EMBUDOS — lo que faltaba para que las automatizaciones existan.
//
// Hasta hoy el CRM tenía las TABLAS de automatizaciones (pasos, ramas,
// inscripciones) pero NADIE procesaba `next_action_at`: una inscripción se
// creaba y se congelaba en el paso 1 para siempre. Este archivo es el motor.
//
// ── Arranque limpio (la regla que evita el desastre) ──
// Al ACTIVAR un embudo se estampa `activado_at` y el cursor arranca ahí. Un
// embudo que barriera la historia mandaría, en su primer minuto, un correo de
// bienvenida a los 280 contactos que llevan años en el CRM. Ese error no se
// puede deshacer: los correos ya salieron. Por eso el cursor NUNCA mira hacia
// atrás de la activación.
//
// ── Candado por inscripción ──
// Dos instancias del cron pueden solaparse. Cada inscripción se toma con un
// compare-and-swap (UPDATE ... WHERE estado='activo' AND next_action_at<=now)
// y solo una gana; la otra ve 0 filas y sigue. Sin esto, un paso "mandar
// correo" se ejecutaría dos veces.
//
// ── Ramas por comportamiento ──
// Las condiciones se evalúan contra hechos del CRM (agendó, es cliente, hizo
// clic). "Abrió" existe pero está marcado como señal poco fiable: Apple Mail
// abre todo automáticamente y Outlook corporativo bloquea imágenes, así que
// ramificar por apertura manda a la gente por el camino equivocado.
import { supabase } from '../supabase';
import { resolverTenant, type Tenant } from './tenant';
import { enviarCorreo } from './pipeline';
import { compilar, compilarTexto, type Bloque, type Contexto } from './plantillas';

export type TipoPaso =
  | 'send_email' | 'wait'
  /** `if_then` es como el esquema del CRM ya llamaba a la condición; se
   *  acepta también `condition` para no atarse al nombre. */
  | 'if_then' | 'condition'
  | 'goal' | 'send_notification' | 'set_property' | 'create_task';

export interface Paso {
  id: string; automation_id: string; orden: number;
  parent_step_id: string | null; branch_key: string | null;
  tipo: TipoPaso; config: any; activo: boolean;
}

export interface Inscripcion {
  id: string; automation_id: string; contact_id: string;
  current_step_id: string | null; estado: string;
  next_action_at: string | null; pasos_dados: number;
}

/** Tope de pasos por inscripción: red contra un embudo mal armado en ciclo. */
const MAX_PASOS = 60;
const LOCK_MIN = 10;

// ── Disparadores ────────────────────────────────────────────────────────

/**
 * Contactos que deberían entrar a este embudo AHORA.
 * Siempre acotado por el cursor: nadie anterior a la activación entra.
 */
async function candidatos(t: Tenant, auto: any): Promise<string[]> {
  const desde = auto.cursor_at || auto.activado_at;
  if (!desde) return [];
  const trig = auto.enrollment_triggers || {};
  const tipo = String(trig.type || '');

  const base = () => {
    let q = supabase.from('contacts').select('id').is('archived_at', null);
    if (t.owner_team_member_id) q = q.eq('referrer_partner_id', t.owner_team_member_id);
    return q;
  };
  const cond = (q: any) => {
    for (const c of (trig.conditions || [])) {
      const op = String(c.operator || 'eq');
      if (op === 'eq') q = q.eq(c.property, c.value);
      else if (op === 'neq') q = q.neq(c.property, c.value);
      else if (op === 'lte') q = q.lte(c.property, c.value);
      else if (op === 'gte') q = q.gte(c.property, c.value);
      else if (op === 'contains') q = q.ilike(c.property, `%${c.value}%`);
    }
    return q;
  };

  let ids: string[] = [];
  if (tipo === 'contacto_nuevo') {
    const { data } = await cond(base().gt('created_at', desde)).limit(2000);
    ids = (data || []).map((r: any) => r.id);
  } else if (tipo === 'lifecycle_stage_change' || tipo === 'property_change' || tipo === 'propiedad') {
    // El contacto tiene que haber CAMBIADO después del cursor: si no, un
    // embudo recién activado se llevaría a toda la cartera que ya cumplía.
    const { data } = await cond(base().gt('updated_at', desde)).limit(2000);
    ids = (data || []).map((r: any) => r.id);
  } else if (tipo === 'segmento' && trig.segmento_id) {
    const { data: seg } = await supabase.from('email_segments').select('definicion').eq('id', trig.segmento_id).maybeSingle();
    if (seg) {
      const { resolverMiembros } = await import('./segmentos');
      const m = await resolverMiembros(t, seg.definicion as any, 5000);
      ids = m.map(x => x.contact_id).filter(Boolean) as string[];
    }
  } else {
    return [];
  }
  if (!ids.length) return [];

  // Nadie entra dos veces (salvo que el embudo permita re-inscripción y haya
  // pasado su periodo de espera).
  // Por TANDAS y revisando el error: un `.in()` con 2,000 uuids es una URL de
  // ~74 KB que PostgREST rechaza. El error no se miraba, `bloqueados` quedaba
  // vacío y se reinscribía a todos — incluidos los que ya iban en camino.
  const yaVan: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('automation_enrollments')
      .select('contact_id, estado, completed_at')
      .eq('automation_id', auto.id).in('contact_id', ids.slice(i, i + 200));
    if (error) throw new Error('No se pudo revisar quién ya está inscrito: ' + error.message);
    yaVan.push(...(data || []));
  }
  const bloqueados = new Set<string>();
  for (const e of yaVan) {
    if (e.estado === 'activo') { bloqueados.add(e.contact_id); continue; }
    if (!auto.allow_reenrollment) { bloqueados.add(e.contact_id); continue; }
    const espera = (auto.reenrollment_delay_hours || 720) * 3600000;
    if (e.completed_at && Date.now() - new Date(e.completed_at).getTime() < espera) bloqueados.add(e.contact_id);
  }

  // Quien se dio de baja no entra a un embudo de marketing.
  // Acotado a los candidatos (y por tandas): sin `.limit()` esto se cortaba en
  // el tope de filas de PostgREST y, pasado ese punto, los suprimidos volvían
  // a entrar al embudo.
  for (let i = 0; i < ids.length; i += 200) {
    const { data: supr } = await supabase.from('email_suppressions')
      .select('contact_id').eq('tenant_id', t.id).is('restaurado_at', null)
      .in('contact_id', ids.slice(i, i + 200)).limit(200);
    for (const s of supr || []) if (s.contact_id) bloqueados.add(s.contact_id);
  }

  return ids.filter(id => !bloqueados.has(id));
}

/** Inscribe a los que toca y adelanta el cursor. Devuelve cuántos entraron. */
export async function inscribirPendientes(t: Tenant, auto: any): Promise<number> {
  const ids = await candidatos(t, auto);
  const primer = await primerPaso(auto.id);
  if (!primer) return 0;

  let n = 0;
  for (const contactId of ids) {
    const { error } = await supabase.from('automation_enrollments').insert({
      automation_id: auto.id, contact_id: contactId,
      current_step_id: primer.id, estado: 'activo',
      next_action_at: new Date().toISOString(),
      enrollment_trigger: auto.enrollment_triggers,
    });
    if (!error) n++;
  }
  await supabase.from('automations')
    .update({ cursor_at: new Date().toISOString(), total_enrolled: (auto.total_enrolled || 0) + n })
    .eq('id', auto.id);
  return n;
}

async function primerPaso(automationId: string): Promise<Paso | null> {
  const { data } = await supabase.from('automation_steps').select('*')
    .eq('automation_id', automationId).is('parent_step_id', null).eq('activo', true)
    .order('orden').limit(1).maybeSingle();
  return (data as Paso) || null;
}

/** El paso que sigue: hijo por rama si la hay, si no el siguiente hermano. */
async function siguientePaso(paso: Paso, rama: string | null): Promise<Paso | null> {
  if (rama) {
    const { data } = await supabase.from('automation_steps').select('*')
      .eq('automation_id', paso.automation_id).eq('parent_step_id', paso.id)
      .eq('branch_key', rama).eq('activo', true).order('orden').limit(1).maybeSingle();
    if (data) return data as Paso;
  }
  const { data: hijo } = await supabase.from('automation_steps').select('*')
    .eq('automation_id', paso.automation_id).eq('parent_step_id', paso.id)
    .is('branch_key', null).eq('activo', true).order('orden').limit(1).maybeSingle();
  if (hijo) return hijo as Paso;

  // OJO: en PostgREST `.eq(campo, null)` NO empata con NULL — se traduce a
  // `campo=eq.null` y en SQL nada es igual a NULL. Hay que usar `.is()`.
  // Con `.eq` aquí, un paso de primer nivel nunca encontraba a su hermano y
  // el embudo se daba por terminado después del primer correo.
  let q = supabase.from('automation_steps').select('*')
    .eq('automation_id', paso.automation_id)
    .gt('orden', paso.orden).eq('activo', true);
  q = paso.parent_step_id ? q.eq('parent_step_id', paso.parent_step_id) : q.is('parent_step_id', null);
  q = paso.branch_key ? q.eq('branch_key', paso.branch_key) : q.is('branch_key', null);
  const { data } = await q.order('orden').limit(1).maybeSingle();
  return (data as Paso) || null;
}

/** ¿Se cumple la condición de una rama? Hechos del CRM, no aperturas. */
async function evaluarCondicion(cfg: any, contactId: string): Promise<boolean> {
  const tipo = String(cfg?.tipo || cfg?.type || '');
  const dias = Number(cfg?.dias ?? cfg?.days ?? 7);
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  if (tipo === 'agendo_reunion') {
    const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true })
      .eq('contact_id', contactId).gte('created_at', desde);
    return (count || 0) > 0;
  }
  if (tipo === 'hizo_clic') {
    const { count } = await supabase.from('email_sends').select('id', { count: 'exact', head: true })
      .eq('contact_id', contactId).not('clicked_at', 'is', null).gte('created_at', desde);
    return (count || 0) > 0;
  }
  if (tipo === 'abrio') {   // señal poco fiable — ver cabecera
    const { count } = await supabase.from('email_sends').select('id', { count: 'exact', head: true })
      .eq('contact_id', contactId).not('first_opened_at', 'is', null).gte('created_at', desde);
    return (count || 0) > 0;
  }
  if (tipo === 'es_cliente' || tipo === 'etapa') {
    const { data } = await supabase.from('contacts').select('lifecycle_stage').eq('id', contactId).maybeSingle();
    const esperado = cfg?.valor ?? cfg?.value ?? 'cliente';
    return data?.lifecycle_stage === esperado;
  }
  if (tipo === 'propiedad') {
    const { data } = await supabase.from('contacts').select(String(cfg.campo)).eq('id', contactId).maybeSingle();
    return (data as any)?.[cfg.campo] === cfg.valor;
  }
  return false;
}

/** Datos de personalización del contacto. */
async function contexto(contactId: string): Promise<Contexto & { email: string | null; company_id: string | null }> {
  const { data } = await supabase.from('contacts')
    .select('nombre, apellido, email, giro, plan_interes, sucursales_interes, company_id, companies(nombre)')
    .eq('id', contactId).maybeSingle();
  const c: any = data || {};
  return {
    nombre: c.nombre, apellido: c.apellido, email: c.email, giro: c.giro,
    plan: c.plan_interes, sucursales: c.sucursales_interes,
    empresa: c.companies?.nombre || null, company_id: c.company_id || null,
  };
}

export interface AvanceEmbudo { procesadas: number; correos: number; completadas: number; errores: number }

/**
 * Procesa las inscripciones vencidas. Toma TODO lo vencido, no "lo de este
 * tick": si el cron se saltó una hora, nadie se queda atorado.
 */
export async function procesarInscripciones(presupuestoMs = 200_000): Promise<AvanceEmbudo> {
  const inicio = Date.now();
  const av: AvanceEmbudo = { procesadas: 0, correos: 0, completadas: 0, errores: 0 };

  while (Date.now() - inicio < presupuestoMs) {
    const { data: lote } = await supabase.from('automation_enrollments')
      .select('*').eq('estado', 'activo').lte('next_action_at', new Date().toISOString())
      .order('next_action_at').limit(25);
    if (!lote?.length) break;

    let avanceEnEsteLote = 0;
    for (const e of lote as Inscripcion[]) {
      if (Date.now() - inicio >= presupuestoMs) break;

      // CANDADO: solo un proceso avanza esta inscripción.
      const { data: tomada } = await supabase.from('automation_enrollments')
        .update({ locked_at: new Date().toISOString() })
        .eq('id', e.id).eq('estado', 'activo').lte('next_action_at', new Date().toISOString())
        .or(`locked_at.is.null,locked_at.lt.${new Date(Date.now() - LOCK_MIN * 60000).toISOString()}`)
        .select('id');
      if (!tomada?.length) continue;   // otra instancia lo tomó

      avanceEnEsteLote++;
      av.procesadas++;
      try {
        const hecho = await avanzarUna(e);
        av.correos += hecho.correos;
        if (hecho.completada) av.completadas++;
      } catch (err: any) {
        av.errores++;
        await supabase.from('automation_enrollments').update({
          last_error: String(err?.message || err).slice(0, 400),
          error_count: (e as any).error_count ? (e as any).error_count + 1 : 1,
          // Un error no puede dejarla girando: se reintenta en una hora.
          next_action_at: new Date(Date.now() + 3600000).toISOString(),
          locked_at: null,
        }).eq('id', e.id);
      }
    }
    // Si otra instancia tiene todo el lote tomado, ninguno se gana y el `while`
    // volvería a pedir las MISMAS 25 filas hasta agotar el presupuesto: dos
    // consultas por fila girando en vacío durante minutos.
    if (avanceEnEsteLote === 0) break;
  }
  return av;
}

async function terminar(e: Inscripcion, razon: string, meta = false) {
  await supabase.from('automation_enrollments').update({
    estado: meta ? 'meta_lograda' : 'completado',
    unenrollment_reason: razon,
    completed_at: new Date().toISOString(),
    next_action_at: null,
  }).eq('id', e.id);
  if (meta) {
    const { data: a } = await supabase.from('automations').select('total_achieved_goal').eq('id', e.automation_id).maybeSingle();
    await supabase.from('automations').update({ total_achieved_goal: (a?.total_achieved_goal || 0) + 1 }).eq('id', e.automation_id);
  }
}

/** Ejecuta el paso actual de UNA inscripción y la deja lista para el siguiente. */
async function avanzarUna(e: Inscripcion): Promise<{ correos: number; completada: boolean }> {
  if ((e.pasos_dados || 0) > MAX_PASOS) {
    await terminar(e, 'demasiados pasos: revisa el embudo');
    return { correos: 0, completada: true };
  }

  const { data: auto } = await supabase.from('automations').select('*').eq('id', e.automation_id).maybeSingle();
  if (!auto || auto.estado !== 'activo') {
    // Embudo pausado: la inscripción espera, no se pierde su lugar.
    await supabase.from('automation_enrollments')
      .update({ next_action_at: new Date(Date.now() + 3600000).toISOString(), locked_at: null }).eq('id', e.id);
    return { correos: 0, completada: false };
  }

  const t = await resolverTenant(auto.tenant_id);
  if (!t) { await terminar(e, 'sin inquilino'); return { correos: 0, completada: true }; }

  if (!e.current_step_id) { await terminar(e, 'sin pasos'); return { correos: 0, completada: true }; }
  const { data: pasoData } = await supabase.from('automation_steps').select('*').eq('id', e.current_step_id).maybeSingle();
  const paso = pasoData as Paso | null;
  if (!paso) { await terminar(e, 'el paso ya no existe'); return { correos: 0, completada: true }; }

  const cfg = paso.config || {};
  let rama: string | null = null;
  let correos = 0;

  if (paso.tipo === 'send_email') {
    const ctx = await contexto(e.contact_id);
    if (ctx.email) {
      const { data: tpl } = cfg.template_id
        ? await supabase.from('email_templates').select('bloques, asunto').eq('id', cfg.template_id).maybeSingle()
        : { data: null as any };
      const bloques = (tpl?.bloques || cfg.bloques || []) as Bloque[];
      const asunto = cfg.asunto || tpl?.asunto || auto.nombre;
      const r = await enviarCorreo({
        tenantId: t.id, para: ctx.email, asunto,
        html: compilar(bloques, ctx, t), texto: compilarTexto(bloques, ctx),
        categoria: (auto.categoria === 'relacion' ? 'relacion' : 'marketing'),
        contactId: e.contact_id, companyId: ctx.company_id,
        automationId: auto.id, enrollmentId: e.id, stepId: paso.id,
        templateId: cfg.template_id || null,
      });
      if (r.enviado) correos = 1;
      // Un rechazo (presión, supresión) NO detiene el embudo: la persona
      // simplemente no recibió ESE correo y sigue su camino.
    }
  } else if (paso.tipo === 'send_notification') {
    await supabase.from('activities').insert({
      contact_id: e.contact_id, tipo: 'sistema', automatico: true,
      titulo: cfg.titulo || `Tarea del embudo "${auto.nombre}"`,
      metadata: { automation_id: auto.id, step_id: paso.id },
    });
  } else if (paso.tipo === 'if_then' || paso.tipo === 'condition') {
    rama = (await evaluarCondicion(cfg, e.contact_id)) ? 'si' : 'no';
  } else if (paso.tipo === 'goal') {
    const lograda = await evaluarCondicion(cfg, e.contact_id);
    if (lograda) { await terminar(e, cfg.nombre || 'meta lograda', true); return { correos, completada: true }; }
  }

  // Meta global del embudo: si ya se cumplió, sale aunque queden pasos.
  if (auto.goal_criteria && await evaluarCondicion(auto.goal_criteria, e.contact_id)) {
    await terminar(e, 'meta del embudo lograda', true);
    return { correos, completada: true };
  }

  const sig = await siguientePaso(paso, rama);
  if (!sig) {
    await terminar(e, 'terminó el embudo');
    const { data: a } = await supabase.from('automations').select('total_completed').eq('id', auto.id).maybeSingle();
    await supabase.from('automations').update({ total_completed: (a?.total_completed || 0) + 1 }).eq('id', auto.id);
    return { correos, completada: true };
  }

  // "Esperar" es el único paso que consume tiempo de reloj.
  let cuando = new Date();
  if (sig.tipo === 'wait') {
    const c = sig.config || {};
    // `ms || DEFECTO` convertía una espera de CERO en un día entero: 0 es
    // falsy. El valor por omisión solo aplica cuando NO se configuró ninguna
    // unidad de tiempo — una espera de 0 es una decisión, no un hueco.
    const definido = ['dias', 'days', 'horas', 'hours', 'minutos', 'minutes'].some(k => c[k] !== undefined && c[k] !== null && c[k] !== '');
    const ms = (Number(c.dias ?? c.days ?? 0) * 86400000)
             + (Number(c.horas ?? c.hours ?? 0) * 3600000)
             + (Number(c.minutos ?? c.minutes ?? 0) * 60000);
    cuando = new Date(Date.now() + (definido ? ms : 86400000));
    // Un "esperar" no ejecuta nada: se salta al que sigue cuando venza.
    const trasEspera = await siguientePaso(sig, null);
    await supabase.from('automation_enrollments').update({
      current_step_id: trasEspera ? trasEspera.id : null,
      next_action_at: trasEspera ? cuando.toISOString() : null,
      pasos_dados: (e.pasos_dados || 0) + 1, locked_at: null,
    }).eq('id', e.id);
    if (!trasEspera) await terminar(e, 'terminó el embudo');
    return { correos, completada: !trasEspera };
  }

  await supabase.from('automation_enrollments').update({
    current_step_id: sig.id, next_action_at: cuando.toISOString(),
    pasos_dados: (e.pasos_dados || 0) + 1, locked_at: null,
  }).eq('id', e.id);
  return { correos, completada: false };
}

/**
 * Activar un embudo. El `activado_at` es la promesa de arranque limpio: a
 * partir de aquí, y nunca hacia atrás.
 */
export async function activar(automationId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: pasos } = await supabase.from('automation_steps').select('id').eq('automation_id', automationId).limit(1);
  if (!pasos?.length) return { ok: false, error: 'El embudo no tiene pasos.' };
  const ahora = new Date().toISOString();
  await supabase.from('automations').update({ estado: 'activo', activado_at: ahora, cursor_at: ahora }).eq('id', automationId);
  return { ok: true };
}

export async function pausar(automationId: string): Promise<void> {
  await supabase.from('automations').update({ estado: 'pausado' }).eq('id', automationId);
}

/** Cuántos esperan en cada paso — el badge del árbol. */
export async function conteoPorPaso(automationId: string): Promise<Record<string, number>> {
  const { data } = await supabase.from('automation_enrollments')
    .select('current_step_id').eq('automation_id', automationId).eq('estado', 'activo').limit(20000);
  const out: Record<string, number> = {};
  for (const e of data || []) if (e.current_step_id) out[e.current_step_id] = (out[e.current_step_id] || 0) + 1;
  return out;
}
