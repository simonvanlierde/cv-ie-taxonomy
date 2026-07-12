import { useScroll, useSpring } from "motion/react";
import { type RefObject, useEffect, useState } from "react";

// Weighty, overdamped spring: the fan is heavy hardware being taken apart, so
// parts glide and settle — no cartoon overshoot. This is the feel knob.
// NOTE: tune stiffness/damping/mass here if the scrub feels off.
const SPRING = { stiffness: 120, damping: 25, mass: 0.7 } as const;

/**
 * Scroll progress (0..1) of a tall container, spring-smoothed for a scrubbed,
 * weighty feel. `smooth: false` (reduced motion) maps 1:1.
 *
 * Returns a plain number so the SVG coordinate math in Fan stays unchanged.
 * NOTE: per-frame React re-render is retained (same as before). If a
 * profiler shows scrub jank, drive Fan's transforms off the MotionValue
 * directly (useTransform + motion.g) to skip the re-render — not before.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  smooth: boolean,
  active = true,
): number {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const smoothed = useSpring(scrollYProgress, SPRING);
  const source = smooth ? smoothed : scrollYProgress;

  const [p, setP] = useState(0);
  useEffect(() => {
    // When the scroll narrative isn't rendered (mobile stepper), don't subscribe:
    // the target ref is null so `source` would track the window and re-render on
    // every page scroll, driving a fan nobody sees.
    if (!active) return;
    setP(source.get());
    return source.on("change", setP);
  }, [source, active]);

  return active ? p : 0;
}
