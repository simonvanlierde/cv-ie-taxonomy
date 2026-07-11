import { describe, expect, it } from "vitest";
import { cells } from "./data/taxonomy";
import { clampFrame, FRAMES, frameToViewBox, HOME_FRAME, VIEW } from "./frames";
import { frameOf } from "./test-helpers";

const inside = (f: { x: number; y: number; w: number; h: number }) =>
  f.x >= VIEW.x && f.y >= VIEW.y && f.x + f.w <= VIEW.x + VIEW.w && f.y + f.h <= VIEW.y + VIEW.h;

describe("frames", () => {
  it("has an in-bounds frame for every taxonomy cell", () => {
    for (const c of cells) {
      expect(FRAMES[c.id], `frame for ${c.id}`).toBeDefined();
      expect(inside(frameOf(c.id)), `frame for ${c.id} inside VIEW`).toBe(true);
    }
  });

  it("home frame is the whole view", () => {
    expect(HOME_FRAME).toEqual(VIEW);
    expect(frameToViewBox(HOME_FRAME)).toBe("-250 -25 1070 950");
  });

  it("clamps an over-large or off-edge frame back inside its bounds", () => {
    const clamped = clampFrame({ x: -999, y: 0, w: 5000, h: 5000 }, VIEW);
    expect(inside(clamped)).toBe(true);
    expect(clamped).toEqual({ x: VIEW.x, y: VIEW.y, w: VIEW.w, h: VIEW.h });
  });
});
