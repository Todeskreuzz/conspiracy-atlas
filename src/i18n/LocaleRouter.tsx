import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { App } from '../App';
import { DEFAULT_LOCALE, type Locale } from '../../shared/constants';
import { localeBase, localeFromPath, localePath, stripLocale } from '../../shared/localePath';
import { storedLocale } from '.';

/**
 * Where the visitor should be on first load. Old ?lang= links move to the language's own URL; a visitor who chose
 * a language with the switcher before is taken to that version (crawlers have no stored choice, so they always
 * get the page they asked for).
 */
export function initialUrl(loc: { pathname: string; search: string; hash: string }, stored: Locale | null): string | null {
  const params = new URLSearchParams(loc.search);
  const lang = params.get('lang');
  params.delete('lang');
  const search = params.toString() ? `?${params}` : '';
  const plain = stripLocale(loc.pathname);
  let target: Locale | null = null;
  if (lang === 'de' || lang === 'en') target = lang;
  else if (stored && stored !== DEFAULT_LOCALE && localeFromPath(loc.pathname) === DEFAULT_LOCALE) target = stored;
  if (!target) return null;
  const url = localePath(target, plain) + search + loc.hash;
  return url === loc.pathname + loc.search + loc.hash ? null : url;
}

function currentLocale(): Locale {
  const next = initialUrl(window.location, storedLocale());
  if (next) window.history.replaceState(window.history.state, '', next);
  return localeFromPath(window.location.pathname);
}

/** The browser router with the language prefix as basename, so every in-app link stays in the current language. */
export function LocaleRouter() {
  const [locale, setLocale] = useState<Locale>(currentLocale);
  // Back/forward across a language switch.
  useEffect(() => {
    const onPop = () => setLocale(localeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const switchTo = useCallback((next: Locale) => {
    const { pathname, search, hash } = window.location;
    const url = localePath(next, stripLocale(pathname)) + search + hash;
    if (url !== pathname + search + hash) window.history.pushState(null, '', url);
    setLocale(next);
  }, []);
  return (
    <BrowserRouter key={locale} basename={localeBase(locale) || undefined}>
      <App locale={locale} onLocaleChange={switchTo} />
    </BrowserRouter>
  );
}
