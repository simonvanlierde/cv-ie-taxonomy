import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";

/**
 * Esc with a citation open inside an open detail.
 *
 * Two things want that keypress: the browser's close watcher, which owns the
 * popover in the top layer, and our own bubble-phase handler in useDialogRegion,
 * which owns the detail. `hasOpenPopover` is there to make the nearer one win,
 * so a reader who opened a reference and changed their mind gets the reference
 * closed and keeps the detail they were reading.
 *
 * jsdom has neither a top layer nor a close watcher, so there our handler is the
 * only claimant and the ordering question cannot come up. This is the engine
 * answering it.
 *
 * Driven through the phone layout because its cell lists are plain buttons, which
 * hold still for a trusted click.
 */
// the viewport is per-page, not per-test, so hand the next test its desktop back
afterEach(() => page.viewport(1280, 900));

const popover = () => document.querySelector(".cvt-cite-pop:popover-open");

describe("a citation inside a detail, in a real engine", () => {
  it("gives Esc to the popover first, and the detail keeps the next one", async () => {
    render(<CvTaxonomy />);
    await page.viewport(420, 900);
    await vi.waitFor(() => expect(document.querySelector(".cvt-mcell")).not.toBeNull());
    const cell = document.querySelector(".cvt-mcell") as HTMLElement;
    cell.scrollIntoView({ block: "end" });
    await userEvent.click(cell);

    const detail = await screen.findByRole("dialog");
    // the chips carry author–year, so a year is what tells one from a control;
    // take the first chip actually on screen rather than the first in the DOM
    const cite = within(detail)
      .getAllByRole("button", { name: /\d{4}/ })
      .find((b) => b.checkVisibility()) as HTMLElement;
    await userEvent.click(cite);
    expect(popover()).not.toBeNull();

    await userEvent.keyboard("{Escape}");
    expect(popover()).toBeNull();
    // the detail underneath is still there — the whole point of the guard
    expect(detail).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
