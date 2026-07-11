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

  it("highlights the selected cell's part on the diagram fan", async () => {
    const { container } = render(<Explorable />);
    await userEvent.click(screen.getByRole("button", { name: /component · quantity/i }));
    // component-quantity → motor (mo)
    const motor = container.querySelector('[data-part="mo"][data-highlight="true"]');
    expect(motor).toBeInTheDocument();
  });
});
