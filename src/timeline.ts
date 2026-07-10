// Scroll pacing: the timeline itself, and the easing that reads it. Both the
// stage (Fan) and the rail chapters (CvTaxonomy) drive off this module, and
// timeline.test.ts checks the pacing contract against these exact functions —
// so the maths lives here once rather than being mirrored into the test.

/** presence window: [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] */
export type PresenceWindow = readonly [number, number, number, number];

// Scroll timeline (fractions of total scroll). Retune the pacing HERE only.
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
  // each motion beat starts exactly where the chapter above it starts fading
  // (presence fadeOutStart) and settles before the next chapter is fully in
  explode: [0.33, 0.43],
  drift: [0.58, 0.67],
  presence: {
    Product: [0.1, 0.16, 0.33, 0.4],
    Component: [0.34, 0.43, 0.58, 0.64],
    Material: [0.6, 0.68, 0.84, 0.9],
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
