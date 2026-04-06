export const defaultLocale = 'es' as const;
export const locales = ['es', 'en', 'fr', 'it', 'pt'] as const;
export type Locale = (typeof locales)[number];

export const languageNames: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
};

export const currencyMap: Record<Locale, string> = {
  es: 'mxn',
  en: 'usd',
  fr: 'eur',
  it: 'eur',
  pt: 'brl',
};

export const currencySymbols: Record<string, string> = {
  mxn: 'MXN',
  usd: 'USD',
  eur: 'EUR',
  brl: 'BRL',
};

export const localeToHreflang: Record<Locale, string> = {
  es: 'es-MX',
  en: 'en-US',
  fr: 'fr-FR',
  it: 'it-IT',
  pt: 'pt-BR',
};

export const siteUrl = 'https://www.sacscloud.com';
