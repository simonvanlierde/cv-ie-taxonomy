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
    expect(screen.getByText(/where it fails/i)).toBeInTheDocument();
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

  it("steps along the matrix on ArrowRight while the instrument has focus", async () => {
    const user = userEvent.setup();
    render(<Explorable />);
    await user.click(screen.getByRole("button", { name: /component · quantity/i }));
    expect(screen.getByRole("complementary", { name: /component · quantity/i })).toHaveFocus();

    await user.keyboard("{ArrowRight}");

    expect(
      screen.getByRole("complementary", { name: /component · structure/i }),
    ).toBeInTheDocument();
    // Esc afterwards returns focus to the bay the reader ended on
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /component · structure/i })).toHaveFocus();
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

  it("moves focus into the detail when another bay is clicked, so Esc still closes it", async () => {
    const user = userEvent.setup();
    render(<Explorable />);

    await user.click(screen.getByRole("button", { name: /component · quantity/i }));
    await user.click(screen.getByRole("button", { name: /material · identity/i }));
    expect(screen.getByRole("complementary", { name: /material · identity/i })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("gives a compound cell both verdicts and each sub-task's own handling", async () => {
    const user = userEvent.setup();
    render(<Explorable />);

    await user.click(screen.getByRole("button", { name: /component · structure/i }));
    const region = screen.getByRole("complementary", { name: /component · structure/i });
    expect(region).toHaveTextContent("Partial and Emerging-but-narrow");
    // the relations sub-task is Emerging-but-narrow: its handling is "do not
    // populate", which must not be flattened into Partial's "verify"
    expect(region).toHaveTextContent(/BoC attachment relations: Treat it as unavailable/);
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

describe("What if?", () => {
  const cell = () => document.getElementById("cvt-mx-product-identity") as HTMLElement;

  it("re-derives a verdict from the reader's marks, keeps the paper's beside it, and resets", async () => {
    const user = userEvent.setup();
    render(<Explorable />);
    await user.click(screen.getByRole("button", { name: "What if?" }));
    expect(screen.getByRole("button", { name: "What if?" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(cell());
    const detail = screen.getByRole("complementary", { name: /product · identity/i });
    // B · ✗ᵐ · ✓: show it working on field photos and it reaches Strong
    const field = within(detail).getByRole("group", { name: /shown to work on field photos/i });
    await user.click(within(field).getByRole("radio", { name: "Yes" }));

    expect(cell().getAttribute("aria-label")).toMatch(
      /: Strong\. That is your marks' verdict; the paper's is Partial$/,
    );
    expect(cell().querySelector(".cvt-mx-ghost")).not.toBeNull();
    expect(document.querySelector(".cvt-whatif-note")).toHaveTextContent(
      "1 cell differs from the paper",
    );

    await user.click(screen.getByRole("button", { name: /reset to the paper/i }));
    expect(cell().getAttribute("aria-label")).toMatch(/: Partial\./);
    expect(cell().querySelector(".cvt-mx-ghost")).toBeNull();
  });

  it("shows the paper's map again when switched off, edits and all", async () => {
    const user = userEvent.setup();
    render(<Explorable />);
    await user.click(screen.getByRole("button", { name: "What if?" }));
    await user.click(cell());
    const detail = screen.getByRole("complementary", { name: /product · identity/i });
    const field = within(detail).getByRole("group", { name: /shown to work on field photos/i });
    await user.click(within(field).getByRole("radio", { name: "Yes" }));

    await user.click(screen.getByRole("button", { name: "What if?" }));
    expect(cell().getAttribute("aria-label")).toMatch(/: Partial\./);
    // the detail is the paper's again, not the editor
    expect(within(detail).queryByRole("group", { name: /evidence/i })).toBeNull();
  });

  it("keeps the paper's cell selected, so switching off never shows the reader's marks", async () => {
    const user = userEvent.setup();
    render(<Explorable />);
    await user.click(screen.getByRole("button", { name: "What if?" }));
    await user.click(cell());
    let detail = screen.getByRole("complementary", { name: /product · identity/i });
    const evidence = within(detail).getByRole("group", { name: "Evidence" });
    await user.click(within(evidence).getByRole("radio", { name: /^C,/ }));
    // away and back, then off: the detail is the paper's again
    await user.click(document.getElementById("cvt-mx-product-quantity") as HTMLElement);
    await user.click(cell());
    detail = screen.getByRole("complementary", { name: /product · identity/i });
    expect(within(detail).getByRole("status")).toHaveTextContent("The paper’s: Partial");
    await user.click(screen.getByRole("button", { name: "What if?" }));
    expect(detail).toHaveTextContent("P: Partial");
  });

  it("draws the paper's outline when only a compound cell's weaker sub-verdict moves", async () => {
    const user = userEvent.setup();
    render(<Explorable />);
    await user.click(screen.getByRole("button", { name: "What if?" }));
    const structure = document.getElementById("cvt-mx-component-structure") as HTMLElement;
    await user.click(structure);
    const detail = screen.getByRole("complementary", { name: /component · structure/i });
    const relations = within(detail).getByRole("group", { name: "BoC attachment relations" });
    const evidence = within(relations).getByRole("group", { name: "Evidence" });
    await user.click(within(evidence).getByRole("radio", { name: /^C,/ }));
    expect(structure.querySelector(".cvt-mx-ghost")).not.toBeNull();
    expect(structure.getAttribute("aria-label")).toMatch(
      /the paper's is Partial and Emerging-but-narrow$/,
    );
  });

  it("keeps focus on Reset after it is pressed", async () => {
    const user = userEvent.setup();
    render(<Explorable />);
    await user.click(screen.getByRole("button", { name: "What if?" }));
    await user.click(cell());
    const detail = screen.getByRole("complementary", { name: /product · identity/i });
    const field = within(detail).getByRole("group", { name: /shown to work on field photos/i });
    await user.click(within(field).getByRole("radio", { name: "Yes" }));
    const reset = screen.getByRole("button", { name: /reset to the paper/i });
    await user.click(reset);
    expect(reset).toHaveFocus();
    expect(reset).toHaveAttribute("aria-disabled", "true");
  });
});
