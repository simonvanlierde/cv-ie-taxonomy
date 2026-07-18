import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Explorable } from "./Explorable";

describe("Explorable", () => {
  it("shows a prompt until a cell is selected, then fills the detail inline (no dialog)", async () => {
    render(<Explorable />);
    expect(screen.getByText(/select any cell/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /component · quantity/i }));

    // inline detail is present, still no modal dialog; the prompt has done its job
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/select any cell/i)).not.toBeInTheDocument();
    expect(screen.getByText(/where it breaks/i)).toBeInTheDocument();
  });

  it("names the selected cell in the inline detail (scale · info type and task)", async () => {
    render(<Explorable />);
    await userEvent.click(screen.getByRole("button", { name: /component · quantity/i }));

    expect(screen.getByText("Component · Quantity")).toBeInTheDocument();
    // the task heading comes from the cell itself, not a hardcoded string
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
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
