import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { getInvestigationKey, invApi, isValidKey, setInvestigationKey } from '../api/investigations';
import type { Investigation } from '../../shared/types';
import { LoadState, Unavailable } from '../components/Unavailable';
import { useFeature } from '../api/status';
import { ApiFailure } from '../api/client';

export default function InvestigationsPage() {
  const { t, locale } = useI18n();
  const feature = useFeature('investigations');
  const navigate = useNavigate();
  const [key, setKey] = useState(getInvestigationKey);
  const [showKey, setShowKey] = useState(false);
  const [otherKey, setOtherKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = useAsync((signal) => invApi(key).get<{ items: Investigation[] }>('', signal), [key]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await invApi(key).post<{ id: number }>('', { title, description });
      navigate(`/investigations/${r.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.investigations')}</div>
        <h1>{t('investigations.title')}</h1>
        <p>{t('investigations.intro')}</p>
        <p className="notice">{t('investigations.privacy')}</p>
      </header>
      {feature.loaded && !feature.available ? (
        <Unavailable feature="investigations" state={feature.state} />
      ) : (
        <div className="two-col">
          <aside className="panel">
            <h3>{t('investigations.keyTitle')}</h3>
            <p className="small muted">{t('investigations.keyHelp')}</p>
            {showKey ? (
              <code className="mono small" style={{ wordBreak: 'break-all', display: 'block' }} data-testid="investigation-key">
                {key}
              </code>
            ) : (
              <button className="btn btn--small" onClick={() => setShowKey(true)}>
                {t('investigations.showKey')}
              </button>
            )}
            <details style={{ marginTop: 12 }}>
              <summary className="small">{t('investigations.useKey')}</summary>
              <input type="text" className="mono" value={otherKey} onChange={(e) => setOtherKey(e.target.value.trim().toLowerCase())} maxLength={64} />
              {otherKey && !isValidKey(otherKey) && <span className="error-text small">{t('investigations.keyInvalid')}</span>}
              <button
                className="btn btn--small"
                style={{ marginTop: 6 }}
                disabled={!isValidKey(otherKey)}
                onClick={() => {
                  setInvestigationKey(otherKey);
                  setKey(otherKey);
                  setOtherKey('');
                }}
              >
                {t('app.save')}
              </button>
            </details>
          </aside>
          <div>
            <form className="panel" onSubmit={create} style={{ marginBottom: 20 }}>
              <h3>{t('investigations.new')}</h3>
              <div className="field">
                <label htmlFor="inv-title">{t('investigations.titleField')}</label>
                <input id="inv-title" type="text" required minLength={2} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="inv-desc">{t('investigations.description')}</label>
                <textarea id="inv-desc" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {error && <p className="notice notice--error">{error}</p>}
              <button className="btn btn--primary" disabled={title.trim().length < 2}>
                {t('investigations.create')}
              </button>
            </form>
            {list.error instanceof ApiFailure && list.error.status === 401 ? null : <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />}
            {list.data && list.data.items.length === 0 && <p className="muted">{t('investigations.empty')}</p>}
            <div className="grid grid--2">
              {list.data?.items.map((inv) => (
                <Link key={inv.id} to={`/investigations/${inv.id}`} className="case-card">
                  <span className="pin" aria-hidden="true" />
                  <div className="case-card__body" style={{ paddingTop: 26 }}>
                    <div className="case-card__title">{inv.title}</div>
                    {inv.description && <div className="case-card__summary">{inv.description}</div>}
                    <div className="case-card__meta tag">{formatDate(inv.updatedAt, locale)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
