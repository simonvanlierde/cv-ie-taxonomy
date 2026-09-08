import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Cell } from "./data/types";
import { MobileStepper } from "./MobileStepper";

/** The reading position is parent-owned in production — CvTaxonomy holds it so
 *  the layout seam cannot unmount it — so the tests drive it the same way. */
function Stepper({ onOpen = () => {} }: { onOpen?: (cell: Cell, focusId?: string) => void }) {
  const [step, setStep] = useState(0);
  // production starts folded (CvTaxonomy owns this): the scale steps arrive with
  // the drawing on the whole screen and the sheet at its title
  const [collapsed, setCollapsed] = useState(true);
  return (
    <MobileStepper
      onOpen={onOpen}
      reduceMotion
      step={step}
      setStep={setStep}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
    />
  );
}

describe("MobileStepper", () => {
  it("starts on the intro without Back, announces progress, and reaches the matrix", async () => {
    const user = userEvent.setup();
    const { container } = render(<Stepper />);
    expect(screen.getByRole("heading", { name: /what can a machine/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Intro · 1/5");

    for (let i = 0; i < 4; i++) {
      await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement);
    }
    expect(screen.getByRole("heading", { name: /mostly gaps/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Matrix · 5/5");
    expect(container.querySelector(".cvt-stepper-next")).not.toBeInTheDocument();
  });

  it("keeps the evidence contract visible and expands the full introduction", async () => {
    const user = userEvent.setup();
    render(<Stepper />);

    expect(screen.getAllByText(/no model run/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/every verdict comes from/i)).toBeVisible();
    expect(screen.queryByText(/circular-economy research keeps asking/i)).not.toBeVisible();

    const toggle = screen.getByRole("button", { name: /how to read this/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);

    expect(screen.getByText(/circular-economy research keeps asking/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /show less/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("carries the text-table twin on the matrix step", async () => {
    const user = userEvent.setup();
    const { container } = render(<Stepper />);
    for (let i = 0; i < 4; i++) {
      await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement);
    }
    expect(screen.getByRole("button", { name: /plain table/i })).toBeInTheDocument();
  });

  it("opens a cell's panel via onOpen from a scale step", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<Stepper onOpen={onOpen} />);

    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement); // → Product
    await user.click(container.querySelector(".cvt-sheet-toggle") as HTMLButtonElement);
    const list = container.querySelector(".cvt-mgroup") as HTMLElement;
    const identity = within(list).getByRole("button", {
      name: /product · identity.*maturity: partial/i,
    });
    await user.click(identity);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows both sub-verdicts on the compound structure cell, not a flattened letter", async () => {
    const user = userEvent.setup();
    const { container } = render(<Stepper />);
    // → Product → Component, whose Structure cell is the paper's split verdict
    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement);
    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement);
    await user.click(container.querySelector(".cvt-sheet-toggle") as HTMLButtonElement);
    expect(screen.getByText("P / E")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /component · structure.*partial and emerging-but-narrow/i,
      }),
    ).toBeInTheDocument();
  });

  it("arrives folded to its title, opens, and holds the reader's choice across steps", async () => {
    const user = userEvent.setup();
    const { container } = render(<Stepper />);
    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement); // → Product

    const toggle = () => container.querySelector(".cvt-sheet-toggle") as HTMLButtonElement;
    // folded, but never a bare handle: the strip names the scale it holds, so
    // there is something to open and something saying what is behind it
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveTextContent(/one product, seen whole/i);
    expect(container.querySelector(".cvt-mgroup")).toBeNull(); // text away, fan alone

    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(".cvt-mgroup")).not.toBeNull();

    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement); // → Component
    expect(toggle()).toHaveAttribute("aria-expanded", "true"); // the reader's choice sticks
  });
});
