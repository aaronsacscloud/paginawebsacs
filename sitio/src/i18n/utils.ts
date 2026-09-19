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

/**
 * Pares es↔en QUE DE VERDAD EXISTEN (19-sep-2026).
 *
 * `getHreflangLinks` de arriba es MECÁNICA: asume que cualquier ruta española
 * tiene su espejo en `/en/`, `/fr/`, etc. con el mismo path — cierto en un
 * sitio con paridad total, falso aquí: el track en inglés es acotado a 6
 * páginas propias (fashion-erp, apparel-pos, wholesale-apparel-software,
 * size-and-color-inventory, pricing y el hub), casi ninguna con el mismo
 * slug que su pariente en español. Por eso NO se reactivó `getHreflangLinks`
 * tal cual (habría que mentir con /en/planes, /en/producto/... que no
 * existen) — se declara a mano la lista de pares reales, y nada más.
 *
 * Nunca se agrega fr/it/pt aquí: cero páginas construidas en esos idiomas.
 */
export const HREFLANG_PARES_ES_EN: Record<string, string> = {
  '/': '/en',
  '/planes': '/en/pricing',
  '/producto/inventario-omnicanal': '/en/size-and-color-inventory',
  '/producto/punto-de-venta': '/en/apparel-pos',
  '/enterprise': '/en/fashion-erp',
};

export interface HreflangLink {
  lang: string;
  href: string;
}

/**
 * Hreflang recíproco para UNA ruta (española o inglesa), o `null` si esa
 * ruta no tiene par real — es preferible no declarar nada a declarar un par
 * inventado. Se usa desde `BaseLayout.astro` para TODAS las páginas del
 * sitio (españolas incluidas) sin tener que tocar cada página una por una:
 * la tabla de arriba es la única fuente que hay que mantener.
 */
export function hreflangParaRuta(pathname: string): HreflangLink[] | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
  // El build estático de Astro (`build.format` default, "directory") emite
  // cada página como carpeta/index.html y su propio `<link rel="canonical">`
  // sale CON slash final (p. ej. `/en/pricing/`, verificado en el build).
  // Las claves de `HREFLANG_PARES_ES_EN` no la llevan (más fácil de leer y
  // de comparar); se agrega aquí SOLO al construir la URL de salida, para
  // que el hreflang apunte exactamente a la misma URL que el canonical de
  // esa página — no a una variante sin slash que Google tiene que resolver
  // por su cuenta.
  const conSlash = (p: string) => (p === '/' ? '/' : `${p}/`);

  let esPath: string | undefined;
  let enPath: string | undefined;

  if (path in HREFLANG_PARES_ES_EN) {
    esPath = path;
    enPath = HREFLANG_PARES_ES_EN[path];
  } else {
    const found = Object.entries(HREFLANG_PARES_ES_EN).find(([, en]) => en === path);
    if (found) [esPath, enPath] = found;
  }

  if (esPath && enPath) {
    return [
      { lang: 'es-MX', href: `${siteUrl}${conSlash(esPath)}` },
      { lang: 'en-US', href: `${siteUrl}${conSlash(enPath)}` },
      // x-default va al español: es el mercado y el idioma primarios de Sacs.
      { lang: 'x-default', href: `${siteUrl}${conSlash(esPath)}` },
    ];
  }

  // Página en /en/ sin par real en español (p. ej. wholesale-apparel-software,
  // que no traduce ninguna página existente): se autorreferencia y el
  // x-default cae al home en español, no a sí misma.
  if (path === '/en' || path.startsWith('/en/')) {
    return [
      { lang: 'en-US', href: `${siteUrl}${conSlash(path)}` },
      { lang: 'x-default', href: `${siteUrl}/` },
    ];
  }

  return null;
}
