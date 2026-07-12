import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileStepper } from "./MobileStepper";

const baseProps = () => ({
  onOpen: vi.fn(),
  reduceMotion: true,
  theme: "light" as const,
  onToggleTheme: () => {},
  themeIcon: null,
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

  it("opens a cell's panel via onOpen from a scale step", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<MobileStepper {...baseProps()} onOpen={onOpen} />);

    await user.click(container.querySelector(".cvt-stepper-next") as HTMLButtonElement); // → Product
    // the four scale cells name themselves by info type; Identity is unique on the step
    await user.click(screen.getByRole("button", { name: /identity/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
