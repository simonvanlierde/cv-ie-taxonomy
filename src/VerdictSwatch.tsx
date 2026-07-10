import { useId } from "react";
import type { Verdict } from "./data/types";

/**
 * The maturity glyph: a verdict shown by ink weight and letter, never hue.
 * Single source of truth for the verdict→weight encoding.
 *
 * Two stacked encodings of the same ordinal variable:
 *   - the neutral ramp (--cvt-v-*), monotone in lightness, is what you normally see;
 *   - the texture layer, monotone in ink coverage (100 · 25 · 17 · 8 · 0 %), takes
 *     over under forced-colors and print, where the ramp flattens.
 * Absent is not a ramp step — it is the hollow no-data cell, marked by its dashed
 * stroke. The letter always accompanies the glyph, so identity is never weight-alone.
 *
 * Self-contained <svg> with scoped pattern defs, so it drops into HTML flow
 * (legend, matrix, panel) or nests inside another SVG via x/y (the fan chips).
 */
const RAMP: Record<Verdict, string | null> = {
  Strong: "var(--cvt-v-strong)",
  Partial: "var(--cvt-v-partial)",
  "Emerging-but-narrow": "var(--cvt-v-emerging)",
  "Plausible-but-unvalidated": "var(--cvt-v-plausible)",
  Absent: null,
};

export function VerdictSwatch({
  verdict,
  size = 22,
  x,
  y,
}: {
  verdict: Verdict;
  size?: number;
  /** set when nesting inside a parent <svg> (viewBox coords) */
  x?: number;
  y?: number;
}) {
  const id = useId();
  const ramp = RAMP[verdict];
  // forced-colors / print fallback: ink coverage, ordered
  const texture =
    verdict === "Strong"
      ? "var(--cvt-ink)"
      : verdict === "Partial"
        ? `url(#${id}h)`
        : verdict === "Emerging-but-narrow"
          ? `url(#${id}d)`
          : "none";
  const box = { x: 1.5, y: 1.5, width: 23, height: 23, rx: 5 };
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 26 26"
      aria-hidden
      className="cvt-glyphbox"
    >
      <defs>
        <pattern
          id={`${id}h`}
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" className="tex-stroke" />
        </pattern>
        <pattern id={`${id}d`} patternUnits="userSpaceOnUse" width="5" height="5">
          <circle cx="2.5" cy="2.5" r="1.15" className="tex-fill" />
        </pattern>
      </defs>
      <rect
        {...box}
        className="v-fill"
        fill={ramp ?? "none"}
        stroke="var(--cvt-ink)"
        strokeWidth="1.6"
        strokeDasharray={verdict === "Absent" ? "3 3" : undefined}
      />
      <rect {...box} className="v-tex" fill={texture} />
      {verdict === "Plausible-but-unvalidated" && (
        <circle
          className="v-tex"
          cx="13"
          cy="13"
          r="6"
          fill="none"
          stroke="var(--cvt-ink)"
          strokeWidth="1.2"
        />
      )}
    </svg>
  );
}
