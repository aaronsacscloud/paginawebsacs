// Bitácora de los cobros de Mercado Pago que NO terminan en un pago registrado.
//
// Antes solo se guardaba lo que salía bien, y las dos cosas que se perdían eran
// justo las que cuestan dinero:
//   · un cobro APROBADO que no se pudo atribuir a nadie → alguien pagó y nadie
//     lo acreditó; el cliente aparece como moroso.
//   · una tarjeta RECHAZADA → la señal más temprana de que ese cliente se cae
//     este mes, y llegaba semanas tarde (cuando notabas que no entró el dinero).
import { supabase } from '../supabase';

/** status_detail de Mercado Pago traducido, con qué hacer al respecto.
 *  `reintentable` = el mismo plástico puede volver a pasar (fondos, límite);
 *  si es false hace falta que el cliente cambie el medio de pago. */
export const MOTIVOS: Record<string, { texto: string; accion: string; reintentable: boolean }> = {
  cc_rejected_insufficient_amount:   { texto: 'Fondos insuficientes', accion: 'Avísale para que tenga saldo y se reintenta.', reintentable: true },
  cc_rejected_max_attempts:          { texto: 'Demasiados intentos seguidos', accion: 'Espera unas horas antes de volver a cobrar.', reintentable: true },
  cc_rejected_call_for_authorize:    { texto: 'El banco pide que el titular autorice el cargo', accion: 'Que llame a su banco y autorice el cargo recurrente.', reintentable: true },
  cc_rejected_high_risk:             { texto: 'Rechazado por prevención de fraude', accion: 'Pídele otro medio de pago: el banco no va a dejar pasar este.', reintentable: false },
  cc_rejected_card_disabled:         { texto: 'Tarjeta inactiva', accion: 'Que la active con su banco o registre otra.', reintentable: false },
  cc_rejected_card_error:            { texto: 'Error de la tarjeta', accion: 'Que registre de nuevo el medio de pago.', reintentable: false },
  cc_rejected_bad_filled_card_number:{ texto: 'Número de tarjeta mal capturado', accion: 'Que vuelva a registrar su tarjeta.', reintentable: false },
  cc_rejected_bad_filled_date:       { texto: 'Fecha de vencimiento incorrecta', accion: 'Seguramente venció: que registre la nueva.', reintentable: false },
  cc_rejected_bad_filled_security_code: { texto: 'Código de seguridad incorrecto', accion: 'Que vuelva a registrar su tarjeta.', reintentable: false },
  cc_rejected_bad_filled_other:      { texto: 'Datos de la tarjeta incorrectos', accion: 'Que vuelva a registrar su tarjeta.', reintentable: false },
  cc_rejected_blacklist:             { texto: 'Tarjeta bloqueada por Mercado Pago', accion: 'Necesita otro medio de pago.', reintentable: false },
  cc_rejected_duplicated_payment:    { texto: 'Pago duplicado', accion: 'No es un problema: ya se había cobrado.', reintentable: false },
  cc_rejected_invalid_installments:  { texto: 'El banco no acepta ese plazo', accion: 'Que pague de contado o con otra tarjeta.', reintentable: false },
  cc_rejected_other_reason:          { texto: 'El banco lo rechazó sin decir por qué', accion: 'Que intente con otra tarjeta o pregunte a su banco.', reintentable: true },
  cc_amount_rate_limit_exceeded:     { texto: 'Superó el límite de su tarjeta', accion: 'Que use otra tarjeta o pida ampliación de límite.', reintentable: true },
  rejected_by_bank:                  { texto: 'Rechazado por el banco', accion: 'Que pregunte a su banco por qué lo bloquea.', reintentable: true },
  rejected_insufficient_data:        { texto: 'Faltaron datos del pagador', accion: 'Que complete sus datos y reintente.', reintentable: true },
  expired:                           { texto: 'El cobro expiró sin pagarse', accion: 'Genera un link nuevo.', reintentable: true },
};

export function motivoDe(detalle?: string | null): { texto: string; accion: string; reintentable: boolean } {
  const m = detalle ? MOTIVOS[detalle] : null;
  return m || { texto: detalle ? `Rechazado (${detalle})` : 'Rechazado', accion: 'Revísalo en Mercado Pago.', reintentable: true };
}

export type CobroMP = {
  mp_payment_id: string;
  preapproval_id?: string | null;
  subscription_id?: string | null;
  company_id?: string | null;
  payer_email?: string | null;
  monto?: number | null;
  moneda?: string | null;
  estado: string;
  detalle_estado?: string | null;
  metodo?: string | null;
  fecha?: string | null;
  external_reference?: string | null;
  // Quién fue. Sin esto un rebote se lee "sin identificar", que es lo mismo que
  // no tenerlo: no se le puede llamar a nadie.
  payer_nombre?: string | null;
  payer_id?: string | null;
  tarjeta?: string | null;
  descripcion?: string | null;
};

/**
 * Saca del pago de Mercado Pago todo lo que dice DE QUIÉN es.
 *
 * `payer.email` viene vacío seguido en los cargos recurrentes, así que no puede
 * ser el único dato: el nombre del titular, los últimos 4 y la descripción del
 * cobro identifican igual de bien —en las domiciliaciones creadas desde el CRM
 * la descripción es literalmente "<plan> · <cuenta del cliente>"—.
 */
export function identidadDePago(p: any): Pick<CobroMP, 'payer_email' | 'payer_nombre' | 'payer_id' | 'tarjeta' | 'descripcion' | 'external_reference'> & { preapproval_id: string | null } {
  const nombre = [p?.payer?.first_name, p?.payer?.last_name].filter(Boolean).join(' ').trim()
    || String(p?.card?.cardholder?.name || '').trim();
  const u4 = p?.card?.last_four_digits;
  return {
    payer_email: p?.payer?.email || null,
    payer_nombre: nombre || null,
    payer_id: p?.payer?.id != null ? String(p.payer.id) : null,
    tarjeta: u4 ? `${p?.payment_method_id || 'tarjeta'} ••••${u4}` : null,
    descripcion: p?.description || p?.statement_descriptor || null,
    external_reference: p?.external_reference || null,
    preapproval_id: p?.metadata?.preapproval_id ? String(p.metadata.preapproval_id) : null,
  };
}

/**
 * Anota el cobro. Idempotente por `mp_payment_id`: el webhook reintenta y la
 * conciliación puede volver a verlo, y dos filas del mismo cobro serían dos
 * avisos de cobranza para el mismo problema.
 * Devuelve `true` sólo si la fila es NUEVA — así quien llama sabe si toca
 * avisar o si esto ya se atendió.
 */
export async function anotarCobro(c: CobroMP): Promise<boolean> {
  const motivo = c.estado === 'approved' ? null : motivoDe(c.detalle_estado).texto;
  const base: any = {
    mp_payment_id: String(c.mp_payment_id),
    preapproval_id: c.preapproval_id || null,
    subscription_id: c.subscription_id || null,
    company_id: c.company_id || null,
    payer_email: c.payer_email || null,
    monto: Number(c.monto || 0), moneda: c.moneda || 'MXN',
    estado: c.estado, detalle_estado: c.detalle_estado || null, motivo,
    metodo: c.metodo || null, fecha: c.fecha || new Date().toISOString(),
    external_reference: c.external_reference || null,
  };
  // Columnas de identidad (migración de ago-2026). El deploy puede ir antes que
  // el SQL: si no existen, se reintenta sin ellas — perder el nombre del titular
  // es aceptable, perder el cobro entero no.
  const conIdentidad = {
    ...base,
    payer_nombre: c.payer_nombre || null, payer_id: c.payer_id || null,
    tarjeta: c.tarjeta || null, descripcion: c.descripcion || null,
  };
  let { error } = await supabase.from('crm_cobros_mp').insert(conIdentidad);
  if (error && /column .* does not exist|schema cache|could not find/i.test(error.message || '')) {
    ({ error } = await supabase.from('crm_cobros_mp').insert(base));
  }
  if (!error) return true;
  if (/duplicate key|23505/i.test(error.message || '')) return false;   // ya estaba
  console.error('[cobros-mp] no se pudo anotar', c.mp_payment_id, '→', error.message);
  return false;
}

/**
 * Un cobro recurrente que rebotó. Deja el aviso donde se ve —el timeline del
 * cliente— y abre la oportunidad de cobranza. No cambia el estado de la
 * suscripción: que el banco rechace un cargo no es que el cliente cancelara, y
 * marcarlo como caído por un rebote de fondos sería peor que el problema.
 */
export async function avisarCobroFallido(opts: {
  company_id?: string | null; subscription_id?: string | null;
  nombre_plan?: string | null; monto: number; detalle_estado?: string | null;
  payer_email?: string | null; intentos?: number; mp_payment_id?: string | null;
}) {
  const m = motivoDe(opts.detalle_estado);
  const monto = '$' + Number(opts.monto || 0).toLocaleString('es-MX');

  // La campana: un rebote es la señal más temprana de que ese ingreso se cae
  // este mes, y llega de madrugada sin que nadie esté mirando el timeline.
  const { notificar } = await import('../crm/notificaciones');
  await notificar({
    clave: opts.mp_payment_id ? `cobro_rechazado:${opts.mp_payment_id}` : null,
    tipo: 'cobro_rechazado', nivel: 'urgente',
    titulo: `❌ Se rechazó el cobro de ${monto}${opts.nombre_plan ? ' · ' + opts.nombre_plan : ''}`,
    detalle: `${m.texto}. ${m.accion}` + (opts.intentos && opts.intentos > 1 ? ` Van ${opts.intentos} intentos.` : ''),
    monto: Number(opts.monto || 0),
    company_id: opts.company_id || null, subscription_id: opts.subscription_id || null,
    destino: 'pagos', metadata: { detalle_estado: opts.detalle_estado, payer_email: opts.payer_email },
  });
  if (opts.company_id) {
    await supabase.from('activities').insert({
      tipo: 'sistema', company_id: opts.company_id, automatico: true,
      titulo: `⚠️ Se rechazó el cobro de ${monto}${opts.nombre_plan ? ' · ' + opts.nombre_plan : ''}: ${m.texto}`,
      descripcion: m.accion + (opts.payer_email ? ` (paga ${opts.payer_email})` : ''),
      metadata: { audit: 'mp_cobro_fallido', subscription_id: opts.subscription_id, detalle: opts.detalle_estado },
    }).select().maybeSingle();
  }
  // La oportunidad se registra aparte para que caiga en la bandeja de trabajo,
  // que es donde alguien la va a ver; el timeline solo se lee si ya entraste.
  if (opts.company_id) {
    const { registrarOportunidad } = await import('../crm/oportunidades');
    await registrarOportunidad({
      company_id: opts.company_id, tipo: 'cobro_rechazado',
      titulo: `Se le rechazó el cobro de ${monto}: ${m.texto.toLowerCase()}`,
      detalle: opts.intentos && opts.intentos > 1
        ? `Van ${opts.intentos} intentos rechazados. Si no se resuelve, ese ingreso se cae este mes.`
        : 'Sigue siendo cliente, pero este mes no entró el dinero.',
      accion: m.accion,
      peso: m.reintentable ? 80 : 92,
      valor: Number(opts.monto || 0) * 12,
      metadata: { subscription_id: opts.subscription_id, detalle_estado: opts.detalle_estado },
    });
  }
}
