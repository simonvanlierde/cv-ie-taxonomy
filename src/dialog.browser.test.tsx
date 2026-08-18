import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { Outro } from "./CvTaxonomy";

/**
 * The native <dialog> contract, in a real engine.
 *
 * The unit project asserts our half of this — that the opener is focused before
 * showModal, so the browser has an element to return focus to — and takes the
 * browser's half on trust, because jsdom ships HTMLDialogElement with none of
 * its methods and test-setup emulates them. Emulated, the focus restore below
 * would be asserting our own polyfill. Here it is Chromium's.
 */
describe("the plain-table twin, in a real engine", () => {
  it("restores focus to its opener on close", async () => {
    const { container } = render(<Outro />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;

    const opener = screen.getByRole("button", { name: /plain table/i });
    await userEvent.click(opener);
    expect(dialog.open).toBe(true);

    await userEvent.click(within(dialog).getByRole("button", { name: /close table view/i }));
    expect(dialog.open).toBe(false);
    // the browser's own restore, not an emulation of it
    expect(document.activeElement).toBe(opener);
  });

  it("is modal: the page behind it is not reachable by Tab", async () => {
    render(<Outro />);

    await userEvent.click(screen.getByRole("button", { name: /plain table/i }));
    const dialog = screen.getByRole("dialog");

    // Ten tabs is more than the dialog holds, so an untrapped focus would have
    // escaped to the page behind by now. The top layer is what stops it, and
    // only a real engine implements the top layer.
    for (let i = 0; i < 10; i++) await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("closes on Esc, which is the engine's close watcher, not our handler", async () => {
    const { container } = render(<Outro />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;

    await userEvent.click(screen.getByRole("button", { name: /plain table/i }));
    expect(dialog.open).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
  });
});
