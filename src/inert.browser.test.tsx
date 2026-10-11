import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";

/**
 * `inert` on the scenes while the detail sheet covers them.
 *
 * The unit project can only assert that the attribute is on the element, which
 * is a restatement of the JSX: jsdom parses `inert` and implements none of it,
 * so scenes that stayed reachable would still pass there. What the attribute is
 * for is the reader behind the sheet — a browse cursor walks straight past a
 * focus trap, and a stray tap on a control it cannot see opens another cell
 * under a sheet the reader is still reading.
 *
 * Chromium takes an inert subtree out of hit testing, so the proof is that the
 * point over a cell button belongs to the page and not to the button. Both
 * directions are asserted: an inert that never clears is its own bug.
 */
const PHONE = { w: 420, h: 900 };

const centreOf = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
};

/** Narrow past the seam, bring a cell button on screen above the sheet's reach,
 *  and open a cell's sheet from it. */
async function openSheetOverScenes() {
  render(<CvTaxonomy />);
  await page.viewport(PHONE.w, PHONE.h);
  await vi.waitFor(() => expect(document.querySelector(".cvt-mcell")).not.toBeNull());

  // the sheet is 82vh tall, so the button must sit in the top part of the screen;
  // under the sticky figure it would be the figure's pixel, not the page's
  const cells = [...document.querySelectorAll<HTMLElement>("#cvt-ch-Product .cvt-mcell")];
  const button = cells.at(-1) as HTMLElement;
  button.scrollIntoView({ block: "center" });
  window.scrollBy(0, PHONE.h * 0.05);
  await userEvent.click(button);
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
  return button;
}

// the viewport is per-page, not per-test, so hand the next test its desktop back
afterEach(() => page.viewport(1280, 900));

describe("the covered scenes, in an engine that implements inert", () => {
  it("are not there to be pressed while the sheet is over them", async () => {
    const button = await openSheetOverScenes();

    // the button still has a box on screen — inert hides nothing — but the pixel
    // over it does not belong to it, which is why a tap cannot open another cell
    const r = button.getBoundingClientRect();
    expect(r.width).toBeGreaterThan(0);
    expect(r.top >= 0 && r.bottom <= innerHeight, "the button is on screen").toBe(true);
    expect((document.querySelector(".cvt-scroll") as HTMLElement).inert).toBe(true);
    expect(button.contains(centreOf(button))).toBe(false);
  });

  it("come back when the sheet closes", async () => {
    const button = await openSheetOverScenes();

    await userEvent.click(screen.getByRole("button", { name: /close details/i }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // same point, same button. Polled, because the close runs inside a view
    // transition and its snapshot owns the pixels until it finishes.
    await vi.waitFor(() => expect(button.contains(centreOf(button))).toBe(true));
    await userEvent.click(button);
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
  });
});
