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
