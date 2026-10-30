import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';

function CrashNotice() {
  const t = useT();
  return (
    <div className="container page" role="alert" data-testid="crash-notice">
      <span className="stamp" style={{ color: 'var(--red-bright)' }}>
        {t('app.error')}
      </span>
      <h1 style={{ marginTop: 20 }}>{t('app.crashTitle')}</h1>
      <p className="muted">{t('app.crashText')}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          {t('app.reload')}
        </button>
        <Link to="/" className="btn btn--ghost">
          {t('nav.home')}
        </Link>
      </div>
    </div>
  );
}

/**
 * Keeps a crash inside one page: header and navigation stay usable instead of the whole app unmounting.
 * Give it the pathname as `key` so that navigating elsewhere starts with a fresh boundary.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  render() {
    return this.state.failed ? <CrashNotice /> : this.props.children;
  }
}
