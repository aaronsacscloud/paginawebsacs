// OUTBOUND · Venta: precio personalizado y prueba social para las ofertas
// in-app (mejoras 4 y 5). El pago (mejora 3) reutiliza la pasarela ya probada.
import { supabase } from '../supabase';
import { cuentasDe, normCuenta } from '../crm/sacs-cuentas';

// ── #4 Precio personalizado ─────────────────────────────────────────────────
// Una oferta se define en el botón de campaña: { concepto, plan_slug?,
// monto_base?, por_sucursal?, ciclo? }. El precio se calcula para ESA cuenta.
export interface Oferta {
  concepto: string;
  plan_slug?: string;   // si es un plan/plugin del catálogo, toma su precio de lista
  monto_base?: number;  // precio fijo (plugins a la medida, promos)
  por_sucursal?: boolean; // multiplica por las sucursales de la empresa
  ciclo?: 'mensual' | 'anual';
}

export interface PrecioCalculado {
  concepto: string;
  monto: number;
  ciclo: string;
  desglose: string;      // "$900 × 3 sucursales" — para mostrarle el porqué
  sucursales: number;
  es_cotizacion: boolean; // sin precio de catálogo ni base → a cotizar
}

async function sucursalesDe(companyId: string): Promise<number> {
  try {
    const { data } = await supabase.from('companies').select('sucursales, actividad').eq('id', companyId).maybeSingle();
    // Preferir el conteo real del puente (actividad.sucursales), caer a companies.sucursales.
    const real = data?.actividad?.sucursales;
    const n = Number(real ?? data?.sucursales ?? 1);
    return isFinite(n) && n > 0 ? Math.round(n) : 1;
  } catch { return 1; }
}

export async function calcularPrecio(companyId: string, oferta: Oferta): Promise<PrecioCalculado> {
  const ciclo = oferta.ciclo || 'mensual';
  const suc = oferta.por_sucursal ? await sucursalesDe(companyId) : 1;

  let base: number | null = null;
  if (typeof oferta.monto_base === 'number' && oferta.monto_base > 0) {
    base = oferta.monto_base;
  } else if (oferta.plan_slug) {
    const { data: plan } = await supabase.from('plans')
      .select('precio_mensual, precio_anual, a_la_medida').eq('slug', oferta.plan_slug).maybeSingle();
    if (plan && !plan.a_la_medida) {
      base = ciclo === 'anual' ? Number(plan.precio_anual) : Number(plan.precio_mensual);
    }
  }

  if (base == null || !(base > 0)) {
    return { concepto: oferta.concepto, monto: 0, ciclo, desglose: 'Precio a cotizar', sucursales: suc, es_cotizacion: true };
  }

  const monto = Math.round(base * suc * 100) / 100;
  const desglose = suc > 1
    ? `$${base.toLocaleString('es-MX')} × ${suc} sucursales`
    : `$${base.toLocaleString('es-MX')} ${ciclo === 'anual' ? 'al año' : 'al mes'}`;
  return { concepto: oferta.concepto, monto, ciclo, desglose, sucursales: suc, es_cotizacion: false };
}

// ── #5 Prueba social (real + piso, patrón del agendador) ────────────────────
// "N negocios usan X". El conteo REAL sale de companies (uso_sacs para
// módulo/plugin — array jsonb, se recorre en JS; giro — columna plana, COUNT).
// Se le suma un piso base honesto (hay más cuentas SACS que companies en el CRM)
// para que el número no se sienta raquítico en giros/módulos chicos.
const PISO = 40;

export async function pruebaSocial(tipo: 'modulo' | 'plugin' | 'giro', valor: string): Promise<{ total: number; texto: string }> {
  const v = String(valor || '').trim();
  if (!v) return { total: 0, texto: '' };

  if (tipo === 'giro') {
    const { count } = await supabase.from('companies').select('*', { count: 'exact', head: true })
      .eq('giro', v).is('archived_at', null);
    const total = PISO + (count || 0);
    return { total, texto: `${total.toLocaleString('es-MX')} negocios de ${v.toLowerCase()} ya usan SACS` };
  }

  // modulo / plugin: recorrer companies.uso_sacs en JS (no hay agregado SQL).
  const { data } = await supabase.from('companies').select('uso_sacs').is('archived_at', null).limit(5000);
  let reales = 0;
  for (const c of (data || [])) {
    const u = (c as any).uso_sacs || {};
    if (tipo === 'plugin') {
      if (Array.isArray(u.plugins) && u.plugins.indexOf(v) !== -1) reales++;
    } else {
      const mods: any[] = Array.isArray(u.modulos) ? u.modulos : [];
      if (mods.some(m => m && m.modulo === v && m.usa)) reales++;
    }
  }
  const total = PISO + reales;
  return { total, texto: `${total.toLocaleString('es-MX')} negocios ya usan ${v}` };
}

// ── #3 Checkout: crea una preferencia de Mercado Pago REAL para una oferta ──
// Reutiliza la pasarela probada (conexionActiva + /checkout/preferences). El
// external_reference `outbound:<company>:<campana>` deja que el webhook
// registre el cobro en crm_cobros_mp para que un humano lo materialice
// (patrón VincularMercadoPago) — NO se procesa tarjeta aquí.
export async function crearPreferenciaOferta(params: {
  companyId: string; campanaId: string; oferta: Oferta; origen: string; email?: string | null;
}): Promise<{ link: string; monto: number; preference_id: string }> {
  const { conexionActiva, mpFetch } = await import('../pagos/mercadopago');
  const cx = await conexionActiva();
  if (!cx) throw new Error('No hay pasarela de Mercado Pago conectada en el CRM.');

  const precio = await calcularPrecio(params.companyId, params.oferta);
  if (precio.es_cotizacion || !(precio.monto > 0)) {
    throw new Error('Esta oferta no tiene un precio calculable (es a cotizar).');
  }

  const pref = await mpFetch('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ title: precio.concepto, description: precio.desglose, quantity: 1, currency_id: 'MXN', unit_price: precio.monto }],
      external_reference: `outbound:${params.companyId}:${params.campanaId}`,
      payer: params.email ? { email: params.email } : undefined,
      notification_url: params.origen + '/api/revenue/mercadopago-webhook',
      back_urls: { success: params.origen + '/gracias', pending: params.origen + '/gracias', failure: params.origen + '/gracias' },
      statement_descriptor: 'SACSCLOUD',
      expires: true,
      expiration_date_to: new Date(Date.now() + 7 * 86400000).toISOString(),
    }),
  }, cx);

  const link = cx.modo === 'prueba' ? (pref.sandbox_init_point || pref.init_point) : pref.init_point;
  if (!link) throw new Error('Mercado Pago no devolvió un link de pago.');
  return { link, monto: precio.monto, preference_id: pref.id };
}

export { normCuenta, cuentasDe };
