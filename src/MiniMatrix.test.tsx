import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MiniMatrix } from "./MiniMatrix";

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

  it("marks the selected cell with aria-pressed", () => {
    render(<MiniMatrix selectedId="component-quantity" onSelect={() => {}} />);
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });
});
