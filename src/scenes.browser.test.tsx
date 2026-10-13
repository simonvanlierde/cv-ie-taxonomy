import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";

/**
 * The scenes, driven by real scrolling: no scene is pinned here. jsdom has no
 * IntersectionObserver and no scroll timelines, so the scene detection and the
 * CSS that moves the fan can only be checked in a real engine.
 */
const DESKTOP = { w: 1280, h: 900 };

const scroller = () => document.querySelector(".cvt-scroll") as HTMLElement;
const sticky = () => document.querySelector(".cvt-sticky") as HTMLElement;
const num = (prop: string) => Number(getComputedStyle(sticky()).getPropertyValue(prop));

/** put a scene's top at `at` (a fraction of the screen height) */
function scrollSceneTo(id: string, at: number) {
  const el = document.getElementById(id) as HTMLElement;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - at * innerHeight });
}

afterEach(async () => {
  window.scrollTo({ top: 0 });
  await page.viewport(DESKTOP.w, DESKTOP.h);
});

describe("the scenes, on real scrolling", () => {
  it("reports the scene crossing the middle of the screen", async () => {
    render(<CvTaxonomy />);
    for (const scale of ["Product", "Component", "Material"]) {
      // the scene's top a little above the middle line
      scrollSceneTo(`cvt-ch-${scale}`, 0.4);
      await vi.waitFor(() => expect(scroller().dataset.chapter).toBe(scale));
    }
    scrollSceneTo("cvt-matrix", 0.3);
    await vi.waitFor(() => expect(scroller().dataset.chapter).toBe("outro"));
  });

  it("on a phone, reports the scene crossing the text under the figure", async () => {
    render(<CvTaxonomy />);
    await page.viewport(420, 900);
    await vi.waitFor(() => expect(scroller().dataset.layout).toBe("phone"));
    // the scene's heading readable under the figure, below the middle of the screen
    scrollSceneTo("cvt-ch-Component", 0.7);
    await vi.waitFor(() => expect(scroller().dataset.chapter).toBe("Component"));
  });

  it("explodes, drifts and blurs the fan with the scroll, and shows one scene's read-outs", async () => {
    render(<CvTaxonomy />);
    // the scroll-driven block exists and is in force (Chromium has view timelines)
    expect(getComputedStyle(sticky()).animationName).toContain("cvt-explode");

    scrollSceneTo("cvt-ch-Product", 0.3);
    await vi.waitFor(() => expect(num("--pr-product")).toBeCloseTo(1, 3));
    expect(num("--e")).toBeCloseTo(0, 3);
    expect(num("--pr-component")).toBeCloseTo(0, 3);

    scrollSceneTo("cvt-ch-Component", 0.3);
    await vi.waitFor(() => expect(num("--pr-component")).toBeCloseTo(1, 3));
    expect(num("--e")).toBeCloseTo(1, 3);
    expect(num("--m")).toBeCloseTo(0, 3);
    expect(num("--pr-product")).toBeCloseTo(0, 3);

    scrollSceneTo("cvt-ch-Material", 0.3);
    await vi.waitFor(() => expect(num("--pr-material")).toBeCloseTo(1, 3));
    expect(num("--m")).toBeCloseTo(1, 3);
    expect(num("--fog")).toBeGreaterThan(0);
  });

  it("keeps the drawing's aspect ratio in a narrow column, so the camera centres", async () => {
    // a 1024px sheet gives the figure a column narrower than the screen is tall
    await page.viewport(1024, 768);
    render(<CvTaxonomy />);
    const stage = document.querySelector(".cvt-stage") as HTMLElement;
    await vi.waitFor(() => {
      const r = stage.getBoundingClientRect();
      expect(r.width / r.height).toBeCloseTo(800 / 875, 2);
    });
  });
});
