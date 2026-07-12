import { useState } from "react";
import { DetailBody } from "./CvTaxonomy";
import type { Cell } from "./data/types";
import { MiniMatrix } from "./MiniMatrix";

/** Act two: the full matrix as a driveable instrument. Selecting a cell in the
 *  grid fills the detail inline (no modal) beside it. */
export function Explorable() {
  const [selected, setSelected] = useState<Cell | null>(null);
  return (
    <div className="cvt-explorable">
      <div className="cvt-explorable-grid">
        <MiniMatrix selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="cvt-inline-detail" aria-live="polite">
        {selected ? (
          <DetailBody key={selected.id} cell={selected} />
        ) : (
          <p className="cvt-inline-prompt">
            Select a cell to read its verdict, failure mode, and sources.
          </p>
        )}
      </div>
    </div>
  );
}
