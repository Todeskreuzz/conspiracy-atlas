import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { localeAlternates } from '../../shared/localePath';

const SITE = 'The Conspiracy Atlas';

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

/**
 * Title, description, canonical URL and language versions of the current page, for search engines and browser tabs.
 * Pages call it once their data has loaded; PageMeta in App sets the defaults on every navigation before that.
 */
export function usePageMeta(title: string | null | undefined, description?: string | null) {
  const { locale, t } = useI18n();
  const { pathname } = useLocation();
  useEffect(() => {
    if (title === undefined) return;
    document.title = title ? `${title} – ${SITE}` : SITE;
    setMeta('description', (description ?? t('app.tagline')).replace(/\s+/g, ' ').trim().slice(0, 200));
    // pathname comes from the router, so it has no language prefix.
    for (const alt of localeAlternates(window.location.origin, pathname)) {
      setLink(`link[rel="alternate"][hreflang="${alt.locale}"]`, { rel: 'alternate', hreflang: alt.locale, href: alt.url });
      if (alt.locale === locale) setLink('link[rel="canonical"]', { rel: 'canonical', href: alt.url });
    }
  }, [title, description, locale, t, pathname]);
}
