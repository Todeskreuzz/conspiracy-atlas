// Pointer effects for the board theme: the desk lamp follows the pointer and case cards tilt towards it.
// One delegated listener, CSS variables only; skipped for touch devices and reduced motion.
export function installEffects() {
  if (typeof window === 'undefined') return;
  markReadyWhenVisible();
  reloadOnStaleChunks();
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

// Entrance animations are scoped to html.is-ready (board.css): set it on the first frame of a visible tab.
function markReadyWhenVisible() {
  const ready = () => requestAnimationFrame(() => document.documentElement.classList.add('is-ready'));
  if (document.visibilityState === 'visible') return ready();
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', onVisible);
    ready();
  };
  document.addEventListener('visibilitychange', onVisible);
}

// After a redeploy an open tab may ask for route chunks that no longer exist; Vite then fires
// vite:preloadError. Reload once to pick up the new build (guarded so it can never loop).
function reloadOnStaleChunks() {
  window.addEventListener('vite:preloadError', (e) => {
    try {
      const last = Number(sessionStorage.getItem('ca.chunkReload') || 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem('ca.chunkReload', String(Date.now()));
    } catch {
      return;
    }
    e.preventDefault();
    window.location.reload();
  });
}
