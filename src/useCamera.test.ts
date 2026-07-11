import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { clampFrame, frameToViewBox, VIEW } from "./frames";
import { useCamera } from "./useCamera";

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
});
