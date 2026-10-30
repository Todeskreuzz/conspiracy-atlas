// Pointer effects for the board theme: the desk lamp follows the pointer and case cards tilt towards it.
// One delegated listener, CSS variables only; skipped for touch devices and reduced motion.
export function installEffects() {
  if (typeof window === 'undefined') return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || calm) return;

  const root = document.documentElement;
  let card: HTMLElement | null = null;
  let frame = 0;
  let last: PointerEvent | null = null;

  const apply = () => {
    frame = 0;
    const e = last!;
    root.style.setProperty('--lamp-x', `${e.clientX}px`);
    root.style.setProperty('--lamp-y', `${e.clientY}px`);
    const hit = (e.target as Element | null)?.closest?.<HTMLElement>('.case-card') ?? null;
    if (card && card !== hit) resetCard(card);
    card = hit;
    if (card) {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
    }
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => card && resetCard(card));
}

function resetCard(el: HTMLElement) {
  el.style.removeProperty('--rx');
  el.style.removeProperty('--ry');
}

/**
 * Scroll reveals (CSS animation-timeline: view()) only start once the tab is visible. A tab opened
 * in the background otherwise keeps a stale view timeline and its cards and panels stay invisible
 * until the page is reloaded.
 */
export function armScrollReveal() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const arm = () => requestAnimationFrame(() => root.classList.add('reveal-ready'));
  if (document.visibilityState === 'visible') {
    arm();
    return;
  }
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', onVisible);
    arm();
  };
  document.addEventListener('visibilitychange', onVisible);
}
