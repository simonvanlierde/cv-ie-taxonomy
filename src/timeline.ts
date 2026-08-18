// Scroll pacing: the timeline itself, and the easing that reads it. Both the
// stage (Fan) and the rail chapters (CvTaxonomy) drive off this module, and
// timeline.test.ts checks the pacing contract against these exact functions —
// so the maths lives here once rather than being mirrored into the test.

/** presence window: [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] */
export type PresenceWindow = readonly [number, number, number, number];

// Scroll timeline (fractions of total scroll). Retune the pacing HERE only.
//
// The plateau of each presence window brackets the scroll range over which that
// chapter's prose is pinned in the viewport, so the overlays are at full
// strength while the text explaining them is being read. Those pinned ranges,
// measured against the rendered rail (50vh tail), are p ≈ 0.22–0.35 /
// 0.52–0.69 / 0.82–0.98 at 793px, and end ~0.03 later at 1200px, which the
// fade bands absorb. Re-measure before retuning: the windows are not free
// parameters, and the rail's tail in the stylesheet moves them.
//
// The two motion beats fill the gaps between plateaus, so the fan never
// rearranges itself under an annotation that is trying to point at it.
export const TIMELINE = {
  heroEnd: 0.14,
  productEnd: 0.42,
  componentEnd: 0.7,
  materialEnd: 0.96,
  // each motion beat starts exactly where the chapter above it starts fading
  // (presence fadeOutStart) and settles before the next chapter is fully in
  explode: [0.38, 0.47],
  drift: [0.66, 0.75],
  presence: {
    Product: [0.12, 0.18, 0.38, 0.45],
    Component: [0.39, 0.47, 0.66, 0.73],
    Material: [0.67, 0.75, 0.95, 1],
  },
} as const satisfies {
  heroEnd: number;
  productEnd: number;
  componentEnd: number;
  materialEnd: number;
  explode: readonly [number, number];
  drift: readonly [number, number];
  presence: Record<"Product" | "Component" | "Material", PresenceWindow>;
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Eased 0→1 ramp across [a, b], flat outside it. A zero-width window is a step,
 *  not a 0/0 — otherwise a retune to a === b silently NaNs every coordinate. */
export const seg = (p: number, a: number, b: number) =>
  a === b ? (p < a ? 0 : 1) : smoothstep(clamp01((p - a) / (b - a)));

/** A chapter's presence at p: faded in, held across the plateau, faded out. */
export const presence = (w: PresenceWindow, p: number) =>
  seg(p, w[0], w[1]) * (1 - seg(p, w[2], w[3]));

/** The centre of a scale's presence plateau: the p where that chapter is at full
 *  strength. The stepper pins each scale step here, and a `?cell=` deep link
 *  scrolls here, so both land on a fan state whose chips are operable and whose
 *  camera frames point at real geometry. Derived, so a TIMELINE retune moves it. */
export const plateauCentre = (scale: keyof typeof TIMELINE.presence) => {
  const [, plateauStart, plateauEnd] = TIMELINE.presence[scale];
  return (plateauStart + plateauEnd) / 2;
};
