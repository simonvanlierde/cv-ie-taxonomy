import {
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { CHAPTER_COPY } from "./chapters";
import "./CvTaxonomy.css";
import {
  cellAt,
  cells,
  INFO_TYPES,
  maturityLevel,
  SCALES,
  taxonomy,
  VERDICT_LETTER,
} from "./data/taxonomy";
import type { Cell, InfoType, Scale } from "./data/types";
import { Explorable } from "./Explorable";
import { Fan } from "./Fan";
import { FRAMES, type Frame, HOME_FRAME } from "./frames";
import { SCALE_HUE, SURFACE, THEME_VARS, type Theme } from "./theme";
import { TIMELINE } from "./timeline";
import { useCamera } from "./useCamera";
import { useScrollProgress } from "./useScrollProgress";
import { VerdictSwatch } from "./VerdictSwatch";

type Chapter = "hero" | Scale | "outro";

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

/** The component root's inline size, measured via ResizeObserver. null until the
 *  first measurement, so callers fall back to a viewport guess for the first paint. */
function useContainerWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => unknown;
};

/** Run a DOM mutation inside a view transition when supported and enabled;
 *  otherwise just run it. Keeps the morph a pure progressive enhancement. */
export function withViewTransition(run: () => void, enabled: boolean): void {
  const doc = document as ViewTransitionDocument;
  if (enabled && typeof doc.startViewTransition === "function") {
    // flushSync commits the state update *inside* the transition callback, so the
    // browser's after-snapshot sees the open panel; without it React batches the
    // setState past the snapshot and nothing morphs. Safe here: only ever called
    // from an event handler (openCell ← onClick), never during render.
    doc.startViewTransition(() => flushSync(run));
  } else {
    run();
  }
}

// ---- main -------------------------------------------------------------------------
export function CvTaxonomy({
  theme,
  initialCell,
  debugProgress,
}: {
  theme?: Theme;
  /** deep-link: open this cell's panel on load */
  initialCell?: string;
  /** dev-only: pin scroll progress (?p=0.5) for screenshots. Must be finite. */
  debugProgress?: number;
} = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocused = useRef<string | null>(null);

  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // render exactly one fan: full on desktop, compact on mobile. The container's own
  // width drives this (so an embed adapts to its slot, not the viewport); the
  // viewport query only stands in for the first paint, before anything is measured.
  const viewportIsMobile = useMediaQuery("(max-width: 880px)");
  const containerWidth = useContainerWidth(rootRef);
  const isMobile = containerWidth == null ? viewportIsMobile : containerWidth <= 880;

  // Theme has one owner, resolved here: the user's toggle beats the host's prop,
  // which beats the OS. Seeding state from `theme` instead would freeze the prop
  // at mount, so a host that switches its own theme could never move the island.
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [themeOverride, setThemeOverride] = useState<Theme | null>(null);
  const effectiveTheme: Theme = themeOverride ?? theme ?? (systemDark ? "dark" : "light");

  // The island styles its own surface via [data-theme], but the page behind it
  // (rubber-band over-scroll) is not ours to paint. Stamp the resolved theme on
  // <html> and let the host stylesheet key off it — but only when a theme is
  // actually in force, so an embedded island with no explicit theme keeps its
  // hands off the host's document.
  //
  // Both the attribute and color-scheme: the attribute because build targets that
  // predate light-dark() get it lowered to a prefers-color-scheme shim, which
  // would follow the OS and ignore this toggle; color-scheme because it is what
  // form controls and scrollbars read.
  const forcedTheme = themeOverride ?? theme;
  useEffect(() => {
    if (!forcedTheme) return;
    const root = document.documentElement;
    const previousScheme = root.style.colorScheme;
    const previousTheme = root.getAttribute("data-theme");

    root.style.colorScheme = forcedTheme;
    root.setAttribute("data-theme", forcedTheme);

    // The mobile browser chrome reads <meta name="theme-color">, whose media=""
    // keys on the OS scheme only — it would ignore this toggle and disagree with
    // the page it frames. Point every theme-color at the forced surface.
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    const previousMeta = Array.from(metas, (m) => m.content);
    for (const m of metas) m.content = SURFACE[forcedTheme];

    return () => {
      root.style.colorScheme = previousScheme;
      if (previousTheme === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previousTheme);
      metas.forEach((m, i) => {
        m.content = previousMeta[i] ?? "";
      });
    };
  }, [forcedTheme]);

  const scrollP = useScrollProgress(scrollRef, !reduceMotion);
  const p = debugProgress ?? scrollP;
  const chapter = chapterAt(p);

  const [selected, setSelected] = useState<Cell | null>(
    () => cells.find((c) => c.id === initialCell) ?? null,
  );
  const [hovered, setHovered] = useState<Cell | null>(null);
  const [activeInfo, setActiveInfo] = useState<Set<InfoType>>(new Set());
  const [zoomFrame, setZoomFrame] = useState<Frame | null>(() =>
    initialCell ? (FRAMES[initialCell] ?? null) : null,
  );
  // On mobile the compact fan ignores this viewBox, so cut instantly rather than
  // burn a per-frame spring re-rendering the whole tree for output nobody sees.
  const viewBox = useCamera(zoomFrame ?? HOME_FRAME, reduceMotion || isMobile);

  const focus = hovered ?? selected;
  const isDim = (c: Cell) => isDimmed(activeInfo, c);

  function toggleInfo(info: InfoType) {
    setActiveInfo((prev) => {
      const next = new Set(prev);
      next.has(info) ? next.delete(info) : next.add(info);
      return next;
    });
  }

  const openCell = useCallback(
    (cell: Cell, focusId?: string) => {
      lastFocused.current = focusId ?? null;
      withViewTransition(() => {
        setZoomFrame(FRAMES[cell.id] ?? HOME_FRAME);
        setSelected(cell);
      }, !reduceMotion);
    },
    [reduceMotion],
  );

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

  // Lock page scroll while the panel is open, so the scrub and camera stay put
  // under the reader. Restores the prior value on close and on unmount.
  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);

  return (
    <div
      className="cvt"
      ref={rootRef}
      data-theme={effectiveTheme}
      style={THEME_VARS[effectiveTheme]}
    >
      <div className="cvt-scroll" ref={scrollRef}>
        {/* The stage + chapters share one wrapper. It is display:contents on
            desktop (the grid places stage and rail directly), but a real block
            on mobile — where it becomes the sticky stage's containing block, so
            the stage releases at the chapters' end instead of being painted over
            by the outro. */}
        <div className="cvt-pinwrap">
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
                viewBox={viewBox}
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
                      <li key={s} data-active={chapter === s} style={{ "--hue": SCALE_HUE[s] }}>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <fieldset className="cvt-filtergroup">
                    <legend className="cvt-filters-label">filter &gt; information type</legend>
                    <div className="cvt-filters">
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
                  </fieldset>
                </div>
              </div>
            </div>
          </div>

          <Rail chapter={chapter} activeInfo={activeInfo} onOpen={openCell} />
        </div>
        {/* full-width row: the stage's sticky column ends here, and the matrix
            gets the whole canvas as a captioned paper figure */}
        <Outro />
      </div>

      <footer className="cvt-footer">
        <span>© 2026 Simon van Lierde · MIT &amp; CC BY 4.0</span>
        <span className="cvt-footer-mid">Interactive companion to Paper 2 · Table S1</span>
        <a href="https://github.com/simonvanlierde/cv-ie-taxonomy" target="_blank" rel="noreferrer">
          Source on GitHub <span aria-hidden>↗</span>
        </a>
      </footer>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> already closes on Esc; onClick only adds backdrop-click for mouse users */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: a backdrop click lands on the <dialog> itself, so the handler has nowhere else to live */}
      <dialog
        ref={dialogRef}
        className="cvt-panel"
        aria-label={selected ? `${selected.scale} · ${selected.informationType}` : undefined}
        style={selected ? { "--hue": SCALE_HUE[selected.scale] } : undefined}
        onClose={() => {
          setSelected(null);
          setZoomFrame(null);
        }}
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
            style={{ "--hue": SCALE_HUE[scale] }}
          >
            {/* the prose pins while its chapter's overlays are on the stage, so the
                two are read together rather than in sequence */}
            <div className="cvt-chapter-inner">
              <p className="cvt-eyebrow">
                <span className="cvt-dot" aria-hidden /> {scale} scale
              </p>
              <h2>{copy.title}</h2>
              <p className="cvt-body">{copy.body}</p>
            </div>
            {/* mobile only: this scale's cells as a plain list */}
            <div className="cvt-mgroup">
              {INFO_TYPES.map((info) => {
                const cell = cellAt(scale, info);
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

// ---- outro: the matrix, live — select a cell to fill the detail inline and
// ring its part on the diagram fan (memoized: nothing here depends on scroll
// progress, so the per-scroll-frame render skips it entirely) -----
const Outro = memo(function Outro() {
  return (
    <section className="cvt-outro" id="cvt-matrix" aria-label="Full taxonomy matrix">
      <p className="cvt-eyebrow">The full matrix</p>
      <h2>
        Read against its own rubric, the map is largely negative: no task-level cell reaches Strong
        under end-of-life capture.
      </h2>
      <Explorable />
      <p className="cvt-foot">
        Maturity of candidate CV tasks per physical scale × information type, shown by ink weight
        and letter:{" "}
        {taxonomy.meta.maturityLevels.map((m, i) => (
          <span key={m.verdict}>
            {i > 0 ? " · " : ""}
            <b>{m.letter}</b> {m.verdict.toLowerCase()}
          </span>
        ))}
        . Dashed cells are structurally empty (structure resolves at the component scale). A cell
        split on the diagonal carries two verdicts, one per sub-task. Verdicts: Paper 2, Table S1 ·{" "}
        {taxonomy.meta.scanDate} snapshot.
      </p>
      <TableView />
    </section>
  );
});

/** The figure's table twin: every verdict as text, nothing encoded by ink alone.
 *  A modal rather than an in-flow <details>: the scroll timeline is measured over
 *  this container, so expanding ~700px of table inline would remap every
 *  calibrated presence window under the reader (see timeline.ts). */
function TableView() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <div className="cvt-tableview">
      <button type="button" className="cvt-tableview-open" onClick={() => ref.current?.showModal()}>
        Table view — the same twelve cells as text
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> already closes on Esc; onClick only adds backdrop-click for mouse users */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: a backdrop click lands on the <dialog> itself, so the handler has nowhere else to live */}
      <dialog
        ref={ref}
        className="cvt-panel cvt-tablepanel"
        aria-label="Table view — the same twelve cells as text"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="cvt-panel-head">
          <p className="cvt-eyebrow">Table S1 · text view</p>
          <button
            type="button"
            className="cvt-panel-close"
            onClick={() => ref.current?.close()}
            aria-label="Close table view"
          >
            ✕
          </button>
        </div>
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
      </dialog>
    </div>
  );
}

function ShareLink({ cellId }: { cellId: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${location.origin}${location.pathname}?cell=${cellId}`;
    const nav = navigator as Navigator & { share?: (data: { url: string }) => Promise<void> };
    try {
      if (typeof nav.share === "function") {
        await nav.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // the user dismissed the share sheet, or clipboard was denied — nothing to do
    }
  };
  return (
    <button type="button" className="cvt-share" onClick={share}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

// ---- detail panel ------------------------------------------------------------
function DetailPanel({ cell, onClose }: { cell: Cell; onClose: () => void }) {
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
      <DetailBody cell={cell} />
    </>
  );
}

export function DetailBody({ cell }: { cell: Cell }) {
  const level = maturityLevel(cell.maturity);
  return (
    <>
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
        <Row label="Why this verdict" value={cell.maturityNote} />
        {cell.failureMode && (
          <Row label="Dominant failure mode" value={cell.failureMode} mode="warn" />
        )}
      </dl>

      <details className="cvt-panel-more">
        <summary>More detail</summary>
        <dl className="cvt-panel-grid">
          {cell.methodFamily && <Row label="Candidate method family" value={cell.methodFamily} />}
          {cell.example && <Row label="Adjacent-field example" value={cell.example} />}
          {cell.hardware && <Row label="Hardware tendency" value={cell.hardware} />}
          <Row label="Rubric marks (i·ii·iii·m)" value={cell.rubricMarks} mono />
          <Row label="Recommended handling" value={level.handling} />
        </dl>
      </details>

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
        <ShareLink cellId={cell.id} />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
      />
    </svg>
  );
}
