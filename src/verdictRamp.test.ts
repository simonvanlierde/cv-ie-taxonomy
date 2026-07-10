import { describe, expect, it } from "vitest";
import type { Verdict } from "./data/types";
import { SURFACE, VERDICT_RAMP } from "./theme";

/**
 * The ramp *is* the ordinal encoding, so its ordering is a correctness property,
 * not a style preference. These are the same four checks the dataviz validator
 * applies to a sequential scale, pinned here so an edit to theme.ts cannot
 * quietly flatten the order.
 */

// relative luminance, WCAG 2.x
const channel = (hex: string, at: number) => {
  const v = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);

const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  const [lo, hi] = x < y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

// Absent is deliberately not here: it is the hollow no-data cell, not a ramp step.
const ORDER: Verdict[] = ["Strong", "Partial", "Emerging-but-narrow", "Plausible-but-unvalidated"];

describe.each(["light", "dark"] as const)("verdict ramp (%s)", (theme) => {
  const surface = SURFACE[theme];
  const steps = ORDER.map((v) => {
    const hex = VERDICT_RAMP[theme][v];
    if (!hex) throw new Error(`${v} must have a ramp step in the ${theme} theme`);
    return hex;
  });

  it("fades monotonically toward the surface, Strong → Plausible", () => {
    const distance = steps.map((s) => Math.abs(luminance(s) - luminance(surface)));
    expect(distance).toEqual([...distance].sort((a, b) => b - a));
  });

  it("separates adjacent steps by a visible lightness gap", () => {
    for (const [i, step] of steps.slice(1).entries()) {
      const previous = steps[i];
      if (previous === undefined) throw new Error(`no step before index ${i + 1}`);
      expect(Math.abs(luminance(step) - luminance(previous))).toBeGreaterThanOrEqual(0.06);
    }
  });

  it("keeps the faintest step above a 2:1 contrast floor", () => {
    const faintest = steps.at(-1);
    if (faintest === undefined) throw new Error("the ramp has no steps");
    expect(contrast(faintest, surface)).toBeGreaterThanOrEqual(2);
  });

  it("leaves Absent hollow, so it reads as no-data rather than a low rank", () => {
    expect(VERDICT_RAMP[theme].Absent).toBeNull();
  });
});

describe("verdict ramp is selected per theme, not flipped", () => {
  it("derives each theme's steps against its own surface", () => {
    // an inverted light ramp would put Strong near the dark surface, not away from it
    for (const theme of ["light", "dark"] as const) {
      const strong = VERDICT_RAMP[theme].Strong as string;
      expect(contrast(strong, SURFACE[theme])).toBeGreaterThan(4.5);
    }
  });
});
