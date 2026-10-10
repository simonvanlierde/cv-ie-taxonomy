import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { CvTaxonomy } from "./CvTaxonomy";
import { plateauCentre } from "./timeline";

/**
 * WCAG 2.2 AA scan at each stop a reader can land on. axe checks what a
 * rendered page can prove (names, roles, contrast of real text on real
 * backgrounds), so it runs here on Chromium's layout, not on jsdom's 0×0 boxes.
 *
 * NOTE: axe cannot judge text contrast on this page: the sheet's grid is a
 * pseudo-element, so every color-contrast node comes back "incomplete", not
 * passed. Contrast is covered only by the token tests (theme.test.ts,
 * verdictRamp.test.ts) until the page background is a plain colour.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations() {
  // let entrance transitions finish, so contrast is read on settled opacity
  await new Promise((r) => setTimeout(r, 600));
  const { violations } = await axe.run(document, { runOnly: { type: "tag", values: TAGS } });
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("WCAG 2.2 AA (axe)", () => {
  it.each([
    ["hero", 0],
    ["product", plateauCentre("Product")],
    ["component", plateauCentre("Component")],
    ["material", plateauCentre("Material")],
    ["map", 1],
  ])("%s scene", async (_, p) => {
    render(<CvTaxonomy debugProgress={p} />);
    expect(await violations()).toEqual([]);
  });

  it("an open cell detail", async () => {
    render(<CvTaxonomy initialCell="component-structure" />);
    expect(await violations()).toEqual([]);
  });

  it("the phone stepper", async () => {
    // the component switches layout on its own width, not the viewport's
    render(
      <div style={{ width: 420 }}>
        <CvTaxonomy />
      </div>,
    );
    await vi.waitFor(() => expect(document.querySelector(".cvt-stepper")).not.toBeNull());
    expect(await violations()).toEqual([]);
  });
});
