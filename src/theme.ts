import type { CSSProperties } from "react";
import type { Scale, Verdict } from "./data/types";

export type Theme = "light" | "dark";

/** The one layout fork, shared by the JS tree swap and the CSS container queries:
 *  below this width the island is mobile (stepper, bottom sheet), at or above it
 *  desktop (scroll narrative). Container queries cannot read a TS constant, so
 *  CvTaxonomy.css hard-codes it as `(width < 881px)` / `(width >= 881px)` —
 *  scripts/check-theme.ts fails CI if the two drift. */
export const BREAKPOINT_PX = 881;

// Colourblind-safe (Okabe–Ito) hue per physical scale. Maturity is NEVER colour.
// One set serves both themes: since the sheet went cyanotype, both grounds are dark,
// so a hue that clears 3:1 on the blue paper clears it on the burnt-out sheet too
// (theme.test.ts holds every hue against both surfaces). Product is Okabe–Ito's sky
// blue rather than its blue, which would sit at 2.3:1 on paper of its own hue.
// They clear 3:1 as marks but not 4.5:1 as text — carry them on a swatch, never
// on the glyph text itself.
export const SCALE_HUE: Record<Scale, string> = {
  Product: "#56B4E9",
  Component: "#009E73",
  Material: "#CC79A7",
};

/** the `var(--cvt-sc-…)` consumer map — anything painting a scale mark uses this,
 *  so the mark follows the theme without every call site branching on it */
export const SCALE_VAR: Record<Scale, string> = {
  Product: "var(--cvt-sc-product)",
  Component: "var(--cvt-sc-component)",
  Material: "var(--cvt-sc-material)",
};

// The sheet's two exposures. Light is the cyanotype itself, Prussian-blue paper
// with the linework burnt out white; dark is the same sheet taken almost to black.
// Both are dark grounds, which is what lets the hue sets above collapse to one.
export const SURFACE: Record<Theme, string> = {
  light: "#0d3b5e",
  dark: "#050c14",
};

// Maturity is ordinal, so it rides ink coverage: one ink, monotone in lightness,
// stepped away from each exposure's own ground. `Absent` is not a step — it is the
// hollow no-data cell, marked by its dashed stroke. Order here is the encoding;
// `verdictRamp.test.ts` holds it to that.

export const VERDICT_RAMP: Record<Theme, Record<Verdict, string | null>> = {
  light: {
    Strong: "#e9f4ff",
    Partial: "#b5cfe2",
    "Emerging-but-narrow": "#85a8c3",
    "Plausible-but-unvalidated": "#6b93b1",
    Absent: null,
  },
  dark: {
    Strong: "#cfe3f2",
    Partial: "#9ab5cb",
    "Emerging-but-narrow": "#6d8ba5",
    "Plausible-but-unvalidated": "#4e6c86",
    Absent: null,
  },
};

/** The fan's part slots. One list feeds both the property side (THEME_VARS) and
 *  the consumer side (SEG_VAR), so a renamed slot cannot strand a `var(--seg-…)`
 *  on an undefined custom property — there is no hand-written copy to go stale. */
export const SEG_SLOTS = ["fg", "bl", "rg", "mo", "nk", "ba", "warn"] as const;
export type SegSlot = (typeof SEG_SLOTS)[number];

/**
 * Instance-segmentation overlay hues — a deliberate quote of COCO/YOLO output,
 * not maturity and not scale. One neon set now serves both exposures: the darkened
 * arm existed only for a pale surface, and the cyanotype has none. Every hue clears
 * 3:1 on both grounds and 4.5:1 under the tags' dark ink, and every mask carries a
 * class label, which is the secondary encoding the CVD floor band requires.
 */
export const SEG_HUE: Record<SegSlot, string> = {
  fg: "#facc15",
  bl: "#22d3ee",
  rg: "#a78bfa",
  mo: "#fb923c",
  nk: "#f472b6",
  ba: "#34d399",
  warn: "#ffb454",
};

/** the `var(--seg-…)` consumer map, derived from the same slot list as THEME_VARS */
export const SEG_VAR = Object.fromEntries(
  SEG_SLOTS.map((slot) => [slot, `var(--seg-${slot})`]),
) as Record<SegSlot, string>;

// One verdict, one custom property; Absent has none (the hollow no-data cell).
// Both the property side (THEME_VARS) and the consumer side (VERDICT_VAR)
// derive from this map, so a renamed token cannot leave a stale var() behind.
const VERDICT_TOKEN: Record<Verdict, string | null> = {
  Strong: "--cvt-v-strong",
  Partial: "--cvt-v-partial",
  "Emerging-but-narrow": "--cvt-v-emerging",
  "Plausible-but-unvalidated": "--cvt-v-plausible",
  Absent: null,
};

/** the `var(--cvt-v-…)` consumer map for anything painting a ramp step */
export const VERDICT_VAR = Object.fromEntries(
  Object.entries(VERDICT_TOKEN).map(([verdict, token]) => [verdict, token && `var(${token})`]),
) as Record<Verdict, string | null>;

const themeVars = (theme: Theme): CSSProperties => {
  const vars: Record<string, string> = {};
  for (const slot of SEG_SLOTS) vars[`--seg-${slot}`] = SEG_HUE[slot];
  for (const [scale, hex] of Object.entries(SCALE_HUE)) {
    vars[`--cvt-sc-${scale.toLowerCase()}`] = hex;
  }
  for (const [verdict, token] of Object.entries(VERDICT_TOKEN)) {
    const hex = VERDICT_RAMP[theme][verdict as Verdict];
    if (token && hex) vars[token] = hex;
  }
  return vars;
};

/** Every overlay/ramp hue as CSS custom properties for the root element's inline
 *  style — precomputed per theme, so the per-scroll-frame render hands React the
 *  same object reference and the style diff short-circuits. */
export const THEME_VARS: Record<Theme, CSSProperties> = {
  light: themeVars("light"),
  dark: themeVars("dark"),
};
