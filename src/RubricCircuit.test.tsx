import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cellById } from "./data/taxonomy";
import { RubricCircuit } from "./RubricCircuit";

/**
 * `Seg` state and the `data-live` node marker are derived from the printed
 * rubric marks by evidenceCarries/captureCarries/deployedCarries — a chain
 * that dies at its first failure. This exercises the three shapes that chain
 * can take, each keyed to one Seg's data-state ("evidence", "capture",
 * "deployed", in DOM order).
 */

const segs = (container: HTMLElement) => [...container.querySelectorAll(".cvt-circuit-seg")];
const states = (container: HTMLElement) => segs(container).map((s) => s.getAttribute("data-state"));
const live = (container: HTMLElement) =>
  container.querySelector(".cvt-circuit-node[data-live]")?.getAttribute("data-live");

describe("RubricCircuit", () => {
  it("draws a mid-break run: evidence carries, capture breaks, deployment goes dead", () => {
    // product-identity: "B · ✗ᵐ · ✓" — evidence is benchmarked (carries), but
    // fails end-of-life capture, so the printed ✓ on deployment never fires.
    const cell = cellById("product-identity");
    const { container } = render(<RubricCircuit cell={cell} />);
    expect(states(container)).toEqual(["carries", "breaks", "dead"]);
    expect(live(container)).toBe("false");
  });

  it("draws a run that dies at the first segment: narrow-class evidence never carries", () => {
    // component-condition: "C · ✗ᵘ · ✗" — evidence is concept/adjacent-domain
    // only (not B), so the run breaks immediately and the rest goes dead.
    const cell = cellById("component-condition");
    const { container } = render(<RubricCircuit cell={cell} />);
    expect(states(container)).toEqual(["breaks", "dead", "dead"]);
    expect(live(container)).toBe("false");
  });

  it("marks the node live only when a run completes at B · ✓ · ✓", () => {
    // No cell in the corpus reaches this: the paper's central finding is that
    // nothing clears all three gates under end-of-life capture. Marking the
    // live node still needs a positive case, so this cell is a real one with
    // its rubricMarks overridden to the one printed form that completes.
    const cell = { ...cellById("product-identity"), rubricMarks: "B · ✓ · ✓" };
    const { container } = render(<RubricCircuit cell={cell} />);
    expect(states(container)).toEqual(["carries", "carries", "carries"]);
    expect(live(container)).toBe("true");
  });

  it("renders one run line per sub-verdict on a compound cell", () => {
    // component-structure: "detect/seg B · ✗ᵃ · ✗; relations N · ✗ᵃ · ✗"
    const cell = cellById("component-structure");
    const { container } = render(<RubricCircuit cell={cell} />);
    const lines = container.querySelectorAll(".cvt-circuit-run");
    expect(lines).toHaveLength(2);
    expect(states(container)).toEqual(["carries", "breaks", "dead", "breaks", "dead", "dead"]);
  });
});
