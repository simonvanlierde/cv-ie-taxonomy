import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { CvTaxonomy } from "./CvTaxonomy";
import { SCALES } from "./data/taxonomy";
import { SCENES } from "./params";

/**
 * WCAG 2.2 AA scan at each stop a reader can land on. axe checks what a
 * rendered page can prove (names, roles, contrast of real text on real
 * backgrounds), so it runs here on Chromium's layout, not on jsdom's 0×0 boxes.
 *
 * Text sits on a plain background colour, so axe can measure its contrast:
 * each scan must pass color-contrast on real nodes, not only report no
 * violations. Text over the drawing's grid stays "incomplete" (axe reads a
 * background image as unknown); the token tests cover that.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations() {
  // let every time-based fade and move finish, so contrast is read on settled
  // opacity; scroll-driven and endless animations (the idle spin, the caret)
  // never finish, so they are left out
  await new Promise(requestAnimationFrame);
  const settling = document
    .getAnimations()
    .filter(
      (a) => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity,
    );
  await Promise.all(settling.map((a) => a.finished.catch(() => undefined)));
  const { violations, passes } = await axe.run(document, {
    runOnly: { type: "tag", values: TAGS },
  });
  const contrast = passes.find((p) => p.id === "color-contrast");
  expect(contrast?.nodes.length ?? 0, "color-contrast passes on some text").toBeGreaterThan(0);
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("WCAG 2.2 AA (axe)", () => {
  it.each(SCENES)("%s scene", async (chapter) => {
    render(<CvTaxonomy debugChapter={chapter} />);
    expect(await violations()).toEqual([]);
  });

  it("an open cell detail", async () => {
    render(<CvTaxonomy initialCell="component-structure" />);
    await screen.findByRole("complementary", { name: /component · structure/i });
    expect(await violations()).toEqual([]);
  });

  it.each(["product-identity", "component-structure"])("the %s rubric editor", async (id) => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="outro" />);
    await user.click(screen.getByRole("button", { name: "What if?" }));
    await user.click(document.getElementById(`cvt-mx-${id}`) as HTMLElement);
    const detail = screen.getByRole("complementary");
    expect(within(detail).getAllByRole("radio").length).toBeGreaterThan(0);
    expect(await violations()).toEqual([]);
  });

  it.each(SCALES)("the open %s real-model panel", async (scale) => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter={scale} />);
    const chapter = document.getElementById(`cvt-ch-${scale}`) as HTMLElement;
    const toggle = within(chapter).getByRole("button", { name: /try your own photo/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(chapter).getByLabelText(/use your own photo/i)).toBeInTheDocument();
    expect(
      within(chapter).getByRole("button", { name: /remove OWL-ViT downloads/i }),
    ).toBeVisible();
    expect(await violations()).toEqual([]);
  });

  it("the phone layout", async () => {
    // the component switches layout on its own width, not the viewport's
    render(
      <div style={{ width: 420 }}>
        <CvTaxonomy />
      </div>,
    );
    await vi.waitFor(() => expect(document.querySelector(".cvt-mcell")).not.toBeNull());
    expect(await violations()).toEqual([]);
  });
});
