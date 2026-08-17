import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useScrollProgress } from "./useScrollProgress";

// record what motion is asked to observe; the spring is a pass-through here
const targets: ({ current: HTMLElement | null } | undefined)[] = [];
vi.mock("motion/react", () => ({
  useScroll: ({ target }: { target?: { current: HTMLElement | null } }) => {
    targets.push(target);
    return { scrollYProgress: { get: () => 0, on: () => () => {} } };
  },
  useSpring: (v: unknown) => v,
}));

describe("useScrollProgress", () => {
  // the desktop narrative isn't rendered on mobile, so the ref is null on a
  // mobile-first mount; motion caches its attachment on the target's identity
  // and would otherwise never observe the container that appears on the way back
  it("re-targets motion when the narrative comes back across the breakpoint", () => {
    targets.length = 0;
    const ref = createRef<HTMLElement>();
    const { rerender } = renderHook(({ active }) => useScrollProgress(ref, false, active), {
      initialProps: { active: false },
    });

    // nothing to observe while the stepper is on stage
    expect(targets.at(-1)).toBeUndefined();

    ref.current = document.createElement("div");
    rerender({ active: true });

    expect(targets.at(-1)?.current).toBe(ref.current);
  });
});
