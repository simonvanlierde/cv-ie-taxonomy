import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateMedia: (media: {
      reducedMotion?: "reduce" | null;
      forcedColors?: "active" | null;
    }) => Promise<void>;
  }
}

/**
 * The two media queries a reader sets for access, emulated on the real page.
 *
 * Reduced motion: the fan must stop following the scroll and stop gliding;
 * each scene shows its finished pose, and only the read-outs keep a short fade
 * so a scene change is still seen.
 *
 * Forced colours: high-contrast modes leave SVG fill and stroke alone, so the
 * drawing's lines must be mapped to the system text colour by hand.
 */
const sticky = () => document.querySelector(".cvt-sticky") as HTMLElement;

afterEach(() => commands.emulateMedia({ reducedMotion: null, forcedColors: null }));

describe("reduced motion", () => {
  it("drops the scroll-driven drawing and the camera move, and shows the finished pose", async () => {
    await commands.emulateMedia({ reducedMotion: "reduce" });
    render(<CvTaxonomy debugChapter="Component" />);

    const style = getComputedStyle(sticky());
    expect(style.animationName).toBe("none");
    // the parts cut to the pose; only the presence fade is left
    expect(style.transitionProperty).not.toMatch(/--e\b/);
    // the kill switch leaves 0.01ms, which no one sees
    const camera = getComputedStyle(document.querySelector(".cvt-cam") as HTMLElement);
    expect(Number.parseFloat(camera.transitionDuration)).toBeLessThan(0.001);
    await vi.waitFor(() =>
      expect(Number(style.getPropertyValue("--pr-component"))).toBeCloseTo(1, 3),
    );
    expect(Number(style.getPropertyValue("--e"))).toBe(1);
  });

  it("scrubs the drawing with the scroll when motion is welcome", async () => {
    render(<CvTaxonomy />);
    expect(getComputedStyle(sticky()).animationName).toContain("cvt-explode");
  });
});

/** what a system colour keyword resolves to on this page, for comparison */
function systemColour(keyword: string): string {
  const probe = document.createElement("span");
  probe.style.color = keyword;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

describe("forced colours", () => {
  it("draws the fan's lines and the read-outs in the system text colour", async () => {
    await commands.emulateMedia({ forcedColors: "active" });
    render(<CvTaxonomy debugChapter="Component" />);
    const text = systemColour("CanvasText");

    for (const selector of [".fan-ring", ".fan-part rect", ".ov-leader", ".ov-bbox-r"]) {
      const el = document.querySelector(selector) as SVGElement;
      expect(getComputedStyle(el).stroke, selector).toBe(text);
    }
    expect(getComputedStyle(document.querySelector(".ov-tag text") as SVGElement).fill).toBe(text);
    // the colour washes go: two colours cannot show them
    expect(getComputedStyle(document.querySelector(".ov-segfill") as SVGElement).display).toBe(
      "none",
    );
  });
});
