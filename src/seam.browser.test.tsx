import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";

/**
 * The 881px layout seam, measured rather than declared.
 *
 * `useContainerSize` reads the page's own width through a ResizeObserver. jsdom
 * reports every box as 0×0 and never fires the observer, which leaves the unit
 * project no choice but to fake the seam through matchMedia — and a faked seam
 * proves the fallback, not the measurement. Here Chromium does the layout and
 * the observer fires for real.
 *
 * Both layouts render the same scenes, so crossing the seam must not remount
 * them: a reader halfway down the page keeps their place when a phone is
 * rotated or a window dragged narrow.
 */
const DESKTOP = { w: 1280, h: 900 };
const PHONE = { w: 420, h: 900 };

const layout = () => (document.querySelector(".cvt-scroll") as HTMLElement).dataset.layout;
const scene = (id: string) => document.getElementById(id);

// back to the configured viewport, so one test's resize cannot set up the next
afterEach(() => page.viewport(DESKTOP.w, DESKTOP.h));

describe("the layout seam, on real layout", () => {
  it("swaps the fan's chips for per-scene cell lists when the container narrows", async () => {
    render(<CvTaxonomy />);
    expect(layout()).toBe("sheet");
    expect(document.querySelector(".cvt-co")).not.toBeNull();

    await page.viewport(PHONE.w, PHONE.h);

    // a ResizeObserver delivers on the next frame, so poll rather than assume
    await vi.waitFor(() => {
      expect(layout()).toBe("phone");
      expect(document.querySelector(".cvt-co")).toBeNull();
      expect(scene("cvt-ch-Product")?.querySelector(".cvt-mcell")).not.toBeNull();
    });
  });

  it("keeps the same scenes mounted across a trip over the seam and back", async () => {
    render(<CvTaxonomy />);
    const component = scene("cvt-ch-Component");
    const camera = document.querySelector(".cvt-cam");

    await page.viewport(PHONE.w, PHONE.h);
    await vi.waitFor(() => expect(layout()).toBe("phone"));
    await page.viewport(DESKTOP.w, DESKTOP.h);
    await vi.waitFor(() => expect(layout()).toBe("sheet"));

    expect(scene("cvt-ch-Component")).toBe(component);
    // the figure too, which is where the reader's view of the drawing lives
    expect(document.querySelector(".cvt-cam")).toBe(camera);
  });
});
