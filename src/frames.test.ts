import { describe, expect, it } from "vitest";
import { frameFor } from "./CvTaxonomy";
import { cells } from "./data/taxonomy";
import { chipFrame } from "./Fan";
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

  // the enlargement must not crop the read-out that opened it: a reader who
  // clicked "steel · ABS · Cu · PCB" and got half of it under the panel edge
  // was shown the mock numbers around it instead of the thing they chose
  it("keeps every cell's own chip inside its zoom frame, and the frame inside the view", () => {
    for (const c of cells) {
      const chip = chipFrame(c.id);
      expect(chip, `chip for ${c.id}`).not.toBeNull();
      if (!chip) continue;
      const f = frameFor(c.id);
      expect(inside(f), `zoom frame for ${c.id} inside VIEW`).toBe(true);
      expect(f.x <= chip.x && f.x + f.w >= chip.x + chip.w, `${c.id} chip x in frame`).toBe(true);
      expect(f.y <= chip.y && f.y + f.h >= chip.y + chip.h, `${c.id} chip y in frame`).toBe(true);
    }
  });

  it("home frame is the whole view", () => {
    // no literal viewBox here: VIEW is a tuned crop around the drawing, and
    // pinning its numbers would fail on every retune without catching a defect
    expect(HOME_FRAME).toEqual(VIEW);
    expect(frameToViewBox(HOME_FRAME)).toBe(frameToViewBox(VIEW));
  });

  it("clamps an over-large or off-edge frame back inside its bounds", () => {
    const clamped = clampFrame({ x: -999, y: 0, w: 5000, h: 5000 }, VIEW);
    expect(inside(clamped)).toBe(true);
    expect(clamped).toEqual({ x: VIEW.x, y: VIEW.y, w: VIEW.w, h: VIEW.h });
  });
});
