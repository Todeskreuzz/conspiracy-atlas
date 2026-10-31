import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { LOCALES } from '../../shared/constants';
import { setApiLocale } from '../api/client';
import { GlobalSearch } from './GlobalSearch';
import { AccountButton, AccountNavLink, AdminNavLink } from './AccountButton';

export type NavItem = { to: string; key: string; /** Extra path prefixes (detail pages) that count as this section. */ match?: readonly string[]; cta?: boolean };
export type NavEntry = NavItem | { group: string; items: readonly NavItem[] };

/**
 * Top navigation. Related sections share a drop-down group so the bar stays readable; a group with a
 * single item renders as a plain tab, so adding a section is one line here plus its i18n key.
 */
export const NAV: readonly NavEntry[] = [
  { to: '/', key: 'nav.home' },
  { to: '/wall', key: 'nav.wall' },
  {
    group: 'archive',
    items: [
      { to: '/archive', key: 'nav.archive', match: ['/theory/'] },
      { to: '/organizations', key: 'nav.organizations', match: ['/people/'] },
      { to: '/events', key: 'nav.events' },
      { to: '/knowledge', key: 'nav.knowledge' },
      { to: '/experts', key: 'nav.experts' },
    ],
  },
  {
    group: 'explore',
    items: [
      { to: '/timeline', key: 'nav.timeline' },
      { to: '/map', key: 'nav.map' },
    ],
  },
  {
    group: 'casework',
    items: [
      { to: '/investigations', key: 'nav.investigations' },
      { to: '/saved', key: 'nav.saved' },
    ],
  },
  { group: 'community', items: [{ to: '/community', key: 'nav.community' }] },
  { to: '/about', key: 'nav.about' },
  { to: '/submit', key: 'nav.submit', cta: true },
];

const isGroup = (e: NavEntry): e is { group: string; items: readonly NavItem[] } => 'group' in e;

/** Flat list of all nav targets as [path, i18n key]. */
export const NAV_ITEMS: readonly (readonly [string, string])[] = NAV.flatMap((e) => (isGroup(e) ? e.items : [e])).map((i) => [i.to, i.key] as const);

function matches(item: NavItem, pathname: string) {
  if (item.to === '/') return pathname === '/';
  return pathname === item.to || pathname.startsWith(`${item.to}/`) || (item.match ?? []).some((m) => pathname.startsWith(m));
}

function NavTab({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const { t } = useI18n();
  const active = matches(item, pathname);
  return (
    <NavLink to={item.to} end={item.to === '/'} viewTransition onClick={onNavigate} className={`nav-tab${active ? ' active' : ''}${item.cta ? ' nav-submit' : ''}`}>
      {t(item.key)}
    </NavLink>
  );
}

function NavGroup({ id, items, pathname, open, onToggle, onClose }: { id: string; items: readonly NavItem[]; pathname: string; open: boolean; onToggle: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const active = items.some((i) => matches(i, pathname));
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose]);
  const menuId = `nav-group-${id}`;
  return (
    <div
      ref={ref}
      className={`nav-group${open ? ' open' : ''}${active ? ' active' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          onClose();
          ref.current?.querySelector('button')?.focus();
        }
      }}
    >
      <button type="button" className={`nav-tab nav-group__toggle${active ? ' active' : ''}`} aria-expanded={open} aria-controls={menuId} onClick={onToggle}>
        {t(`navGroup.${id}`)}
        <svg className="nav-group__caret" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={menuId} className="nav-group__menu">
        {items.map((item) => (
          <NavTab key={item.to} item={item} pathname={pathname} onNavigate={onClose} />
        ))}
      </div>
    </div>
  );
}

function MainNav({ open }: { open: boolean }) {
  const { pathname } = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const close = useCallback(() => setOpenGroup(null), []);
  useEffect(close, [pathname, close]);
  return (
    <nav id="main-nav" className={`main-nav${open ? ' open' : ''}`} aria-label="Main">
      {NAV.map((entry) =>
        isGroup(entry) ? (
          entry.items.length === 1 ? (
            <NavTab key={entry.group} item={entry.items[0]} pathname={pathname} />
          ) : (
            <NavGroup key={entry.group} id={entry.group} items={entry.items} pathname={pathname} open={openGroup === entry.group} onToggle={() => setOpenGroup((g) => (g === entry.group ? null : entry.group))} onClose={close} />
          )
        ) : (
          <NavTab key={entry.to} item={entry} pathname={pathname} />
        ),
      )}
      <AdminNavLink />
      <AccountNavLink />
    </nav>
  );
}

/** Sections whose page header carries a stamp (text in i18n under tabStamp). */
export const TAB_STAMPS = ['archive', 'events', 'organizations', 'saved', 'investigations', 'community', 'knowledge', 'experts', 'about', 'submit'] as const;

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
  // Each section has its own character (src/styles/tabs.css): a header treatment, a stamp and a lamp colour.
  const tab = location.pathname.split('/')[1] || 'home';
  const stamp = (TAB_STAMPS as readonly string[]).includes(tab) ? t(`tabStamp.${tab}`) : '';
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
          <MainNav open={open} />
          <div className="header-tools">
            <GlobalSearch />
            <LanguageSwitch />
            <AccountButton />
            <button type="button" className="btn btn--ghost btn--small menu-toggle" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((o) => !o)}>
              {t('app.menu')}
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} data-tab={tab} style={stamp ? ({ '--stamp': JSON.stringify(stamp) } as React.CSSProperties) : undefined}>
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
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
