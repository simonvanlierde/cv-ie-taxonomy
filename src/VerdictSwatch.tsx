import { useId } from "react";
import type { Verdict } from "./data/types";

/**
 * The maturity glyph: a verdict shown by texture and letter, never colour.
 * Single source of truth for the verdict→texture encoding.
 *
 * Self-contained <svg> with scoped pattern defs, so it drops into HTML flow
 * (legend, matrix, panel) or nests inside another SVG via x/y (the fan chips).
 */
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
  const fill =
    verdict === "Strong"
      ? "var(--cvt-ink)"
      : verdict === "Partial"
        ? `url(#${id}h)`
        : verdict === "Emerging-but-narrow"
          ? `url(#${id}d)`
          : "none";
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
        <pattern id={`${id}d`} patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="3" cy="3" r="1.1" className="tex-fill" />
        </pattern>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="23"
        height="23"
        rx="5"
        fill={fill}
        stroke="var(--cvt-ink)"
        strokeWidth="1.6"
        strokeDasharray={verdict === "Absent" ? "3 3" : undefined}
      />
      {verdict === "Plausible-but-unvalidated" && (
        <circle cx="13" cy="13" r="6" fill="none" stroke="var(--cvt-ink)" strokeWidth="1.6" />
      )}
    </svg>
  );
}
