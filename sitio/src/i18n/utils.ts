import { defaultLocale, locales, currencyMap, siteUrl } from './config';
import type { Locale } from './config';

import es from './translations/es.json';
import en from './translations/en.json';
import fr from './translations/fr.json';
import it from './translations/it.json';
import pt from './translations/pt.json';

const translations: Record<Locale, Record<string, any>> = { es, en, fr, it, pt };

/**
 * Get a translated string by dot-notation key.
 * Falls back to Spanish if key not found in target locale.
 */
export function t(key: string, locale: Locale = defaultLocale): string {
  const keys = key.split('.');
  let value: any = translations[locale];
  for (const k of keys) {
    value = value?.[k];
  }
  if (typeof value === 'string') return value;

  // Fallback to default locale
  let fallback: any = translations[defaultLocale];
  for (const k of keys) {
    fallback = fallback?.[k];
  }
  return typeof fallback === 'string' ? fallback : key;
}

/**
 * Get locale from current URL pathname.
 */
export function getLangFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/');
  if (locales.includes(lang as Locale) && lang !== defaultLocale) {
    return lang as Locale;
  }
  return defaultLocale;
}

/**
 * Build a localized URL. Spanish (default) stays at root, others get prefix.
 */
export function getLocalizedUrl(path: string, locale: Locale): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return cleanPath;
  return `/${locale}${cleanPath}`;
}

/**
 * Get the default currency key for a locale.
 */
export function getDefaultCurrency(locale: Locale): string {
  return currencyMap[locale];
}

/**
 * Format a price using Intl.NumberFormat.
 */
export function formatPrice(amount: number, currency: string, locale: Locale = defaultLocale): string {
  const localeMap: Record<Locale, string> = {
    es: 'es-MX',
    en: 'en-US',
    fr: 'fr-FR',
    it: 'it-IT',
    pt: 'pt-BR',
  };

  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get all hreflang links for a given path.
 */
export function getHreflangLinks(currentPath: string): { lang: string; href: string }[] {
  // Strip locale prefix to get the base path
  let basePath = currentPath;
  for (const locale of locales) {
    if (locale !== defaultLocale && currentPath.startsWith(`/${locale}/`)) {
      basePath = currentPath.slice(locale.length + 1);
      break;
    }
    if (locale !== defaultLocale && currentPath === `/${locale}`) {
      basePath = '/';
      break;
    }
  }

  const links = locales.map((locale) => ({
    lang: locale,
    href: `${siteUrl}${getLocalizedUrl(basePath, locale)}`,
  }));

  links.push({
    lang: 'x-default',
    href: `${siteUrl}${basePath}`,
  });

  return links;
}
