import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileStepper } from "./MobileStepper";

const baseProps = () => ({
  onOpen: vi.fn(),
  reduceMotion: true,
  themeToggle: null,
});

describe("MobileStepper", () => {
  it("starts on the intro with Back disabled, and reaches the matrix via Next", async () => {
    const user = userEvent.setup();
    const { container } = render(<MobileStepper {...baseProps()} />);
    expect(screen.getByRole("heading", { name: /what can a machine/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();

    for (let i = 0; i < 4; i++) {
      await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement);
    }
    expect(screen.getByText(/the full matrix/i)).toBeInTheDocument();
    expect(container.querySelector(".cvt-stepper-next")).toBeDisabled();
  });

  it("carries the text-table twin on the matrix step", async () => {
    const user = userEvent.setup();
    const { container } = render(<MobileStepper {...baseProps()} />);
    for (let i = 0; i < 4; i++) {
      await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement);
    }
    expect(screen.getByRole("button", { name: /table view/i })).toBeInTheDocument();
  });

  it("opens a cell's panel via onOpen from a scale step", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<MobileStepper {...baseProps()} onOpen={onOpen} />);

    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement); // → Product
    const list = container.querySelector(".cvt-mgroup") as HTMLElement;
    await user.click(within(list).getByRole("button", { name: /identity/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows both sub-verdicts on the compound structure cell, not a flattened letter", async () => {
    const user = userEvent.setup();
    const { container } = render(<MobileStepper {...baseProps()} />);
    // → Product → Component, whose Structure cell is the paper's split verdict
    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement);
    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement);
    expect(screen.getByText("P / E")).toBeInTheDocument();
  });

  it("carries no info-type filter — a four-row list needs none", async () => {
    const user = userEvent.setup();
    const { container } = render(<MobileStepper {...baseProps()} />);
    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement); // → Product
    expect(container.querySelector(".cvt-filtergroup")).toBeNull();
  });
});
