import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { DetailBody } from "./CvTaxonomy";
import { cells, maturityName, VERDICT_LETTER } from "./data/taxonomy";
import type { Cell } from "./data/types";
import { MiniMatrix } from "./MiniMatrix";
import { RubricCircuit } from "./RubricCircuit";
import { type Evidence, runsOf } from "./rubricMarks";
import { changedCount, type Edits, type Marks, toDepositCsv, withEdits } from "./sandbox";
import { SCALE_VAR } from "./theme";
import { useDialogRegion } from "./useDialogRegion";

/** Act two: the full matrix as a driveable instrument. Selecting a cell fills the
 *  column beside it — the same enlargement act one draws, under the same contract:
 *  Esc closes, focus moves in on open and back to the cell that opened it. Not
 *  modal, for the same reason act one's is not: the other eleven cells are right
 *  there, and scanning between them is the whole point of the instrument.
 *  `children` is what the column holds while nothing is selected (the caption
 *  and the table twin); the detail takes its place, as act one's takes the prose's. */
export function Explorable({ children }: { children?: ReactNode }) {
  const [selected, setSelected] = useState<Cell | null>(null);
  // Held in a ref, not derived from `selected`: closing clears the selection on
  // the render *before* the region's cleanup runs, so a derived value is already
  // null by the time focus needs somewhere to go back to.
  const openerId = useRef<string | null>(null);
  const select = useCallback((cell: Cell) => {
    openerId.current = `cvt-mx-${cell.id}`;
    setSelected(cell);
  }, []);
  const close = useCallback(() => setSelected(null), []);
  // What if?: the reader's own marks, re-derived through the paper's ladder
  const [whatIf, setWhatIf] = useState(false);
  const [edits, setEdits] = useState<Edits>({});
  const view = useCallback(
    (cell: Cell) => (whatIf ? withEdits(cell, edits[cell.id]) : cell),
    [whatIf, edits],
  );
  const changed = changedCount(edits);
  // Arrow keys step the selection along the matrix while a detail is open, so a
  // reader scanning cells does not have to leave the detail and find the next
  // bay by Tab. Focus stays where it is; `select` re-points the focus return at
  // the new cell, so Esc afterwards lands on the bay the reader ended on.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step || e.altKey || e.metaKey || e.ctrlKey) return;
      // scoped to the instrument: focus in its bays or its detail
      const t = e.target as HTMLElement | null;
      if (!t?.closest(".cvt-explorable") || t.closest("input, textarea, select, dialog, [popover]"))
        return;
      const i = cells.findIndex((c) => c.id === selected.id);
      const next = cells[(i + step + cells.length) % cells.length];
      if (!next) return;
      e.preventDefault();
      select(next);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, select]);
  const ref = useDialogRegion({
    open: selected !== null,
    onClose: close,
    returnFocusTo: openerId.current,
    contentKey: selected?.id,
  });

  return (
    <div className="cvt-explorable" data-open={selected !== null}>
      <div className="cvt-explorable-grid">
        <WhatIfBar
          on={whatIf}
          changed={changed}
          edited={Object.keys(edits).length > 0}
          onToggle={() => setWhatIf((v) => !v)}
          onReset={() => setEdits({})}
          csv={() => toDepositCsv(edits)}
        />
        <MiniMatrix selectedId={selected?.id ?? null} onSelect={select} view={view} />
      </div>
      <div className="cvt-explorable-col">
        {!selected && (
          <div className="cvt-explorable-idle">
            <p className="cvt-inline-prompt">
              Select a cell to see why it got its verdict, and where it fails.
            </p>
            {children}
          </div>
        )}
        {/* not a live region: the detail takes focus when it opens, so a screen
            reader hears its name and role once, rather than a whole detail read
            out on every cell the reader steps to */}
        <div className="cvt-inline-detail">
          {selected && (
            <aside
              ref={ref as RefObject<HTMLElement>}
              className="cvt-inline-region"
              aria-label={`${selected.scale} · ${selected.informationType}`}
              tabIndex={-1}
            >
              <div className="cvt-inline-head">
                <h3 className="cvt-inline-title">
                  {selected.structurallyEmpty
                    ? "Structurally empty: answered at the component scale"
                    : selected.task}
                </h3>
                <button
                  type="button"
                  className="cvt-panel-close"
                  onClick={close}
                  aria-label="Close details"
                >
                  <CloseGlyph />
                </button>
              </div>
              {/* under the title, not over it — see DetailPanel */}
              <p className="cvt-panel-scale" style={{ "--hue": SCALE_VAR[selected.scale] }}>
                detail · {selected.scale} · {selected.informationType}
              </p>
              {whatIf && runsOf(selected).length > 0 ? (
                <MarksEditor
                  key={selected.id}
                  paper={selected}
                  marks={edits[selected.id]}
                  onChange={(m) => setEdits((e) => ({ ...e, [selected.id]: m }))}
                />
              ) : (
                <DetailBody key={selected.id} cell={selected} />
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

/** the same drawn mark the sheet's other close controls use */
function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** The sandbox's switch and, while it is on, what the reader has changed. */
function WhatIfBar({
  on,
  changed,
  edited,
  onToggle,
  onReset,
  csv,
}: {
  on: boolean;
  changed: number;
  edited: boolean;
  onToggle: () => void;
  onReset: () => void;
  csv: () => string;
}) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv()], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "rubric-marks-what-if.csv",
    });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="cvt-whatif" data-on={on}>
      <button type="button" className="cvt-whatif-toggle" aria-pressed={on} onClick={onToggle}>
        What if?
      </button>
      {on ? (
        <>
          <p className="cvt-whatif-note" role="status">
            Your marks, not the paper&rsquo;s. {changed === 1 ? "1 cell" : `${changed} cells`}{" "}
            {changed === 1 ? "differs" : "differ"} from the paper. A dashed outline is the
            paper&rsquo;s verdict.
          </p>
          <button type="button" onClick={onReset} disabled={!edited}>
            Reset to the paper
          </button>
          <button type="button" onClick={download}>
            Export CSV
          </button>
        </>
      ) : (
        <p className="cvt-whatif-note">Change a cell&rsquo;s marks and see its verdict move.</p>
      )}
    </div>
  );
}

const EVIDENCE: { value: Evidence; label: string }[] = [
  { value: "B", label: "B, tested on these or similar products" },
  { value: "N", label: "N, one narrow kind of object only" },
  { value: "C", label: "C, an idea or a neighbouring field only" },
  { value: "–", label: "–, no method" },
];

/** The marks of each run as radio groups; the verdict follows from them. */
function MarksEditor({
  paper,
  marks,
  onChange,
}: {
  paper: Cell;
  marks: Marks[] | undefined;
  onChange: (marks: Marks[]) => void;
}) {
  const id = useId();
  const runs = runsOf(paper);
  const current: Marks[] =
    marks ??
    runs.map(({ evidence, capture, deployed, basis }) => ({ evidence, capture, deployed, basis }));
  const mine = withEdits(paper, current);
  const set = (i: number, patch: Partial<Marks>) =>
    onChange(current.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <div className="cvt-marks">
      <p className="cvt-marks-verdict">
        <b>{VERDICT_LETTER[mine.maturity]}</b> {maturityName(mine)}
        <span>{` · the paper’s: ${VERDICT_LETTER[paper.maturity]} ${maturityName(paper)}`}</span>
      </p>
      {runs.map((run, i) => {
        const m = current[i];
        if (!m) return null;
        const name = `${id}-${i}`;
        return (
          <div className="cvt-marks-run" key={run.label ?? i}>
            {run.label && <p className="cvt-circuit-sub">{paper.subVerdicts?.[i]?.label}</p>}
            <fieldset>
              <legend>Evidence</legend>
              {EVIDENCE.map((e) => (
                <label key={e.value}>
                  <input
                    type="radio"
                    name={`${name}-evidence`}
                    checked={m.evidence === e.value}
                    onChange={() => set(i, { evidence: e.value })}
                  />
                  {e.label}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Shown to work on field photos</legend>
              <label>
                <input
                  type="radio"
                  name={`${name}-field`}
                  checked={m.capture === "pass"}
                  onChange={() => set(i, { capture: "pass" })}
                />
                Yes
              </label>
              <label>
                <input
                  type="radio"
                  name={`${name}-field`}
                  checked={m.capture === "fail"}
                  onChange={() => set(i, { capture: "fail" })}
                />
                No
              </label>
            </fieldset>
            <fieldset>
              <legend>In use for this task</legend>
              <label>
                <input
                  type="radio"
                  name={`${name}-deployed`}
                  checked={m.deployed === "pass"}
                  onChange={() => set(i, { deployed: "pass" })}
                />
                Yes
              </label>
              <label>
                <input
                  type="radio"
                  name={`${name}-deployed`}
                  checked={m.deployed === "fail"}
                  onChange={() => set(i, { deployed: "fail" })}
                />
                No
              </label>
            </fieldset>
          </div>
        );
      })}
      <RubricCircuit cell={mine} />
    </div>
  );
}
