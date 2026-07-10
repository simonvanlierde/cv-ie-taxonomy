import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CvTaxonomy } from "./CvTaxonomy";
import { cellById } from "./data/taxonomy";

/**
 * The detail panel is a native <dialog>: it owns the focus trap, Esc and focus
 * return, and the component only drives open/close. That contract is the thing
 * worth testing — it is what a keyboard or screen-reader user actually meets.
 * (matchMedia and <dialog> shims live in test-setup.ts.)
 */

/** the mobile list renders a button per cell, id `cvt-m-<cellId>`; use it as the trigger */
const trigger = (cellId: string) => document.getElementById(`cvt-m-${cellId}`) as HTMLElement;

describe("detail panel", () => {
  it("opens on a cell click, and shows that cell's verdict", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger("component-identity"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(dialog).toHaveAttribute("open");
  });

  it("focuses the opening cell before showing the modal, so focus can return to it", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    const opener = trigger("component-identity");
    await user.click(opener);
    await screen.findByRole("dialog");

    // This is the component's half of the focus-return contract: the browser
    // restores focus to whatever was focused when showModal ran, so that element
    // must be the trigger and not <body>. (The restore itself is the engine's
    // job; under jsdom it is emulated — see test-setup.ts.)
    expect(opener).toHaveFocus();
  });

  it("closes on Esc, landing focus back on the cell that opened it", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    const opener = trigger("component-identity");
    await user.click(opener);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("closes on the panel's own close button", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    await user.click(trigger("material-identity"));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: /close details/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deep-links straight into a cell's panel via initialCell", async () => {
    const cell = cellById("material-quantity");
    render(<CvTaxonomy initialCell={cell.id} />);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent(cell.task);
  });

  it("ignores an initialCell that names no cell, rather than throwing", () => {
    render(<CvTaxonomy initialCell="not-a-cell" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("theme has a single owner", () => {
  it("follows the host prop, and keeps following it when the host changes it", () => {
    const { container, rerender } = render(<CvTaxonomy theme="light" />);
    const island = () => container.querySelector(".cvt");

    expect(island()).toHaveAttribute("data-theme", "light");

    // seeding state from the prop froze it at mount: the island never followed
    rerender(<CvTaxonomy theme="dark" />);
    expect(island()).toHaveAttribute("data-theme", "dark");
  });

  it("stamps an explicit theme on <html>, so the page behind the island matches", () => {
    render(<CvTaxonomy theme="dark" />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("leaves the host document alone when no theme is forced", () => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";

    render(<CvTaxonomy />);

    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(document.documentElement.style.colorScheme).toBe("");
  });

  it("restores the host document on unmount", () => {
    document.documentElement.removeAttribute("data-theme");
    const { unmount } = render(<CvTaxonomy theme="dark" />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("lets the in-page toggle beat the host prop", async () => {
    const user = userEvent.setup();
    const { container } = render(<CvTaxonomy theme="light" />);

    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));

    expect(container.querySelector(".cvt")).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});

describe("the illustrative caveat", () => {
  // the per-layer aria-hidden sweep lives in Fan.test.tsx, next to the component
  // that owns the layers; this is the integration-level half of that guarantee
  it("is rendered alongside the mock overlays", () => {
    render(<CvTaxonomy />);
    expect(screen.getByText(/overlays illustrative, not model output/i)).toBeInTheDocument();
  });
});
