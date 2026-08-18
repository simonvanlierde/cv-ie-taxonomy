import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cellById, cells, taxonomy } from "./data/taxonomy";
import { Fan } from "./Fan";
import { FRAMES } from "./frames";
import { TIMELINE } from "./timeline";

/**
 * The floating chips ARE the controls. Their operability must track the chapter
 * — never the focus dimming, which only fades siblings to 0.45 while leaving
 * them plainly on screen.
 *
 * Deriving `active` from opacity meant that focusing one chip stripped tabIndex
 * and set aria-hidden on every sibling, so Tab left the fan after a single chip.
 */

/** mid-plateau of the Component chapter: its four chips are fully present */
const COMPONENT_PLATEAU = (TIMELINE.presence.Component[1] + TIMELINE.presence.Component[2]) / 2;

const noop = () => {};
const renderFan = (props: Partial<Parameters<typeof Fan>[0]> = {}) =>
  render(
    <svg aria-label="test host">
      <title>test host</title>
      <Fan
        p={COMPONENT_PLATEAU}
        focus={null}
        onSelect={noop}
        onHover={noop}
        reduceMotion={true}
        {...props}
      />
    </svg>,
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
    expect(chip(container, "component-identity")).toHaveAttribute("aria-hidden", "true");
    expect(chip(container, "component-quantity")).toHaveAttribute("tabindex", "0");
    // camera home: the whole chapter is back in the ring
    rerender(
      <svg aria-label="test host">
        <title>test host</title>
        <Fan
          p={COMPONENT_PLATEAU}
          focus={selected}
          onSelect={noop}
          onHover={noop}
          reduceMotion={true}
          frame={null}
        />
      </svg>,
    );
    expect(chip(container, "component-identity")).toHaveAttribute("tabindex", "0");
  });

  it("makes every chip of the on-stage chapter focusable", () => {
    const { container } = renderFan();
    for (const id of COMPONENT_CHIPS) {
      const g = chip(container, id);
      expect(g, id).toHaveAttribute("tabindex", "0");
      expect(g, id).toHaveAttribute("aria-hidden", "false");
    }
  });

  it("keeps siblings focusable while one chip has focus", () => {
    // this is the regression: focus on component-identity dims the other three
    // to 0.45, and they used to drop out of the tab order and the a11y tree
    const focused = cellById("component-identity");
    const { container } = renderFan({ focus: focused });

    for (const id of COMPONENT_CHIPS.filter((c) => c !== focused.id)) {
      const g = chip(container, id);
      expect(g, `${id} is visible but unreachable`).toHaveAttribute("tabindex", "0");
      expect(g, `${id} is visible but unannounced`).toHaveAttribute("aria-hidden", "false");
      expect(Number(g.style.opacity), `${id} should be dimmed, not hidden`).toBeGreaterThan(0);
    }
  });

  it("takes chips of an off-stage chapter out of the tab order", () => {
    const { container } = renderFan();
    for (const id of ["material-identity", "product-identity"]) {
      expect(chip(container, id), id).toHaveAttribute("tabindex", "-1");
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
    const layers = [...container.querySelectorAll(".ov-layer")];
    expect(layers.length).toBe(9);
    for (const layer of layers) expect(layer).toHaveAttribute("aria-hidden", "true");
  });

  it("renders no NaN coordinates at any scroll position", () => {
    for (const p of [0, 0.15, 0.35, 0.5, 0.66, 0.85, 1]) {
      const { container, unmount } = renderFan({ p });
      expect(container.innerHTML, `p=${p}`).not.toMatch(/NaN/);
      unmount();
    }
  });
});

describe("compact fan", () => {
  it("drops the floating chips but keeps painting the annotations", () => {
    const { container } = renderFan({ compact: true });
    expect(container.querySelectorAll(".cvt-co")).toHaveLength(0);
    // …which is exactly why the annotations must remain painted on mobile
    expect(container.querySelectorAll(".ov-layer")).toHaveLength(9);
    expect(within(container).getByText(/desk_fan/)).toBeInTheDocument();
  });

  it("turns the on-stage annotation layers into the cell's tap targets", () => {
    const opened: string[] = [];
    const { container } = renderFan({
      compact: true,
      onSelect: (cell) => opened.push(cell.id),
    });

    const layer = container.querySelector("#cvt-ov-component-identity") as SVGGElement;
    expect(layer).toHaveAttribute("role", "button");
    expect(layer).toHaveAttribute("tabindex", "0");
    expect(layer).toHaveAttribute("aria-hidden", "false");
    layer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(opened).toEqual(["component-identity"]);

    // off-stage chapters stay out of reach, exactly like the desktop chips
    const offStage = container.querySelector("#cvt-ov-product-identity") as SVGGElement;
    expect(offStage).toHaveAttribute("tabindex", "-1");
    expect(offStage).toHaveAttribute("aria-hidden", "true");
  });
});
