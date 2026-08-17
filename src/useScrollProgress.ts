import { useScroll, useSpring } from "motion/react";
import { type RefObject, useEffect, useMemo, useState } from "react";

// Weighty, overdamped spring: the fan is heavy hardware being taken apart, so
// parts glide and settle — no cartoon overshoot. This is the feel knob.
// NOTE: tune stiffness/damping/mass here if the scrub feels off.
const SPRING = { stiffness: 120, damping: 25, mass: 0.7 } as const;

/**
 * Scroll progress (0..1) of a tall container, spring-smoothed for a scrubbed,
 * weighty feel. `smooth: false` (reduced motion) maps 1:1.
 *
 * Returns a plain number, so the SVG coordinate math in Fan stays plain math.
 * NOTE: that costs one React re-render per scroll frame. If a profiler shows
 * scrub jank, drive Fan's transforms off the MotionValue directly
 * (useTransform + motion.g) to skip the re-render — not before.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  smooth: boolean,
  active = true,
): number {
  // motion memoizes its scroll attachment on the target ref's *identity*. The
  // narrative container isn't rendered on mobile, so on a mobile-first mount the
  // ref is null and motion parks; crossing the breakpoint back to desktop mounts
  // the container but leaves the identity unchanged, so motion never re-attaches
  // and progress stays pinned at 0 while the page scrolls under it. Handing it a
  // fresh forwarding ref per layout mode makes it re-attach. While the narrative
  // is unrendered we hand over no target at all: a ref pointing at nothing is an
  // error to motion, and the subscription below is gated anyway.
  const target = useMemo(
    () =>
      active
        ? {
            get current() {
              return ref.current;
            },
          }
        : undefined,
    [ref, active],
  );
  const { scrollYProgress } = useScroll({
    target,
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
