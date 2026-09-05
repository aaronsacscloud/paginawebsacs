/**
 * CONTRATACIÓN DE PUNTA A PUNTA (decisión del dueño, 2026-09-05).
 *
 * Del «quiero contratar» al acceso en la mano del cliente, sin que el dinero se vuelva barrera:
 *
 *   plan ──▶ pago ──▶ esperando_comprobante ──▶ comprobante ──▶ acceso_enviado ──▶ confirmado
 *
 *   · plan:      se le pregunta qué plan; si no sabe, se le recomienda por tiendas y necesidad.
 *   · pago:      total mensual y anual (el anual ahorra 35 %). Tres vías: tarjeta en /planes, transferencia (anual) o
 *                liga de Mercado Pago (la genera el consultor). Se pide el correo para el acceso si no lo tenemos.
 *   · esperando: se mandaron los datos bancarios (Kiether, la pagadora) y se espera el comprobante por WhatsApp.
 *   · comprobante: el agente LEE la foto o el PDF (fotos-lead.ts la marca «COMPROBANTE DE PAGO»). En ese momento:
 *                  1) el comprobante va por correo a administración, 2) se abre la tarea P1 «confirmar depósito» al
 *                  consultor, 3) se CREA la cuenta en Sacs (sin marca de prueba: es un cliente) y 4) se le manda el
 *                  acceso con la Academia, la liga para agendar su kickoff y el soporte dentro de Sacs.
 *   · confirmado: el consultor confirmó el depósito desde la tarea → cliente, onboarding abierto. Si el dinero no
 *                 llegó, desde la misma tarea se bloquea la cuenta.
 *
 * El único paso humano es confirmar que el dinero entró. Todo lo demás lo hace el sistema en el mismo minuto.
 * El estado vive en ti_perfil.agente_estado.contratacion; los mensajes los escribe el agente con la nota de cada fase.
 */
import { supabase } from '../../supabase';
import { provisionAccount, generateUniqueAccountId } from '../../register';

export const CUENTA_PAGO = {
  empresa: 'Kiether', nota_empresa: 'es la pagadora del grupo', rfc: 'PTK230413KK1', banco: 'BBVA',
  cuenta: '0120641979', clabe: '012180001206419797', concepto: 'Desarrollo de software', correo: 'administracion@sacscloud.com',
};
export const LIGA_PLANES = 'https://www.sacscloud.com/planes';
export const LIGA_KICKOFF = 'https://www.sacscloud.com/agendar/onboarding';
export const LIGA_APP = 'https://app.sacscloud.com';

export type PlanClave = 'vende' | 'controla' | 'fideliza' | 'automatiza';
export const PLANES: { clave: PlanClave; nombre: string; mensual: number; anual: number; para: string }[] = [
  { clave: 'vende', nombre: 'Vende', mensual: 810, anual: 527, para: 'una sola tienda' },
  { clave: 'controla', nombre: 'Controla', mensual: 1215, anual: 790, para: 'varias tiendas: existencias por sucursal, traspasos, CEDIS' },
  { clave: 'fideliza', nombre: 'Fideliza y Multiplica', mensual: 1890, anual: 1229, para: 'clientas, monedero, puntos, campañas por correo y WhatsApp' },
  { clave: 'automatiza', nombre: 'Automatiza', mensual: 3780, anual: 2457, para: 'IA, reglas automáticas, pronóstico, integraciones' },
];
export const planPorNombre = (s: string | null | undefined): typeof PLANES[number] | null => {
  const t = String(s || '').toLowerCase();
  if (!t) return null;
  if (/automatiza/.test(t)) return PLANES[3];
  if (/fideliza|multiplica/.test(t)) return PLANES[2];
  if (/controla/.test(t)) return PLANES[1];
  if (/vende/.test(t)) return PLANES[0];
  return null;
};
const mxn = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

export type FaseContratacion = 'plan' | 'pago' | 'esperando_comprobante' | 'comprobante' | 'acceso_enviado' | 'confirmado' | 'cancelada';
export type Contratacion = {
  fase: FaseContratacion; desde: string;
  plan?: PlanClave | null; sucursales?: number | null; periodo?: 'mensual' | 'anual' | null; via?: 'planes' | 'transferencia' | 'mercadopago' | null;
  pago_enviado_at?: string | null; nudges?: number;
  comprobante?: { msg_id: string; url: string; descripcion: string; at: string } | null;
  cuenta?: string | null; acceso_at?: string | null; tarea_id?: string | null; confirmado_at?: string | null; error_acceso?: string | null;
};

const QUIERE_CONTRATAR = /\b(quiero contratar(lo)?|c[oó]mo (lo )?contrato|c[oó]mo (le )?hago para (pagar|contratar|empezar)|d[oó]nde (pago|lo pago)|quiero pagar|lo quiero (ya|contratar)|vamos con (el|la) (plan|licencia)|me quedo con (el|la) (plan|licencia)|me interesa contratar|ya lo quiero|c[oó]mo se paga|pasame? (los )?datos (para|de) (pago|transferencia|dep[oó]sito)|ya decid[ií]|va, contrat[ao])\b/i;

async function ia(accion: string, contact_id: string, razon: string, detalle?: any) {
  await supabase.from('ia_log').insert({ accion, contact_id, razon: razon.slice(0, 300), detalle: detalle || null }).then(() => {}, () => {});
}
async function leer(contactId: string): Promise<{ st: Contratacion | null; agente_estado: any }> {
  const { data } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', contactId).maybeSingle();
  const ae: any = (data?.agente_estado as any) || {};
  return { st: ae.contratacion || null, agente_estado: ae };
}
async function guardar(contactId: string, agente_estado: any, st: Contratacion) {
  const { _password, ...limpio } = st as any;   // la contraseña temporal viaja en el mensaje, NUNCA se guarda en el CRM
  await supabase.from('ti_perfil').upsert({ contact_id: contactId, agente_estado: { ...agente_estado, contratacion: limpio }, updated_at: new Date().toISOString() }, { onConflict: 'contact_id' });
}

/** Lo que ya sabemos del lead que decide plan y total. */
async function ficha(contactId: string) {
  const { data: c } = await supabase.from('contacts').select('id, nombre, email, whatsapp, giro, sucursales_interes, plan_interes, company_id, propiedades, companies(id, nombre, nombre_comercial, giro, sucursales, sacs_account)').eq('id', contactId).maybeSingle();
  const co: any = (c as any)?.companies || null; const dl: any = ((c as any)?.propiedades as any)?.datos_lead || {};
  return {
    c, co,
    marca: co?.nombre_comercial || co?.nombre || dl.empresa || null,
    sucursales: Number((c as any)?.sucursales_interes ?? co?.sucursales) || null,
    giro: (c as any)?.giro || co?.giro || null,
    email: String((c as any)?.email || '').trim().toLowerCase() || null,
    planInteres: planPorNombre((c as any)?.plan_interes),
  };
}

const totales = (plan: typeof PLANES[number], sucursales: number | null | undefined) => {
  const n = Math.max(1, sucursales || 1);
  return { n, mensual: plan.mensual * n, anual_mes: plan.anual * n, anual_total: plan.anual * n * 12 };
};

/** El bloque bancario tal cual se le manda (una burbuja aparte, para que lo copie). */
export const bloqueBancario = () => `Empresa: ${CUENTA_PAGO.empresa}\nRFC: ${CUENTA_PAGO.rfc}\nBanco: ${CUENTA_PAGO.banco}\nCuenta: ${CUENTA_PAGO.cuenta}\nCLABE: ${CUENTA_PAGO.clabe}\nConcepto: ${CUENTA_PAGO.concepto}`;

/**
 * ANTES DEL TURNO. Lee el último mensaje del lead, avanza la fase si toca (comprobante recibido, «quiero contratar»)
 * y devuelve la nota con la que el agente escribe. Null si el lead no está contratando.
 */
export async function contratacionAntesDelTurno(contactId: string, textoLead: string, conversationId?: string | null): Promise<string | null> {
  const { st: prev, agente_estado } = await leer(contactId);
  let st: Contratacion | null = prev && !['cancelada'].includes(prev.fase) ? { ...prev } : null;
  const ahora = new Date().toISOString();
  if (!st && QUIERE_CONTRATAR.test(textoLead || '')) {
    st = { fase: 'plan', desde: ahora, nudges: 0 };
    await ia('contratacion_inicio', contactId, `«${String(textoLead).slice(0, 120)}»`);
  }
  if (!st) return null;
  const f = await ficha(contactId);
  // Datos que llegan por la ficha (el agente los reporta en «datos» y aplicarDatos los escribe en el CRM).
  if (!st.plan && f.planInteres) st.plan = f.planInteres.clave;
  if (!st.sucursales && f.sucursales) st.sucursales = f.sucursales;
  // Lo que dice en ESTE mensaje cuenta ya (no en el turno siguiente): «por transferencia», «anual», «Controla», «3 tiendas».
  // Sin esto, el lead pedía los datos bancarios y el agente contestaba «te los paso en un momento» (visto en la prueba del 5-sep).
  {
    const t = String(textoLead || '');
    const p = planPorNombre(t); if (p) st.plan = p.clave;
    if (/\banual\b|al a[ñn]o|por a[ñn]o/i.test(t)) st.periodo = 'anual'; else if (/\bmensual\b|por mes|al mes/i.test(t) && !/anual/i.test(t)) st.periodo = st.periodo || 'mensual';
    if (/transferencia|transferir|dep[oó]sito|depositar|spei|clabe|datos (de la )?cuenta|datos bancarios/i.test(t)) { st.via = 'transferencia'; st.periodo = st.periodo || 'anual'; }
    else if (/mercado ?pago|liga de pago|link de pago|m[aá]ndame (la|una) liga/i.test(t)) st.via = 'mercadopago';
    else if (/tarjeta|en l[ií]nea|por la p[aá]gina|en la p[aá]gina|en planes/i.test(t)) st.via = 'planes';
    const m = t.match(/(\d{1,2})\s*(tiendas?|sucursales?|puntos? de venta|locales?)/i); if (m) st.sucursales = parseInt(m[1], 10);
  }

  // ¿Llegó el comprobante? (foto o PDF que fotos-lead marcó como COMPROBANTE DE PAGO, después de que mandamos los datos)
  if (['pago', 'esperando_comprobante'].includes(st.fase)) {
    const desde = st.pago_enviado_at || st.desde;
    const { data: convs } = await supabase.from('wa_conversaciones').select('id').eq('contact_id', contactId);
    const ids = (convs || []).map(x => x.id);
    if (ids.length) {
      const { data: media } = await supabase.from('wa_mensajes').select('id, media_url, transcript, created_at').in('conversation_id', ids).eq('direccion', 'entrante').in('tipo', ['image', 'document', 'file']).is('borrado_at', null).gte('created_at', desde).not('transcript', 'is', null).order('created_at', { ascending: false }).limit(6);
      const comp = (media || []).find(m => /^\s*COMPROBANTE DE PAGO/i.test(String(m.transcript || '')));
      if (comp) {
        st.fase = 'comprobante'; st.comprobante = { msg_id: comp.id, url: comp.media_url, descripcion: String(comp.transcript).slice(0, 600), at: ahora };
        await ia('contratacion_comprobante', contactId, st.comprobante.descripcion.slice(0, 200), { msg_id: comp.id });
      }
    }
  }

  let nota: string;
  const plan = st.plan ? PLANES.find(p => p.clave === st!.plan)! : null;
  const tot = plan ? totales(plan, st.sucursales) : null;
  const correoTxt = f.email ? `Correo para el acceso: ${f.email} (ya lo tenemos).` : 'NO TENEMOS SU CORREO: pídelo en este mismo mensaje («¿a qué correo te creo el acceso?»), es indispensable para crear su cuenta.';
  const reporta = 'Reporta en "datos" lo que diga: campo plan_elegido (Vende/Controla/Fideliza y Multiplica/Automatiza), periodo_pago (mensual/anual), via_pago (tarjeta/transferencia/mercadopago), sucursales, email.';

  if (st.fase === 'comprobante') {
    // Crear el acceso ahora mismo si ya hay correo; si no, pedirlo (y se crea en cuanto lo dé).
    if (!st.cuenta && f.email) await crearAcceso(contactId, st, f);
    await tareaYCorreo(contactId, st, f).catch(() => {});
    nota = st.cuenta
      ? `EL LEAD MANDÓ SU COMPROBANTE DE PAGO (${st.comprobante?.descripcion.slice(0, 200)}). Ya se pasó a administración y SU ACCESO YA ESTÁ CREADO. Escribe DOS burbujas (sepáralas con ---). Burbuja 1: gracias, que ya lo pasaste a administración y que en este momento queda listo su acceso. Burbuja 2, tal cual estos datos: entra en ${LIGA_APP} con el correo ${f.email} y la contraseña temporal «${st.error_acceso ? '' : (st as any)._password || ''}» (la cambia al entrar); adentro tiene la Academia para aprender paso a paso, y el chat de soporte dentro de su Sacs para cualquier duda; y que agende su sesión de arranque con un consultor para su kickoff aquí: ${LIGA_KICKOFF}. Sin vender nada más, sin preguntas. Cálido y concreto.`
      : st.error_acceso
        ? `EL LEAD MANDÓ SU COMPROBANTE DE PAGO. Ya se pasó a administración, pero el sistema NO pudo crear la cuenta todavía (${st.error_acceso}); el consultor ya tiene la tarea. Dile gracias, que ya lo pasaste a administración y que en unos minutos le llega su acceso por aquí, con la Academia y su sesión de arranque. Sin preguntas.`
        : `EL LEAD MANDÓ SU COMPROBANTE DE PAGO. Ya se pasó a administración. Para crear su acceso en este momento SOLO falta su correo: agradécele, dile que en cuanto te pase el correo le creas el acceso al instante (Academia, soporte dentro de Sacs y su sesión de arranque), y pídele el correo. Una sola pregunta.`;
    st.fase = st.cuenta ? 'acceso_enviado' : 'comprobante';
    if (st.cuenta) st.acceso_at = ahora;
  } else if (st.fase === 'plan' && !plan) {
    const sug = !st.sucursales ? null : st.sucursales >= 2 ? PLANES[1] : PLANES[0];
    nota = `EL LEAD QUIERE CONTRATAR. Fase PLAN. ${st.sucursales ? `Tiene ${st.sucursales} tienda(s).` : 'No sabemos cuántas tiendas tiene: pregúntalo en la misma línea.'} Pregúntale qué plan quiere y, si no lo tiene claro, recomiéndale uno por lo que sabes de él${sug ? ` (por número de tiendas le queda ${sug.nombre}: ${sug.para}; si ya habló de clientas, monedero o campañas, Fideliza y Multiplica)` : ''}. Nada de listas de funciones: una línea por qué ese plan y el precio por tienda al mes (mensual y anual). No lo mandes a demo ni a llamada: ya quiere comprar. ${reporta} Una sola pregunta al final.`;
    st.fase = 'plan';
  } else if (!st.via && plan && tot) {
    st.fase = 'pago';
    nota = `EL LEAD QUIERE CONTRATAR el plan ${plan.nombre}${st.sucursales ? ` para ${tot.n} tienda(s)` : ' (si no sabes cuántas tiendas, pregúntalo)'}. Fase PAGO. Dile el total claro: ${mxn(tot.mensual)} al mes, o si lo toma anual ${mxn(tot.anual_mes)} al mes (${mxn(tot.anual_total)} en un solo pago) con el 35 % de ahorro. Las vías, en una línea cada una: pagar con tarjeta en ${LIGA_PLANES} (mensual o anual, el acceso le llega al correo al terminar), o si prefiere el anual por transferencia le pasas los datos por aquí, o si quiere liga de pago se la mandas. Pregúntale cuál prefiere. ${correoTxt} ${reporta} Máximo dos preguntas en total (vía y correo si falta).`;
  } else if (st.via === 'transferencia' && st.fase !== 'esperando_comprobante') {
    st.fase = 'esperando_comprobante'; st.pago_enviado_at = ahora;
    nota = `EL LEAD VA A PAGAR POR TRANSFERENCIA el plan ${plan?.nombre} ${st.periodo === 'anual' && tot ? `anual: ${mxn(tot.anual_total)}` : tot ? `(${mxn(tot.mensual)} al mes; si lo paga anual son ${mxn(tot.anual_total)} con 35 % de ahorro)` : ''}. Escribe DOS burbujas (sepáralas con ---). Burbuja 1: el monto y que en cuanto te mande el comprobante por aquí queda listo su acceso en ese mismo momento. Burbuja 2, EXACTAMENTE estos datos, uno por línea y sin cambiar nada:\n${bloqueBancario()}\nDespués de los datos, una línea: que el comprobante lo mande por aquí mismo y, si puede, también a ${CUENTA_PAGO.correo}. ${correoTxt} Nada más.`;
  } else if (st.via === 'planes') {
    nota = `EL LEAD VA A PAGAR CON TARJETA en ${LIGA_PLANES}. Dile que ahí elige ${plan?.nombre || 'su plan'}${st.periodo === 'anual' ? ' anual' : ''}, paga, y su acceso le llega al correo al terminar; que en cuanto lo haga le escribes para agendar su sesión de arranque con el consultor. Si ya pagó, pídele que te diga y agradécele. Sin repetir precios.`;
  } else if (st.via === 'mercadopago') {
    nota = `EL LEAD QUIERE LIGA DE PAGO (Mercado Pago) para el plan ${plan?.nombre} ${st.periodo || ''}. Dile que se la pasas en un momento por aquí. ${correoTxt} Sin nada más.`;
    await tareaLiga(contactId, st, f).catch(() => {});
  } else if (st.fase === 'esperando_comprobante') {
    nota = `EL LEAD ESTÁ POR PAGAR POR TRANSFERENCIA (ya le mandaste los datos bancarios el ${String(st.pago_enviado_at).slice(0, 10)}). Contesta lo que pregunte; si pregunta los datos, repítelos exactos en una burbuja aparte:\n${bloqueBancario()}\nSi dice que ya pagó pero no ha mandado comprobante, pídele la captura por aquí para dejarle el acceso en ese momento. ${correoTxt}`;
  } else if (st.fase === 'acceso_enviado') {
    nota = `EL LEAD YA ES CLIENTE: pagó y ya tiene su acceso (cuenta ${st.cuenta}, entra en ${LIGA_APP}). Contesta lo que pregunte con calidez; si es duda de uso, recuérdale el chat de soporte dentro de su Sacs y la Academia; si no ha agendado su kickoff, la liga es ${LIGA_KICKOFF}. No vendas nada.`;
  } else {
    nota = `EL LEAD ESTÁ CONTRATANDO (fase ${st.fase}). Contesta lo que pregunte y avanza al pago. ${reporta}`;
  }
  await guardar(contactId, agente_estado, st);
  return nota;
}

/** DESPUÉS DEL TURNO: lo que el agente captó en «datos» mueve la fase (plan, periodo, vía, correo). */
export async function contratacionDespuesDelTurno(contactId: string, datos: any[] | undefined): Promise<void> {
  const { st, agente_estado } = await leer(contactId);
  if (!st || ['cancelada', 'confirmado'].includes(st.fase)) return;
  const d = (datos || []).filter(x => x && x.campo && x.valor && (x.confianza ?? 1) >= 0.5);
  let cambio = false;
  for (const x of d) {
    const v = String(x.valor).toLowerCase();
    if (x.campo === 'plan_elegido') { const p = planPorNombre(v); if (p && st.plan !== p.clave) { st.plan = p.clave; cambio = true; } }
    if (x.campo === 'periodo_pago') { const per = /anual|año/.test(v) ? 'anual' : /mensual|mes/.test(v) ? 'mensual' : null; if (per && st.periodo !== per) { st.periodo = per; cambio = true; } }
    if (x.campo === 'via_pago') { const via = /transfer|dep[oó]sito|spei|clabe/.test(v) ? 'transferencia' : /mercado|liga|link/.test(v) ? 'mercadopago' : /tarjeta|planes|web|p[aá]gina|en l[ií]nea/.test(v) ? 'planes' : null; if (via && st.via !== via) { st.via = via; if (via === 'transferencia') st.periodo = st.periodo || 'anual'; cambio = true; } }
    if (x.campo === 'sucursales') { const n = parseInt(v, 10); if (n > 0 && st.sucursales !== n) { st.sucursales = n; cambio = true; } }
  }
  if (cambio) await guardar(contactId, agente_estado, st);
  // Si el comprobante ya llegó y el correo acaba de aparecer, el acceso se crea AHORA y sale solo (sin esperar otro turno).
  if (st.fase === 'comprobante' && !st.cuenta) {
    const f = await ficha(contactId);
    if (f.email) {
      await crearAcceso(contactId, st, f);
      if (st.cuenta) {
        st.fase = 'acceso_enviado'; st.acceso_at = new Date().toISOString();
        await guardar(contactId, agente_estado, st);
        const { data: cv } = await supabase.from('wa_conversaciones').select('id, telefono').eq('contact_id', contactId).order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
        if (cv?.telefono) await supabase.from('ti_envios').insert({ contact_id: contactId, conversation_id: cv.id, telefono: String(cv.telefono).replace(/\D/g, ''), origen: 'contratacion', estado: 'pendiente', mensaje: mensajeAcceso(f.email, (st as any)._password), salida: { estado: 'agendada', objetivo: 'Entregar el acceso recién creado', responder: true, accion: { tipo: 'ninguna' }, contratacion: { cuenta: st.cuenta } }, sale_at: new Date().toISOString(), modelo: 'regla' }).then(() => {}, () => {});
      } else await guardar(contactId, agente_estado, st);
    }
  }
}

export const mensajeAcceso = (email: string, password?: string | null) =>
  `Listo, tu acceso ya quedó. Entra en ${LIGA_APP} con tu correo ${email}${password ? ` y la contraseña temporal ${password} (la cambias al entrar)` : ''}.\n\nAdentro tienes la Academia para aprender paso a paso y el chat de soporte dentro de tu Sacs para cualquier duda. Y aquí agendas tu sesión de arranque con un consultor para tu kickoff: ${LIGA_KICKOFF}`;

/** Crea la cuenta en Sacs (sin marca de prueba: es un cliente) y la liga en el CRM. Muta `st`. */
async function crearAcceso(contactId: string, st: Contratacion, f: Awaited<ReturnType<typeof ficha>>): Promise<void> {
  try {
    if (!f.email) { st.error_acceso = 'sin correo'; return; }
    const base = f.marca || f.c?.nombre || 'tienda';
    const cuenta = await generateUniqueAccountId(base);
    const password = 'sacs' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
    const r = await provisionAccount({
      account_id: cuenta, account_name: f.marca || base, nombre: f.c?.nombre || base, email: f.email, password,
      whatsapp: f.c?.whatsapp || undefined, giro: f.giro || undefined, sucursales: st.sucursales ? String(st.sucursales) : undefined,
      plan: st.plan || undefined, source: 'agente_contratacion',
    });
    if (!r.ok) { st.error_acceso = r.error || `HTTP ${r.status}`; await ia('contratacion_acceso_fallo', contactId, st.error_acceso, r); return; }
    st.cuenta = cuenta; st.error_acceso = null; (st as any)._password = password;   // _password NO se persiste (guardar() lo escribe tal cual: se borra abajo)
    const ahora = new Date().toISOString();
    if (f.c?.company_id) {
      await supabase.from('company_sacs_accounts').insert({ company_id: f.c.company_id, cuenta, es_principal: true }).then(() => {}, () => {});
      await supabase.from('companies').update({ sacs_account: cuenta, updated_at: ahora }).eq('id', f.c.company_id).then(() => {}, () => {});
    }
    await supabase.from('activities').insert({ contact_id: contactId, company_id: f.c?.company_id || null, tipo: 'acceso_creado', titulo: `Acceso creado por el agente · cuenta ${cuenta}`, descripcion: `Pagó por transferencia (plan ${st.plan || '?'} ${st.periodo || ''}). Falta que el consultor confirme el depósito.`, automatico: true }).then(() => {}, () => {});
    await ia('contratacion_acceso', contactId, `cuenta ${cuenta} · plan ${st.plan} ${st.periodo || ''}`, { cuenta, email: f.email });
  } catch (e: any) { st.error_acceso = String(e?.message || e).slice(0, 160); }
}

/** La tarea P1 «confirmar depósito» y el correo a administración, una sola vez por contratación. */
async function tareaYCorreo(contactId: string, st: Contratacion, f: Awaited<ReturnType<typeof ficha>>) {
  if (st.tarea_id) return;
  const plan = st.plan ? PLANES.find(p => p.clave === st.plan) : null; const tot = plan ? totales(plan, st.sucursales) : null;
  const n = String(f.c?.nombre || 'el lead').split(/\s+/)[0];
  const monto = tot ? (st.periodo === 'anual' ? mxn(tot.anual_total) + ' (anual)' : mxn(tot.mensual) + ' (mensual)') : 'por confirmar';
  const { data: t } = await supabase.from('ti_tareas').insert({
    contact_id: contactId, company_id: f.c?.company_id || null, familia: 'cerrar', tipo: 'activacion', prioridad: 1, vence_at: new Date(Date.now() + 2 * 3600e3).toISOString(), origen: 'contratacion',
    payload: {
      instruccion: `${n}: mandó comprobante de transferencia · confirmar depósito y cerrar venta`,
      porque: `Plan ${plan?.nombre || '?'} ${st.periodo || ''} para ${st.sucursales || '?'} tienda(s): ${monto}. Lo que se ve en el comprobante: ${st.comprobante?.descripcion || ''}. ${st.cuenta ? `El acceso YA se creó (cuenta ${st.cuenta}) y se le mandó por WhatsApp.` : 'El acceso se crea en cuanto dé su correo.'} Cuando veas el depósito en la cuenta de ${CUENTA_PAGO.empresa}, confirma aquí: eso lo vuelve cliente y abre su onboarding.`,
      nombre: f.c?.nombre, whatsapp: f.c?.whatsapp, email: f.email, plan: st.plan, periodo: st.periodo, sucursales: st.sucursales, monto, cuenta: st.cuenta || null,
      comprobante_url: st.comprobante?.url || null, comprobante_msg_id: st.comprobante?.msg_id || null,
      hechos: [['Plan', `${plan?.nombre || '?'} ${st.periodo || ''}`, `${st.sucursales || '?'} tienda(s)`], ['Monto esperado', monto, ''], ['Cuenta creada', st.cuenta || 'pendiente (sin correo)', '', st.cuenta ? 'verde' : 'ambar']],
      resultados: { confirmado: 'Depósito confirmado: ya es cliente', no_llego: 'No llegó el dinero: bloquear la cuenta', parcial: 'Llegó otro monto (anota cuánto)' },
    },
  }).select('id').maybeSingle();
  st.tarea_id = t?.id || null;
  try {
    const { sendEmail } = await import('../../email');
    await sendEmail({
      to: CUENTA_PAGO.correo, transaccional: true, categoria: 'contratacion', contact_id: contactId,
      subject: `Comprobante de transferencia · ${f.c?.nombre || 'lead'} · ${plan?.nombre || ''} ${st.periodo || ''} · ${monto}`,
      html: `<p>El agente recibió por WhatsApp un comprobante de pago.</p><ul><li><b>Cliente:</b> ${f.c?.nombre || ''} · ${f.marca || ''} · ${f.c?.whatsapp || ''} · ${f.email || 'sin correo'}</li><li><b>Plan:</b> ${plan?.nombre || '?'} ${st.periodo || ''} · ${st.sucursales || '?'} tienda(s) · esperado ${monto}</li><li><b>Cuenta en Sacs:</b> ${st.cuenta || 'pendiente'}</li><li><b>Lo que se ve:</b> ${st.comprobante?.descripcion || ''}</li></ul>${st.comprobante?.url ? `<p><a href="${st.comprobante.url}">Ver comprobante</a></p>` : ''}<p>El consultor confirma el depósito desde su tarea en el CRM.</p>`,
    });
  } catch (e: any) { await ia('contratacion_correo_fallo', contactId, String(e?.message || e)); }
  await ia('contratacion_tarea', contactId, `tarea ${st.tarea_id} · ${monto}`);
}

/** Liga de Mercado Pago: la genera el consultor (tarea P1 con plan, periodo y sucursales). */
async function tareaLiga(contactId: string, st: Contratacion, f: Awaited<ReturnType<typeof ficha>>) {
  const { data: abierta } = await supabase.from('ti_tareas').select('id').eq('contact_id', contactId).eq('estado', 'pendiente').eq('tipo', 'liga_pago').limit(1);
  if ((abierta || []).length) return;
  const plan = st.plan ? PLANES.find(p => p.clave === st.plan) : null; const tot = plan ? totales(plan, st.sucursales) : null;
  const n = String(f.c?.nombre || 'el lead').split(/\s+/)[0];
  await supabase.from('ti_tareas').insert({ contact_id: contactId, company_id: f.c?.company_id || null, familia: 'cerrar', tipo: 'liga_pago', prioridad: 1, vence_at: new Date(Date.now() + 30 * 60e3).toISOString(), origen: 'contratacion', payload: {
    instruccion: `${n}: quiere liga de Mercado Pago · ${plan?.nombre || '?'} ${st.periodo || ''} · ${st.sucursales || '?'} tienda(s)`,
    porque: `El agente le dijo que se la pasamos en un momento. Monto: ${tot ? (st.periodo === 'anual' ? mxn(tot.anual_total) + ' anual' : mxn(tot.mensual) + ' mensual') : 'por confirmar'}. Genera la liga y mándasela por el hilo.`,
    nombre: f.c?.nombre, whatsapp: f.c?.whatsapp, plan: st.plan, periodo: st.periodo, sucursales: st.sucursales,
    resultados: { enviada: 'Liga enviada', pago: 'Ya pagó con la liga', no_quiso: 'Ya no la quiso' },
  } });
}

/**
 * EL CONSULTOR DECIDE desde la tarea «activacion»: confirmado → cliente + onboarding; no_llego → se bloquea la cuenta.
 */
export async function resolverActivacion(tarea: any, resultado: string, userId: string | null): Promise<{ ok: boolean; detalle?: string }> {
  const contactId = tarea.contact_id as string; const p: any = tarea.payload || {};
  const { st, agente_estado } = await leer(contactId);
  const ahora = new Date().toISOString();
  if (resultado === 'confirmado') {
    await supabase.from('contacts').update({ lifecycle_stage: 'cliente', updated_at: ahora }).eq('id', contactId).then(() => {}, () => {});
    if (tarea.company_id) { try { const { abrirOnboardingSiAplica } = await import('../onboarding.lib'); await abrirOnboardingSiAplica(tarea.company_id, { quien: userId || 'crm' }); } catch { /* onboarding pausado */ } }
    await supabase.from('activities').insert({ contact_id: contactId, company_id: tarea.company_id || null, tipo: 'pago_confirmado', titulo: `Depósito confirmado · ${p.monto || ''}`, descripcion: `Plan ${p.plan || ''} ${p.periodo || ''}. Cuenta ${p.cuenta || st?.cuenta || ''}. Ya es cliente.`, automatico: false, user_id: userId }).then(() => {}, () => {});
    if (st) await guardar(contactId, agente_estado, { ...st, fase: 'confirmado', confirmado_at: ahora });
    await ia('contratacion_confirmada', contactId, `${p.plan || ''} ${p.periodo || ''} · ${p.monto || ''}`, { por: userId });
    return { ok: true, detalle: 'cliente' };
  }
  if (resultado === 'no_llego') {
    const cuenta = p.cuenta || st?.cuenta;
    let bloqueo: any = { ok: false, error: 'sin cuenta' };
    if (cuenta) { const { revocarCuenta } = await import('../prueba'); bloqueo = await revocarCuenta({ cuenta, accion: 'bloquear', quien: userId || 'crm', motivo: 'pago', adeudo: p.monto }); }
    await supabase.from('activities').insert({ contact_id: contactId, company_id: tarea.company_id || null, tipo: 'pago_no_llego', titulo: 'El depósito no llegó', descripcion: cuenta ? (bloqueo.ok ? `Cuenta ${cuenta} bloqueada por pago.` : `No se pudo bloquear ${cuenta}: ${bloqueo.error}`) : 'No había cuenta creada.', automatico: false, user_id: userId }).then(() => {}, () => {});
    if (st) await guardar(contactId, agente_estado, { ...st, fase: 'cancelada' });
    await ia('contratacion_no_llego', contactId, cuenta ? `bloqueo ${bloqueo.ok ? 'ok' : bloqueo.error}` : 'sin cuenta');
    return { ok: bloqueo.ok || !cuenta, detalle: bloqueo.error };
  }
  return { ok: true };
}

/**
 * OBSERVADOR: quien recibió los datos bancarios y no ha mandado comprobante recibe UN recordatorio amable a las 24 h;
 * a las 72 h el consultor recibe una llamada P1. Devuelve cuántos tocó.
 */
export async function revisarContrataciones(decidir: (contactId: string, nota: string) => Promise<any>): Promise<{ recordados: number; llamadas: number }> {
  const res = { recordados: 0, llamadas: 0 };
  const { data: perfiles } = await supabase.from('ti_perfil').select('contact_id, agente_estado').not('agente_estado->contratacion', 'is', null).limit(200);
  const ahora = Date.now();
  for (const p of perfiles || []) {
    const ae: any = p.agente_estado || {}; const st: Contratacion | null = ae.contratacion || null;
    if (!st || st.fase !== 'esperando_comprobante' || !st.pago_enviado_at) continue;
    const horas = (ahora - Date.parse(st.pago_enviado_at)) / 3600e3;
    if (horas >= 24 && !(st.nudges || 0)) {
      const r = await decidir(p.contact_id, `RECORDATORIO ÚNICO DE PAGO: hace un día le mandaste los datos para la transferencia y no ha llegado comprobante. Una sola línea amable, sin presión: si ya lo hizo que te mande la captura para dejarle el acceso hoy, y si prefiere pagar con tarjeta en ${LIGA_PLANES} también queda al momento. Sin repetir los datos bancarios salvo que los pida.`).catch(() => null);
      await guardar(p.contact_id, ae, { ...st, nudges: 1 });
      if (r) res.recordados++;
    } else if (horas >= 72 && (st.nudges || 0) === 1) {
      const { data: c } = await supabase.from('contacts').select('nombre, whatsapp, company_id, owner_id').eq('id', p.contact_id).maybeSingle();
      await supabase.from('ti_tareas').insert({ contact_id: p.contact_id, company_id: c?.company_id || null, owner_id: c?.owner_id || null, familia: 'llamar', tipo: 'llamada', prioridad: 1, vence_at: new Date().toISOString(), origen: 'contratacion', payload: { instruccion: `${String(c?.nombre || 'el lead').split(' ')[0]}: iba a pagar por transferencia hace 3 días y no mandó comprobante`, porque: 'Quería contratar; algo lo detuvo (¿dudas del monto, del banco, de la factura?). Una llamada lo destraba.', nombre: c?.nombre, whatsapp: c?.whatsapp, reloj: 'contratacion', resultados: { contesto: 'Contestó', buzon: 'Buzón', no_contesto: 'No contestó', pago: 'Ya pagó' } } });
      await guardar(p.contact_id, ae, { ...st, nudges: 2 });
      res.llamadas++;
    }
  }
  return res;
}
