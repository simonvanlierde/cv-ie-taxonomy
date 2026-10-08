import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CvTaxonomy } from "./CvTaxonomy";
import { cellById } from "./data/taxonomy";
import { VERDICT_HEIGHT } from "./theme";

/**
 * The closing figure's claim is geometric: "each block stands as high as its
 * verdict; the dashed rule is Strong". A block sized against the whole bay,
 * label band included, overstates every verdict, and jsdom cannot see it.
 */
describe("the matrix blocks, on real layout", () => {
  it("stand at their verdict's share of the floor-to-shelf distance", () => {
    render(<CvTaxonomy />);
    const cells = [...document.querySelectorAll<HTMLElement>(".cvt-mx-cell")];
    expect(cells.length).toBe(12);
    for (const el of cells) {
      if (el.dataset.ghost === "true") continue;
      const cell = cellById(el.id.replace("cvt-mx-", ""));
      const standsAt = cell.subVerdicts?.[0]?.maturity ?? cell.maturity;
      const block = el.querySelector(".cvt-mx-block") as HTMLElement;
      const bay = el.getBoundingClientRect();
      const b = block.getBoundingClientRect();
      const shelfToFloor = b.bottom - bay.top - el.clientTop;
      expect(b.height / shelfToFloor, el.id).toBeCloseTo(VERDICT_HEIGHT[standsAt], 1);
    }
  });
});
