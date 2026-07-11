import { render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { clampFrame, frameToViewBox, VIEW } from "./frames";
import { useCamera } from "./useCamera";

// mock motion's animate to invoke onUpdate with a scalar progress, synchronously
vi.mock("motion", () => ({
  animate: (_from: number, _to: number, opts: { onUpdate: (t: number) => void }) => {
    opts.onUpdate(0.5);
    return { stop: () => {} };
  },
}));

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
});
