import { Link, NavLink } from 'react-router-dom';
import { useT } from '../i18n';
import { useAccount } from '../api/account';
import { useFeature } from '../api/status';
import { Avatar } from './ProfileView';

/** Header entry: "Sign in" for visitors, avatar and name (linking to the own profile) when signed in. */
export function AccountButton() {
  const t = useT();
  const account = useAccount();
  const feature = useFeature('accounts');
  if (account.user) {
    return (
      <Link to={`/u/${account.user.username}`} className="account-button" title={t('account.myProfile')} data-testid="account-button">
        <Avatar url={account.user.avatarUrl} name={account.user.displayName} size="small" />
        <span className="account-button__name">{account.user.displayName}</span>
      </Link>
    );
  }
  if (feature.loaded && !feature.available) return null;
  return (
    <Link to="/login" className="btn btn--ghost btn--small account-button" data-testid="account-button" aria-label={t('account.signIn')}>
      <svg className="account-button__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="account-button__label">{t('account.signIn')}</span>
    </Link>
  );
}

/** Entry inside the mobile menu, where the header has no room for the button. */
export function AccountNavLink() {
  const t = useT();
  const account = useAccount();
  const feature = useFeature('accounts');
  if (!account.user && feature.loaded && !feature.available) return null;
  return (
    <Link to={account.user ? `/u/${account.user.username}` : '/login'} className="nav-tab nav-account">
      {account.user ? `${t('account.myProfile')} (${account.user.displayName})` : t('account.signIn')}
    </Link>
  );
}

/** Admin tab in the main navigation; only accounts with admin rights see it. */
export function AdminNavLink() {
  const t = useT();
  const account = useAccount();
  if (!account.user?.isAdmin) return null;
  return (
    <NavLink to="/admin" viewTransition className={({ isActive }) => `nav-tab nav-admin${isActive ? ' active' : ''}`} data-testid="nav-admin">
      {t('nav.admin')}
    </NavLink>
  );
}
