import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cellById, cells, taxonomy } from "./data/taxonomy";
import { CHIP_LAYOUT, Fan } from "./Fan";
import { FRAMES } from "./frames";
import { SCENES } from "./params";

/**
 * The floating chips ARE the controls. Their operability must track the chapter
 * — never the focus dimming, which only fades siblings to 0.45 while leaving
 * them plainly on screen.
 *
 * Deriving `active` from opacity meant that focusing one chip stripped tabIndex
 * and set aria-hidden on every sibling, so Tab left the fan after a single chip.
 */

const noop = () => {};
const renderFan = (props: Partial<Parameters<typeof Fan>[0]> = {}) =>
  render(
    <Fan
      chapter="Component"
      focus={null}
      onSelect={noop}
      onHover={noop}
      reduceMotion={true}
      {...props}
    />,
  );

const chip = (container: HTMLElement, id: string) =>
  container.querySelector(`#cvt-co-${id}`) as SVGGElement;

const COMPONENT_CHIPS = [
  "component-identity",
  "component-structure",
  "component-quantity",
  "component-condition",
];

describe("chip operability", () => {
  it.each(["Product", "Material"] as const)(
    "does not rate the %s connections placeholder",
    (scale) => {
      const { container } = renderFan({ chapter: scale });
      const button = chip(container, `${scale.toLowerCase()}-structure`);
      expect(button).toHaveAccessibleName(/not applicable/i);
      expect(button).not.toHaveAccessibleName(/absent/i);
      expect(button.querySelector(".cvt-co-letter")).toBeEmptyDOMElement();
    },
  );

  it("drops chips outside the camera frame from the tab ring, but never the selected one", () => {
    // component-quantity's frame is tight around the motor: the identity chip in
    // the left gutter is not on the sheet while that detail is open, and a chip
    // the reader cannot see is not a tab stop. The opener stays focusable so
    // focus has somewhere to return to.
    const selected = cellById("component-quantity");
    const { container, rerender } = renderFan({
      focus: selected,
      frame: FRAMES["component-quantity"],
    });
    expect(chip(container, "component-identity")).toHaveAttribute("tabindex", "-1");
    // still on screen and clickable, so still announced
    expect(chip(container, "component-identity")).not.toHaveAttribute("aria-hidden");
    expect(chip(container, "component-quantity")).toHaveAttribute("tabindex", "0");
    // camera home: the whole chapter is back in the ring
    rerender(
      <Fan
        chapter="Component"
        focus={selected}
        onSelect={noop}
        onHover={noop}
        reduceMotion={true}
        frame={null}
      />,
    );
    expect(chip(container, "component-identity")).toHaveAttribute("tabindex", "0");
  });

  it("makes every chip of the on-stage chapter focusable", () => {
    const { container } = renderFan();
    for (const id of COMPONENT_CHIPS) {
      const g = chip(container, id);
      expect(g, id).toHaveAttribute("tabindex", "0");
      expect(g, id).not.toHaveAttribute("inert");
    }
  });

  it("keeps siblings focusable while one chip has focus", () => {
    // this is the regression: focus on component-identity dims the other three,
    // and they used to drop out of the tab order and the a11y tree
    const focused = cellById("component-identity");
    const { container } = renderFan({ focus: focused });

    for (const id of COMPONENT_CHIPS.filter((c) => c !== focused.id)) {
      const g = chip(container, id);
      expect(g, `${id} is visible but unreachable`).toHaveAttribute("tabindex", "0");
      expect(g, `${id} is visible but unannounced`).not.toHaveAttribute("inert");
      // its contents are dimmed, its plate is not (so the leader stays hidden)
      expect(Number(g.style.getPropertyValue("--dim")), `${id} should be dimmed`).toBeLessThan(1);
      expect(g.style.opacity).toBe(chip(container, focused.id).style.opacity);
    }
  });

  it("makes chips of an off-stage chapter inert: not seen, operable or announced", () => {
    const { container } = renderFan();
    for (const id of ["material-identity", "product-identity"]) {
      expect(chip(container, id), id).toHaveAttribute("inert");
    }
  });
});

describe("chip copy vs. verdict", () => {
  // Verdict vocabulary, derived from the source-of-truth legend (never hand-copied):
  // each verdict's own words, so a chip mentioning another verdict's word is caught.
  const VERDICT_WORDS = taxonomy.meta.maturityLevels.map((m) => ({
    verdict: m.verdict,
    words: m.verdict
      .toLowerCase()
      .split("-")
      .filter((w) => w !== "but"),
  }));

  it("never lets a chip's read-out contradict its own cell's maturity", () => {
    const { container } = renderFan();
    for (const cell of cells) {
      const text = container
        .querySelector(`#cvt-co-${cell.id} .cvt-co-text`)
        ?.textContent?.toLowerCase();
      if (!text) continue;
      for (const { verdict, words } of VERDICT_WORDS) {
        if (verdict === cell.maturity) continue;
        for (const word of words) {
          expect(
            text,
            `${cell.id}: "${text}" reads like ${verdict}, but is ${cell.maturity}`,
          ).not.toContain(word);
        }
      }
    }
  });
});

describe("mock overlays", () => {
  it("are hidden from assistive tech even while fully opaque", () => {
    const { container } = renderFan();
    const layers = container.querySelectorAll(".ov-layer");
    expect(layers).toHaveLength(9);
    // every one of them inside the hidden svg
    expect(container.querySelectorAll(".cvt-fan-marks .ov-layer")).toHaveLength(layers.length);
    expect(container.querySelector(".cvt-fan-marks")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders no NaN coordinates in any scene", () => {
    for (const chapter of SCENES) {
      for (const compact of [false, true]) {
        const { container, unmount } = renderFan({ chapter, compact });
        expect(container.innerHTML, `${chapter}, compact ${compact}`).not.toMatch(/NaN/);
        unmount();
      }
    }
  });
});

describe("compact fan", () => {
  it("drops the floating chips but keeps painting the annotations", () => {
    const { container } = renderFan({ compact: true });
    expect(container.querySelectorAll(".cvt-co")).toHaveLength(0);
    // the phone lists the cells in the text; the drawing still shows the read-outs
    expect(container.querySelectorAll(".ov-layer")).toHaveLength(9);
    expect(within(container).getByText(/desk fan/)).toBeInTheDocument();
  });
});

describe("chip names", () => {
  it("start with the chip's visible text, so a voice user can say what they see", () => {
    const { container } = renderFan();
    const label = chip(container, "component-structure").getAttribute("aria-label") ?? "";
    // the letter, then the read-out text, in the order they are drawn
    const parts = [...chip(container, "component-structure").children].map((el) => el.textContent);
    expect(label.startsWith(`${parts.filter(Boolean).join(" ")}.`)).toBe(true);
  });
});

describe("chip read-outs", () => {
  // The read-outs are mock values, but their hedges claim a verdict, so a
  // verdict change in taxonomy.json must reach the chip text too.
  it.each(CHIP_LAYOUT)("$id: hedge words agree with the verdict", ({ id, text, strike }) => {
    const cell = cellById(id);
    expect(text.includes("(unproven)"), text).toBe(cell.maturity === "Plausible-but-unvalidated");
    expect(text.includes("(one product type)"), text).toBe(cell.maturity === "Emerging-but-narrow");
    expect(Boolean(strike), text).toBe(cell.maturity === "Absent" && !cell.structurallyEmpty);
  });
});

describe("the scene claims drawn on the fan", () => {
  it("draws one measuring scale per scene that has a drop, hidden from assistive tech", () => {
    const { container } = renderFan();
    const drops = container.querySelectorAll(".cvt-drop");
    expect(drops).toHaveLength(2);
    for (const d of drops) expect(d).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves them off the phone, where the headings carry the claims", () => {
    const { container } = renderFan({ compact: true });
    expect(container.querySelectorAll(".cvt-drop")).toHaveLength(0);
  });
});
