/** Demo-shell URL params. Kept out of main.tsx so they can be tested. */

/**
 * `?p=0.5` pins scroll progress for screenshots.
 *
 * `?p=abc` is NaN, and `NaN ?? scrollP` keeps the NaN (?? only guards null and
 * undefined) — it then flows through every SVG transform and blanks the fan with
 * no error. Only a finite value, clamped to the 0..1 the timeline expects, passes.
 */
export function parseProgress(raw: string | null): number | undefined {
  // `?p=` with no value: Number("") is 0, which would silently pin the fan at
  // the hero rather than scrolling. An empty param means "not set".
  if (raw === null || raw.trim() === "") return undefined;
  const p = Number(raw);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : undefined;
}
