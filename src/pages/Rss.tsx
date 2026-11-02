import { useState } from 'react';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Paged, TheorySummary } from '../../shared/types';
import { TheoryCard } from '../components/TheoryCard';
import { LoadState } from '../components/Unavailable';
import { CaseOfTheDay } from '../components/CaseOfTheDay';
import { localePath } from '../../shared/localePath';

/** Readable page for the RSS feed: the case of the day as the highlight, then the newest case files with their images. */
export default function RssPage() {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const latest = useAsync((signal) => api<Paged<TheorySummary>>('/theories?pageSize=12', { signal }), [locale]);
  const feedPath = locale === 'de' ? '/feed.xml?lang=de' : '/feed.xml';
  const feedUrl = `${window.location.origin}${feedPath}`;

  const [embedCopied, setEmbedCopied] = useState(false);
  const embedSrc = `${window.location.origin}${localePath(locale, '/embed/case-of-the-day')}`;
  const embedCode = `<iframe src="${embedSrc}" width="100%" height="420" style="border:0;max-width:640px" loading="lazy" title="The Conspiracy Atlas – Case of the day"></iframe>`;

  const copyTo = (text: string, done: (v: boolean) => void) => async () => {
    try {
      await navigator.clipboard.writeText(text);
      done(true);
      setTimeout(() => done(false), 2000);
    } catch {
      /* clipboard blocked: the text stays visible to copy by hand */
    }
  };
  const copy = copyTo(feedUrl, setCopied);
  const copyEmbed = copyTo(embedCode, setEmbedCopied);

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

      <section className="panel">
        <h2>{t('rss.embedTitle')}</h2>
        <p>{t('rss.embedIntro')}</p>
        <code className="mono" data-testid="embed-code">
          {embedCode}
        </code>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn btn--small" onClick={copyEmbed}>
            {embedCopied ? t('rss.copied') : t('rss.embedCopy')}
          </button>
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
