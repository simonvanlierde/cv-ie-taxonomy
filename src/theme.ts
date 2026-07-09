import type { CSSProperties } from "react";
import type { Scale, Verdict } from "./data/types";

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
export const SURFACE: Record<"light" | "dark", string> = {
  light: "#dce8f1",
  dark: "#0b1622",
};

export const VERDICT_RAMP: Record<"light" | "dark", Record<Verdict, string | null>> = {
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

/**
 * Instance-segmentation overlay hues — a deliberate quote of COCO/YOLO output,
 * not maturity and not scale. Selected per theme rather than flipped: the dark
 * set is the neon original; the light set keeps each hue but is darkened to the
 * 3:1 mark floor against the light surface, where the neon reads at 1.2–2.2:1.
 * Both sets clear 4.5:1 under the tags' dark ink, and every mask carries a class
 * label, which is the secondary encoding the CVD floor band requires.
 */
export const SEG_HUE: Record<"light" | "dark", Record<string, string>> = {
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

/** the overlay hues as CSS custom properties, for the root element's inline style */
export const segVars = (theme: "light" | "dark"): CSSProperties =>
  Object.fromEntries(
    Object.entries(SEG_HUE[theme]).map(([part, hex]) => [`--seg-${part}`, hex]),
  ) as CSSProperties;

/** a ramp step; only `Absent` has none, and it is never asked for here */
const step = (theme: "light" | "dark", verdict: Verdict): string => {
  const hex = VERDICT_RAMP[theme][verdict];
  if (!hex) throw new Error(`${verdict} has no ramp step: it is the hollow no-data cell`);
  return hex;
};

/** the ramp as CSS custom properties, for the root element's inline style */
export const rampVars = (theme: "light" | "dark"): CSSProperties =>
  ({
    "--cvt-v-strong": step(theme, "Strong"),
    "--cvt-v-partial": step(theme, "Partial"),
    "--cvt-v-emerging": step(theme, "Emerging-but-narrow"),
    "--cvt-v-plausible": step(theme, "Plausible-but-unvalidated"),
  }) as CSSProperties;

// Scroll timeline (fractions of total scroll). Retune the pacing HERE only:
// the stage (Fan) and the rail chapters both read from it.
// presence windows: [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd]
//
// The plateau of each presence window brackets the scroll position at which that
// chapter's prose sits centred in the viewport, so the overlays are at full
// strength while the text explaining them is being read. Those centres, measured
// against the rendered rail, are p ≈ 0.23 / 0.51 / 0.78; they shift by at most
// 0.04 between a 793px and a 1200px viewport, which the 0.06–0.08 fade bands
// absorb. Re-measure before retuning: the windows are not free parameters.
//
// The two motion beats fill the gaps between plateaus, so the fan never
// rearranges itself under an annotation that is trying to point at it.
export const TIMELINE = {
  heroEnd: 0.12,
  productEnd: 0.36,
  componentEnd: 0.64,
  materialEnd: 0.86,
  explode: [0.28, 0.41],
  drift: [0.58, 0.67],
  presence: {
    Product: [0.1, 0.16, 0.33, 0.4],
    Component: [0.34, 0.43, 0.58, 0.64],
    Material: [0.6, 0.68, 0.84, 0.9],
  },
} as const;
