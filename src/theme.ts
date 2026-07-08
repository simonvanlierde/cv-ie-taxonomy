import type { Scale } from "./data/types";

// Colourblind-safe (Okabe–Ito) hue per physical scale. Maturity is NEVER colour.
export const SCALE_HUE: Record<Scale, string> = {
  Product: "#0072B2",
  Component: "#009E73",
  Material: "#CC79A7",
};

// Scroll timeline (fractions of total scroll). Retune the pacing HERE only:
// the stage (Fan) and the rail chapters both read from it.
// presence windows: [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd]
export const TIMELINE = {
  heroEnd: 0.12,
  productEnd: 0.36,
  componentEnd: 0.64,
  materialEnd: 0.86,
  explode: [0.36, 0.52],
  drift: [0.64, 0.8],
  presence: {
    Product: [0.14, 0.2, 0.36, 0.42],
    Component: [0.5, 0.56, 0.64, 0.7],
    Material: [0.78, 0.84, 0.9, 0.96],
  },
} as const;
