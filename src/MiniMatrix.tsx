import { cellAt, INFO_TYPES, SCALES, splitOf, VERDICT_LETTER } from "./data/taxonomy";
import type { Cell, Scale, Verdict } from "./data/types";
import { SCALE_VAR, VERDICT_HEIGHT, VERDICT_VAR } from "./theme";

/**
 * The taxonomy as ink on the sheet, not as twelve cards.
 *
 * Every cell is a bay of ruled ground with a block standing in it, and the
 * block's height is the verdict. A row's silhouette therefore carries the
 * finding: the reader sees where the map is empty before reading a word. The
 * `Strong` shelf is ruled across the top of every bay and nothing reaches it,
 * which is the paper's central claim drawn rather than asserted.
 */
export function MiniMatrix({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (cell: Cell) => void;
}) {
  return (
    <div className="cvt-matrix">
      <span className="cvt-mx-shelf-label" aria-hidden>
        strong &rarr;
      </span>
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

/** A split cell stands at its stronger sub-verdict and rules its weaker one
 *  across the block, so the gap between the two sub-tasks is visible too. */
function subRule(split: readonly [Verdict, Verdict] | undefined) {
  if (!split) return null;
  const [strong, weak] = split;
  const inner = VERDICT_HEIGHT[weak] / VERDICT_HEIGHT[strong];
  return <span className="cvt-mx-subrule" style={{ bottom: `${inner * 100}%` }} aria-hidden />;
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
      <span className="cvt-mx-h cvt-mx-row" style={{ "--hue": SCALE_VAR[scale] }}>
        {scale}
      </span>
      {INFO_TYPES.map((info) => {
        const cell = cellAt(scale, info);
        // a compound cell shows both sub-task verdicts rather than flattening to one
        const split = splitOf(cell);
        const standsAt = split ? split[0] : cell.maturity;
        return (
          <button
            key={cell.id}
            type="button"
            className="cvt-mx-cell"
            data-ghost={!!cell.structurallyEmpty}
            data-verdict={VERDICT_LETTER[cell.maturity]}
            aria-pressed={cell.id === selectedId}
            aria-label={
              split
                ? `${scale} · ${info}: ${cell.subVerdicts?.map((s) => `${s.label} ${s.maturity}`).join("; ")}`
                : `${scale} · ${info}: ${cell.maturity}`
            }
            onClick={() => onSelect(cell)}
          >
            <span
              className="cvt-mx-block"
              style={{
                height: `${VERDICT_HEIGHT[standsAt] * 100}%`,
                background: VERDICT_VAR[standsAt] ?? "none",
              }}
              aria-hidden
            >
              {subRule(split)}
            </span>
            <b className="cvt-mx-letter">
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
