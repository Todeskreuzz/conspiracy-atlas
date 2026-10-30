import { useStatus } from '../api/status';
import { useI18n } from '../i18n';
import { FEATURE_KEYS } from '../../shared/availability';
import { Unavailable } from '../components/Unavailable';

export function AboutPage() {
  const { t } = useI18n();
  const { features, loaded } = useStatus();
  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.about')}</div>
        <h1>{t('about.title')}</h1>
      </header>
      <div className="grid grid--2">
        <div>
          <p>{t('about.text1')}</p>
          <p>{t('about.text2')}</p>
          <h2>{t('about.costTitle')}</h2>
          <p className="muted">{t('about.costText')}</p>
          <h2>{t('about.privacyTitle')}</h2>
          <p className="muted">{t('about.privacyText')}</p>
          <h2>{t('about.licensesTitle')}</h2>
          <p className="muted">{t('about.licensesText')}</p>
        </div>
        <div className="panel">
          <h2>{t('about.status')}</h2>
          {!loaded && <p className="muted loading">{t('app.loading')}</p>}
          <ul className="list-plain" data-testid="feature-status">
            {FEATURE_KEYS.map((k) => (
              <li key={k}>
                <div className="mono small">{k}</div>
                {features[k].available ? (
                  <span style={{ color: 'var(--green)' }}>● OK</span>
                ) : (
                  <Unavailable feature={k} state={features[k].state} explanation={features[k].message?.replace('Currently unavailable! ', '')} compact />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
