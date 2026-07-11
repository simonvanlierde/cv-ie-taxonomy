import { cellAt, INFO_TYPES, SCALES, VERDICT_LETTER } from "./data/taxonomy";
import type { Cell, Scale, Verdict } from "./data/types";
import { SCALE_HUE } from "./theme";
import { VerdictSwatch } from "./VerdictSwatch";

/** exactly two sub-verdicts render as a diagonal split; anything else is one verdict */
function splitOf(cell: Cell): readonly [Verdict, Verdict] | undefined {
  const [first, second, ...rest] = cell.subVerdicts ?? [];
  if (!first || !second || rest.length > 0) return undefined;
  return [first.maturity, second.maturity];
}

/** Standalone, selectable 3x4 taxonomy grid — the same markup as the Outro's matrix
 *  figure, but each cell is a toggle button reporting its selection instead of
 *  opening the detail panel directly. */
export function MiniMatrix({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (cell: Cell) => void;
}) {
  return (
    <div className="cvt-matrix">
      <span />
      {INFO_TYPES.map((i) => (
        <span key={i} className="cvt-mx-h">
          {i}
        </span>
      ))}
      {SCALES.map((s) => (
        <MiniMatrixRow key={s} scale={s} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function MiniMatrixRow({
  scale,
  selectedId,
  onSelect,
}: {
  scale: Scale;
  selectedId: string | null;
  onSelect: (cell: Cell) => void;
}) {
  return (
    <>
      <span className="cvt-mx-h cvt-mx-row" style={{ "--hue": SCALE_HUE[scale] }}>
        {scale}
      </span>
      {INFO_TYPES.map((info) => {
        const cell = cellAt(scale, info);
        // a compound cell shows both sub-task verdicts rather than flattening to one
        const split = splitOf(cell);
        return (
          <button
            key={cell.id}
            type="button"
            className="cvt-mx-cell"
            data-ghost={!!cell.structurallyEmpty}
            aria-pressed={cell.id === selectedId}
            aria-label={
              split
                ? `${scale} · ${info}: ${cell.subVerdicts?.map((s) => `${s.label} ${s.maturity}`).join("; ")}`
                : `${scale} · ${info}: ${cell.maturity}`
            }
            onClick={() => onSelect(cell)}
          >
            <VerdictSwatch verdict={cell.maturity} split={split} size={24} />
            <b>
              {split
                ? split.map((v) => VERDICT_LETTER[v]).join(" / ")
                : VERDICT_LETTER[cell.maturity]}
            </b>
            <span className="cvt-mx-name">
              {cell.structurallyEmpty
                ? "structurally empty"
                : split
                  ? split.map((v) => v.toLowerCase()).join(" · ")
                  : cell.maturity.toLowerCase()}
            </span>
          </button>
        );
      })}
    </>
  );
}
