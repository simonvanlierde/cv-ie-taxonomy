import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";

declare module "vitest/browser" {
  interface BrowserCommands {
    reduceMotion: (on: boolean) => Promise<void>;
  }
}

/**
 * Reduced motion, on the real media query. The fan must stop following the
 * scroll and stop gliding: each scene shows its finished pose, and only the
 * read-outs keep a short fade so a scene change is still seen.
 */
const sticky = () => document.querySelector(".cvt-sticky") as HTMLElement;

afterEach(() => commands.reduceMotion(false));

describe("reduced motion", () => {
  it("drops the scroll-driven drawing and the camera move, and shows the finished pose", async () => {
    await commands.reduceMotion(true);
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
