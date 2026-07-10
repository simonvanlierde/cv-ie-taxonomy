import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./CvTaxonomy.css";
import { cellAt, cells, INFO_TYPES, SCALES, taxonomy, VERDICT_LETTER } from "./data/taxonomy";
import type { Cell, InfoType, Scale, Verdict } from "./data/types";
import { Fan } from "./Fan";
import { rampVars, SCALE_HUE, segVars, TIMELINE } from "./theme";
import { useScrollProgress } from "./useScrollProgress";
import { VerdictSwatch } from "./VerdictSwatch";

type Chapter = "hero" | Scale | "outro";

const CHAPTER_COPY: Record<Scale, { title: string; body: string }> = {
  Product: {
    title: "One product, seen whole",
    body: "Identity is the workhorse: read the rating label, match a database. 96% of labels read in professional repair, 40% at the recycler. Geometry from a single view stays approximate, and “worth repairing?” is a verdict no benchmark yet validates.",
  },
  Component: {
    title: "Pulled apart",
    body: "Detection and segmentation can name and count parts, after domain tuning. The gap is relations: which part attaches to which (the bill of components) holds ~82% in-domain and collapses to ~39% out of distribution.",
  },
  Material: {
    title: "Down to matter",
    body: "Surface material ID works under controlled light and fails under field shift. Mass and volume are never seen, only derived (geometry × material class × density prior), and every error compounds.",
  },
};

function chapterAt(p: number): Chapter {
  if (p < TIMELINE.heroEnd) return "hero";
  if (p < TIMELINE.productEnd) return "Product";
  if (p < TIMELINE.componentEnd) return "Component";
  if (p < TIMELINE.materialEnd) return "Material";
  return "outro";
}

// the one dim rule, shared by the fan, the mobile list and the matrix
const isDimmed = (activeInfo: Set<InfoType>, c: Cell) =>
  activeInfo.size > 0 && !activeInfo.has(c.informationType);

/** Reactive `matchMedia`: re-renders when the query flips (OS reduced-motion toggle,
 *  viewport crossing a breakpoint), not just on mount. */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // server render: assume no match
  );
}

// ---- main -------------------------------------------------------------------------
export function CvTaxonomy({
  theme,
  initialCell,
  debugProgress,
}: {
  theme?: "light" | "dark";
  /** deep-link: open this cell's panel on load */
  initialCell?: string;
  /** dev-only: pin scroll progress (?p=0.5) for screenshots */
  debugProgress?: number;
} = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocused = useRef<string | null>(null);

  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // render exactly one fan: full on desktop, compact on mobile
  const isMobile = useMediaQuery("(max-width: 880px)");

  // theme: follow the host prop / OS by default; the toggle sets an explicit override
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [themeOverride, setThemeOverride] = useState<"light" | "dark" | null>(theme ?? null);
  const effectiveTheme: "light" | "dark" = themeOverride ?? (systemDark ? "dark" : "light");
  const scrollP = useScrollProgress(scrollRef, !reduceMotion);
  const p = debugProgress ?? scrollP;
  const chapter = chapterAt(p);

  const [selected, setSelected] = useState<Cell | null>(
    () => cells.find((c) => c.id === initialCell) ?? null,
  );
  const [hovered, setHovered] = useState<Cell | null>(null);
  const [activeInfo, setActiveInfo] = useState<Set<InfoType>>(new Set());

  const focus = hovered ?? selected;
  const isDim = (c: Cell) => isDimmed(activeInfo, c);

  function toggleInfo(info: InfoType) {
    setActiveInfo((prev) => {
      const next = new Set(prev);
      next.has(info) ? next.delete(info) : next.add(info);
      return next;
    });
  }

  const openCell = useCallback((cell: Cell, focusId?: string) => {
    lastFocused.current = focusId ?? null;
    setSelected(cell);
  }, []);

  // native <dialog> owns focus-trap, Esc and focus-return; we only drive open/close
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (selected) {
      // focus the trigger first so the dialog restores to it (not <body>) on close
      if (lastFocused.current) document.getElementById(lastFocused.current)?.focus();
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [selected]);

  return (
    <div
      className="cvt"
      data-theme={effectiveTheme}
      style={{ ...rampVars(effectiveTheme), ...segVars(effectiveTheme) }}
    >
      <div className="cvt-scroll" ref={scrollRef}>
        {/* ---- sticky stage: the fan IS the interface ---- */}
        <div className="cvt-stagecol">
          <div className="cvt-sticky">
            <Fan
              p={p}
              focus={focus}
              isDim={isDim}
              onSelect={openCell}
              onHover={setHovered}
              reduceMotion={reduceMotion}
              compact={isMobile}
            />
            <div className="cvt-hud">
              <div className="cvt-hud-top">
                <span className="cvt-eyebrow">CV × industrial ecology</span>
                <div className="cvt-hud-actions">
                  <span className="cvt-hud-tag">overlays illustrative, not model output</span>
                  <button
                    type="button"
                    className="cvt-theme-toggle"
                    onClick={() => setThemeOverride(effectiveTheme === "dark" ? "light" : "dark")}
                    aria-label={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} theme`}
                    title={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} theme`}
                  >
                    {effectiveTheme === "dark" ? <SunIcon /> : <MoonIcon />}
                  </button>
                </div>
              </div>
              <div className="cvt-hud-bottom">
                <ol className="cvt-ind" aria-label="Physical scale chapters">
                  {SCALES.map((s) => (
                    <li
                      key={s}
                      data-active={chapter === s}
                      style={{ ["--hue" as string]: SCALE_HUE[s] }}
                    >
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="cvt-filtergroup">
                  <span className="cvt-filters-label" aria-hidden>
                    filter ▸ information type
                  </span>
                  <div className="cvt-filters" role="group" aria-label="Filter by information type">
                    {INFO_TYPES.map((info) => (
                      <button
                        key={info}
                        type="button"
                        className="cvt-chip"
                        aria-pressed={activeInfo.has(info)}
                        onClick={() => toggleInfo(info)}
                      >
                        {info}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Rail chapter={chapter} activeInfo={activeInfo} onOpen={openCell} />
        {/* full-width row: the stage's sticky column ends here, and the matrix
            gets the whole canvas as a captioned paper figure */}
        <Outro onOpen={openCell} />
      </div>

      <footer className="cvt-footer">
        <span>© 2026 Simon van Lierde · MIT &amp; CC BY 4.0</span>
        <span className="cvt-footer-mid">Interactive companion to Paper 2 · Table S1</span>
        <a href="https://github.com/simonvanlierde/cv-ie-taxonomy" target="_blank" rel="noreferrer">
          Source on GitHub <span aria-hidden>↗</span>
        </a>
      </footer>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> already closes on Esc; onClick only adds backdrop-click for mouse users */}
      <dialog
        ref={dialogRef}
        className="cvt-panel"
        aria-label={selected ? `${selected.scale} · ${selected.informationType}` : undefined}
        style={selected ? { ["--hue" as string]: SCALE_HUE[selected.scale] } : undefined}
        onClose={() => setSelected(null)}
        onClick={(e) => {
          // click on the backdrop (the dialog itself, outside its content) closes it
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {selected && <DetailPanel cell={selected} onClose={() => dialogRef.current?.close()} />}
      </dialog>
    </div>
  );
}

// ---- narrative rail (memoized: only re-renders on chapter/filter change,
// not on every scroll frame) -------------------------------------------------
const Rail = memo(function Rail({
  chapter,
  activeInfo,
  onOpen,
}: {
  chapter: Chapter;
  activeInfo: Set<InfoType>;
  onOpen: (cell: Cell, focusId?: string) => void;
}) {
  const isDim = (c: Cell) => isDimmed(activeInfo, c);
  return (
    <div className="cvt-rail">
      <section className="cvt-hero">
        <p className="cvt-eyebrow">Paper 2 · interactive supplement</p>
        <h1 className="cvt-title">
          What can a machine
          <br />
          actually see?
        </h1>
        <p className="cvt-sub">
          An end-of-life desk fan, taken apart by the twelve tasks computer vision is asked to do in
          industrial ecology. The read-outs on the fan are the controls. Click one. Every verdict is
          the paper's own (<span className="cvt-cite">Table&nbsp;S1</span>), shown by{" "}
          <em>ink weight and letter</em>, never colour.
        </p>
        <ul className="cvt-legendline" aria-label="Maturity legend">
          {taxonomy.meta.maturityLevels.map((m) => (
            <li key={m.verdict} title={m.gloss}>
              <VerdictSwatch verdict={m.verdict} size={18} />
              <span>
                <b>{m.letter}</b> {m.verdict}
              </span>
            </li>
          ))}
        </ul>
        <p className="cvt-scrollhint" aria-hidden>
          scroll to take it apart <span className="cvt-scrollhint-arrow">↓</span>
        </p>
        <a className="cvt-skip" href="#cvt-matrix">
          or skip to the full matrix
        </a>
      </section>

      {SCALES.map((scale) => {
        const copy = CHAPTER_COPY[scale];
        return (
          <section
            key={scale}
            className="cvt-chapter"
            data-active={chapter === scale}
            style={{ ["--hue" as string]: SCALE_HUE[scale] }}
          >
            <p className="cvt-eyebrow">
              <span className="cvt-dot" aria-hidden /> {scale} scale
            </p>
            <h2>{copy.title}</h2>
            <p className="cvt-body">{copy.body}</p>
            {/* mobile only: this scale's cells as a plain list */}
            <div className="cvt-mgroup">
              {INFO_TYPES.map((info) => {
                const cell = cellAt(scale, info)!;
                const hid = `cvt-m-${cell.id}`;
                return (
                  <button
                    key={cell.id}
                    id={hid}
                    type="button"
                    className="cvt-mcell"
                    data-ghost={!!cell.structurallyEmpty}
                    data-dim={isDim(cell)}
                    onClick={() => onOpen(cell, hid)}
                  >
                    <VerdictSwatch verdict={cell.maturity} size={20} />
                    <span className="cvt-mcell-info">{info}</span>
                    <span className="cvt-mcell-task">
                      {cell.structurallyEmpty
                        ? "resolved at component scale"
                        : cell.task.split(/[,;]/)[0]}
                    </span>
                    <b>{VERDICT_LETTER[cell.maturity]}</b>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
});

// ---- outro: the matrix as a full-width paper figure -------------------------
function Outro({ onOpen }: { onOpen: (cell: Cell, focusId?: string) => void }) {
  return (
    <section className="cvt-outro" id="cvt-matrix" aria-label="Full taxonomy matrix">
      <p className="cvt-eyebrow">The full matrix</p>
      <h2>
        Read against its own rubric, the map is largely negative: no task-level cell reaches Strong
        under end-of-life capture.
      </h2>
      <figure className="cvt-figure">
        {/* wide content scrolls in its own box; the page never scrolls sideways */}
        <div className="cvt-matrixwrap">
          <div className="cvt-matrix">
            <span />
            {INFO_TYPES.map((i) => (
              <span key={i} className="cvt-mx-h">
                {i}
              </span>
            ))}
            {SCALES.map((s) => (
              <MatrixRow key={s} scale={s} onOpen={onOpen} />
            ))}
          </div>
        </div>
        <figcaption className="cvt-foot">
          Maturity of candidate CV tasks per physical scale × information type, shown by ink weight
          and letter:{" "}
          {taxonomy.meta.maturityLevels.map((m, i) => (
            <span key={m.verdict}>
              {i > 0 ? " · " : ""}
              <b>{m.letter}</b> {m.verdict.toLowerCase()}
            </span>
          ))}
          . Dashed cells are structurally empty (structure resolves at the component scale). A cell
          split on the diagonal carries two verdicts, one per sub-task. Verdicts: Paper 2, Table S1
          · {taxonomy.meta.scanDate} snapshot.
        </figcaption>
      </figure>
      <TableView />
    </section>
  );
}

/** The figure's table twin: every verdict as text, nothing encoded by ink alone. */
function TableView() {
  return (
    <details className="cvt-tableview">
      <summary>Table view — the same twelve cells as text</summary>
      <div className="cvt-tablewrap">
        <table>
          <caption>
            Table S1, verbatim. Compound cells list one row per sub-task, as the paper does.
          </caption>
          <thead>
            <tr>
              <th scope="col">Scale</th>
              <th scope="col">Information type</th>
              <th scope="col">Task</th>
              <th scope="col">Maturity</th>
              <th scope="col">Rubric marks (i·ii·iii·m)</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((cell) =>
              (cell.subVerdicts ?? [{ label: null, maturity: cell.maturity }]).map((sub) => (
                <tr key={`${cell.id}-${sub.label ?? "only"}`}>
                  <th scope="row">{cell.scale}</th>
                  <td>{cell.informationType}</td>
                  <td>
                    {cell.structurallyEmpty ? "— structurally empty —" : cell.task}
                    {sub.label && <span className="cvt-subtask"> · {sub.label}</span>}
                  </td>
                  <td>
                    <b>{VERDICT_LETTER[sub.maturity]}</b> {sub.maturity}
                  </td>
                  <td className="cvt-mono">
                    {"rubricMarks" in sub && sub.rubricMarks ? sub.rubricMarks : cell.rubricMarks}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function MatrixRow({
  scale,
  onOpen,
}: {
  scale: Scale;
  onOpen: (cell: Cell, focusId?: string) => void;
}) {
  return (
    <>
      <span className="cvt-mx-h cvt-mx-row" style={{ ["--hue" as string]: SCALE_HUE[scale] }}>
        {scale}
      </span>
      {INFO_TYPES.map((info) => {
        const cell = cellAt(scale, info)!;
        const hid = `cvt-mx-${cell.id}`;
        // a compound cell shows both sub-task verdicts rather than flattening to one
        const split = splitOf(cell);
        return (
          <button
            key={cell.id}
            id={hid}
            type="button"
            className="cvt-mx-cell"
            data-ghost={!!cell.structurallyEmpty}
            aria-label={
              split
                ? `${scale} · ${info}: ${cell.subVerdicts?.map((s) => `${s.label} ${s.maturity}`).join("; ")}`
                : `${scale} · ${info}: ${cell.maturity}`
            }
            onClick={() => onOpen(cell, hid)}
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

/** exactly two sub-verdicts render as a diagonal split; anything else is one verdict */
function splitOf(cell: Cell): readonly [Verdict, Verdict] | undefined {
  const subs = cell.subVerdicts;
  return subs?.length === 2 ? [subs[0].maturity, subs[1].maturity] : undefined;
}

// ---- detail panel ------------------------------------------------------------
function DetailPanel({ cell, onClose }: { cell: Cell; onClose: () => void }) {
  const level = taxonomy.meta.maturityLevels.find((m) => m.verdict === cell.maturity)!;
  return (
    <>
      <div className="cvt-panel-head">
        <div>
          <p className="cvt-panel-scale">
            {cell.scale} · {cell.informationType}
          </p>
          <h2>{cell.task}</h2>
        </div>
        <button
          type="button"
          className="cvt-panel-close"
          onClick={onClose}
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      <div className="cvt-verdict">
        <VerdictSwatch verdict={cell.maturity} size={34} />
        <div>
          <strong>
            {VERDICT_LETTER[cell.maturity]}: {cell.maturity}
          </strong>
          <span>{level.gloss}</span>
        </div>
      </div>

      {cell.subVerdicts && (
        <ul className="cvt-subverdicts">
          {cell.subVerdicts.map((s) => (
            <li key={s.label}>
              <b>{VERDICT_LETTER[s.maturity]}</b> {s.label}: {s.maturity}
            </li>
          ))}
        </ul>
      )}

      <dl className="cvt-panel-grid">
        {cell.methodFamily && <Row label="Candidate method family" value={cell.methodFamily} />}
        <Row label="Why this verdict" value={cell.maturityNote} />
        {cell.failureMode && (
          <Row label="Dominant failure mode" value={cell.failureMode} mode="warn" />
        )}
        {cell.example && <Row label="Adjacent-field example" value={cell.example} />}
        {cell.hardware && <Row label="Hardware tendency" value={cell.hardware} />}
        <Row label="Rubric marks (i·ii·iii·m)" value={cell.rubricMarks} mono />
        <Row label="Recommended handling" value={level.handling} />
      </dl>

      <div className="cvt-panel-foot">
        <span className={`cvt-status cvt-status-${cell.sourceStatus.toLowerCase()}`}>
          {cell.sourceStatus}
        </span>
        {cell.citations.length > 0 && (
          <ul className="cvt-cites">
            {cell.citations.map((c) => (
              <li key={c} className="cvt-cite-key">
                @{c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono,
  mode,
}: {
  label: string;
  value: string;
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

// theme-toggle glyphs: sun shows in dark (→ switch to light), moon in light
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
      />
    </svg>
  );
}
