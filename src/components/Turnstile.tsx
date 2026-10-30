import { useEffect, useRef } from 'react';
import { useStatus } from '../api/status';
import { Unavailable } from './Unavailable';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

// Cloudflare Turnstile (free plan). This is the only external script of the application and it is
// loaded only when Turnstile is enabled and configured; otherwise the form shows "Currently unavailable!".
export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const { features, turnstileSiteKey } = useStatus();
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const available = features.turnstile.available && !!turnstileSiteKey;

  useEffect(() => {
    if (!available || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: turnstileSiteKey,
          theme: 'dark',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, turnstileSiteKey, resetKey]);

  if (!available) return <Unavailable feature="turnstile" state={features.turnstile.state === 'available' ? 'not_configured' : features.turnstile.state} compact />;
  return <div ref={ref} data-testid="turnstile" />;
}
