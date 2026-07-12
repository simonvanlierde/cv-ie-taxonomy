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
// These clear 3:1 as marks but not 4.5:1 as text — carry them on a swatch, never
// on the glyph text itself.
export const SCALE_HUE: Record<Scale, string> = {
  Product: "#0072B2",
  Component: "#009E73",
  Material: "#CC79A7",
};

// Maturity is ordinal, so it rides a neutral ramp: one hue, monotone in lightness,
// stepped away from each theme's own surface rather than inverted from the other.
// `Absent` is not a step — it is the hollow no-data cell, marked by its dashed
// stroke. Order here is the encoding; `verdictRamp.test.ts` holds it to that.
export const SURFACE: Record<Theme, string> = {
  light: "#dce8f1",
  dark: "#0b1622",
};

export const VERDICT_RAMP: Record<Theme, Record<Verdict, string | null>> = {
  light: {
    Strong: "#0e2740",
    Partial: "#485d72",
    "Emerging-but-narrow": "#758899",
    "Plausible-but-unvalidated": "#96a6b5",
    Absent: null,
  },
  dark: {
    Strong: "#e8f1f8",
    Partial: "#aab4bc",
    "Emerging-but-narrow": "#7a848d",
    "Plausible-but-unvalidated": "#56606b",
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
 * not maturity and not scale. Selected per theme rather than flipped: the dark
 * set is the neon original; the light set keeps each hue but is darkened to the
 * 3:1 mark floor against the light surface, where the neon reads at 1.2–2.2:1.
 * Both sets clear 4.5:1 under the tags' dark ink, and every mask carries a class
 * label, which is the secondary encoding the CVD floor band requires.
 */
export const SEG_HUE: Record<Theme, Record<SegSlot, string>> = {
  dark: {
    fg: "#facc15",
    bl: "#22d3ee",
    rg: "#a78bfa",
    mo: "#fb923c",
    nk: "#f472b6",
    ba: "#34d399",
    warn: "#ffb454",
  },
  light: {
    fg: "#9d810d",
    bl: "#0691a6",
    rg: "#8c75d2",
    mo: "#bf6f2e",
    nk: "#c85d95",
    ba: "#24946b",
    warn: "#ab7938",
  },
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
  for (const slot of SEG_SLOTS) vars[`--seg-${slot}`] = SEG_HUE[theme][slot];
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
