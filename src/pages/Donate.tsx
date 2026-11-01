import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { useT } from '../i18n';
import { DONATION_WALLETS } from '../../shared/donate';

/** QR code as an SVG path, built from the module matrix (no HTML strings). */
function QrCode({ value, label }: { value: string; label: string }) {
  const { d, size } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const m = 4; // quiet zone
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + m} ${r + m}h1v1h-1z`;
    return { d: path, size: n + 2 * m };
  }, [value]);
  return (
    <svg className="donate-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

function CopyButton({ value }: { value: string }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2500);
  };
  return (
    <button type="button" className="btn btn--primary" onClick={copy} aria-live="polite">
      {state === 'copied' ? `✓ ${t('donate.copied')}` : state === 'failed' ? t('donate.copyFailed') : t('donate.copy')}
    </button>
  );
}

export default function DonatePage() {
  const t = useT();
  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.donate')}</div>
        <h1>{t('donate.title')}</h1>
        <p>{t('donate.intro')}</p>
      </header>
      <div className="donate-grid">
        {DONATION_WALLETS.map((w) => (
          <section key={w.id} className="panel donate-card" aria-labelledby={`donate-${w.id}`}>
            <h2 id={`donate-${w.id}`}>
              {w.name} <span className="donate-symbol mono">{w.symbol}</span>
            </h2>
            <div className="muted small">
              {t('donate.network')}: {w.network}
            </div>
            <QrCode value={w.address} label={t('donate.qrLabel', { coin: w.name })} />
            <code className="donate-address mono" data-testid={`donate-address-${w.id}`}>
              {w.address}
            </code>
            <CopyButton value={w.address} />
          </section>
        ))}
      </div>
      <p className="muted small donate-note">{t('donate.note')}</p>
    </div>
  );
}
