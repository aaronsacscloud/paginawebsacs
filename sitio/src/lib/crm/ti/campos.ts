// TRABAJO INTELIGENTE · F3 — EL REGISTRO DE CAMPOS y las DEUDAS DE DATO.
//
// Principio aprobado: el dato se captura donde nace; al humano se le pide EL
// CAMPO exacto, nunca «abre la ficha y llena». Cada campo vigilado declara
// dónde vive, cómo se captura y cuándo «se debe» — agregar un campo es
// agregar un renglón aquí, nunca tocar el motor.
//
// La escritura es por ALLOW-LIST: solo puede escribirse lo que este registro
// declara, en la tabla y columna que declara. Nada de updates arbitrarios.
import { planDeCotizacion } from '../../quotes/plan.ts';
import { supabase } from '../../supabase';

type Captura =
  | { tipo: 'texto'; placeholder: string; multilinea?: boolean }
  | { tipo: 'numero'; placeholder: string }
  | { tipo: 'opciones'; opciones: Record<string, string> };

export type CampoDef = {
  etiqueta: string;
  /** bloqueante (impide una acción) · comercial (con reloj) · higiene (lote) */
  clase: 'bloqueante' | 'comercial' | 'higiene';
  tabla: 'contacts' | 'companies' | 'bookings' | 'quotes';
  columna: string;
  captura: Captura;
  nota: string;
  /** Cada cuántos días se vuelve a pedir si sigue sin resolverse (default 30: una vez al mes). */
  reintentoDias?: number;
  /** Prioridad en el plan del día (default por clase: bloqueante 3, comercial 4, higiene 5). */
  prioridad?: number;
  /** Efectos colaterales permitidos al escribir (siguen siendo allow-list: solo lo que se declara aquí). */
  despues?: (sujetoId: string, valor: string) => Promise<void>;
};

export const CAMPOS: Record<string, CampoDef> = {
  // ── LA CADENA DESPUÉS DE LA REUNIÓN (decisión del dueño 2026-09-03): resultado el mismo día → minuta en 24 h →
  //    interés/cotización en 48 h. Cada eslabón vencido se vuelve a pedir y escala (24 h al consultor, 48 h al dueño).
  reunion_resultado: {
    etiqueta: 'Resultado de la reunión', clase: 'comercial', prioridad: 3, reintentoDias: 1,
    tabla: 'bookings', columna: 'estado',
    captura: { tipo: 'opciones', opciones: { asistio: 'Se hizo: asistió', no_asistio: 'No llegó', cancelada: 'Se canceló' } },
    nota: 'La reunión ya pasó y nadie registró qué pasó. Sin esto el agente no sabe si retirarse o insistir.',
    despues: async (id, v) => {
      const { data: b } = await supabase.from('bookings').select('contact_id').eq('id', id).maybeSingle();
      if (!b?.contact_id) return;
      if (v === 'asistio') await supabase.from('contacts').update({ estatus_lead: 'demo_hecha', estatus_lead_at: new Date().toISOString() }).eq('id', b.contact_id).in('estatus_lead', ['nuevo', 'contactado', 'respondio', 'agendado', 'sin_respuesta']);
    },
  },
  reunion_minuta: {
    etiqueta: 'Minuta de la reunión', clase: 'comercial', prioridad: 3, reintentoDias: 1,
    tabla: 'bookings', columna: 'minuta',
    captura: { tipo: 'texto', placeholder: 'Qué vimos, qué le dolió, qué prometimos, qué sigue…', multilinea: true },
    nota: 'La reunión se hizo hace más de 24 h y no hay minuta. Sin minuta la cotización se arma de memoria y el agente no sabe qué pasó.',
  },
  reunion_interes: {
    etiqueta: '¿Le interesó? (cotización)', clase: 'comercial', prioridad: 3, reintentoDias: 2,
    tabla: 'contacts', columna: 'estatus_lead',
    captura: { tipo: 'opciones', opciones: { cotizado: 'Sí le interesó: ya le coticé (o la mando hoy)', descartado: 'No le interesó' } },
    nota: 'Pasaron 48 h de la minuta y no hay cotización ni una decisión. O se cotiza o se cierra con motivo.',
    despues: async (id, v) => {
      const ahora = new Date().toISOString();
      if (v === 'descartado') await supabase.from('contacts').update({ lifecycle_stage: 'descalificado', descarte_categoria: 'sin_interes_post_demo', estatus_lead_at: ahora }).eq('id', id);
      else await supabase.from('contacts').update({ estatus_lead_at: ahora }).eq('id', id);
    },
  },
  cotizacion_cobro: {
    etiqueta: 'Cotización aceptada sin pago', clase: 'comercial', prioridad: 3, reintentoDias: 7,
    tabla: 'quotes', columna: 'estado',
    captura: { tipo: 'opciones', opciones: { accepted: 'Sigue en proceso de pago: le doy seguimiento', rejected: 'Se cayó: sin interés' } },
    nota: 'La aceptó hace más de 7 días y no hay pago. Si ya pagó, registra el pago en Pagos y esto desaparece; si no, decide.',
    despues: async (id, v) => {
      const ahora = new Date().toISOString();
      if (v === 'rejected') await supabase.from('deals').update({ stage: 'cerrada_perdida', motivo_perdida: 'aceptó y no pagó', closed_at: ahora, stage_changed_at: ahora }).eq('quote_id', id).not('stage', 'in', '("cerrada_ganada","cerrada_perdida")');
      else await supabase.from('quotes').update({ updated_at: ahora }).eq('id', id);
    },
  },
  cotizacion_estado: {
    etiqueta: 'Cotización sin movimiento: ¿sigue viva?', clase: 'comercial', prioridad: 4, reintentoDias: 7,
    tabla: 'quotes', columna: 'estado',
    captura: { tipo: 'opciones', opciones: { sent: 'Sigue viva, la estoy trabajando', suspended: 'Suspendida por ahora', rejected: 'Sin interés' } },
    nota: 'Lleva más de 30 días sin movimiento. Mientras no cambies el estatus, se te vuelve a pedir cada semana.',
    despues: async (id, v) => {
      const ahora = new Date().toISOString();
      const { data: q } = await supabase.from('quotes').select('contact_id').eq('id', id).maybeSingle();
      if (v === 'rejected') {
        await supabase.from('deals').update({ stage: 'cerrada_perdida', motivo_perdida: 'sin movimiento 30+ días', closed_at: ahora, stage_changed_at: ahora }).eq('quote_id', id).not('stage', 'in', '("cerrada_ganada","cerrada_perdida")');
        if (q?.contact_id) await supabase.from('contacts').update({ estatus_lead: 'descartado', estatus_lead_at: ahora, descarte_categoria: 'cotizacion_sin_interes' }).eq('id', q.contact_id).neq('lifecycle_stage', 'cliente');
      } else if (v === 'suspended') {
        await supabase.from('deals').update({ probabilidad: 5, stage_changed_at: ahora, proximo_paso: 'Cotización suspendida: revisar en un mes' }).eq('quote_id', id).not('stage', 'in', '("cerrada_ganada","cerrada_perdida")');
      } else {
        await supabase.from('quotes').update({ updated_at: ahora }).eq('id', id);   // «sigue viva» reinicia el reloj de 30 días
      }
    },
  },
  rfc: {
    etiqueta: 'RFC', clase: 'higiene',
    tabla: 'companies', columna: 'rfc',
    captura: { tipo: 'texto', placeholder: 'RFC…' },
    nota: 'Cliente activo sin RFC: el día que pida factura, esto lo bloquea.',
  },
  razon_social: {
    etiqueta: 'Razón social', clase: 'higiene',
    tabla: 'companies', columna: 'razon_social',
    captura: { tipo: 'texto', placeholder: 'Razón social…' },
    nota: 'Va de la mano del RFC para poder facturar.',
  },
  sacs_account: {
    etiqueta: 'Cuenta SACS', clase: 'comercial',
    tabla: 'companies', columna: 'sacs_account',
    captura: { tipo: 'texto', placeholder: 'nombre de la cuenta…' },
    nota: 'Sin ligarla no hay señales de uso ni salud — el churn se vuelve invisible.',
  },
  giro: {
    etiqueta: 'Giro del negocio', clase: 'higiene',
    tabla: 'contacts', columna: 'giro',
    captura: { tipo: 'opciones', opciones: {
      'Ropa y moda': 'Ropa y moda', 'Zapatería': 'Zapatería', 'Papelería': 'Papelería',
      'Joyería': 'Joyería', 'Abarrotes': 'Abarrotes', 'Ferretería': 'Ferretería',
      'Regalos': 'Regalos', 'Otro': 'Otro',
    } },
    nota: 'Con el giro, sus mensajes de cadencia usan casos de SU ramo.',
  },
  sucursales_interes: {
    etiqueta: 'Sucursales', clase: 'higiene',
    tabla: 'contacts', columna: 'sucursales_interes',
    captura: { tipo: 'numero', placeholder: '¿cuántas sucursales?' },
    nota: 'El tamaño decide el score de valor y la cadencia premium.',
  },
};

/** Escribir un dato CONFIRMADO — solo por el registro, solo a su destino. */
export async function escribirDato(clave: string, sujetoId: string, valor: any) {
  const def = CAMPOS[clave];
  if (!def) return { error: `Campo desconocido: ${clave}` };
  if (valor == null || valor === '') return { error: 'Falta el valor' };
  if (def.captura.tipo === 'opciones' && !def.captura.opciones[String(valor)]) {
    return { error: `Valor fuera del catálogo de ${def.etiqueta}` };
  }
  const v = def.captura.tipo === 'numero' ? Number(valor) : String(valor).trim();
  if (def.captura.tipo === 'numero' && !Number.isFinite(v as number)) return { error: 'Debe ser un número' };
  const { error } = await supabase.from(def.tabla).update({ [def.columna]: v }).eq('id', sujetoId);
  if (error) return { error: error.message };
  if (def.despues) { try { await def.despues(sujetoId, String(v)); } catch (e: any) { console.error('[campos] despues', clave, e?.message || e); } }
  return { ok: true };
}

/** ¿Ya se pidió este campo para este sujeto hace poco? (no se pregunta dos
 *  veces la misma cosa el mismo mes, aunque siga vacío). */
async function yaPedido(clave: string, sujeto: string) {
  const dias = CAMPOS[clave]?.reintentoDias ?? 30;
  // Pendiente = no se vuelve a pedir; resuelta/omitida hace poco = tampoco (se respeta el reintento).
  const { data: pend } = await supabase.from('ti_tareas').select('id').eq('estado', 'pendiente')
    .filter('payload->>campo_clave', 'eq', clave).filter('payload->>sujeto', 'eq', sujeto).limit(1);
  if ((pend || []).length) return true;
  const { data } = await supabase.from('ti_tareas').select('id')
    .filter('payload->>campo_clave', 'eq', clave)
    .filter('payload->>sujeto', 'eq', sujeto)
    .gt('created_at', new Date(Date.now() - dias * 86400e3).toISOString())
    .limit(1);
  return !!(data || []).length;
}

const P_CLASE = { bloqueante: 3, comercial: 4, higiene: 5 } as const;

async function crearDeuda(clave: string, sujeto: string, extra: {
  contact_id?: string | null; company_id?: string | null; owner_id?: string | null;
  quien: string; instruccion?: string; porque?: string; valor_sugerido?: string; fuente?: string; prioridad?: number; extra_payload?: any;
}) {
  const def = CAMPOS[clave];
  const cap: any = def.captura;
  await supabase.from('ti_tareas').insert({
    contact_id: extra.contact_id || null, company_id: extra.company_id || null, owner_id: extra.owner_id || null,
    familia: 'higiene', tipo: 'dato', prioridad: extra.prioridad ?? def.prioridad ?? P_CLASE[def.clase],
    vence_at: new Date().toISOString(), origen: 'deuda', lote_tipo: def.clase,
    payload: {
      campo_clave: clave, sujeto,
      instruccion: extra.instruccion || `${extra.quien} — ${def.etiqueta}`,
      porque: extra.porque || def.nota,
      campo: def.etiqueta,
      // la forma que el panel ya pinta:
      ...(cap.tipo === 'opciones' ? { opciones: Object.keys(cap.opciones), opciones_l: cap.opciones } : { input: cap.placeholder, ...(cap.multilinea ? { multilinea: true } : {}) }),
      ...(extra.valor_sugerido ? { valor: extra.valor_sugerido, fuente: extra.fuente || 'sugerido' } : {}),
      ...(extra.extra_payload || {}),
    },
  });
}

/** EL DETECTOR — corre dentro de generarPlan. Idempotente y con tope por
 *  corrida: un backlog de 57 RFC entra al lote de a poquitos, no en tsunami. */
export async function detectarDeudas() {
  const res: any = { deuda_reuniones: 0, deuda_facturacion: 0, deuda_sacs: 0, deuda_lead: 0 };

  // 1) LA CADENA DE LA REUNIÓN. El dueño de cada eslabón es el consultor de la reunión (consultor_id), si no el
  //    owner del contacto, si no el consultor por default de la config.
  const cfgFila = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  const consultorDefault = (cfgFila.data?.valor as any)?.consultor_default || null;
  const ahoraCdmx = new Date(Date.now() - 6 * 3600e3); const hoy = ahoraCdmx.toISOString().slice(0, 10); const horaAhora = ahoraCdmx.toISOString().slice(11, 16);
  const duenoDe = (r: any, c: any) => r.consultor_id || c?.owner_id || consultorDefault;
  // 1a. Pasó la reunión (ayer, o hoy y ya terminó) y sigue en agendada/confirmada/reagendada → RESULTADO hoy mismo.
  const { data: reus } = await supabase.from('bookings')
    .select('id, fecha, hora_fin, estado, consultor_id, invitee_nombre, contact_id, contacts(id, nombre, owner_id, company_id)')
    .in('estado', ['agendada', 'confirmada', 'reagendada']).not('contact_id', 'is', null)
    .lte('fecha', hoy).order('fecha', { ascending: false }).limit(40);
  for (const r of reus || []) {
    if (r.fecha === hoy && String(r.hora_fin || '23:59').slice(0, 5) > horaAhora) continue;   // todavía no termina
    if (await yaPedido('reunion_resultado', String(r.id))) continue;
    const c: any = (r as any).contacts || {};
    const n = (c.nombre || r.invitee_nombre || '').split(/\s+/)[0] || 'el lead';
    await crearDeuda('reunion_resultado', String(r.id), {
      contact_id: r.contact_id, company_id: c.company_id, owner_id: duenoDe(r, c),
      quien: c.nombre || r.invitee_nombre || 'la reunión',
      instruccion: `¿Qué pasó en la reunión con ${n}?`,
      porque: `Era el ${r.fecha}${r.hora_fin ? ` (terminaba ${String(r.hora_fin).slice(0, 5)})` : ''}. El resultado se registra el mismo día: de él depende si el agente se retira o insiste.`,
    });
    res.deuda_reuniones++;
  }
  // 1b. Asistió y no hay minuta 24 h después → MINUTA.
  const { data: sinMinuta } = await supabase.from('bookings')
    .select('id, fecha, hora_fin, updated_at, consultor_id, invitee_nombre, contact_id, contacts(id, nombre, owner_id, company_id)')
    .eq('estado', 'asistio').is('minuta', null).not('contact_id', 'is', null)
    .gte('fecha', new Date(Date.now() - 45 * 86400e3).toISOString().slice(0, 10)).lt('updated_at', new Date(Date.now() - 24 * 3600e3).toISOString()).limit(40);
  for (const r of sinMinuta || []) {
    if (await yaPedido('reunion_minuta', String(r.id))) continue;
    const c: any = (r as any).contacts || {}; const n = (c.nombre || r.invitee_nombre || '').split(/\s+/)[0] || 'el lead';
    await crearDeuda('reunion_minuta', String(r.id), { contact_id: r.contact_id, company_id: c.company_id, owner_id: duenoDe(r, c), quien: c.nombre || r.invitee_nombre || 'la reunión', instruccion: `Minuta de la reunión con ${n} (${r.fecha})`, porque: 'Se hizo hace más de 24 h y no hay minuta. Pega la transcripción o tus notas y la IA la estructura, saca los requerimientos y te pregunta qué sigue.', extra_payload: { minuta_ia: true, reunion: { id: r.id, fecha: r.fecha }, lead: { id: c.id, nombre: c.nombre || r.invitee_nombre, company_id: c.company_id } } });
    res.deuda_minutas = (res.deuda_minutas || 0) + 1;
  }
  // 1c. Con minuta desde hace 48 h, sin cotización posterior y sin decisión → ¿LE INTERESÓ?
  const { data: conMinuta } = await supabase.from('bookings')
    .select('id, fecha, updated_at, consultor_id, invitee_nombre, contact_id, minuta, contacts(id, nombre, owner_id, company_id, estatus_lead, lifecycle_stage)')
    .eq('estado', 'asistio').not('minuta', 'is', null).not('contact_id', 'is', null)
    .gte('fecha', new Date(Date.now() - 45 * 86400e3).toISOString().slice(0, 10)).lt('updated_at', new Date(Date.now() - 48 * 3600e3).toISOString()).limit(40);
  for (const r of conMinuta || []) {
    const c: any = (r as any).contacts || {};
    if (!c.id || ['cotizado', 'descartado'].includes(c.estatus_lead) || ['cliente', 'descalificado'].includes(c.lifecycle_stage)) continue;
    const dec = (r as any).minuta?.decision?.tipo; if (dec && dec !== 'cotizar') continue;   // segunda reunión / retomar / sin interés: no se exige cotización
    const { data: q } = await supabase.from('quotes').select('id').eq('contact_id', c.id).not('estado', 'in', '("deleted","plantilla")').gte('created_at', `${r.fecha}T00:00:00`).limit(1);
    if ((q || []).length) continue;
    if (await yaPedido('reunion_interes', String(c.id))) continue;
    const n = (c.nombre || r.invitee_nombre || '').split(/\s+/)[0] || 'el lead';
    await crearDeuda('reunion_interes', String(c.id), { contact_id: c.id, company_id: c.company_id, owner_id: duenoDe(r, c), quien: c.nombre || 'el lead', instruccion: `${n}: ¿le interesó? Han pasado 48 h de la minuta sin cotización`, porque: 'Si le interesó, hoy sale la cotización; si no, se cierra con motivo y el lead deja de estorbar en el embudo.' });
    res.deuda_interes = (res.deuda_interes || 0) + 1;
  }
  // 1d. COTIZACIÓN SIN MOVIMIENTO 30 DÍAS (enviada, aceptada sin pagar o vencida) → se pide cada 7 días hasta que cambie.
  //
  // Este detector estuvo MUERTO desde siempre: pedía `updated_at`, columna que
  // no existía en quotes, así que la consulta devolvía error y `dormidas`
  // quedaba en null. Se corrigió con la migración 2026-09-quotes-updated-at.
  const { data: dormidas, error: errDorm } = await supabase.from('quotes')
    .select('id, numero, total, estado, created_at, updated_at, notas, contact_id, contacts(id, nombre, owner_id, company_id, lifecycle_stage)')
    .in('estado', ['sent', 'accepted', 'expired']).not('contact_id', 'is', null)
    .lt('created_at', new Date(Date.now() - 30 * 86400e3).toISOString()).lt('updated_at', new Date(Date.now() - 30 * 86400e3).toISOString()).limit(60);
  if (errDorm) console.error('[ti] cotizaciones dormidas:', errDorm.message);
  const hoyMX = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  for (const q of dormidas || []) {
    const c: any = (q as any).contacts || {}; if (!c.id || c.lifecycle_stage === 'cliente') continue;
    // Una cotización con PLAN DE PAGOS no está dormida: está en calendario.
    // Preguntarle al consultor «¿sigue viva o sin interés?» por un cliente que
    // abona cada mes es ruido, y encima la acción correcta es otra —cobrar la
    // parcialidad— y esa ya la persigue Cobranza.
    if (planDeCotizacion(q, 0, hoyMX).length) continue;
    if (await yaPedido('cotizacion_estado', String(q.id))) continue;
    const dias = Math.floor((Date.now() - Date.parse(q.updated_at || q.created_at)) / 86400e3);
    const n = (c.nombre || '').split(/\s+/)[0] || 'el lead';
    await crearDeuda('cotizacion_estado', String(q.id), { contact_id: c.id, company_id: c.company_id, owner_id: c.owner_id || consultorDefault, quien: c.nombre || 'el lead', instruccion: `Cotización #${q.numero || 's/n'} de ${n}: ${dias} días sin movimiento`, porque: `$${Math.round(Number(q.total) || 0).toLocaleString('es-MX')} en estado «${q.estado}» desde hace ${dias} días. Decide: sigue viva, suspendida o sin interés. Se vuelve a pedir cada semana hasta que cambies el estatus.` });
    res.deuda_cotizaciones = (res.deuda_cotizaciones || 0) + 1;
  }
  // 1f. COTIZACIÓN ACEPTADA SIN PAGO (7 días): cuarto estado con reloj propio; en Finanzas es «por cobrar de venta nueva».
  // Este también estaba muerto por `updated_at` (ver 1d).
  const { data: aceptadas, error: errAcep } = await supabase.from('quotes')
    .select('id, numero, total, updated_at, notas, contact_id, contacts(id, nombre, owner_id, company_id)')
    .eq('estado', 'accepted').not('contact_id', 'is', null).lt('updated_at', new Date(Date.now() - 7 * 86400e3).toISOString()).limit(40);
  if (errAcep) console.error('[ti] cotizaciones aceptadas sin pago:', errAcep.message);
  // Lo abonado a cada una: «no ha pagado» tiene que ser verdad. Una aceptada
  // con anticipo SÍ pagó, y decirle al consultor que no lo hizo lo manda a
  // cobrar algo que ya está cobrado.
  const idsAcep = (aceptadas || []).map(q => q.id);
  const { data: pagosAcep } = idsAcep.length
    ? await supabase.from('payments').select('quote_id, monto').in('quote_id', idsAcep).neq('estado', 'reembolsado')
    : { data: [] as any[] };
  const abonadoAcep = new Map<string, number>();
  for (const pg of pagosAcep || []) abonadoAcep.set(pg.quote_id, (abonadoAcep.get(pg.quote_id) || 0) + Number(pg.monto || 0));
  for (const q of aceptadas || []) {
    const c: any = (q as any).contacts || {}; if (!c.id) continue;
    // Con PLAN DE PAGOS el reloj no es de 7 días: es el calendario pactado, y
    // quien persigue la parcialidad es Cobranza. Solo entra si va atrasada.
    const plan = planDeCotizacion(q, abonadoAcep.get(q.id) || 0, hoyMX);
    if (plan.length && !plan.some(x => x.vencida)) continue;
    if (await yaPedido('cotizacion_cobro', String(q.id))) continue;
    const dias = Math.floor((Date.now() - Date.parse(q.updated_at)) / 86400e3);
    const abon = abonadoAcep.get(q.id) || 0;
    const tot = Math.round(Number(q.total) || 0);
    const venc = plan.filter(x => x.vencida);
    const instruccion = venc.length
      ? `${(c.nombre || '').split(/\s+/)[0] || 'El lead'}: parcialidad vencida de la cotización #${q.numero || 's/n'}`
      : `${(c.nombre || '').split(/\s+/)[0] || 'El lead'} aceptó la cotización #${q.numero || 's/n'} hace ${dias} días y ${abon > 0 ? 'no ha liquidado' : 'no ha pagado'}`;
    const porque = venc.length
      ? `${venc.map(x => `${x.concepto} de $${Math.round(x.monto).toLocaleString('es-MX')} venció el ${x.fecha}`).join('; ')}. Cóbrala o reagenda el plan.`
      : abon > 0
        ? `Lleva $${Math.round(abon).toLocaleString('es-MX')} de $${tot.toLocaleString('es-MX')}. Cobra el saldo o marca que se cayó.`
        : `$${tot.toLocaleString('es-MX')} aceptados sin pago. Cóbrala o marca que se cayó.`;
    await crearDeuda('cotizacion_cobro', String(q.id), { contact_id: c.id, company_id: c.company_id, owner_id: c.owner_id || consultorDefault, quien: c.nombre || 'el lead', instruccion, porque });
    res.deuda_cobro = (res.deuda_cobro || 0) + 1;
  }
  // 1g. DEMO PRÓXIMA SIN CONSULTOR (el lead agendó con el agente y nadie la tiene): se asigna el consultor por default y se avisa ANTES.
  const { data: proximas } = await supabase.from('bookings').select('id, fecha, hora_inicio, invitee_nombre, contact_id, contacts(nombre, owner_id)')
    .in('estado', ['agendada', 'confirmada', 'reagendada']).is('consultor_id', null).gte('fecha', hoy).lte('fecha', new Date(Date.now() + 2 * 86400e3 - 6 * 3600e3).toISOString().slice(0, 10)).limit(20);
  for (const r of proximas || []) {
    const c: any = (r as any).contacts || {}; const dueno = c.owner_id || consultorDefault; if (!dueno) continue;
    await supabase.from('bookings').update({ consultor_id: dueno }).eq('id', r.id);
    try { const { avisoSistema } = await import('./agente'); await avisoSistema({ tipo: 'sistema_demo_sin_consultor', nivel: 'alerta', clave: `demo_sin_consultor:${r.id}`, titulo: `Demo de ${c.nombre || r.invitee_nombre || 'un lead'} el ${r.fecha} ${String(r.hora_inicio || '').slice(0, 5)} no tenía consultor`, detalle: 'La agendó el agente y nadie la tenía asignada. Quedó asignada al consultor por default.', que_hacer: 'Confirma quién la da en Reuniones; si no eres tú, reasígnala.', contact_id: r.contact_id } as any); } catch {}
    res.demos_asignadas = (res.demos_asignadas || 0) + 1;
  }
  // 1e. ESCALAMIENTO: deuda comercial pendiente > 24 h → aviso al consultor; > 48 h (segundo aviso) → también al dueño.
  try { res.escaladas = await escalarDeudas(); } catch (e: any) { console.error('[campos] escalar', e?.message || e); }

  // 2) Cliente activo sin RFC / razón social (facturación) y sin cuenta SACS.
  const { data: emps } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, rfc, razon_social, sacs_account, subscriptions!inner(id, estado)')
    .eq('subscriptions.estado', 'activa').limit(200);
  let cupoFact = 15;
  // RFC OBLIGATORIO AL CERRAR LA VENTA (decisión 2026-09-03): con pago en los últimos 30 días, RFC y razón social suben a
  // bloqueante y se piden juntos, con prioridad; el resto sigue siendo higiene de a poquitos.
  const { data: pagosRec } = await supabase.from('payments').select('company_id').eq('estado', 'confirmado').gte('fecha', new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)).not('company_id', 'is', null).limit(500);
  const conPago = new Set((pagosRec || []).map(p => p.company_id));
  for (const e of emps || []) {
    const quien = e.nombre_comercial || e.nombre || 'Cliente';
    if (!e.sacs_account && !(await yaPedido('sacs_account', String(e.id)))) {
      await crearDeuda('sacs_account', String(e.id), { company_id: e.id, quien });
      res.deuda_sacs++;
    }
    const reciente = conPago.has(e.id);
    if (reciente) {
      if (!e.rfc && !(await yaPedido('rfc', String(e.id)))) { await crearDeuda('rfc', String(e.id), { company_id: e.id, quien, prioridad: 3, porque: 'Acaba de pagar: sin RFC no se puede facturar la venta.' }); res.deuda_facturacion++; }
      if (!e.razon_social && !(await yaPedido('razon_social', String(e.id)))) { await crearDeuda('razon_social', String(e.id), { company_id: e.id, quien, prioridad: 3, porque: 'Acaba de pagar: va con el RFC para la factura.' }); res.deuda_facturacion++; }
      continue;
    }
    if (cupoFact > 0 && !e.rfc && !(await yaPedido('rfc', String(e.id)))) {
      await crearDeuda('rfc', String(e.id), { company_id: e.id, quien });
      res.deuda_facturacion++; cupoFact--;
    }
  }

  // 3) Leads del universo TI sin giro / sin sucursales.
  const { data: leads } = await supabase.from('contacts')
    .select('id, nombre, giro, sucursales_interes, owner_id, company_id, propiedades, ti_cadencias!inner(estado)')
    .neq('ti_cadencias.estado', 'terminada').limit(100);
  let cupoLead = 15;
  for (const k of leads || []) {
    if ((k.propiedades as any)?.demo_ti) continue;
    if (cupoLead <= 0) break;
    const quien = k.nombre || 'Lead';
    if (k.giro == null && !(await yaPedido('giro', String(k.id)))) {
      await crearDeuda('giro', String(k.id), { contact_id: k.id, company_id: k.company_id, owner_id: k.owner_id, quien });
      res.deuda_lead++; cupoLead--;
    } else if (k.sucursales_interes == null && !(await yaPedido('sucursales_interes', String(k.id)))) {
      await crearDeuda('sucursales_interes', String(k.id), { contact_id: k.id, company_id: k.company_id, owner_id: k.owner_id, quien });
      res.deuda_lead++; cupoLead--;
    }
  }

  return res;
}


/** Aviso en Sistema (campana) cuando un eslabón de la cadena vence: 24 h → consultor, 48 h y cada 24 h más → también el dueño. */
async function escalarDeudas(): Promise<number> {
  const { data: pend } = await supabase.from('ti_tareas').select('id, contact_id, owner_id, created_at, escalado_at, escalaciones, payload')
    .eq('estado', 'pendiente').eq('tipo', 'dato').eq('lote_tipo', 'comercial').lt('created_at', new Date(Date.now() - 24 * 3600e3).toISOString()).limit(100);
  let n = 0;
  const { avisoSistema } = await import('./agente');
  for (const t of pend || []) {
    const desde = Date.parse(t.escalado_at || t.created_at);
    if (Date.now() - desde < 24 * 3600e3) continue;
    const p: any = t.payload || {}; const veces = (t.escalaciones || 0) + 1;
    const horas = Math.round((Date.now() - Date.parse(t.created_at)) / 3600e3);
    await avisoSistema({ tipo: 'sistema_dato', nivel: veces >= 2 ? 'urgente' : 'alerta', clave: `dato:${t.id}:${veces}`, titulo: `${veces === 1 ? 'Falta un dato' : `${veces}º aviso: falta un dato`} · ${p.instruccion || p.campo}`, detalle: `${p.porque || ''} Lleva ${horas} h sin capturarse.`, que_hacer: 'Trabajo inteligente → Datos → Reunión y cotización.', contact_id: t.contact_id, solo_dueno: veces >= 2 } as any).catch(() => {});
    await supabase.from('ti_tareas').update({ escalado_at: new Date().toISOString(), escalaciones: veces }).eq('id', t.id);
    n++;
  }
  return n;
}
