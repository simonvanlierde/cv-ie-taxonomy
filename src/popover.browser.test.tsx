import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
 * Driven through the mobile sheet because the sheet's cell list is a plain list
 * of buttons: the desktop callouts ride the fan's spring and are never still
 * enough for a trusted click to land on.
 */
const popover = () => document.querySelector(".cvt-cite-pop:popover-open");

describe("a citation inside a detail, in a real engine", () => {
  it("gives Esc to the popover first, and the detail keeps the next one", async () => {
    render(<CvTaxonomy />);
    await page.viewport(420, 900);
    await vi.waitFor(() => expect(document.querySelector(".cvt-stepper")).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: /^Start/ }));
    // the scale steps arrive folded to their title, so open the sheet for its cells
    await userEvent.click(document.querySelector(".cvt-sheet-toggle") as HTMLElement);
    await vi.waitFor(() => expect(document.querySelector(".cvt-mcell")).not.toBeNull());
    await userEvent.click(document.querySelector(".cvt-mcell") as HTMLElement);

    const detail = await screen.findByRole("dialog");
    // the chips carry author–year, so a year is what tells one from a control;
    // the sheet's prose is folded away until the reader scrolls it up, so take
    // the first chip actually on screen rather than the first in the DOM
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
