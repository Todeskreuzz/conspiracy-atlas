import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, ApiFailure } from '../api/client';
import { applySession, useAccount } from '../api/account';
import { useFeature } from '../api/status';
import { Unavailable } from '../components/Unavailable';
import { TurnstileWidget } from '../components/Turnstile';
import { PASSWORD_MIN } from '../../shared/profile';
import type { AccountUser } from '../../shared/profile';

type Mode = 'login' | 'register' | 'recover';
interface SessionReply {
  authenticated: boolean;
  available: boolean;
  user: AccountUser;
  csrfToken: string;
  recoveryCode?: string;
}

/** Shows a new recovery code once; the visitor confirms that they stored it. */
export function RecoveryCodeNotice({ code, onDone }: { code: string; onDone: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="paper recovery-code" data-testid="recovery-code">
      <h2>{t('account.recovery.title')}</h2>
      <p>{t('account.recovery.text')}</p>
      <code className="recovery-code__value">{code}</code>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => setCopied(false));
          }}
        >
          {copied ? t('account.recovery.copied') : t('account.recovery.copy')}
        </button>
        <button type="button" className="btn btn--primary" onClick={onDone}>
          {t('account.recovery.done')}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  const feature = useFeature('accounts');
  const account = useAccount();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  const after = params.get('next')?.startsWith('/') ? params.get('next')! : null;
  const finish = (user: AccountUser) => navigate(after ?? (mode === 'register' ? '/account' : `/u/${user.username}`));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode !== 'login' && password !== password2) {
      setError(t('account.errors.mismatch'));
      return;
    }
    setBusy(true);
    try {
      const path = mode === 'login' ? '/account/login' : mode === 'register' ? '/account/register' : '/account/recover';
      const body =
        mode === 'login'
          ? { username, password }
          : mode === 'register'
            ? { username, password, displayName: displayName || undefined, turnstileToken: token }
            : { username, recoveryCode: code, newPassword: password, turnstileToken: token };
      const r = await api<SessionReply>(path, { method: 'POST', body, localized: false });
      applySession(r);
      if (r.recoveryCode) setNewCode(r.recoveryCode);
      else finish(r.user);
    } catch (err) {
      const f = err instanceof ApiFailure ? err : null;
      setError(
        f?.code === 'invalid_credentials'
          ? t('account.errors.credentials')
          : f?.code === 'username_taken'
            ? t('account.errors.taken')
            : f?.code === 'invalid_recovery'
              ? t('account.errors.recovery')
              : f?.code === 'account_locked'
                ? t('account.errors.locked')
                : (err as Error).message,
      );
      setResetKey((k) => k + 1);
      setToken(null);
    } finally {
      setBusy(false);
    }
  };

  if (newCode && account.user) {
    return (
      <div className="container page page--narrow">
        <RecoveryCodeNotice code={newCode} onDone={() => finish(account.user!)} />
      </div>
    );
  }

  const needsTurnstile = mode !== 'login';
  return (
    <div className="container page page--narrow">
      <header className="page-header">
        <div className="kicker">{t('account.kicker')}</div>
        <h1>{t(`account.${mode}.title`)}</h1>
        <p>{t(`account.${mode}.intro`)}</p>
      </header>
      {feature.loaded && !feature.available ? (
        <Unavailable feature="accounts" state={feature.state} />
      ) : account.user && !busy ? (
        <p className="notice">
          {t('account.alreadySignedIn', { name: account.user.displayName })} <Link to={`/u/${account.user.username}`}>{t('account.myProfile')} →</Link>
        </p>
      ) : (
        <form className="paper auth-form" onSubmit={submit} data-testid="auth-form">
          <div className="tabs" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
                {t(`account.${m}.tab`)}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="acc-user">{t('account.fields.username')}</label>
            <input id="acc-user" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} required />
            {mode === 'register' && <span className="help">{t('account.fields.usernameHelp')}</span>}
          </div>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="acc-name">{t('account.fields.displayName')}</label>
              <input id="acc-name" type="text" autoComplete="nickname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
            </div>
          )}
          {mode === 'recover' && (
            <div className="field">
              <label htmlFor="acc-code">{t('account.fields.recoveryCode')}</label>
              <input id="acc-code" type="text" className="mono" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} required />
            </div>
          )}
          <div className="field">
            <label htmlFor="acc-pass">{mode === 'recover' ? t('account.fields.newPassword') : t('account.fields.password')}</label>
            <input
              id="acc-pass"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === 'login' ? undefined : PASSWORD_MIN}
              maxLength={200}
              required
            />
            {mode !== 'login' && <span className="help">{t('account.fields.passwordHelp', { min: PASSWORD_MIN })}</span>}
          </div>
          {mode !== 'login' && (
            <div className="field">
              <label htmlFor="acc-pass2">{t('account.fields.repeatPassword')}</label>
              <input id="acc-pass2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} maxLength={200} required />
            </div>
          )}
          {needsTurnstile && <TurnstileWidget onToken={setToken} resetKey={resetKey} />}
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          <div className="btn-row">
            <button type="submit" className="btn btn--primary" disabled={busy || (needsTurnstile && !token)}>
              {busy ? t('app.loading') : t(`account.${mode}.submit`)}
            </button>
            {mode === 'login' ? (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setMode('recover')}>
                {t('account.login.forgot')}
              </button>
            ) : mode === 'recover' ? (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setMode('login')}>
                {t('account.recover.back')}
              </button>
            ) : null}
          </div>
          {mode === 'register' && <p className="small muted">{t('account.register.privacy')}</p>}
        </form>
      )}
    </div>
  );
}
