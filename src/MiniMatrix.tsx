import { cellAt, INFO_TYPES, maturityName, SCALES, splitOf, VERDICT_LETTER } from "./data/taxonomy";
import type { Cell, Scale, Verdict } from "./data/types";
import { cellGapTexts } from "./rubricMarks";
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
  view = (cell) => cell,
}: {
  selectedId: string | null;
  onSelect: (cell: Cell) => void;
  /** the cell as shown: the paper's, or the reader's What if? version of it */
  view?: (cell: Cell) => Cell;
}) {
  return (
    <div className="cvt-matrix">
      {/* the corner of the header row: the row heads and cells auto-flow five to
          a row after it, so no item needs explicit placement — placing only the
          column heads left the first row head to fill this slot and pushed every
          row label a row down and a column right */}
      <span aria-hidden />
      {INFO_TYPES.map((i) => (
        <span key={i} className="cvt-mx-h">
          {i}
        </span>
      ))}
      {SCALES.map((s) => (
        <MiniMatrixRow key={s} scale={s} selectedId={selectedId} onSelect={onSelect} view={view} />
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
  view,
}: {
  scale: Scale;
  selectedId: string | null;
  onSelect: (cell: Cell) => void;
  view: (cell: Cell) => Cell;
}) {
  return (
    <>
      <span className="cvt-mx-h cvt-mx-row" style={{ "--hue": SCALE_VAR[scale] }}>
        {scale}
      </span>
      {INFO_TYPES.map((info) => {
        const paper = cellAt(scale, info);
        const cell = view(paper);
        // where the reader's verdict is not the paper's, the paper's stays drawn
        // as a ghost, so the sandbox can never pass for the paper's finding
        // compared as words, so a compound cell's weaker sub-verdict counts too
        const differs = maturityName(cell) !== maturityName(paper);
        const ghost = differs ? (splitOf(paper)?.[0] ?? paper.maturity) : null;
        // a compound cell shows both sub-task verdicts rather than flattening to one
        const split = splitOf(cell);
        const standsAt = split ? split[0] : cell.maturity;
        const missing = cellGapTexts(cell);
        const said =
          (missing.length > 0 ? `. Missing: ${missing.join(", ")}` : "") +
          (differs ? `. That is your marks' verdict; the paper's is ${maturityName(paper)}` : "");
        // the name starts with the letter the cell shows, so a voice user can say it
        const letters = split
          ? split.map((s) => VERDICT_LETTER[s]).join(" / ")
          : VERDICT_LETTER[cell.maturity];
        return (
          <button
            key={cell.id}
            id={`cvt-mx-${cell.id}`}
            type="button"
            className="cvt-mx-cell"
            data-ghost={!!cell.structurallyEmpty}
            data-verdict={VERDICT_LETTER[cell.maturity]}
            aria-pressed={cell.id === selectedId}
            aria-label={
              cell.structurallyEmpty
                ? `${scale} · ${info}: structurally empty, answered at the component scale`
                : split
                  ? `${letters} ${scale} · ${info}: ${cell.subVerdicts?.map((s) => `${s.label} ${s.maturity}`).join("; ")}${said}`
                  : `${letters} ${scale} · ${info}: ${cell.maturity}${said}`
            }
            // the paper's cell, never the What if? copy: the detail and the editor
            // both read their "paper's" verdict from what is selected
            onClick={() => onSelect(paper)}
          >
            {/* a structurally empty bay is hatched, as a drawing hatches a void:
                no block, no letter — it is not a short bar and not an Absent,
                it is a cell with no task of its own */}
            <span
              className="cvt-mx-block"
              style={
                cell.structurallyEmpty
                  ? { top: 0, height: "auto" }
                  : {
                      "--h": VERDICT_HEIGHT[standsAt],
                      "--fill": VERDICT_VAR[standsAt] ?? "none",
                    }
              }
              aria-hidden
            >
              {subRule(split)}
            </span>
            {ghost && (
              <span className="cvt-mx-ghost" style={{ "--h": VERDICT_HEIGHT[ghost] }} aria-hidden />
            )}
            {!cell.structurallyEmpty && (
              <b className="cvt-mx-letter">
                {split
                  ? split.map((v) => VERDICT_LETTER[v]).join(" / ")
                  : VERDICT_LETTER[cell.maturity]}
              </b>
            )}
            {/* under the block, what it is missing; the verdict is in the letter
                and the key above the matrix */}
            <span className="cvt-mx-name">
              {cell.structurallyEmpty ? "structurally empty" : missing.join(" · ")}
            </span>
          </button>
        );
      })}
    </>
  );
}
