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
 */
export function useCamera(target: Frame, reduceMotion: boolean): string {
  const { x, y, w, h } = clampFrame(target, VIEW);
  const current = useRef<Frame>({ x, y, w, h });
  const [frame, setFrame] = useState<Frame>({ x, y, w, h });

  useEffect(() => {
    const to = { x, y, w, h };
    if (reduceMotion) {
      current.current = to;
      setFrame(to);
      return;
    }
    const from = current.current;
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
