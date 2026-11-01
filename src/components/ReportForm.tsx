import { useState } from 'react';
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from '../../shared/constants';
import { useFeature } from '../api/status';
import { api, ApiFailure } from '../api/client';
import { useT } from '../i18n';
import { TurnstileWidget } from './Turnstile';
import { Unavailable } from './Unavailable';

/** Report button with its form. `compact` is the small variant under comments, notes and profiles. */
export function ReportForm({ targetType, targetId, compact = false }: { targetType: ReportTargetType; targetId: number; compact?: boolean }) {
  const t = useT();
  const feature = useFeature('reports');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(compact ? 'spam' : 'missing_source');
  const [details, setDetails] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<ApiFailure | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className={compact ? 'report-link' : 'btn btn--ghost btn--small'}
        onClick={() => setOpen(true)}
        aria-label={compact ? t('report.titleFor', { what: t(`report.targets.${targetType}`) }) : undefined}
      >
        ⚑ {compact ? t('report.short') : t('theory.report')}
      </button>
    );
  }
  if (!feature.available) return <Unavailable feature="reports" state={feature.state} explanation={feature.message?.replace('Currently unavailable! ', '')} compact />;
  if (state === 'sent') return <p className={`notice notice--ok${compact ? ' small' : ''}`}>{t('report.sent')}</p>;

  const send = async () => {
    setState('sending');
    setError(null);
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details, turnstileToken: token }, localized: false });
      setState('sent');
    } catch (e) {
      setError(e instanceof ApiFailure ? e : null);
      setState('idle');
    }
  };

  return (
    <div className={`panel${compact ? ' report-form--compact' : ''}`} style={{ marginTop: 10 }}>
      <h4>{targetType === 'theory' ? t('report.title') : t('report.titleFor', { what: t(`report.targets.${targetType}`) })}</h4>
      <div className="field">
        <label htmlFor={`report-reason-${targetType}-${targetId}`}>{t('report.reason')}</label>
        <select id={`report-reason-${targetType}-${targetId}`} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`report.reasons.${r}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`report-details-${targetType}-${targetId}`}>{t('report.details')}</label>
        <textarea id={`report-details-${targetType}-${targetId}`} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <TurnstileWidget onToken={setToken} />
      {error && (error.unavailable ? <Unavailable state={error.state!} feature="reports" /> : <p className="notice notice--error">{error.message}</p>)}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn btn--primary btn--small" disabled={state === 'sending' || !token} onClick={send}>
          {t('report.send')}
        </button>
        <button className="btn btn--ghost btn--small" onClick={() => setOpen(false)}>
          {t('app.cancel')}
        </button>
      </div>
    </div>
  );
}
