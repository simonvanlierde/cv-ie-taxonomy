import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";

/**
 * `inert` on the stepper while the detail sheet covers it.
 *
 * The unit project can only assert that the attribute is on the element, which
 * is a restatement of the JSX: jsdom parses `inert` and implements none of it,
 * so a stepper that stayed reachable would still pass there. What the attribute
 * is for is the reader behind the sheet — a browse cursor walks straight past a
 * focus trap, and a stray tap on a control it cannot see pages the drawing out
 * from under a sheet the reader is still reading.
 *
 * Chromium takes an inert subtree out of hit testing, so the proof is that the
 * point over "Next" belongs to the page and not to the button. Both directions
 * are asserted: an inert that never clears is its own bug.
 */
const PHONE = { w: 420, h: 900 };

const nextBtn = () => document.querySelector(".cvt-stepper-next") as HTMLElement;
const centreOf = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
};

/** Narrow past the seam, page to the Product step, and open a cell's sheet. */
async function openSheetOverStepper() {
  render(<CvTaxonomy />);
  await page.viewport(PHONE.w, PHONE.h);
  await vi.waitFor(() => expect(document.querySelector(".cvt-stepper")).not.toBeNull());

  await userEvent.click(screen.getByRole("button", { name: /^Start/ }));
  // the scale steps arrive folded to their title, so open the sheet for its cells
  await userEvent.click(document.querySelector(".cvt-sheet-toggle") as HTMLElement);
  await vi.waitFor(() => expect(document.querySelector(".cvt-mcell")).not.toBeNull());
  expect(screen.getByRole("status")).toHaveTextContent("Product · 2/5");

  await userEvent.click(document.querySelector(".cvt-mcell") as HTMLElement);
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
}

// the viewport is per-page, not per-test, so hand the next test its desktop back
afterEach(() => page.viewport(1280, 900));

describe("the covered stepper, in an engine that implements inert", () => {
  it("is not there to be pressed while the sheet is over it", async () => {
    await openSheetOverStepper();

    const next = nextBtn();
    // the button still has a box — inert hides nothing — but the pixel over it
    // belongs to the page behind, which is why a tap cannot page the drawing
    expect(next.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(document.querySelector(".cvt-stepper")?.contains(centreOf(next))).toBe(false);
  });

  it("comes back when the sheet closes", async () => {
    await openSheetOverStepper();
    const next = nextBtn();

    await userEvent.click(screen.getByRole("button", { name: /close details/i }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // same point, same button: nothing else was covering it, the inert was.
    // Polled, because the close runs inside a view transition and its snapshot
    // owns the pixels until it finishes.
    await vi.waitFor(() => expect(centreOf(next)).toBe(next));
    await userEvent.click(next);
    expect(screen.getByRole("status")).toHaveTextContent("Component · 3/5");
  });
});
