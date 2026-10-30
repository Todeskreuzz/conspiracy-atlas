import { Link } from 'react-router-dom';
import { useT } from '../i18n';

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="container page">
      <span className="stamp" style={{ color: 'var(--red-bright)' }}>
        404
      </span>
      <h1 style={{ marginTop: 20 }}>{t('app.notFound')}</h1>
      <p className="muted">{t('app.notFoundText')}</p>
      <Link to="/" className="btn">
        {t('nav.home')}
      </Link>
    </div>
  );
}
