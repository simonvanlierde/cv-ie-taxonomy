import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast } from "./test-helpers";
import { SCALE_HUE, SEG_HUE, SURFACE } from "./theme";

/**
 * The palette's accessibility floors, pinned per theme: 3:1 for non-text marks
 * (WCAG 1.4.11), 4.5:1 for the small status/warn text (WCAG 1.4.3). The mark hues
 * live in theme.ts; the text tokens live in CvTaxonomy.css as light-dark() pairs,
 * so this test reads them out of the stylesheet source — there is no second copy
 * to drift.
 */

// vitest's jsdom env rewrites import.meta.url off the file scheme, so resolve
// from the project root (vitest's cwd) instead
const css = readFileSync("src/CvTaxonomy.css", "utf8");

/** the two arms of a `--token: light-dark(a, b)` declaration in CvTaxonomy.css */
function lightDark(token: string): { light: string; dark: string } {
  const m = css.match(new RegExp(`${token}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`));
  if (!m?.[1] || !m[2]) throw new Error(`${token} is not a plain light-dark(hex, hex) in the CSS`);
  return { light: m[1], dark: m[2] };
}

// One hue set, both exposures: each is checked against both grounds, so collapsing
// the per-theme fork cannot hide a hue that only worked on one of them.
describe.each(["light", "dark"] as const)("mark hues hold the 3:1 floor (%s)", (theme) => {
  const surface = SURFACE[theme];

  it("scale hues clear 3:1 against the surface", () => {
    for (const [scale, hex] of Object.entries(SCALE_HUE)) {
      expect(contrast(hex, surface), `${scale} on ${theme} surface`).toBeGreaterThanOrEqual(3);
    }
  });

  it("segmentation hues clear 3:1 against the surface", () => {
    for (const [slot, hex] of Object.entries(SEG_HUE)) {
      expect(contrast(hex, surface), `seg ${slot} on ${theme} surface`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe.each(["light", "dark"] as const)("status text holds the 4.5:1 floor (%s)", (theme) => {
  const panel = lightDark("--cvt-panel")[theme];

  it("--cvt-warn (failure-mode text, preprint status) on the panel", () => {
    expect(contrast(lightDark("--cvt-warn")[theme], panel)).toBeGreaterThanOrEqual(4.5);
  });

  it("--cvt-ok (published status) on the panel", () => {
    expect(contrast(lightDark("--cvt-ok")[theme], panel)).toBeGreaterThanOrEqual(4.5);
  });
});
