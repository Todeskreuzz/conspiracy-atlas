import type { Source, EvidenceLink } from '../../shared/types';
import { formatDate, useI18n } from '../i18n';

export function SourceItem({ source, relation, note }: { source: Source; relation?: EvidenceLink['relation']; note?: string | null }) {
  const { t, locale } = useI18n();
  return (
    <div className="source-item" data-testid="source-item">
      <div>
        {source.url ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}
          </a>
        ) : (
          <span>{source.title}</span>
        )}
        {source.author && <span className="muted"> — {source.author}</span>}
        {(source.publisher || source.publishedDate) && (
          <span className="muted">
            {' '}
            ({[source.publisher, formatDate(source.publishedDate, locale)].filter(Boolean).join(', ')})
          </span>
        )}
      </div>
      <div className="src-meta">
        <span className="badge badge--category">{source.isPrimary ? t('theory.primary') : t('theory.secondary')}</span>
        <span className="badge badge--category">{t(`sourceTypes.${source.sourceType}`)}</span>
        {relation && <span className="badge badge--category">{t(`evidenceRelations.${relation}`)}</span>}
        {source.url && (
          <span className="muted">{source.lastChecked ? t('theory.lastChecked', { date: formatDate(source.lastChecked, locale) }) : t('theory.notChecked')}</span>
        )}
      </div>
      {source.qualityNote && (
        <div className="small muted" style={{ marginTop: 4 }}>
          <strong>{t('theory.quality')}:</strong> {source.qualityNote}
        </div>
      )}
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}
