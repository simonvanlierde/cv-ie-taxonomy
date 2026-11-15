import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { cap } from "./chapters";
import {
  cells,
  maturityLevel,
  maturityName,
  splitOf,
  taskName,
  VERDICT_LETTER,
} from "./data/taxonomy";
import type { Cell } from "./data/types";
import { Cite, CitedProse } from "./References";
import { RubricCircuit } from "./RubricCircuit";
import { gapsOf, gapText } from "./rubricMarks";
import { SCALE_VAR } from "./theme";
import { useDialogRegion } from "./useDialogRegion";
import { VerdictSwatch } from "./VerdictSwatch";

function ShareLink({ cellId }: { cellId: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // no share sheet and no clipboard (e.g. an insecure embed): a button that
  // could only silently no-op is worse than no button
  if (typeof navigator.share !== "function" && !navigator.clipboard) return null;
  const share = async () => {
    // build on the current URL so its params survive (?theme=dark stays a dark
    // link); ?scene is the dev-only scene pin and has no business being shared
    const url = new URL(location.href);
    url.searchParams.set("cell", cellId);
    url.searchParams.delete("scene");
    // a fragment (#cvt-matrix after the skip link) would race the deep link's
    // own scroll on load and can close the detail it opens
    url.hash = "";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url: url.href });
      } else {
        await navigator.clipboard.writeText(url.href);
        clearTimeout(timer.current);
        setCopied(true);
        timer.current = setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // the user dismissed the share sheet, or clipboard was denied — nothing to do
    }
  };
  return (
    <>
      <button type="button" className="cvt-share" onClick={share}>
        {copied ? "Copied" : typeof navigator.share === "function" ? "Share link" : "Copy link"}
      </button>
      {/* the button's own text change is not announced; this is */}
      <span className="cvt-sr" role="status">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}

// What the paper's source-status flag means for a reader; n/a cells (nothing
// cited) show no chip at all rather than an unexplained "n/a".
const STATUS_LABEL: Record<string, string> = {
  Published: "peer-reviewed sources",
  Mixed: "peer-reviewed and preprint sources",
  Preprint: "preprint sources only",
};

// The paper records each cell as an evidence mark and two gates. The marks are
// opaque on their own, so the key travels with them wherever they are shown.
// "E" stays off the evidence column: it is already the Emerging-but-narrow letter.
export const RUBRIC_LABEL = "Rubric marks (evidence · field · deployed)";

export function RubricKey() {
  return (
    <p className="cvt-rubric-key">
      The first mark describes the evidence. <b>B</b>: a general method tested on these or similar
      products.
      <b>N</b>: tested on one type of object only. <b>C</b>: an idea or evidence from a related
      field. <b>–</b>: no direct method. The next two marks check whether it works on photos taken
      after use and whether it is in use for this task. A ✓ means yes; a ✗ means no. The small
      letters explain a ✗ for field photos: ✗ᵐ means performance was measured and fell short, ✗ᵃ
      means limits are inferred from related research, and ✗ᵘ means it has not been tested.
    </p>
  );
}

/** The tallest compact sheet among a scale's cells, measured once offscreen in the
 *  live sheet's own width and styles, so the first Next to a taller cell does not
 *  resize the figure either. */
function tallestCompactSheet(root: HTMLElement, cell: Cell, sample: HTMLElement): number {
  const probe = document.createElement("div");
  probe.className = "cvt-detail cvt-detail-sheet cvt-probe";
  probe.style.setProperty("--hue", SCALE_VAR[cell.scale]);
  probe.inert = true;
  probe.ariaHidden = "true";
  probe.style.width = `${sample.offsetWidth}px`;
  root.append(probe);
  const mount = createRoot(probe);
  let tallest = 0;
  try {
    for (const c of cells.filter((c) => c.scale === cell.scale)) {
      flushSync(() =>
        mount.render(
          <SheetBody
            cell={c}
            compact
            expanded={false}
            onToggle={() => {}}
            onClose={() => {}}
            onNavigate={() => {}}
          />,
        ),
      );
      tallest = Math.max(tallest, probe.getBoundingClientRect().height);
    }
  } finally {
    mount.unmount();
    probe.remove();
  }
  return tallest;
}

// ---- detail: an enlargement drawn on the sheet ---------------------------------
/**
 * Act one's detail takes the narrative column's place rather than covering the
 * drawing: click a callout and the sheet reconfigures around it, with a leader
 * ruled back toward the part. That is why it is not a `<dialog>` — the element is
 * always in the top layer, so it can only ever float over the sheet.
 *
 * The three behaviours `<dialog>` gave us for free live in `useDialogRegion`, and
 * are now ours to test rather than take on trust.
 */
export function DetailRegion({
  cell,
  onClose,
  returnFocusTo,
  onBackToStart,
  compact = false,
  modal = false,
  onNavigate,
}: {
  cell: Cell;
  onClose: () => void;
  returnFocusTo: string | null;
  onBackToStart?: () => void;
  compact?: boolean;
  onNavigate?: (step: number) => void;
  /** only the mobile sheet, which covers the drawing it belongs to */
  modal?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useDialogRegion({
    open: true,
    onClose,
    returnFocusTo,
    modal,
    contentKey: cell.id,
    keepFocus: compact,
  });
  // The figure above the sheet is sized from the sheet's height. Within one scale
  // the sheet is as tall as the tallest of its cells, so stepping with Next does not
  // resize the drawing under the reader.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scale and expanded restart the measure
  useEffect(() => {
    const region = ref.current;
    const root = region?.closest<HTMLElement>(".cvt");
    if (!compact || !region || !root || typeof ResizeObserver === "undefined") return;
    let tallest = 0;
    const measure = () => {
      const height = region.getBoundingClientRect().height;
      tallest = expanded ? height : Math.max(tallest, height);
      region.style.minHeight = expanded ? "" : `${tallest}px`;
      root.style.setProperty("--cvt-detail-height", `${tallest}px`);
    };
    // the floor is the tallest cell of the scale from the start, so the first
    // step to a taller cell does not resize the drawing
    const seed = () => {
      tallest = expanded ? 0 : tallestCompactSheet(root, cell, region);
      measure();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    // min-height beats max-height: a turned phone must not keep the old floor
    const restart = () => {
      region.style.minHeight = "";
      seed();
    };
    window.addEventListener("resize", restart);
    measure();
    // flushSync is a no-op inside an effect, so the offscreen render waits a microtask
    let live = true;
    queueMicrotask(() => live && seed());
    return () => {
      live = false;
      window.removeEventListener("resize", restart);
      observer.disconnect();
      region.style.minHeight = "";
      root.style.removeProperty("--cvt-detail-height");
    };
  }, [compact, expanded, cell.scale, ref]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: new content starts at the heading, including after collapse
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [cell.id, expanded, ref]);
  const shared = {
    className: compact ? "cvt-detail cvt-detail-sheet" : "cvt-detail",
    "aria-label": `${cell.scale} · ${cell.informationType}`,
    "data-expanded": expanded,
    style: { "--hue": SCALE_VAR[cell.scale] } as CSSProperties,
    tabIndex: -1,
  };
  const body = (
    <SheetBody
      cell={cell}
      compact={compact}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      onClose={onClose}
      onBackToStart={onBackToStart}
      onNavigate={onNavigate}
    />
  );

  // Two elements rather than one with a computed role: aria-modal is only valid
  // alongside an explicit dialog role, and <aside> already means complementary.
  return modal ? (
    <div {...shared} ref={ref as RefObject<HTMLDivElement>} role="dialog" aria-modal="true">
      {body}
    </div>
  ) : (
    <aside {...shared} ref={ref as RefObject<HTMLElement>}>
      {body}
    </aside>
  );
}

/** The sheet's content, also drawn offscreen to size the sheet before the reader steps. */
function SheetBody({
  cell,
  compact,
  expanded,
  onToggle,
  onClose,
  onBackToStart,
  onNavigate,
}: {
  cell: Cell;
  compact: boolean;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  onBackToStart?: () => void;
  onNavigate?: (step: number) => void;
}) {
  return (
    <>
      {/* the pressed Previous/Next button keeps focus, so the new cell is announced here */}
      {compact && (
        <p className="cvt-sr-only" role="status">
          {cell.scale} · {cell.informationType}
        </p>
      )}
      <DetailPanel
        cell={cell}
        onClose={onClose}
        onBackToStart={onBackToStart}
        scores={compact}
        compact={compact && !expanded}
        // the desktop panel hides the scenes' prose, h1 included, so its title
        // is the page's heading while it is open; the phone's sheet leaves the scenes in the tree
        titleTag={compact ? "h2" : "h1"}
        controls={
          compact && (
            <div className="cvt-detail-controls">
              <button
                type="button"
                onClick={onToggle}
                className="cvt-evidence-toggle"
                aria-expanded={expanded}
              >
                {expanded ? "Back to compact" : "Read evidence"}
              </button>
              <nav aria-label={`Compare ${cell.scale.toLowerCase()} cells`}>
                <button type="button" aria-label="Previous cell" onClick={() => onNavigate?.(-1)}>
                  Previous
                </button>
                <button type="button" aria-label="Next cell" onClick={() => onNavigate?.(1)}>
                  Next
                </button>
              </nav>
            </div>
          )
        }
      />
    </>
  );
}

function DetailPanel({
  cell,
  onClose,
  onBackToStart,
  scores,
  compact = false,
  titleTag: Title,
  controls,
}: {
  cell: Cell;
  onClose: () => void;
  onBackToStart?: () => void;
  scores: boolean;
  compact?: boolean;
  titleTag: "h1" | "h2";
  controls?: ReactNode;
}) {
  return (
    <>
      <div className="cvt-panel-head">
        <div>
          <Title>{taskName(cell)}</Title>
          {/* under the title, not over it: the same words above a heading are a
              kicker, and this names which cell of the sheet the detail enlarges */}
          <p className="cvt-panel-scale">
            detail ·&nbsp;{cell.scale} ·&nbsp;{cell.informationType}
          </p>
        </div>
        <button
          type="button"
          className="cvt-panel-close"
          onClick={onClose}
          aria-label="Close details"
        >
          <CloseIcon />
        </button>
      </div>
      <IllustrativeDisclosure scores={scores} short={compact} />
      <DetailBody cell={cell} compact={compact} />
      {controls}
      {onBackToStart && (
        <button type="button" className="cvt-back-start" onClick={onBackToStart}>
          Back to start
        </button>
      )}
    </>
  );
}

export function DetailBody({ cell, compact = false }: { cell: Cell; compact?: boolean }) {
  if (cell.structurallyEmpty) {
    return (
      <>
        <div className="cvt-verdict">
          <strong>Not applicable</strong>
        </div>
        {compact && <p className="cvt-term-note">{cell.maturityNote}</p>}
        {!compact && (
          <>
            <dl className="cvt-panel-grid">
              <Row label="Why this cell has no rating" value={cell.maturityNote} />
            </dl>
            <div className="cvt-panel-foot">
              <ShareLink cellId={cell.id} />
            </div>
          </>
        )}
      </>
    );
  }
  const level = maturityLevel(cell.maturity);
  // a compound cell states both verdicts, and each sub-task keeps its own
  // handling: the weaker one's "do not populate" must not read as "verify"
  const split = splitOf(cell);
  const mentionsEol = [cell.maturityNote, cell.failureMode, cell.example].some((value) =>
    /EoL|end-of-life|end of life/i.test(value ?? ""),
  );
  return (
    <>
      {!compact && mentionsEol && (
        <p className="cvt-term-note">
          End-of-life (<abbr title="End-of-life">EoL</abbr>) means after a product has been used.
          Dirt, wear, missing parts and awkward camera angles can change what software recognises.
        </p>
      )}
      <div className="cvt-verdict">
        <VerdictSwatch verdict={cell.maturity} split={split} size={34} />
        <div>
          <strong>
            {split
              ? split.map((v) => VERDICT_LETTER[v]).join(" / ")
              : VERDICT_LETTER[cell.maturity]}
            : {maturityName(cell)}
          </strong>
          {!compact && !split && <span>{level.gloss}</span>}
        </div>
      </div>

      {cell.subVerdicts && (
        <ul className="cvt-subverdicts">
          {cell.subVerdicts.map((s) => (
            <li key={s.label}>
              <b>{VERDICT_LETTER[s.maturity]}</b> {s.label}: {s.maturity}
              {!compact && <span>{maturityLevel(s.maturity).gloss}</span>}
            </li>
          ))}
        </ul>
      )}

      <dl className="cvt-panel-grid">
        {!compact && (
          <Row
            label="Why this verdict"
            value={<CitedProse text={cell.maturityNote} citeKeys={cell.citations} />}
          />
        )}
        {cell.failureMode && (
          <Row
            label="Where it fails"
            value={
              compact ? (
                cell.failureMode
              ) : (
                <CitedProse text={cell.failureMode} citeKeys={cell.citations} />
              )
            }
            mode="warn"
          />
        )}
        {!compact && (
          <>
            <GapRow cell={cell} />
            <Row
              label="How to use the result"
              value={
                cell.subVerdicts
                  ? cell.subVerdicts.map((s) => (
                      <span className="cvt-handling" key={s.label}>
                        {s.label}: {maturityLevel(s.maturity).handling}
                      </span>
                    ))
                  : level.handling
              }
            />
            {/* The run belongs where the panel opens, not folded into "More detail":
            it is the derivation of the verdict stated three lines above it, and
            behind a closed <details> nobody meets the mechanism at all. */}
            <Row label="How the rating was reached" value={<RubricCircuit cell={cell} />} />
          </>
        )}
      </dl>

      {!compact && (
        <>
          <details className="cvt-panel-more">
            <summary>Methods, examples and sources</summary>
            <dl className="cvt-panel-grid">
              {cell.methodFamily && (
                <Row
                  label="Typical methods"
                  value={<CitedProse text={cell.methodFamily} citeKeys={cell.citations} />}
                />
              )}
              {cell.example && (
                <Row
                  label="Studies and examples"
                  value={<CitedProse text={cell.example} citeKeys={cell.citations} />}
                />
              )}
              {cell.hardware && <Row label="Where it runs" value={cell.hardware} />}
              {/* the paper's own notation, for a reader checking against Table S2; the
              run above already glosses each mark, so the key stays with the table */}
              <Row
                label={RUBRIC_LABEL}
                value={<span className="cvt-mono">{cell.rubricMarks}</span>}
              />
            </dl>
          </details>

          <div className="cvt-panel-foot">
            {STATUS_LABEL[cell.sourceStatus] && (
              <span className={`cvt-status cvt-status-${cell.sourceStatus.toLowerCase()}`}>
                {STATUS_LABEL[cell.sourceStatus]}
              </span>
            )}
            {cell.citations.length > 0 && (
              <ul className="cvt-cites">
                {cell.citations.map((c) => (
                  <li key={c}>
                    <Cite citeKey={c} />
                  </li>
                ))}
              </ul>
            )}
            <ShareLink cellId={cell.id} />
          </div>
        </>
      )}
    </>
  );
}

/** What the cell is missing, per row of a compound cell, in plain words. */
function GapRow({ cell }: { cell: Cell }) {
  // each row keeps its own index, so it pairs with its sub-verdict's name
  const rows = gapsOf(cell)
    .map((r, i) => ({ ...r, name: cell.subVerdicts?.[i]?.label ?? r.label }))
    .filter((r) => r.gaps.length > 0);
  if (rows.length === 0) return null;
  const text = (r: (typeof rows)[number]) => r.gaps.map(gapText).join("; ");
  return (
    <Row
      label="What is missing"
      value={
        // a compound cell names the sub-task even when only one of them has gaps
        rows.length === 1 && rows[0] && !cell.subVerdicts
          ? cap(text(rows[0]))
          : rows.map((r) => (
              <span className="cvt-handling" key={r.name}>
                {r.name}: {text(r)}
              </span>
            ))
      }
    />
  );
}

function Row({
  label,
  value,
  mono,
  mode,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  mode?: "warn";
}) {
  return (
    <div className={`cvt-row${mode === "warn" ? " cvt-row-warn" : ""}`}>
      <dt>{label}</dt>
      <dd className={mono ? "cvt-mono" : undefined}>{value}</dd>
    </div>
  );
}

/** `scores`: also say what the numbers on the drawing are, once, beside the figure.
 *  `short`: the clause in a few words, where the stamp shares a small sheet with the verdict. */
export function IllustrativeDisclosure({
  scores = false,
  short = false,
}: {
  scores?: boolean;
  short?: boolean;
}) {
  return (
    <p className="cvt-illustrative-note">
      Illustration · no photo was analysed
      {scores && (
        <span className="cvt-illustrative-scores">
          {short
            ? "Scores are examples, not accuracy."
            : "Scores such as 0.94 are example confidence values, not measured accuracy."}
        </span>
      )}
    </p>
  );
}

/** Drawn, not a glyph: the sheet's icons (close, table) share one
 *  stroke weight, and a Unicode ✕ renders in whatever the fallback face is. */
export function CloseIcon() {
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
