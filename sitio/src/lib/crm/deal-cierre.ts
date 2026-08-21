// Ganar una oportunidad tiene que DEJAR ALGO. Si no, el cierre es un cambio de
// color en un tablero.
//
// Lo que pasaba: la oportunidad ganada de $44,505 no tenía empresa —solo un
// contacto—, así que el automatismo que convierte en cliente y crea la
// suscripción no se disparaba nunca. Se veía ganada y no existía ni el cliente
// ni el cobro. Aquí se cierra ese hueco en tres pasos:
//
//   1. Asegurar el CLIENTE (si solo hay contacto, se crea su empresa y se liga).
//   2. Crear la SUSCRIPCIÓN del recurrente (mensual o anual) con lo que se vendió.
//   3. Crear el PAGO ÚNICO como licencia vitalicia — así vive en la cuenta del
//      cliente, se le puede cobrar y NO suma al ARR (que es lo correcto: un pago
//      único no es ingreso recurrente).
//
// Todo idempotente: reabrir y volver a cerrar no duplica nada.
import { supabase } from '../supabase';
import { calcularTotales, nombrePlanDeItems, type DealItem } from './deal-items';

export type ResultadoCierre = {
  company_id: string | null;
  cliente_creado: boolean;
  /** true = venía de un lead y se acaba de convertir; false = ya era cliente. */
  convirtio_lead?: boolean;
  subscription_id?: string | null;
  sub_creada: boolean;
  unico_id?: string | null;
  unico_creado: boolean;
  avisos: string[];
};

/**
 * Cada paso del cierre deja su propia línea en la Actividad del cliente.
 *
 * Antes todo el cierre cabía en una sola línea ("Oportunidad ganada"), y lo que
 * de verdad pasó —que un lead se volvió cliente, que nació una suscripción de
 * $9,000 al año, que quedó un pago único por cobrar— no se veía en ningún lado.
 * Cuando alguien abre el perfil tres meses después, el timeline es la única
 * fuente de por qué ese cliente existe y qué se le prometió.
 */
async function actividad(companyId: string | null, dealId: string, contactId: string | null, tipo: string, titulo: string, descripcion?: string, metadata?: any) {
  if (!companyId && !contactId) return;
  try {
    await supabase.from('activities').insert({
      tipo, automatico: true,
      company_id: companyId || null, contact_id: contactId || null, deal_id: dealId || null,
      titulo: titulo.slice(0, 240), descripcion: descripcion || null,
      metadata: { audit: 'deal_cierre', ...(metadata || {}) },
    }).select().maybeSingle();
  } catch (e: any) { console.error('[deal-cierre] actividad:', e?.message || e); }
}

/** El cliente al que se le va a cobrar. Sin esto no hay nada que crear. */
async function asegurarCliente(deal: any): Promise<{ company_id: string | null; creado: boolean; aviso?: string }> {
  if (deal.company_id) return { company_id: deal.company_id, creado: false };

  // El contacto puede tener empresa aunque la oportunidad no la lleve.
  if (deal.contact_id) {
    const { data: ct } = await supabase.from('contacts').select('id, nombre, apellido, email, company_id').eq('id', deal.contact_id).maybeSingle();
    if (ct?.company_id) {
      await supabase.from('deals').update({ company_id: ct.company_id }).eq('id', deal.id);
      return { company_id: ct.company_id, creado: false };
    }
    // Ni empresa ni nada: se crea con el nombre del trato (sin el prefijo) o el
    // del contacto. Un cliente con nombre provisional es corregible; una venta
    // ganada sin cliente no se puede cobrar.
    const nombre = String(deal.nombre || '').replace(/^Oportunidad\s*[—-]\s*/i, '').trim()
      || [ct?.nombre, ct?.apellido].filter(Boolean).join(' ').trim()
      || 'Cliente sin nombre';
    const { data: co, error } = await supabase.from('companies')
      .insert({ nombre, estado_cuenta: 'activo' }).select('id').maybeSingle();
    if (error || !co) return { company_id: null, creado: false, aviso: 'No se pudo crear el cliente: ' + (error?.message || '') };
    await supabase.from('contacts').update({ company_id: co.id, tipo: 'cliente', lifecycle_stage: 'cliente' }).eq('id', ct?.id || deal.contact_id);
    await supabase.from('deals').update({ company_id: co.id }).eq('id', deal.id);
    // El momento exacto en que dejó de ser un lead. Es el hito del que cuelga
    // todo lo demás del cliente, y hasta ahora no quedaba escrito en ningún lado.
    await actividad(co.id, deal.id, ct?.id || deal.contact_id, 'cliente_convertido',
      `✨ ${[ct?.nombre, ct?.apellido].filter(Boolean).join(' ') || nombre} pasó de lead a CLIENTE`,
      `Se creó el cliente "${nombre}" al ganar la oportunidad "${deal.nombre}".`,
      { company_id: co.id, deal_nombre: deal.nombre, desde: 'lead' });
    return { company_id: co.id, creado: true };
  }
  return { company_id: null, creado: false, aviso: 'La oportunidad no tiene ni cliente ni contacto: no hay a quién cobrarle.' };
}

/**
 * ¿Ya existe una sub igual por este mismo trato? (reabrir y recerrar)
 *
 * Busca por el TRATO y por la COTIZACIÓN. Antes solo miraba `deal_id`, y las
 * licencias creadas por el otro camino —registrar el pago a mano, que las liga
 * a la cotización pero no al trato— quedaban invisibles: caso Okulany, una
 * licencia activa con su pago y, 23 minutos después, una segunda idéntica
 * 'programada' creada por el cierre de la misma cotización.
 */
async function subDelDeal(dealId: string, ciclo: string, quoteId?: string | null): Promise<string | null> {
  const mismoCiclo = (s: any) => (ciclo === 'vitalicia' ? s.ciclo === 'vitalicia' : s.ciclo !== 'vitalicia');
  const { data } = await supabase.from('subscriptions').select('id, ciclo').eq('deal_id', dealId).limit(20);
  const hit = (data || []).find(mismoCiclo);
  if (hit) return hit.id;
  if (!quoteId) return null;
  const { data: porQuote } = await supabase.from('subscriptions')
    .select('id, ciclo, estado').eq('quote_id', quoteId).limit(20);
  const hit2 = (porQuote || []).filter((s: any) => s.estado !== 'cancelada').find(mismoCiclo);
  return hit2?.id || null;
}

async function crearSub(fila: any): Promise<{ id: string | null; error?: string }> {
  // deal_id puede no existir todavía (deploy antes que el SQL): se reintenta sin él.
  let ins = await supabase.from('subscriptions').insert(fila).select('id').maybeSingle();
  if (ins.error && /deal_id|plan_id|precio_lista|column|schema cache/i.test(ins.error.message || '')) {
    const { deal_id, plan_id, precio_lista, ...base } = fila;
    ins = await supabase.from('subscriptions').insert(base).select('id').maybeSingle();
  }
  if (ins.error) return { id: null, error: ins.error.message };
  return { id: ins.data?.id || null };
}

/**
 * Materializa una oportunidad ganada: cliente + suscripción + pago único.
 * Nunca lanza — un fallo aquí no puede impedir que el trato quede ganado.
 */
export async function materializarDealGanado(deal: any): Promise<ResultadoCierre> {
  const avisos: string[] = [];
  const out: ResultadoCierre = { company_id: null, cliente_creado: false, sub_creada: false, unico_creado: false, avisos };

  const cli = await asegurarCliente(deal);
  out.company_id = cli.company_id;
  out.cliente_creado = cli.creado;
  if (cli.aviso) avisos.push(cli.aviso);
  if (!cli.company_id) return out;

  const items: DealItem[] = Array.isArray(deal.items) ? deal.items : [];
  // Sin líneas capturadas se usa lo que la oportunidad traiga suelto: así los
  // tratos viejos también generan algo al cerrarse.
  const t = items.length
    ? calcularTotales(items, deal.descuento_pct)
    : {
        mrr: Number(deal.mrr || deal.valor_mensual || 0),
        arr: Number(deal.mrr || deal.valor_mensual || 0) * 12,
        valor_unico: Number(deal.valor_unico || (deal.billing_period === 'unico' ? deal.valor_total : 0) || 0),
        valor_total: Number(deal.valor_total || 0),
        tipo_ingreso: null, billing_period: (deal.billing_period as any) || null,
        subtotal_recurrente_periodo: 0,
      };

  const hoy = new Date().toISOString().slice(0, 10);
  const contactId = deal.contact_id || null;

  // ── Recurrente ──
  if (t.mrr > 0) {
    const yaEsta = await subDelDeal(deal.id, 'recurrente', deal.quote_id);
    if (yaEsta) { out.subscription_id = yaEsta; }
    else {
      const ciclo = t.billing_period === 'anual' ? 'anual' : 'mensual';
      const precio = ciclo === 'anual' ? Math.round(t.mrr * 12) : Math.round(t.mrr);
      const planLinea = items.find(i => i.ciclo !== 'unico' && i.plan_id);
      const { id, error } = await crearSub({
        company_id: cli.company_id, contact_id: contactId, deal_id: deal.id,
        nombre_plan: nombrePlanDeItems(items, deal.plan || 'Licencia SACS'),
        ciclo, estado: 'programada', precio,
        mrr: Math.round(t.mrr * 100) / 100, arr: Math.round(t.mrr * 12 * 100) / 100,
        fecha_inicio: hoy, proxima_factura: hoy, monto_proximo: precio,
        ...(planLinea?.plan_id ? { plan_id: planLinea.plan_id } : {}),
        ...(deal.quote_id ? { quote_id: deal.quote_id } : {}),
        ...(deal.referrer_partner_id ? { partner_id: deal.referrer_partner_id } : {}),
      });
      if (error) avisos.push('Suscripción: ' + error);
      else {
        out.subscription_id = id; out.sub_creada = true;
        await actividad(cli.company_id, deal.id, contactId, 'suscripcion_creada',
          `📄 Suscripción creada: ${nombrePlanDeItems(items, deal.plan || 'Licencia SACS')} · $${precio.toLocaleString('es-MX')}/${ciclo === 'anual' ? 'año' : 'mes'}`,
          `Nace PROGRAMADA (aceptada, sin pagar): pasa a activa con el primer pago. Aporta $${Math.round(t.mrr).toLocaleString('es-MX')} de MRR.`,
          { subscription_id: id, ciclo, precio, mrr: t.mrr });
      }
    }
  }

  // ── Pago único ──
  // Va como licencia vitalicia: es la forma que el CRM ya tiene de un cobro que
  // no se repite. Así se le puede cobrar y NO infla el ARR.
  if (t.valor_unico > 0) {
    const yaEsta = await subDelDeal(deal.id, 'vitalicia', deal.quote_id);
    if (yaEsta) { out.unico_id = yaEsta; }
    else {
      const unicos = items.filter(i => i.ciclo === 'unico');
      const nombre = (unicos.length === 1 ? unicos[0].nombre : `Pago único · ${deal.nombre || 'venta'}`).slice(0, 160);
      const { id, error } = await crearSub({
        company_id: cli.company_id, contact_id: contactId, deal_id: deal.id,
        nombre_plan: nombre, ciclo: 'vitalicia', estado: 'programada',
        precio: Math.round(t.valor_unico), mrr: 0, arr: 0,
        fecha_inicio: hoy, proxima_factura: null, monto_proximo: null,
        ...(deal.quote_id ? { quote_id: deal.quote_id } : {}),
      });
      if (error) avisos.push('Pago único: ' + error);
      else {
        out.unico_id = id; out.unico_creado = true;
        await actividad(cli.company_id, deal.id, contactId, 'pago_unico_creado',
          `💵 Pago único por cobrar: ${nombre} · $${Math.round(t.valor_unico).toLocaleString('es-MX')}`,
          'Queda como licencia vitalicia en su cuenta: se le puede cobrar y NO suma al ARR.',
          { subscription_id: id, monto: t.valor_unico });
      }
    }
  }

  if (t.mrr <= 0 && t.valor_unico <= 0) {
    avisos.push('La oportunidad no tiene ni recurrente ni pago único capturado: no se generó cobro.');
  }

  // El cliente queda marcado como tal (aunque no se haya creado aquí).
  await supabase.from('companies').update({ estado_cuenta: 'activo' }).eq('id', cli.company_id).neq('estado_cuenta', 'activo');
  if (contactId) await supabase.from('contacts').update({ tipo: 'cliente', lifecycle_stage: 'cliente' }).eq('id', contactId);
  if (out.subscription_id) await supabase.from('deals').update({ subscription_id: out.subscription_id }).eq('id', deal.id).then(() => {}, () => {});

  out.convirtio_lead = cli.creado;

  // La campana: convertir un lead en cliente es EL evento del embudo. Que pase
  // en silencio es lo que hace que nadie dé la bienvenida ni arranque el
  // onboarding el mismo día.
  if (cli.creado) {
    try {
      const { notificar } = await import('./notificaciones');
      const { data: co } = await supabase.from('companies').select('nombre').eq('id', cli.company_id).maybeSingle();
      await notificar({
        clave: `lead_convertido:${deal.id}`,
        tipo: 'cliente_convertido', nivel: 'info',
        titulo: `🎉 ${co?.nombre || 'Un lead'} ya es CLIENTE`,
        detalle: [
          out.sub_creada ? 'Su suscripción quedó creada (programada).' : '',
          out.unico_creado ? 'Tiene un pago único por cobrar.' : '',
          'Todo el detalle está en su Actividad.',
        ].filter(Boolean).join(' '),
        monto: Number(deal.valor_total || 0),
        company_id: cli.company_id, subscription_id: out.subscription_id || null,
        destino: 'clientes', metadata: { deal_id: deal.id },
      });
    } catch (e: any) { console.error('[deal-cierre] campana:', e?.message || e); }
  }

  // Si algo NO se pudo hacer, también se escribe: un cierre a medias que no
  // deja rastro es el que se descubre cuando el cliente reclama.
  if (avisos.length) {
    await actividad(cli.company_id, deal.id, contactId, 'sistema',
      '⚠️ El cierre quedó incompleto', avisos.join(' · '), { avisos });
  }

  return out;
}
