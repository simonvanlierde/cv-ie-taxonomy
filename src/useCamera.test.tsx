import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { clampFrame, type Frame, frameToViewBox, VIEW } from "./frames";
import { useCamera } from "./useCamera";

// the spring's onUpdate, kept so a test can drive the animation to its end
const motion = vi.hoisted(() => ({ updates: [] as ((t: number) => void)[] }));

// mock motion's animate to invoke onUpdate with a scalar progress, synchronously
vi.mock("motion", () => ({
  animate: (_from: number, _to: number, opts: { onUpdate: (t: number) => void }) => {
    motion.updates.push(opts.onUpdate);
    opts.onUpdate(0.5);
    return { stop: () => {} };
  },
}));

/** every viewBox the hook has rendered, oldest first */
function record(target: Frame, initial?: Frame): string[] {
  const seen: string[] = [];
  function Probe() {
    seen.push(useCamera(target, false, initial));
    return null;
  }
  render(<Probe />);
  return seen;
}

describe("useCamera", () => {
  it("returns the target viewBox immediately under reduced motion", () => {
    const target = { x: 160, y: 180, w: 340, h: 380 };
    const { result } = renderHook(() => useCamera(target, true));
    expect(result.current).toBe(frameToViewBox(clampFrame(target, VIEW)));
  });

  it("cuts straight to a new target under reduced motion when it changes", () => {
    const { result, rerender } = renderHook(({ f }) => useCamera(f, true), {
      initialProps: { f: VIEW },
    });
    expect(result.current).toBe(frameToViewBox(VIEW));
    const next = { x: 200, y: 360, w: 300, h: 260 };
    rerender({ f: next });
    expect(result.current).toBe(frameToViewBox(clampFrame(next, VIEW)));
  });

  it("keeps the viewBox fully numeric while animating (not reduced motion)", () => {
    function Probe() {
      const vb = useCamera({ x: 160, y: 180, w: 340, h: 380 }, false);
      return <output>{vb}</output>;
    }
    const { container } = render(<Probe />);
    const vb = container.querySelector("output")?.textContent ?? "";
    expect(vb).not.toContain("undefined");
    const nums = vb.split(" ").map(Number);
    expect(nums).toHaveLength(4);
    expect(nums.every((n) => Number.isFinite(n))).toBe(true);
  });

  it("stands on `initial` for the first frame and only then dives to the target", () => {
    motion.updates.length = 0;
    const initial = VIEW;
    const target = { x: 160, y: 180, w: 340, h: 380 };
    const seen = record(target, initial);

    expect(seen[0]).toBe(frameToViewBox(clampFrame(initial, VIEW)));
    expect(seen.at(-1)).not.toBe(frameToViewBox(clampFrame(target, VIEW)));

    // run the spring out: the camera arrives only once the animation does
    act(() => motion.updates.at(-1)?.(1));
    expect(seen.at(-1)).toBe(frameToViewBox(clampFrame(target, VIEW)));
  });

  it("starts on the target when no `initial` is given", () => {
    const target = { x: 160, y: 180, w: 340, h: 380 };
    expect(record(target)[0]).toBe(frameToViewBox(clampFrame(target, VIEW)));
  });
});
