// Constantes del PROGRAMA PADRINO (Buddy) — fuente única de verdad.
// Módulo PURO (sin dependencias): lo consumen tanto la lógica del wallet
// (lib/wallet.ts → webhook que acredita) como la landing estática (/buddy),
// para que el monto que se PROMETE sea siempre el que se PAGA.

// El padrino gana el 40% del valor de la licencia en créditos (Saldo Sacs),
// en AMBOS momentos: al activarse el regalo y cuando el referido paga.
export const REFERRAL_PCT = 0.40;

// Valor de la licencia que se regala (Plan Vende anual).
export const GIFT_LICENSE_VALUE_MXN = 6000;

// Bono al padrino cuando su amigo activa el año gratis = 40% de la licencia ($2,400).
export const GIFT_ACTIVATION_BONUS_MXN = Math.round(GIFT_LICENSE_VALUE_MXN * REFERRAL_PCT);

// ─── Programa EMBAJADOR (link de referido permanente de cada cliente) ───
// El referido obtiene 50% OFF su primer año del Plan Vende (1 sucursal).
export const CLIENT_REF_DISCOUNT_PCT = 0.50;
// Cuando el referido paga, el cliente referidor gana 40% del VALOR de la
// licencia ($2,400 fijo, NO del monto descontado) en créditos Sacs.
export const CLIENT_REF_COMMISSION_MXN = Math.round(GIFT_LICENSE_VALUE_MXN * REFERRAL_PCT);
