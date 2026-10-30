import { UNAVAILABLE_MESSAGE, explainDe, explainEn, type FeatureKey, type ServiceState } from '../../shared/availability';
import { useI18n } from '../i18n';
import { ApiFailure } from '../api/client';

interface Props {
  feature?: FeatureKey | null;
  state?: ServiceState;
  /** Overrides the English explanation. */
  explanation?: string;
  compact?: boolean;
  onRetry?: () => void;
}

/**
 * The single, fixed availability notice. The English status text "Currently unavailable!"
 * is always shown verbatim; in the German UI a German explanation is added below it.
 */
export function Unavailable({ feature = null, state = 'not_configured', explanation, compact, onRetry }: Props) {
  const { locale, t } = useI18n();
  const en = explanation ?? explainEn(feature, state);
  const de = locale === 'de' ? explainDe(feature, state) : null;
  return (
    <div className={`unavailable${compact ? ' unavailable--compact' : ''}`} role="status" data-testid="unavailable" data-state={state}>
      <strong className="unavailable__title">{UNAVAILABLE_MESSAGE}</strong>
      {en && <span className="unavailable__text"> {en}</span>}
      {de && (
        <p className="unavailable__de" lang="de">
          {de}
        </p>
      )}
      {!compact && <span className="unavailable__state">{t(`unavailable.states.${state}`)}</span>}
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--small" onClick={onRetry}>
          {t('app.retry')}
        </button>
      )}
    </div>
  );
}

/** Renders a loading/error state for API-driven sections. */
export function LoadState({ loading, error, onRetry }: { loading: boolean; error: Error | null; onRetry?: () => void }) {
  const { t } = useI18n();
  if (loading) return <p className="muted loading" aria-busy="true">{t('app.loading')}</p>;
  if (error instanceof ApiFailure && error.status === 404) return <p className="muted">{t('app.notFoundText')}</p>;
  if (error instanceof ApiFailure && error.state) {
    return <Unavailable feature="database" state={error.state} onRetry={onRetry} />;
  }
  if (error) return <Unavailable feature={null} state="temporary_error" onRetry={onRetry} />;
  return null;
}
