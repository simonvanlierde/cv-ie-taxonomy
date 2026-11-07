import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cellById, cells, taxonomy } from "./data/taxonomy";
import { type Evidence, type Gate, type Run, runsOf, verdictOf } from "./rubricMarks";
import { changedCount, type Marks, printRun, withEdits } from "./sandbox";

const marks = fc.record<Marks>({
  evidence: fc.constantFrom<Evidence>("B", "N", "C", "–"),
  capture: fc.constantFrom<Gate>("pass", "fail"),
  deployed: fc.constantFrom<Gate>("pass", "fail"),
  basis: fc.constantFrom<Run["basis"]>(null, "measured", "inferred", "untested"),
});
const label = fc.option(fc.stringMatching(/^[a-z][a-z0-9 /_-]{0,30}$/), { nil: null });
const compound = cellById("component-structure");
const populated = cells.filter((cell) => runsOf(cell).length > 0);

const expectedVerdict = (run: Marks) => {
  if (run.evidence === "B") {
    return run.capture === "pass" && run.deployed === "pass" ? "Strong" : "Partial";
  }
  return {
    N: "Emerging-but-narrow",
    C: "Plausible-but-unvalidated",
    "–": "Absent",
  }[run.evidence];
};

describe("rubric properties", () => {
  it("round-trips printed runs, retaining a failing field gate's basis", () => {
    fc.assert(
      fc.property(marks, label, (mark, name) => {
        const parsed = runsOf({ ...compound, rubricMarks: printRun({ ...mark, label: name }) });
        expect(parsed).toEqual([
          {
            ...mark,
            label: name?.trim().replace(/\s+/g, " ") ?? null,
            basis: mark.capture === "pass" ? null : mark.basis,
            completes: expectedVerdict(mark) === "Strong",
          },
        ]);
        expect(parsed.map(verdictOf)).toEqual([expectedVerdict(mark)]);
      }),
    );
  });

  it("parses arbitrary text into only valid evidence and consistent completion states", () => {
    fc.assert(
      fc.property(fc.string(), (rubricMarks) => {
        for (const run of runsOf({ ...compound, rubricMarks })) {
          expect(["B", "N", "C", "–"]).toContain(run.evidence);
          expect(run.completes).toBe(expectedVerdict(run) === "Strong");
        }
      }),
    );
  });

  it("keeps compound sub-verdicts and selects the strongest regardless of run order", () => {
    fc.assert(
      fc.property(marks, marks, (first, second) => {
        const expected = [expectedVerdict(first), expectedVerdict(second)];
        const strongest = taxonomy.meta.maturityLevels.find((level) =>
          expected.includes(level.verdict),
        )?.verdict;
        const edited = withEdits(compound, [first, second]);
        expect(edited.subVerdicts?.map((sub) => sub.maturity)).toEqual(expected);
        expect(runsOf(edited).map(verdictOf)).toEqual(expected);
        expect(edited.maturity).toBe(strongest);
        expect(withEdits(compound, [second, first]).maturity).toBe(strongest);
      }),
    );
  });

  it("counts at most one changed cell even when several of its runs change", () => {
    fc.assert(
      fc.property(fc.constantFrom(...populated), marks, marks, (paper, first, second) => {
        const snapshot = structuredClone(paper);
        const edits = runsOf(paper).map((_, i) => (i === 0 ? first : second));
        const original = runsOf(paper).map(verdictOf);
        const changed = edits.some((mark, i) => expectedVerdict(mark) !== original[i]);
        expect(changedCount({ [paper.id]: edits })).toBe(changed ? 1 : 0);
        expect(withEdits(paper, edits)).toEqual(withEdits(withEdits(paper, edits), edits));
        expect(paper).toEqual(snapshot);
      }),
    );
  });
});
