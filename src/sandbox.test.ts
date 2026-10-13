import { describe, expect, it } from "vitest";
import deposit from "./data/deposit-rubric-marks.json";
import { cellById, cells } from "./data/taxonomy";
import { runsOf } from "./rubricMarks";
import { changedCount, type Edits, type Marks, toDepositCsv, withEdits } from "./sandbox";

/** the paper's own marks for a cell, as the sandbox holds them */
const marksOf = (id: string): Marks[] =>
  runsOf(cellById(id)).map(({ evidence, capture, deployed, basis }) => ({
    evidence,
    capture,
    deployed,
    basis,
  }));

describe("the What if? sandbox", () => {
  it("leaves a cell as the paper has it until the reader changes a mark", () => {
    const cell = cellById("product-identity");
    expect(withEdits(cell, undefined)).toBe(cell);
    expect(changedCount({})).toBe(0);
  });

  it("re-derives the verdict through the paper's ladder", () => {
    // Product · Identity is B · ✗ᵐ · ✓: pass its field gate and it reaches Strong
    const [run] = marksOf("product-identity");
    if (!run) throw new Error("no run");
    const edits: Edits = { "product-identity": [{ ...run, capture: "pass" }] };
    const cell = withEdits(cellById("product-identity"), edits["product-identity"]);
    expect(cell.maturity).toBe("Strong");
    expect(cell.rubricMarks).toBe("B · ✓ · ✓");
    expect(changedCount(edits)).toBe(1);
  });

  it("gives a field gate set back to ✗ its original basis", () => {
    const [run] = marksOf("product-identity");
    if (!run) throw new Error("no run");
    const cell = withEdits(cellById("product-identity"), [{ ...run, capture: "fail" }]);
    expect(cell.rubricMarks).toBe("B · ✗ᵐ · ✓");
    expect(changedCount({ "product-identity": [{ ...run, capture: "fail" }] })).toBe(0);
  });

  it("re-derives each sub-verdict of a compound cell, and stands it at the stronger", () => {
    const [detect, relations] = marksOf("component-structure");
    if (!detect || !relations) throw new Error("no runs");
    const cell = withEdits(cellById("component-structure"), [
      { ...detect, evidence: "C" },
      { ...relations, evidence: "B" },
    ]);
    expect(cell.subVerdicts?.map((s) => s.maturity)).toEqual([
      "Plausible-but-unvalidated",
      "Partial",
    ]);
    expect(cell.maturity).toBe("Partial");
    // the printed marks still parse back into the same two labelled runs
    expect(runsOf(cell).map((r) => r.label)).toEqual(["detect/seg", "relations"]);
  });

  it("exports the paper's own marks exactly as the deposit records them", () => {
    const [header, ...rows] = toDepositCsv({}).trim().split("\n");
    expect(header).toBe(
      "cell,sub_cell,evidence_mark,field_gate,field_gate_basis,deployment_gate,derived_verdict,evidence_citekeys",
    );
    expect(rows).toHaveLength(deposit.length);
    rows.forEach((line, i) => {
      const d = deposit[i];
      if (!d) throw new Error(`no deposit row ${i}`);
      const want = [
        d.cell,
        d.sub_cell ?? "",
        d.evidence_mark,
        d.field_gate,
        d.field_gate_basis ?? "",
        d.deployment_gate,
        d.derived_verdict,
        d.evidence_citekeys.join(";"),
      ].join(",");
      expect(line, d.cell).toBe(want);
    });
  });

  it("writes the reader's marks into the export", () => {
    const [run] = marksOf("product-identity");
    if (!run) throw new Error("no run");
    const csv = toDepositCsv({ "product-identity": [{ ...run, capture: "pass" }] });
    expect(csv.split("\n")[1]).toMatch(/^Product · Identity,,B,✓,,✓,Strong,/);
  });

  it("covers every populated cell", () => {
    const populated = cells.filter((c) => !c.structurallyEmpty).length;
    const named = new Set(deposit.map((d) => d.cell.replace(/\s*\(.*\)$/, "")));
    expect(named.size).toBe(populated);
  });
});
