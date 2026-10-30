import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { LOCALES } from '../../shared/constants';
import { setApiLocale } from '../api/client';

export const NAV_ITEMS = [
  ['/', 'nav.home'],
  ['/wall', 'nav.wall'],
  ['/archive', 'nav.archive'],
  ['/organizations', 'nav.organizations'],
  ['/events', 'nav.events'],
  ['/timeline', 'nav.timeline'],
  ['/map', 'nav.map'],
  ['/investigations', 'nav.investigations'],
  ['/community', 'nav.community'],
  ['/submit', 'nav.submit'],
  ['/knowledge', 'nav.knowledge'],
  ['/about', 'nav.about'],
] as const;

export function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="12" fill="#1b1714" />
      <path d="M14 46L50 18M14 46L46 48" stroke="#b3261e" strokeWidth="2.5" />
      <circle cx="14" cy="46" r="6.5" fill="#c9372c" />
      <circle cx="50" cy="18" r="6.5" fill="#c9372c" />
      <circle cx="46" cy="48" r="5" fill="#c9372c" />
    </svg>
  );
}

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('app.language')}>
      {LOCALES.map((l) => (
        <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)} lang={l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  setApiLocale(locale);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  const fullBleed = location.pathname === '/wall';
  return (
    <>
      <a href="#main" className="skip-link">
        {t('app.skip')}
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand" aria-label={t('app.name')} viewTransition>
            <BrandMark />
            <span className="brand__name">
              The Conspiracy <span>Atlas</span>
            </span>
          </Link>
          <nav className={`main-nav${open ? ' open' : ''}`} aria-label="Main">
            {NAV_ITEMS.map(([to, key]) => (
              <NavLink key={to} to={to} end={to === '/'} viewTransition className={({ isActive }) => `${isActive ? 'active' : ''}${to === '/submit' ? ' nav-submit' : ''}`}>
                {t(key)}
              </NavLink>
            ))}
          </nav>
          <div className="header-tools">
            <LanguageSwitch />
            <button type="button" className="btn btn--ghost btn--small menu-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {t('app.menu')}
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      {!fullBleed && (
        <footer className="site-footer">
          <div className="container">
            <div>
              <strong className="typewriter">{t('app.name')}</strong>
              <div>{t('app.tagline')}</div>
            </div>
            <div>{t('app.freeOnly')}</div>
            <div className="btn-row">
              <Link to="/knowledge">{t('nav.knowledge')}</Link>
              <Link to="/about">{t('nav.about')}</Link>
              <Link to="/admin">{t('nav.admin')}</Link>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
