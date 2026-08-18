import { animate } from "motion";
import { useEffect, useRef, useState } from "react";
import { clampFrame, type Frame, frameToViewBox, VIEW } from "./frames";

// Weighty, overdamped: the fan is heavy hardware, so the camera glides in and
// settles without overshoot. Same family as the scroll scrub's spring.
const SPRING = { type: "spring", stiffness: 140, damping: 26, mass: 0.9 } as const;

/**
 * Owns the Fan viewBox as animated state. Springs from the current frame to
 * `target` (clamped into VIEW); `reduceMotion` cuts instantly. Returns a plain
 * viewBox string so the SVG stays a controlled attribute.
 *
 * `initial` is where the camera stands on mount (default: on the target). A
 * deep link mounts with a cell already selected; starting the camera at home and
 * letting it dive to the part shows the reader what the drawing is before the
 * enlargement of one corner of it. Reduced motion still cuts to the target.
 */
export function useCamera(target: Frame, reduceMotion: boolean, initial: Frame = target): string {
  const { x, y, w, h } = clampFrame(target, VIEW);
  const start = reduceMotion ? { x, y, w, h } : clampFrame(initial, VIEW);
  const current = useRef<Frame>(start);
  const [frame, setFrame] = useState<Frame>(start);

  useEffect(() => {
    const to = { x, y, w, h };
    const from = current.current;
    // already there (every mount, and any dep change that keeps the target):
    // don't burn a spring of no-op re-renders gliding a camera that isn't moving
    if (from.x === x && from.y === y && from.w === w && from.h === h) return;
    if (reduceMotion) {
      current.current = to;
      setFrame(to);
      return;
    }
    const controls = animate(0, 1, {
      ...SPRING,
      onUpdate: (t: number) => {
        const f = {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
          w: from.w + (to.w - from.w) * t,
          h: from.h + (to.h - from.h) * t,
        };
        current.current = f;
        setFrame(f);
      },
    });
    return () => controls.stop();
  }, [x, y, w, h, reduceMotion]);

  return frameToViewBox(frame);
}
