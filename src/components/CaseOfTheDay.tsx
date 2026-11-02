import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { TheorySummary } from '../../shared/types';
import { CategoryBadge } from './Badges';

/** "home": the start page block with its heading. "spotlight": the large feature on the RSS page. */
export function CaseOfTheDay({ variant = 'home' }: { variant?: 'home' | 'spotlight' }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const res = useAsync((signal) => api<{ day: string; theory: TheorySummary | null }>('/case-of-the-day', { signal }), [locale]);
  const [busy, setBusy] = useState(false);
  const theory = res.data?.theory;
  if (!theory) return null;
  const random = async () => {
    setBusy(true);
    try {
      const r = await api<{ slug: string }>('/random-case');
      navigate(`/theory/${r.slug}`);
    } catch {
      setBusy(false);
    }
  };
  const day = new Date(`${res.data!.day}T00:00:00Z`).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const spotlight = variant === 'spotlight';
  const article = (
    <article className={`case-of-day paper${spotlight ? ' case-of-day--spotlight' : ''}`}>
      <span className="pin" aria-hidden="true" />
      <div className="case-of-day__img">
        <img src={theory.imagePath ?? '/media/cards/theory.svg'} alt="" loading="lazy" />
      </div>
      <div className="case-of-day__body">
        {spotlight && (
          <div className="case-of-day__day mono small">
            {t('home.caseOfTheDay')} · {day}
          </div>
        )}
        <h3>{theory.title}</h3>
        {theory.subtitle && <p className="muted">{theory.subtitle}</p>}
        <p>{theory.summary}</p>
        <div className="btn-row">
          <CategoryBadge category={theory.category} />
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <Link to={`/theory/${theory.slug}`} className="btn btn--primary" viewTransition>
            {t('home.openCase')} →
          </Link>
          <button type="button" className="btn" onClick={random} disabled={busy}>
            🎲 {t('home.randomCase')}
          </button>
        </div>
      </div>
    </article>
  );
  if (spotlight) return <section className="section container" data-testid="case-of-the-day-spotlight">{article}</section>;
  return (
    <section className="section container" data-testid="case-of-the-day">
      <div className="section-title">
        <h2>{t('home.caseOfTheDay')}</h2>
        <span className="mono muted small">
          {day} ·{' '}
          <a href={locale === 'de' ? '/rss-page?lang=de' : '/rss-page'} title={t('app.rssTitle')} data-testid="rss-link">
            {t('app.rss')}
          </a>
        </span>
      </div>
      {article}
    </section>
  );
}
