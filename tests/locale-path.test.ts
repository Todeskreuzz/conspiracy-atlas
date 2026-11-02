import { describe, it, expect } from 'vitest';
import { localeAlternates, localeBase, localeFromPath, localePath, stripLocale } from '../shared/localePath';
import { initialUrl } from '../src/i18n/LocaleRouter';
import en from '../src/i18n/locales/en.json';
import de from '../src/i18n/locales/de.json';
import fr from '../src/i18n/locales/fr.json';

describe('language URLs', () => {
  it('reads and strips the language prefix', () => {
    expect(localeFromPath('/')).toBe('en');
    expect(localeFromPath('/archive')).toBe('en');
    expect(localeFromPath('/de')).toBe('de');
    expect(localeFromPath('/de/theory/area-51')).toBe('de');
    expect(localeFromPath('/fr/theory/area-51')).toBe('fr');
    expect(stripLocale('/fr/archive')).toBe('/archive');
    expect(localeFromPath('/design')).toBe('en');
    expect(stripLocale('/de')).toBe('/');
    expect(stripLocale('/de/')).toBe('/');
    expect(stripLocale('/de/archive')).toBe('/archive');
    expect(stripLocale('/archive')).toBe('/archive');
  });

  it('builds the URL of a page in each language', () => {
    expect(localePath('en', '/archive')).toBe('/archive');
    expect(localePath('de', '/archive')).toBe('/de/archive');
    expect(localePath('de', '/')).toBe('/de');
    expect(localeBase('en')).toBe('');
    expect(localePath('fr', '/')).toBe('/fr');
    expect(localeAlternates('https://x.test', '/de/map')).toEqual([
      { locale: 'en', url: 'https://x.test/map' },
      { locale: 'de', url: 'https://x.test/de/map' },
      { locale: 'fr', url: 'https://x.test/fr/map' },
      { locale: 'x-default', url: 'https://x.test/map' },
    ]);
  });

  it('moves old ?lang= links and remembered choices to the right URL on first load', () => {
    const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });
    expect(initialUrl(at('/archive', '?lang=fr'), null)).toBe('/fr/archive');
    expect(initialUrl(at('/archive', '?lang=de'), null)).toBe('/de/archive');
    expect(initialUrl(at('/theory/x', '?lang=de&tab=a', '#s'), null)).toBe('/de/theory/x?tab=a#s');
    expect(initialUrl(at('/de/map', '?lang=en'), null)).toBe('/map');
    expect(initialUrl(at('/archive'), 'de')).toBe('/de/archive');
    expect(initialUrl(at('/de/archive'), 'en')).toBeNull();
    expect(initialUrl(at('/archive'), null)).toBeNull();
    expect(initialUrl(at('/de'), 'de')).toBeNull();
  });
});

type Dict = { [k: string]: string | Dict };
const keys = (d: Dict, p = ''): string[] => Object.entries(d).flatMap(([k, v]) => (typeof v === 'string' ? [`${p}${k}`] : keys(v, `${p}${k}.`)));

describe('translations', () => {
  it('has every interface text in English, German and French', () => {
    const enKeys = keys(en as Dict).sort();
    const deKeys = keys(de as Dict).sort();
    const frKeys = keys(fr as Dict).sort();
    expect(deKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !deKeys.includes(k))).toEqual([]);
    expect(frKeys).toEqual(enKeys);
  });
});
