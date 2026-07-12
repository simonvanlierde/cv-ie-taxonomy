import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vite rewrites import.meta.url in transformed modules, so resolve from the root.
const css = readFileSync(join(process.cwd(), "src/CvTaxonomy.css"), "utf8");

/** the body of every `display: none` rule, paired with its selector list */
const hiddenSelectors = () =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => /display:\s*none/.test(body ?? ""))
    .map(([, selectors]) => (selectors ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim());

describe("the illustrative-overlay caveat", () => {
  it("is never display:none, at any viewport", () => {
    for (const selectors of hiddenSelectors()) {
      expect(
        selectors,
        `.cvt-hud-tag is hidden by "${selectors}" — the mock overlays would render uncaveated`,
      ).not.toMatch(/\.cvt-hud-tag\b/);
    }
  });

  it("still exists as a rule, so the selector has not been renamed out from under this test", () => {
    expect(css).toMatch(/\.cvt-hud-tag\s*\{/);
  });
});
