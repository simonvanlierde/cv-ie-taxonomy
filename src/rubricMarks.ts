import type { Cell } from "./data/types";

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
  basis: "measured" | "adjacent" | "untested" | null;
  capture: Gate;
  deployed: Gate;
  /** the run reaches the far electrode only at B · ✓ · ✓, which is Strong */
  completes: boolean;
}

const EVIDENCE_TEXT: Record<Evidence, string> = {
  B: "benchmarked product-general",
  N: "narrow class only",
  C: "concept or adjacent domain only",
  "–": "no method, or derived",
};

const BASIS_TEXT = {
  measured: "measured drop under end-of-life capture",
  adjacent: "inferred from an adjacent domain",
  untested: "untested under end-of-life capture",
} as const;

export const evidenceText = (e: Evidence) => EVIDENCE_TEXT[e];
export const basisText = (b: Run["basis"]) => (b ? BASIS_TEXT[b] : null);

const BASIS_BY_GLYPH: Record<string, Run["basis"]> = {
  ᵐ: "measured",
  ᵃ: "adjacent",
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
  return cell.rubricMarks
    .split(";")
    .map((r) => parseRun(r))
    .filter((r): r is Run => r !== null);
}
