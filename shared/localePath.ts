// Language versions of a page have their own URLs: English (the default) is the plain path,
// every other language puts its code in front, e.g. /de/archive. Used by the app, the sitemap
// and the link-preview Functions, so every place builds the same URLs.
import { DEFAULT_LOCALE, LOCALES, type Locale } from './constants';

/** Languages that get a URL prefix (all but the default). */
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/** The language a path belongs to: /de or /de/... is German, everything else English. */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/')[1] ?? '';
  return (PREFIXED_LOCALES as readonly string[]).includes(first) ? (first as Locale) : DEFAULT_LOCALE;
}

/** The path without its language prefix (always starts with "/"). */
export function stripLocale(pathname: string): string {
  const locale = localeFromPath(pathname);
  if (locale === DEFAULT_LOCALE) return pathname || '/';
  const rest = pathname.slice(locale.length + 1);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/** The router base path of a language: '' for English, '/de' for German. */
export function localeBase(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

/** The URL path of a page (given without prefix) in a language: localePath('de', '/archive') === '/de/archive'. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === '/' ? localeBase(locale) : `${localeBase(locale)}${clean}`;
}

/** Same page in every language, plus x-default (English), for hreflang tags and the sitemap. */
export function localeAlternates(origin: string, path: string): { locale: Locale | 'x-default'; url: string }[] {
  const plain = stripLocale(path);
  return [
    ...LOCALES.map((locale) => ({ locale, url: `${origin}${localePath(locale, plain)}` })),
    { locale: 'x-default' as const, url: `${origin}${localePath(DEFAULT_LOCALE, plain)}` },
  ];
}
