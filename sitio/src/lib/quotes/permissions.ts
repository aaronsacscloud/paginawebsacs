// Reglas de qué puede hacer un Partner con una cotización.
// Estas reglas se aplican en backend (los endpoints) — UI debería respetarlas también.

import type { CurrentUser } from '../auth/scope';
import { isPartnerAllowedPlan } from './partner-catalog';

export const PARTNER_MAX_DISCOUNT_PCT = 15;
export const PARTNER_MAX_EXTENSIONS = 1;
export const PARTNER_MAX_EXTENSION_DAYS = 15;

export interface PartnerPermissionError {
  status: number;
  code: string;
  message: string;
}

/**
 * Valida un body de quote (POST/PUT) cuando el actor es un partner.
 * Retorna null si todo OK, o un objeto error que el endpoint debe devolver.
 */
export function validatePartnerQuoteBody(
  user: CurrentUser,
  body: Record<string, any>,
): PartnerPermissionError | null {
  if (user.role !== 'partner') return null;

  // 1. Descuento global ≤ 15%
  const descTipo = body.descuento_tipo || 'pct';
  const descVal = Number(body.descuento_global) || 0;
  if (descTipo === 'pct' && descVal > PARTNER_MAX_DISCOUNT_PCT) {
    return {
      status: 422,
      code: 'discount_too_high',
      message: `El descuento máximo permitido es ${PARTNER_MAX_DISCOUNT_PCT}%`,
    };
  }
  if (descTipo === 'monto' && descVal > 0) {
    // Si el cliente no manda subtotal o es <= 0 no podemos validar el cap → rechazar por seguridad.
    const subtotal = Number(body.subtotal) || 0;
    if (subtotal <= 0 || descVal > subtotal * (PARTNER_MAX_DISCOUNT_PCT / 100)) {
      return {
        status: 422,
        code: 'discount_too_high',
        message: `El descuento máximo permitido es ${PARTNER_MAX_DISCOUNT_PCT}% del subtotal`,
      };
    }
  }

  // 2. Items: planes deben ser del catálogo; extras pueden ser libres (catálogo SACS o custom)
  const items = Array.isArray(body.items) ? body.items : [];

  // Subtotal de items pagados (excluyendo promociones) para validar caps relativos.
  const paidSubtotal = items
    .filter((it: any) => !(it?.tipo === 'extra' && it?.es_promocion))
    .reduce((s: number, it: any) => s + (Number(it?.subtotal) || Number(it?.monto) || 0), 0);

  for (const it of items) {
    if (it?.tipo === 'plan') {
      if (!isPartnerAllowedPlan(it.nombre)) {
        return {
          status: 422,
          code: 'plan_not_allowed',
          message: `Plan no reconocido: ${it.nombre}`,
        };
      }
      // Descuento por línea ≤ 15%
      const lineDisc = Number(it.descuento_pct) || 0;
      if (lineDisc > PARTNER_MAX_DISCOUNT_PCT) {
        return {
          status: 422,
          code: 'line_discount_too_high',
          message: `Descuento por línea máximo ${PARTNER_MAX_DISCOUNT_PCT}%`,
        };
      }
    }
    // Promociones (precio_unitario=0, precio_original>0): cap el valor publicitado
    // para evitar "ahorro de $1M" en una cotización de $5k (engaño al cliente).
    if (it?.tipo === 'extra' && it?.es_promocion) {
      const precioOriginal = Number(it?.precio_original) || 0;
      // Una sola promo no puede valer más que el subtotal pagado de la cotización.
      // Para una cotización sin items pagados (solo promos), no permitir promos > $0.
      if (precioOriginal > paidSubtotal) {
        return {
          status: 422,
          code: 'promo_value_too_high',
          message: paidSubtotal > 0
            ? `El valor de una promoción no puede superar el subtotal pagado de la cotización (${paidSubtotal}).`
            : 'Las promociones requieren al menos un plan o extra pagado en la cotización.',
        };
      }
    }
    // Extras no-promo (tipo='extra', sin es_promocion) no tienen whitelist —
    // el partner puede agregar servicios propios igual que el admin.
  }

  return null;
}

/**
 * Cuando un partner edita una quote existente, bloquea cambios sobre quotes
 * ya aceptadas/pagadas/rechazadas.
 */
export function canPartnerEditQuote(prevEstado: string | null | undefined): boolean {
  const locked = ['accepted', 'paid', 'rejected'];
  return !locked.includes(String(prevEstado || ''));
}
