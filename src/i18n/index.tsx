import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from './locales/en.json';
import de from './locales/de.json';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../shared/constants';
import { localeFromPath } from '../../shared/localePath';

// Central translation registry. To add a language: add a JSON file with the same keys,
// register it here and extend LOCALES in shared/constants.ts.
export const dictionaries: Record<Locale, typeof en> = { en, de };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown> ? Leaves<T[K], `${P}${K}.`> : `${P}${K}`;
}[keyof T & string];
export type TKey = Leaves<typeof en>;

export const STORAGE_KEY = 'ca.locale';

function lookup(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as object)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, v) => (vars[v] !== undefined ? String(vars[v]) : `{${v}}`)) : raw;
}

/** The language of the current URL: /de/... is German, plain paths are English (see shared/localePath.ts). */
export function detectLocale(): Locale {
  try {
    return localeFromPath(window.location.pathname);
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** The language the visitor last chose with the switcher, if any. */
export function storedLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && (LOCALES as readonly string[]).includes(stored) ? (stored as Locale) : null;
  } catch {
    return null;
  }
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey | string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
});

/**
 * onLocaleChange: set by the app root, which moves to the URL of the other language (src/i18n/LocaleRouter.tsx).
 * Without it (tests) the language only changes in memory.
 */
export function I18nProvider({ children, initial, onLocaleChange }: { children: ReactNode; initial?: Locale; onLocaleChange?: (l: Locale) => void }) {
  const [locale, setLocaleState] = useState<Locale>(initial ?? detectLocale());
  const setLocale = useCallback(
    (l: Locale) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        /* ignore */
      }
      if (onLocaleChange) onLocaleChange(l);
      else setLocaleState(l);
    },
    [onLocaleChange],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;

export function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  if (/^-?\d{1,4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const d = new Date(`${value}-01T00:00:00Z`);
    return d.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  }
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
