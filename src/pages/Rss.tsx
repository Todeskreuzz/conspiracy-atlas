import { useState } from 'react';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Paged, TheorySummary } from '../../shared/types';
import { TheoryCard } from '../components/TheoryCard';
import { LoadState } from '../components/Unavailable';
import { CaseOfTheDay } from '../components/CaseOfTheDay';

/** Readable page for the RSS feed: the case of the day as the highlight, then the newest case files with their images. */
export default function RssPage() {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const latest = useAsync((signal) => api<Paged<TheorySummary>>('/theories?pageSize=12', { signal }), [locale]);
  const feedPath = locale === 'de' ? '/feed.xml?lang=de' : '/feed.xml';
  const feedUrl = `${window.location.origin}${feedPath}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address stays visible to copy by hand */
    }
  };

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">RSS</div>
        <h1>{t('rss.title')}</h1>
        <p>{t('rss.intro')}</p>
      </header>

      <section className="panel">
        <p>{t('rss.address')}</p>
        <div className="btn-row">
          <code className="mono" data-testid="feed-address">
            {feedUrl}
          </code>
          <button type="button" className="btn btn--small" onClick={copy}>
            {copied ? t('rss.copied') : t('rss.copy')}
          </button>
          <a className="btn btn--small btn--ghost" href={feedPath}>
            {t('rss.raw')}
          </a>
        </div>
      </section>

      <CaseOfTheDay variant="spotlight" />

      <section className="section">
        <div className="section-title">
          <h2>{t('rss.latest')}</h2>
        </div>
        <LoadState loading={latest.loading} error={latest.error} onRetry={latest.reload} />
        {latest.data && (
          <div className="grid grid--cards">
            {latest.data.items.map((th) => (
              <TheoryCard key={th.id} theory={th} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
