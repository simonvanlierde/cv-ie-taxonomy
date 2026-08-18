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
  const [collapsed, setCollapsed] = useState(false);
  return (
    <MobileStepper
      onOpen={onOpen}
      reduceMotion
      themeToggle={null}
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
    expect(screen.getByText("P / E")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /component · structure.*partial and emerging-but-narrow/i,
      }),
    ).toBeInTheDocument();
  });

  it("folds the sheet to its handle and back, and holds the fold across steps", async () => {
    const user = userEvent.setup();
    const { container } = render(<Stepper />);
    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement); // → Product

    const toggle = () => container.querySelector(".cvt-sheet-toggle") as HTMLButtonElement;
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".cvt-mgroup")).toBeNull(); // text gone, fan alone

    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement); // → Component
    expect(toggle()).toHaveAttribute("aria-expanded", "false"); // fan-only view sticks

    await user.click(toggle());
    expect(container.querySelector(".cvt-mgroup")).not.toBeNull();
  });
});
