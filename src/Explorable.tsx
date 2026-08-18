import { type RefObject, useCallback, useRef, useState } from "react";
import { DetailBody } from "./CvTaxonomy";
import type { Cell } from "./data/types";
import { MiniMatrix } from "./MiniMatrix";
import { SCALE_VAR } from "./theme";
import { useDialogRegion } from "./useDialogRegion";

/** Act two: the full matrix as a driveable instrument. Selecting a cell fills the
 *  detail beside it — the same enlargement act one draws, under the same contract:
 *  Esc closes, focus moves in on open and back to the cell that opened it. Not
 *  modal, for the same reason act one's is not: the other eleven cells are right
 *  there, and scanning between them is the whole point of the instrument. */
export function Explorable() {
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
  const ref = useDialogRegion({
    open: selected !== null,
    onClose: close,
    returnFocusTo: openerId.current,
  });

  return (
    <>
      {/* the hint sits above the instrument, not in the detail column — the
          column only earns its grid track once there is a detail to fill it */}
      {!selected && (
        <p className="cvt-inline-prompt">
          Select any cell to see why it earned its verdict, and where it breaks.
        </p>
      )}
      <div className="cvt-explorable" data-open={selected !== null}>
        <div className="cvt-explorable-grid">
          <MiniMatrix selectedId={selected?.id ?? null} onSelect={select} />
        </div>
        {/* always mounted so the live region exists before content arrives */}
        <div className="cvt-inline-detail" aria-live="polite">
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
    </>
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
