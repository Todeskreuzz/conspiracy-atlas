import { useState } from 'react';
import { useT } from '../i18n';

/** Shares a page with the device's share sheet, or copies the link where that is not available. */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t('share.copyPrompt'), url);
    }
  };
  return (
    <button type="button" className="btn btn--small" onClick={share}>
      {copied ? `✓ ${t('share.copied')}` : `↗ ${t('share.share')}`}
    </button>
  );
}
