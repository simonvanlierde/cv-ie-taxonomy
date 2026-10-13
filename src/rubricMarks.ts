import type { Cell, Verdict } from "./data/types";

/**
 * The paper records each cell as an evidence mark and two gates, printed in
 * Table S2 as `B · ✗ᵘ · ✗`. Read as a ladder, that string is a run of three
 * segments that either carries to the end or breaks somewhere — and where it
 * breaks is the finding. This parses the printed form back into those segments
 * so the drawing can show the break instead of asking the reader to decode
 * superscripts.
 *
 * Parsing rather than storing the parts keeps taxonomy.json byte-comparable
 * with the deposited table: the marks stay exactly as the paper prints them.
 */

export type Gate = "pass" | "fail";
export type Evidence = "B" | "N" | "C" | "–";

export interface Run {
  /** sub-task name for a compound cell ("detect/seg", "relations"), else null */
  label: string | null;
  evidence: Evidence;
  /** the ✗ superscript's evidentiary basis, if the printed mark carries one */
  basis: "measured" | "inferred" | "untested" | null;
  capture: Gate;
  deployed: Gate;
  /** the run reaches the far electrode only at B · ✓ · ✓, which is Strong */
  completes: boolean;
}

const EVIDENCE_TEXT: Record<Evidence, string> = {
  B: "general method, benchmarked",
  N: "narrow class only",
  C: "concept or neighbouring field only",
  "–": "no method, or derived",
};

const BASIS_TEXT = {
  measured: "measured drop on end-of-life photos",
  inferred: "inferred from neighbouring-field or zero-shot evidence",
  untested: "untested on end-of-life photos",
} as const;

export const evidenceText = (e: Evidence) => EVIDENCE_TEXT[e];
export const basisText = (b: Run["basis"]) => (b ? BASIS_TEXT[b] : null);

const BASIS_BY_GLYPH: Record<string, Run["basis"]> = {
  ᵐ: "measured",
  ᵃ: "inferred",
  ᵘ: "untested",
};

const isEvidence = (s: string): s is Evidence => s === "B" || s === "N" || s === "C" || s === "–";

/** One printed run, e.g. `detect/seg B · ✗ᵃ · ✗` or `B · ✗ᵐ · ✓`. */
function parseRun(printed: string): Run | null {
  // drop the parenthetical prose some rows carry after the marks
  const marks = printed.replace(/\(.*?\)/g, "").trim();
  const parts = marks.split("·").map((p) => p.trim());
  if (parts.length !== 3) return null;

  // a compound row prefixes its sub-task name to the evidence mark
  const head = parts[0] ?? "";
  const words = head.split(/\s+/);
  const mark = words.at(-1) ?? "";
  const label = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  if (!isEvidence(mark)) return null;

  const captureRaw = parts[1] ?? "";
  const capture: Gate = captureRaw.startsWith("✓") ? "pass" : "fail";
  const basis = BASIS_BY_GLYPH[captureRaw.slice(1)] ?? null;
  const deployed: Gate = (parts[2] ?? "").startsWith("✓") ? "pass" : "fail";

  return {
    label,
    evidence: mark,
    basis,
    capture,
    deployed,
    completes: mark === "B" && capture === "pass" && deployed === "pass",
  };
}

/** Every run a cell prints: one, or two for a compound cell. Empty when the row
 *  carries no marks at all (the structurally-empty cells print only `–`). */
export function runsOf(cell: Cell): Run[] {
  // parentheticals go before the split, so a "; " inside a note cannot cut a run
  return cell.rubricMarks
    .replace(/\(.*?\)/g, "")
    .split(";")
    .map((r) => parseRun(r))
    .filter((r): r is Run => r !== null);
}

/** The verdict a run's marks give. Every verdict in taxonomy.json must equal this;
 *  the article's deposit derives its verdicts by the same ladder. */
export function verdictOf(run: Run): Verdict {
  switch (run.evidence) {
    case "B":
      return run.completes ? "Strong" : "Partial";
    case "N":
      return "Emerging-but-narrow";
    case "C":
      return "Plausible-but-unvalidated";
    case "–":
      return "Absent";
  }
}

/** One thing a row is missing, in the paper's terms (§2.3.2). */
export type Gap =
  | { kind: "ontology" }
  | { kind: "method" }
  | { kind: "field"; basis: NonNullable<Run["basis"]> }
  | { kind: "derived" };

/**
 * What each row of a cell is missing, listed in the paper's fixed order:
 * ontology-bound, method-bound, then field-bound with its basis. Field-bound is
 * read off the marks — a method exists (B or N) but fails the field gate — so it
 * cannot drift from them; the other two are stored, since no mark records them.
 * A derived row (evidence `–`) inherits its gaps from the cells it is worked
 * out from. Structurally empty cells have no rows, so no gaps.
 */
export function gapsOf(cell: Cell): { label: string | null; gaps: Gap[] }[] {
  return runsOf(cell).map((run, i) => {
    const stored = cell.subVerdicts ? (cell.subVerdicts[i]?.gaps ?? []) : (cell.gaps ?? []);
    const gaps: Gap[] = [];
    if (stored.includes("ontology-bound")) gaps.push({ kind: "ontology" });
    if (stored.includes("method-bound")) gaps.push({ kind: "method" });
    const hasMethod = run.evidence === "B" || run.evidence === "N";
    if (hasMethod && run.capture === "fail" && run.basis) {
      gaps.push({ kind: "field", basis: run.basis });
    }
    if (run.evidence === "–") gaps.push({ kind: "derived" });
    return { label: run.label, gaps };
  });
}

const GAP_TEXT: Record<Gap["kind"], string> = {
  ontology: "no shared taxonomy yet",
  method: "no method yet",
  field: "",
  derived: "worked out from other cells",
};
const FIELD_TEXT: Record<NonNullable<Run["basis"]>, string> = {
  measured: "fell short on field photos",
  inferred: "likely short on field photos",
  untested: "not tried on field photos",
};

/** A gap in plain words, short enough for a matrix cell. */
export const gapText = (g: Gap) => (g.kind === "field" ? FIELD_TEXT[g.basis] : GAP_TEXT[g.kind]);

const SHORT_BASIS: Record<NonNullable<Run["basis"]>, string> = {
  measured: "fell short",
  inferred: "likely short",
  untested: "not tried",
};

/** Every distinct gap a cell's rows carry, in plain words and the paper's order,
 *  with the field gaps of a compound cell joined into one phrase so the matrix
 *  cell can hold them ("likely short or not tried on field photos"). */
export function cellGapTexts(cell: Cell): string[] {
  const gaps = gapsOf(cell).flatMap((row) => row.gaps);
  const has = (kind: Gap["kind"]) => gaps.some((g) => g.kind === kind);
  const bases = [
    ...new Set(gaps.flatMap((g) => (g.kind === "field" ? [SHORT_BASIS[g.basis]] : []))),
  ];
  return [
    ...(has("ontology") ? [GAP_TEXT.ontology] : []),
    ...(has("method") ? [GAP_TEXT.method] : []),
    ...(bases.length > 0 ? [`${bases.join(" or ")} on field photos`] : []),
    ...(has("derived") ? [GAP_TEXT.derived] : []),
  ];
}
