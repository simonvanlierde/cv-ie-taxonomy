import { describe, expect, it } from "vitest";
import type { Scale } from "./data/types";
import { TIMELINE } from "./theme";

/**
 * The pacing contract: an overlay is at full strength while the prose that
 * explains it is on screen, and the fan never rearranges itself underneath an
 * annotation pointing at it. Both are properties of TIMELINE alone, so they can
 * be checked without a browser.
 */

// mirrors Fan.tsx
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const seg = (p: number, a: number, b: number) => smoothstep(clamp01((p - a) / (b - a)));
const presence = (w: readonly number[], p: number) => seg(p, w[0], w[1]) * (1 - seg(p, w[2], w[3]));

/** scroll progress at which each chapter's prose sits centred, measured against
 *  the rendered rail at viewport heights 793px and 1200px (mean, ±0.02) */
const PROSE_CENTRE: Record<Scale, number> = { Product: 0.23, Component: 0.51, Material: 0.78 };

describe("scroll pacing", () => {
  it.each([
    "Product",
    "Component",
    "Material",
  ] as const)("%s overlays are at full strength while its prose is centred", (scale) => {
    expect(presence(TIMELINE.presence[scale], PROSE_CENTRE[scale])).toBeGreaterThan(0.95);
  });

  it("never leaves the stage unannotated between the first and last plateau", () => {
    const total = (p: number) =>
      (["Product", "Component", "Material"] as const).reduce(
        (sum, s) => sum + presence(TIMELINE.presence[s], p),
        0,
      );
    for (let p = TIMELINE.presence.Product[1]; p <= TIMELINE.presence.Material[2]; p += 0.005) {
      expect(total(p), `dead stage at p=${p.toFixed(3)}`).toBeGreaterThan(0.3);
    }
  });

  it("finishes each motion beat before the overlays it would disturb arrive", () => {
    // explode must settle before the component annotations reach full opacity
    expect(TIMELINE.explode[1]).toBeLessThanOrEqual(TIMELINE.presence.Component[1]);
    // drift must settle before the material annotations reach full opacity
    expect(TIMELINE.drift[1]).toBeLessThanOrEqual(TIMELINE.presence.Material[1]);
  });

  it("keeps each plateau inside its own chapter band", () => {
    const band: Record<Scale, [number, number]> = {
      Product: [TIMELINE.heroEnd, TIMELINE.productEnd],
      Component: [TIMELINE.productEnd, TIMELINE.componentEnd],
      Material: [TIMELINE.componentEnd, TIMELINE.materialEnd],
    };
    for (const scale of ["Product", "Component", "Material"] as const) {
      const [, plateauStart, plateauEnd] = TIMELINE.presence[scale];
      const [lo, hi] = band[scale];
      expect(plateauStart, `${scale} plateau starts before its band`).toBeGreaterThanOrEqual(lo);
      expect(plateauEnd, `${scale} plateau ends after its band`).toBeLessThanOrEqual(hi);
    }
  });
});
