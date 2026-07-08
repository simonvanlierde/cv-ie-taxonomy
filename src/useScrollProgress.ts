import { type RefObject, useEffect, useState } from "react";

/**
 * Scroll progress (0..1) of a tall container, smoothed with a per-frame lerp
 * for a scrubbed, weighty feel. `smooth: false` (reduced motion) maps 1:1.
 * The rAF loop sleeps once converged and wakes on the next scroll/resize.
 */
// NOTE: hand-rolled scrub; swap for motion's useScroll if physics get hairy
export function useScrollProgress(ref: RefObject<HTMLElement | null>, smooth: boolean): number {
  const [p, setP] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let target = 0;
    let current = 0;
    let raf = 0;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight);
      target = Math.min(1, Math.max(0, -r.top / total));
    };
    const tick = () => {
      current += (target - current) * (smooth ? 0.14 : 1);
      if (Math.abs(target - current) < 0.0004) {
        current = target;
        setP(current);
        raf = 0; // converged, sleep until the next kick
        return;
      }
      setP(current);
      raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      measure();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    kick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
    };
  }, [ref, smooth]);

  return p;
}
