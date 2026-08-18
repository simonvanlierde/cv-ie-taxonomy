import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { DetailBody } from "./CvTaxonomy";
import { cells } from "./data/taxonomy";
import type { Cell } from "./data/types";
import { MiniMatrix } from "./MiniMatrix";
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
      if (!t?.closest(".cvt-explorable") || t.closest("input, textarea, select")) return;
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
  });

  return (
    <div className="cvt-explorable" data-open={selected !== null}>
      <div className="cvt-explorable-grid">
        <MiniMatrix selectedId={selected?.id ?? null} onSelect={select} />
      </div>
      <div className="cvt-explorable-col">
        {!selected && (
          <div className="cvt-explorable-idle">
            <p className="cvt-inline-prompt">Select a cell to see why, and where it breaks.</p>
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
              <DetailBody key={selected.id} cell={selected} />
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
