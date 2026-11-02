// Preview cards use the same words as the interface. The strings live in the locale files;
// this module only reads them so a card cannot drift from the site.
import en from '../../src/i18n/locales/en.json';
import de from '../../src/i18n/locales/de.json';
import type { EvidenceStatus, Locale } from '../../shared/constants';

const dictionaries = { en, de };

export function statusLabel(locale: Locale, status: EvidenceStatus): string {
  return dictionaries[locale].status[status];
}

export function homeKicker(locale: Locale): string {
  return dictionaries[locale].home.kicker;
}

export function homeDescription(locale: Locale): string {
  return dictionaries[locale].meta.home;
}
