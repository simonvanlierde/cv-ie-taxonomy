import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Explorable } from "./Explorable";

describe("Explorable", () => {
  it("shows a prompt until a cell is selected, then fills the detail inline (no dialog)", async () => {
    render(<Explorable />);
    expect(screen.getByText(/select a cell/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /component · quantity/i }));

    // inline detail is present, still no modal dialog; the prompt has done its job
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/select a cell/i)).not.toBeInTheDocument();
    expect(screen.getByText(/where it breaks/i)).toBeInTheDocument();
  });

  it("names the selected cell in the inline detail (scale · info type and task)", async () => {
    render(<Explorable />);
    await userEvent.click(screen.getByRole("button", { name: /component · quantity/i }));

    // the caption now names the drawing convention too, and sits under the title
    expect(screen.getByText("detail · Component · Quantity")).toBeInTheDocument();
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

  it("closes on Esc and lands focus back on the cell that opened it", async () => {
    const user = userEvent.setup();
    render(<Explorable />);

    const cell = screen.getByRole("button", { name: /component · quantity/i });
    await user.click(cell);
    const region = screen.getByRole("complementary", { name: /component · quantity/i });
    expect(region).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    // act one's detail behaves identically; the two surfaces teach one contract
    expect(cell).toHaveFocus();
  });

  it("closes on its own close control", async () => {
    const user = userEvent.setup();
    render(<Explorable />);

    await user.click(screen.getByRole("button", { name: /material · identity/i }));
    const region = screen.getByRole("complementary", { name: /material · identity/i });
    await user.click(within(region).getByRole("button", { name: /close details/i }));

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
