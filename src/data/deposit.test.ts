import { describe, expect, it } from "vitest";
import { runsOf, verdictOf } from "../rubricMarks";
import deposit from "./deposit-rubric-marks.json";
import { cellById, cells } from "./taxonomy";

// A copy of the article's deposited rubric-marks.json. To update it, rebuild the
// deposit, copy the file here, and change taxonomy.json until this test passes.

// "Component · Structure (BoC)" -> "component-structure"
const idOf = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split("·")
    .map((s) => s.trim().toLowerCase())
    .join("-");

const BASIS = {
  measured: "measured",
  "adjacent-inferred": "inferred",
  untested: "untested",
} as const;
const gate = (mark: string) => (mark === "✓" ? "pass" : "fail");

const rowsByCell = new Map<string, typeof deposit>();
for (const row of deposit)
  rowsByCell.set(idOf(row.cell), [...(rowsByCell.get(idOf(row.cell)) ?? []), row]);

describe("taxonomy.json against the article's deposit", () => {
  it("covers every deposited cell, and only structurally empty cells are missing from it", () => {
    for (const id of rowsByCell.keys()) expect(() => cellById(id), id).not.toThrow();
    const missing = cells.filter((c) => !rowsByCell.has(c.id));
    expect(
      missing.every((c) => c.structurallyEmpty),
      missing.map((c) => c.id).join(),
    ).toBe(true);
  });

  it.each([...rowsByCell])("%s: same marks, verdicts and citation keys", (id, rows) => {
    const cell = cellById(id);
    const runs = runsOf(cell);
    expect(
      runs.map((r) => ({ ...r, verdict: verdictOf(r) })),
      cell.rubricMarks,
    ).toMatchObject(
      rows.map((row) => ({
        evidence: row.evidence_mark,
        capture: gate(row.field_gate),
        basis: row.field_gate_basis ? BASIS[row.field_gate_basis as keyof typeof BASIS] : null,
        deployed: gate(row.deployment_gate),
        verdict: row.derived_verdict,
      })),
    );
    const keys = new Set(rows.flatMap((row) => row.evidence_citekeys));
    expect([...cell.citations].sort()).toEqual([...keys].sort());
  });
});
