import { useEffect, useState } from 'react';

// Counts from 0 up to `target` with an ease-out curve; jumps straight to the value for reduced motion.
export function useCountUp(target: number | undefined, duration = 1200): number | undefined {
  const [value, setValue] = useState(target === undefined ? undefined : 0);
  useEffect(() => {
    if (target === undefined) return setValue(undefined);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setValue(target);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
