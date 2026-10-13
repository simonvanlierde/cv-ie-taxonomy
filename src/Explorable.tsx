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
import { cells, maturityName } from "./data/taxonomy";
import type { Cell } from "./data/types";
import { MiniMatrix } from "./MiniMatrix";
import { RubricCircuit } from "./RubricCircuit";
import { runsOf } from "./rubricMarks";
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
      {/* always there, so turning the switch on is announced */}
      <p className="cvt-whatif-note" role="status">
        {on
          ? `Your marks, not the paper’s. ${changed === 1 ? "1 cell differs" : `${changed} cells differ`} from the paper; each one shows the paper’s verdict as a dashed outline.`
          : "Change a cell’s marks and see its verdict move."}
      </p>
      {on && (
        <>
          {/* aria-disabled, not disabled: a disabled button drops the focus it holds */}
          <button
            type="button"
            aria-disabled={!edited}
            onClick={() => {
              if (edited) onReset();
            }}
          >
            Reset to the paper
          </button>
          <button type="button" onClick={download}>
            Export CSV
          </button>
        </>
      )}
    </div>
  );
}

const EVIDENCE: { value: Marks["evidence"]; label: string }[] = [
  { value: "B", label: "B, tested on these or similar products" },
  { value: "N", label: "N, one narrow kind of object only" },
  { value: "C", label: "C, an idea or a neighbouring field only" },
  { value: "–", label: "–, no method" },
];
const GATE: { value: Marks["capture"]; label: string }[] = [
  { value: "pass", label: "Yes" },
  { value: "fail", label: "No" },
];

/** One mark as a native radio group. */
function Radios<T extends string>({
  name,
  legend,
  options,
  value,
  onPick,
}: {
  name: string;
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onPick(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

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
      {/* announced as the reader changes a mark */}
      <p className="cvt-marks-verdict" role="status">
        Your marks: {maturityName(mine)}
        <span>{`. The paper’s: ${maturityName(paper)}`}</span>
      </p>
      {runs.map((run, i) => {
        const m = current[i];
        if (!m) return null;
        const name = `${id}-${i}`;
        const sub = paper.subVerdicts?.[i]?.label;
        return (
          // a compound cell's two runs ask the same three questions; the group
          // names which sub-task each set belongs to
          <fieldset className="cvt-marks-run" key={run.label ?? i}>
            {sub && <legend className="cvt-circuit-sub">{sub}</legend>}
            <Radios
              name={`${name}-evidence`}
              legend="Evidence"
              options={EVIDENCE}
              value={m.evidence}
              onPick={(evidence) => set(i, { evidence })}
            />
            <Radios
              name={`${name}-field`}
              legend="Shown to work on field photos"
              options={GATE}
              value={m.capture}
              onPick={(capture) => set(i, { capture })}
            />
            <Radios
              name={`${name}-deployed`}
              legend="In use for this task"
              options={GATE}
              value={m.deployed}
              onPick={(deployed) => set(i, { deployed })}
            />
          </fieldset>
        );
      })}
      <RubricCircuit cell={mine} />
    </div>
  );
}
