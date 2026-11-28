import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDialogRegion } from "./useDialogRegion";

function Region({ onClose }: { onClose: () => void }) {
  const ref = useDialogRegion({ open: true, onClose, returnFocusTo: "opener" });
  return (
    <>
      <button id="opener" type="button">
        Open
      </button>
      <section ref={ref} tabIndex={-1} aria-label="Detail">
        <button type="button">Inside</button>
      </section>
    </>
  );
}

describe("useDialogRegion", () => {
  it("keeps focus in the open region when the parent passes a new onClose", () => {
    const { rerender } = render(<Region onClose={() => {}} />);
    const region = screen.getByRole("region", { name: "Detail" });
    expect(region).toHaveFocus();
    // the parent rebuilds its close callback when a media query flips
    rerender(<Region onClose={() => {}} />);
    expect(region).toHaveFocus();
  });
});
