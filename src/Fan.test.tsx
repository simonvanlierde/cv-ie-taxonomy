import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cellById } from "./data/taxonomy";
import { Fan } from "./Fan";
import { TIMELINE } from "./timeline";

/**
 * The floating chips ARE the controls. Their operability must track the chapter
 * and the info-type filter — never the focus dimming, which only fades siblings
 * to 0.45 while leaving them plainly on screen.
 *
 * Deriving `active` from opacity meant that focusing one chip stripped tabIndex
 * and set aria-hidden on every sibling, so Tab left the fan after a single chip.
 */

// `globals: false`, so Testing Library cannot register its own auto-cleanup:
// without this, renders pile up in document.body across tests.
afterEach(cleanup);

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
        isDim={() => false}
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

  it("takes filtered-out chips out of the tab order", () => {
    const { container } = renderFan({ isDim: (c) => c.informationType !== "Identity" });

    expect(chip(container, "component-identity")).toHaveAttribute("tabindex", "0");
    expect(chip(container, "component-structure")).toHaveAttribute("tabindex", "-1");
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
    // …which is exactly why the illustrative caveat must survive on mobile
    expect(container.querySelectorAll(".ov-layer")).toHaveLength(9);
    expect(within(container).getByText(/desk_fan/)).toBeInTheDocument();
  });
});
