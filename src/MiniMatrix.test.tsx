import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { cellById } from "./data/taxonomy";
import { MiniMatrix } from "./MiniMatrix";
import { runsOf } from "./rubricMarks";
import { withEdits } from "./sandbox";

describe("MiniMatrix", () => {
  it("renders a button per populated cell and reports selection", async () => {
    const onSelect = vi.fn();
    render(<MiniMatrix selectedId={null} onSelect={onSelect} />);
    const [first, ...rest] = screen.getAllByRole("button");
    expect(rest.length).toBeGreaterThanOrEqual(11);
    if (!first) throw new Error("expected at least one matrix cell button");
    await userEvent.click(first);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("keeps the paper's rating drawn when the reader swaps a compound cell's sub-verdicts", () => {
    // detect/seg B and relations C (Partial and Plausible-but-unvalidated) swapped
    // to C and B reads the same as words, yet both sub-verdicts are the reader's
    const [detect, relations] = runsOf(cellById("component-structure"));
    if (!detect || !relations) throw new Error("no runs");
    const swapped = [
      { ...detect, evidence: "C" as const },
      { ...relations, evidence: "B" as const },
    ];
    render(
      <MiniMatrix
        selectedId={null}
        onSelect={() => {}}
        view={(cell) => (cell.id === "component-structure" ? withEdits(cell, swapped) : cell)}
      />,
    );
    const bay = document.getElementById("cvt-mx-component-structure");
    expect(bay?.querySelector(".cvt-mx-ghost")).not.toBeNull();
    expect(bay?.getAttribute("aria-label")).toMatch(/your marks' verdict/);
  });

  it("marks the selected cell with aria-pressed", () => {
    render(<MiniMatrix selectedId="component-quantity" onSelect={() => {}} />);
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });

  it("keeps the Strong threshold in the drawing without a redundant label", () => {
    render(<MiniMatrix selectedId={null} onSelect={() => {}} />);

    expect(screen.queryByText(/strong.*unclaimed/i)).not.toBeInTheDocument();
  });

  it("dimensions the gap to Strong in every rated bay, and none in a hatched one", () => {
    render(<MiniMatrix selectedId={null} onSelect={() => {}} />);
    for (const bay of screen.getAllByRole("button")) {
      const gap = bay.querySelector(".cvt-mx-gap");
      if (bay.dataset.ghost === "true") expect(gap).toBeNull();
      else expect(gap).not.toBeNull();
    }
  });
});
