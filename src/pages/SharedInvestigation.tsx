import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { ApiFailure, api } from '../api/client';
import type { SharedInvestigation as SharedInvestigationData } from '../../shared/types';
import { LoadState } from '../components/Unavailable';
import { InvestigationWall } from '../wall/InvestigationWall';

/** Read-only view of the board portion of an explicitly shared investigation. */
export default function SharedInvestigationPage() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const result = useAsync((signal) => api<SharedInvestigationData>(`/shared-investigations/${encodeURIComponent(token)}`, { signal }), [token]);

  if (!result.data) {
    return (
      <div className="container page">
        {result.error instanceof ApiFailure && result.error.status === 404 ? (
          <div className="notice">{t('investigations.sharedNotFound')}</div>
        ) : (
          <LoadState loading={result.loading} error={result.error} onRetry={result.reload} />
        )}
        <Link to="/">{t('nav.home')}</Link>
      </div>
    );
  }

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('investigations.sharedLabel')}</div>
        <h1>{result.data.title}</h1>
        {result.data.description && <p>{result.data.description}</p>}
        <p className="small muted">{t('investigations.sharedNotice')}</p>
      </header>
      <div style={{ border: '1px solid var(--ink-700)', borderRadius: 6, overflow: 'hidden' }}>
        <InvestigationWall board={result.data.board} editor={null} localLayout={false} height="75vh" />
      </div>
    </div>
  );
}
