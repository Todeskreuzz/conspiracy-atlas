import { Link } from 'react-router-dom';
import type { TheorySummary } from '../../shared/types';
import { CategoryBadge } from './Badges';
import { useT } from '../i18n';
import { CaseCover } from './CaseCover';

export function TheoryCard({ theory }: { theory: TheorySummary }) {
  const t = useT();
  return (
    <Link to={`/theory/${theory.slug}`} className="case-card" data-testid="theory-card" viewTransition>
      <span className="pin" aria-hidden="true" />
      <div className="case-card__img">
        {theory.imagePath ? <img src={theory.imagePath} alt="" loading="lazy" /> : <CaseCover id={theory.id} title={theory.title} category={theory.category} />}
      </div>
      <div className="case-card__body">
        <div className="case-card__title">{theory.title}</div>
        {theory.subtitle && <div className="case-card__subtitle">{theory.subtitle}</div>}
        <div className="case-card__summary">{theory.summary}</div>
        <div className="case-card__meta">
          <CategoryBadge category={theory.category} />
          {theory.origin === 'community' && <span className="tag">{t('archive.by', { name: theory.authorName ?? 'Anonymous' })}</span>}
        </div>
      </div>
    </Link>
  );
}

export function Pagination({ page, hasMore, onPage }: { page: number; hasMore: boolean; onPage: (p: number) => void }) {
  const t = useT();
  if (page === 1 && !hasMore) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn--small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← {t('app.previous')}
      </button>
      <span className="muted small">{t('app.page', { page })}</span>
      <button className="btn btn--small" disabled={!hasMore} onClick={() => onPage(page + 1)}>
        {t('app.next')} →
      </button>
    </nav>
  );
}
