import deposit from "./data/deposit-rubric-marks.json";
import { cells, taxonomy } from "./data/taxonomy";
import type { Cell, Verdict } from "./data/types";
import { type Run, runsOf, verdictOf } from "./rubricMarks";

/**
 * The "What if?" sandbox: the reader changes a cell's rubric marks and every
 * verdict, block and gap re-derives through the same ladder the paper uses
 * (`verdictOf`). Nothing here is the paper's finding; the map shows the paper's
 * verdict beside the reader's.
 */

/** The marks a reader can change on one run. The basis travels with the field
 *  gate, so a gate set back to ✗ gets its original basis back. */
export type Marks = Pick<Run, "evidence" | "capture" | "deployed" | "basis">;
/** cell id → one Marks per run, in the order the cell prints them */
export type Edits = Record<string, Marks[]>;

const BASIS_GLYPH = { measured: "ᵐ", inferred: "ᵃ", untested: "ᵘ" } as const;

/** A run in Table S2's printed form: `B · ✗ᵃ · ✗`, with a compound row's label. */
export function printRun(run: Pick<Run, "label"> & Marks): string {
  const field = run.capture === "pass" ? "✓" : `✗${run.basis ? BASIS_GLYPH[run.basis] : ""}`;
  const marks = `${run.evidence} · ${field} · ${run.deployed === "pass" ? "✓" : "✗"}`;
  return run.label ? `${run.label} ${marks}` : marks;
}

const rank = (v: Verdict) => taxonomy.meta.maturityLevels.findIndex((m) => m.verdict === v);

/** The cell as the reader's marks make it: new marks, verdicts and sub-verdicts.
 *  Without edits it is the paper's cell, unchanged. */
export function withEdits(cell: Cell, edits: Marks[] | undefined): Cell {
  if (!edits) return cell;
  const runs = runsOf(cell).map((run, i) => ({ ...run, ...edits[i] }));
  const verdicts = runs.map((run) =>
    verdictOf({
      ...run,
      completes: run.evidence === "B" && run.capture === "pass" && run.deployed === "pass",
    }),
  );
  const strongest = [...verdicts].sort((a, b) => rank(a) - rank(b))[0] ?? cell.maturity;
  return {
    ...cell,
    rubricMarks: runs.map(printRun).join("; "),
    maturity: strongest,
    subVerdicts: cell.subVerdicts?.map((s, i) => ({
      ...s,
      maturity: verdicts[i] ?? s.maturity,
      rubricMarks: printRun({ ...(runs[i] as Run), label: null }),
    })),
  };
}

/** The verdict of every run, so a compound cell's two sub-verdicts both count. */
const verdictsOf = (cell: Cell) => runsOf(cell).map(verdictOf);

/** How many of the cells' verdicts the reader's marks have changed. */
export function changedCount(edits: Edits): number {
  return cells.filter((cell) => {
    const mine = verdictsOf(withEdits(cell, edits[cell.id]));
    return mine.some((v, i) => v !== verdictsOf(cell)[i]);
  }).length;
}

// The deposit names a row "Component · Structure (BoC)" and calls the inferred
// basis "adjacent-inferred"; the export writes the deposit's own words.
const DEPOSIT_BASIS = { measured: "measured", inferred: "adjacent-inferred", untested: "untested" };
const csvField = (s: string) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);

/** The reader's marks as a CSV in the deposit's rubric-marks format, one row per
 *  run, so it opens beside `rubric-marks.csv` and diffs against it. */
export function toDepositCsv(edits: Edits): string {
  const header = [
    "cell",
    "sub_cell",
    "evidence_mark",
    "field_gate",
    "field_gate_basis",
    "deployment_gate",
    "derived_verdict",
    "evidence_citekeys",
  ];
  const seen = new Map<string, number>();
  const rows = deposit.map((row) => {
    const name = row.cell.replace(/\s*\(.*\)$/, "");
    const cell = cells.find((c) => `${c.scale} · ${c.informationType}` === name);
    if (!cell) throw new Error(`deposit row ${row.cell} has no cell`);
    const i = seen.get(cell.id) ?? 0;
    seen.set(cell.id, i + 1);
    const run = runsOf(withEdits(cell, edits[cell.id]))[i];
    if (!run) throw new Error(`deposit row ${row.cell} has no run ${i}`);
    return [
      row.cell,
      row.sub_cell ?? "",
      run.evidence,
      run.capture === "pass" ? "✓" : "✗",
      // a derived row (–) has no method to fall short, so no basis, as in the deposit
      run.capture === "fail" && run.basis && run.evidence !== "–" ? DEPOSIT_BASIS[run.basis] : "",
      run.deployed === "pass" ? "✓" : "✗",
      verdictOf(run),
      row.evidence_citekeys.join(";"),
    ];
  });
  return `${[header, ...rows].map((r) => r.map(csvField).join(",")).join("\n")}\n`;
}
