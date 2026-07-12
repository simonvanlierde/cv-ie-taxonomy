import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Explorable } from "./Explorable";

describe("Explorable", () => {
  it("shows a prompt until a cell is selected, then fills the detail inline (no dialog)", async () => {
    render(<Explorable />);
    expect(screen.getByText(/select a cell/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /component · quantity/i }));

    // inline detail is present, still no modal dialog
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/dominant failure mode/i)).toBeInTheDocument();
  });

  it("marks the selected cell pressed and swaps the detail on a new selection", async () => {
    render(<Explorable />);
    await userEvent.click(screen.getByRole("button", { name: /component · quantity/i }));
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /material · condition/i }));
    const stillOne = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(stillOne).toHaveLength(1);
  });
});
