import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

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
    const en = `${window.location.origin}${pathname}`;
    const de = `${en}?lang=de`;
    setLink('link[rel="canonical"]', { rel: 'canonical', href: locale === 'de' ? de : en });
    setLink('link[rel="alternate"][hreflang="en"]', { rel: 'alternate', hreflang: 'en', href: en });
    setLink('link[rel="alternate"][hreflang="de"]', { rel: 'alternate', hreflang: 'de', href: de });
    setLink('link[rel="alternate"][hreflang="x-default"]', { rel: 'alternate', hreflang: 'x-default', href: en });
  }, [title, description, locale, t, pathname]);
}
