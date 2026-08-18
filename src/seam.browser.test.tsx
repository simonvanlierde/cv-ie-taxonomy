import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";

/**
 * The 881px layout seam, measured rather than declared.
 *
 * `useContainerSize` reads the island's own width through a ResizeObserver, so
 * an embed adapts to its slot instead of to the viewport. jsdom reports every
 * box as 0×0 and never fires the observer, which leaves the unit project no
 * choice but to fake the seam through matchMedia — and a faked seam proves the
 * fallback, not the measurement. Here Chromium does the layout and the observer
 * fires for real.
 *
 * The round trip matters as much as the crossing: the seam unmounts one whole
 * tree and mounts the other, so `step` lives in CvTaxonomy rather than in
 * MobileStepper. A reader three steps in must not be put back at the start
 * because a phone was rotated.
 */
const DESKTOP = { w: 1280, h: 900 };
const PHONE = { w: 420, h: 900 };

const stepper = () => document.querySelector(".cvt-stepper");
const desktopSheet = () => document.querySelector(".cvt-scroll");
/** the stepper's live region, "Component · 3/5" */
const where = () => screen.getByRole("status").textContent;

// back to the configured viewport, so one test's resize cannot set up the next
afterEach(() => page.viewport(DESKTOP.w, DESKTOP.h));

describe("the layout seam, on real layout", () => {
  it("swaps the desktop sheet for the stepper when the container narrows", async () => {
    render(<CvTaxonomy />);
    expect(desktopSheet()).not.toBeNull();
    expect(stepper()).toBeNull();

    await page.viewport(PHONE.w, PHONE.h);

    // a ResizeObserver delivers on the next frame, so poll rather than assume
    await vi.waitFor(() => {
      expect(stepper()).not.toBeNull();
      expect(desktopSheet()).toBeNull();
    });
  });

  it("keeps the reader's step across a trip over the seam and back", async () => {
    render(<CvTaxonomy />);
    await page.viewport(PHONE.w, PHONE.h);
    await vi.waitFor(() => expect(stepper()).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: /^Start/ }));
    await userEvent.click(document.querySelector(".cvt-stepper-next") as HTMLElement);
    await vi.waitFor(() => expect(where()).toMatch(/Component · 3\/5/));

    await page.viewport(DESKTOP.w, DESKTOP.h);
    await vi.waitFor(() => expect(stepper()).toBeNull());

    await page.viewport(PHONE.w, PHONE.h);
    await vi.waitFor(() => expect(stepper()).not.toBeNull());
    expect(where()).toMatch(/Component · 3\/5/);
  });
});
