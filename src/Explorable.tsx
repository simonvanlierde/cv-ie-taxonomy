import { useState } from "react";
import { DetailBody } from "./CvTaxonomy";
import type { Cell } from "./data/types";
import { MiniMatrix } from "./MiniMatrix";
import { SCALE_VAR } from "./theme";

/** Act two: the full matrix as a driveable instrument. Selecting a cell in the
 *  grid fills the detail inline (no modal) beside it. */
export function Explorable() {
  const [selected, setSelected] = useState<Cell | null>(null);
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
          <MiniMatrix selectedId={selected?.id ?? null} onSelect={setSelected} />
        </div>
        {/* always mounted so the live region exists before content arrives */}
        <div className="cvt-inline-detail" aria-live="polite">
          {selected && (
            <>
              <h3 className="cvt-inline-title">
                {selected.structurallyEmpty
                  ? "Structurally empty: answered at the component scale"
                  : selected.task}
              </h3>
              {/* under the title, not over it — see DetailPanel */}
              <p className="cvt-panel-scale" style={{ "--hue": SCALE_VAR[selected.scale] }}>
                {selected.scale} · {selected.informationType}
              </p>
              <DetailBody key={selected.id} cell={selected} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
