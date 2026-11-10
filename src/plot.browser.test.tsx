import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CvTaxonomy } from "./CvTaxonomy";
import type { Chapter } from "./frames";

const inkAnimation = (chapter?: Chapter) => {
  const { unmount } = render(<CvTaxonomy debugChapter={chapter} />);
  const ink = document.querySelector(".fan-ink circle") as SVGElement;
  const name = getComputedStyle(ink).animationName;
  unmount();
  return name;
};

/** The plotted fan: each scene's arrival re-inks the parts, and the opening
 *  view is the whole drawing, never mid-sweep. */
describe("the plotted fan", () => {
  it("draws the hero whole, with no sweep to wait for", () => {
    expect(inkAnimation("hero")).toBe("none");
  });

  it("re-inks the parts under their own keyframes in each scene", () => {
    expect(inkAnimation("Product")).toBe("cvt-plot-product");
    expect(inkAnimation("Component")).toBe("cvt-plot-component");
    expect(inkAnimation("Material")).toBe("cvt-plot-material");
  });

  it("keeps a faint copy of every stroke under the ink", () => {
    render(<CvTaxonomy />);
    const base = document.querySelectorAll(
      ".fan-base :is(rect, circle, path, line):not(.ov-segfill, .mat-tint)",
    ).length;
    const ink = document.querySelectorAll(".fan-ink :is(rect, circle, path, line)").length;
    expect(base).toBeGreaterThan(0);
    // the ink copy skips only the fill-only screw dots
    expect(base - ink).toBe(2);
  });
});
