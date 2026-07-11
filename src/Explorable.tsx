import { useState } from "react";
import { DetailBody } from "./CvTaxonomy";
import type { Cell } from "./data/types";
import { Fan } from "./Fan";
import { MiniMatrix } from "./MiniMatrix";

/** Act two: the matrix and the fan, linked. Selecting a cell in the grid fills
 *  the detail inline (no modal) and rings that cell's part on a static,
 *  exploded diagram fan — forward-only (cell → part; a part can belong to
 *  several cells, so there is no unambiguous reverse target). */
export function Explorable() {
  const [selected, setSelected] = useState<Cell | null>(null);
  return (
    <div className="cvt-explorable">
      <div className="cvt-explorable-stage">
        <Fan
          diagram
          highlightCell={selected}
          p={0}
          focus={null}
          isDim={() => false}
          onSelect={() => {}}
          onHover={() => {}}
          reduceMotion
        />
      </div>
      <div className="cvt-explorable-panel">
        <MiniMatrix selectedId={selected?.id ?? null} onSelect={setSelected} />
        <div className="cvt-inline-detail" aria-live="polite">
          {selected ? (
            <DetailBody cell={selected} />
          ) : (
            <p className="cvt-inline-prompt">
              Select a cell to read its verdict, failure mode, and sources.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
