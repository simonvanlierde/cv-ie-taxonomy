import {
  type CSSProperties,
  memo,
  type ReactNode,
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
  splitOf,
  taxonomy,
  VERDICT_LETTER,
} from "./data/taxonomy";
import type { Cell, Scale, Verdict } from "./data/types";
import { Explorable } from "./Explorable";
import { Fan } from "./Fan";
import { FRAMES, HOME_FRAME } from "./frames";
import { MobileStepper } from "./MobileStepper";
import { Cite, CitedProse } from "./References";
import { RubricCircuit } from "./RubricCircuit";
import { BREAKPOINT_PX, SCALE_VAR, SURFACE, THEME_VARS, type Theme, VERDICT_VAR } from "./theme";
import { plateauCentre, TIMELINE } from "./timeline";
import { useCamera } from "./useCamera";
import { useDialogRegion } from "./useDialogRegion";
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

/** I is skipped, as on a real drawing: it reads as a 1 against the row numbers. */
// biome-ignore lint/security/noSecrets: the drawing sheet's column references
const COLUMN_REFS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
/** one ruler column, matching `.cvt-ruler-x span` in the stylesheet */
const RULER_STEP_PX = 96;

/** The component root's width, measured via ResizeObserver and stored quantised:
 *  whether it is narrower than the layout breakpoint, and how many 96px ruler
 *  columns it holds. Not the raw width, so a resize drag only re-renders on the
 *  frames a threshold is crossed. `narrow` is null until the first measurement,
 *  so callers fall back to a viewport guess for the first paint. */
function useContainerSize(ref: RefObject<HTMLElement | null>): {
  narrow: boolean | null;
  columns: number;
} {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  const [columns, setColumns] = useState(COLUMN_REFS.length);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w !== "number") return;
      setNarrow(w < BREAKPOINT_PX);
      setColumns(Math.min(COLUMN_REFS.length, Math.ceil(w / RULER_STEP_PX)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return { narrow, columns };
}

/** Lock page scroll while a modal is open, so the scrub and camera stay put
 *  under the reader. Restores the prior value on close and on unmount. */
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
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
  /** the narrative column: the scroll timeline is measured over it, not over the
   *  whole scroll section, so the closing figure's height cannot drag the
   *  chapters off the sticky stage */
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<string | null>(null);
  /** cancels a chapter stop's pending focus landing (timer + scrollend listener) */
  const cancelLanding = useRef<(() => void) | null>(null);

  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // render exactly one fan: full on desktop, compact on mobile. The container's own
  // width drives this (so an embed adapts to its slot, not the viewport); the
  // viewport query only stands in for the first paint, before anything is measured.
  const viewportIsMobile = useMediaQuery(`(max-width: ${BREAKPOINT_PX - 1}px)`);
  const { narrow: containerNarrow, columns } = useContainerSize(rootRef);
  const isMobile = containerNarrow ?? viewportIsMobile;

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

  const scrollP = useScrollProgress(scrollRef, !reduceMotion, !isMobile);
  const p = debugProgress ?? scrollP;
  const chapter = chapterAt(p);

  const [selected, setSelected] = useState<Cell | null>(
    () => cells.find((c) => c.id === initialCell) ?? null,
  );
  const [hovered, setHovered] = useState<Cell | null>(null);
  // the camera target derives from the selection (frames.test.ts holds FRAMES
  // to a frame per cell), so open/close paths cannot desync the two
  // The zoom holds only while the reader is in the selected cell's chapter: the
  // sheet is not locked while a detail is open, and a frame tuned for one
  // chapter's explode state frames the wrong geometry once the parts move on, so
  // scrolling on pulls the camera home while the detail stays docked.
  const zoomFrame =
    selected && (isMobile || chapter === selected.scale)
      ? (FRAMES[selected.id] ?? HOME_FRAME)
      : null;
  // On mobile the compact fan ignores this viewBox, so cut instantly rather than
  // burn a per-frame spring re-rendering the whole tree for output nobody sees.
  const viewBox = useCamera(zoomFrame ?? HOME_FRAME, reduceMotion || isMobile);

  const focus = hovered ?? selected;

  // A ?cell= deep link lands the desktop page on that cell's chapter plateau, so
  // the zoom frame (tuned for the chapter's explode state) frames real geometry
  // instead of a giant assembled close-up, and the chip is operable on close.
  /** Scroll to where a scale's chapter is at full strength. The deep link and the
   *  chapter rail share it: both want a fan state whose chips are operable and
   *  whose camera frames point at real geometry. */
  const goToScale = useCallback((scale: Scale, smooth = true) => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const span = scrollEl.offsetHeight - window.innerHeight;
    if (span <= 0) return;
    const top = scrollEl.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + plateauCentre(scale) * span,
      behavior: smooth ? "smooth" : "auto",
    });
    if (!smooth) return;

    // Land the reader ON the cells the stop just brought out. The callouts are
    // drawn inside the SVG, which precedes the rail in DOM order, so tabbing on
    // from the rail walks *away* from them — a keyboard user could reach a
    // scale's chips only by shift-tabbing backwards past everything. Moving
    // focus to the first chip makes the stop behave like the skip link it is.
    const target = cells.find((c) => c.scale === scale && !c.structurallyEmpty);
    if (!target) return;
    const land = () => {
      const chip = document.getElementById(`cvt-co-${target.id}`);
      // only once the chapter is actually on stage; before that it is aria-hidden
      if (chip?.getAttribute("tabindex") === "0") chip.focus();
    };
    // scrollend fires when the smooth scroll settles; the timeout covers engines
    // without it, and firing land() twice is harmless. Both are cancellable: a
    // pending landing that outlives the component would move focus into a tree
    // that is no longer on the page.
    cancelLanding.current?.();
    const timer = setTimeout(land, 700);
    window.addEventListener("scrollend", land, { once: true });
    cancelLanding.current = () => {
      clearTimeout(timer);
      window.removeEventListener("scrollend", land);
    };
  }, []);

  useEffect(() => () => cancelLanding.current?.(), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design — a later mobile↔desktop resize must not yank the reader's scroll position
  useEffect(() => {
    if (!initialCell || isMobile) return;
    const cell = cells.find((c) => c.id === initialCell);
    if (cell) goToScale(cell.scale, false);
  }, []);

  const openCell = useCallback(
    (cell: Cell, focusId?: string) => {
      lastFocused.current = focusId ?? null;
      // Name the clicked trigger's swatch so the browser's *old* snapshot has a
      // cvt-verdict-morph element to pair with the panel's header glyph; the
      // name comes off again inside the update, before the new snapshot, so the
      // panel's glyph (named in CSS) is the only carrier there.
      const source = focusId
        ? document.getElementById(focusId)?.querySelector<SVGElement>(".cvt-glyphbox")
        : null;
      source?.style.setProperty("view-transition-name", "cvt-verdict-morph");
      withViewTransition(() => {
        source?.style.removeProperty("view-transition-name");
        setSelected(cell);
      }, !reduceMotion);
    },
    [reduceMotion],
  );

  const closeCell = useCallback(() => {
    withViewTransition(() => setSelected(null), !reduceMotion);
  }, [reduceMotion]);

  // Only the covering sheet locks the page. A detail drawn on the sheet is not
  // modal, and a scroll lock would make it modal in behaviour while non-modal in
  // ARIA — the reader scrolls on and the detail rides its column.
  useBodyScrollLock(isMobile && selected !== null);

  return (
    <div
      className="cvt"
      ref={rootRef}
      data-theme={effectiveTheme}
      style={THEME_VARS[effectiveTheme]}
    >
      {/* On mobile the sheet has no narrative column to give up, so the detail
          arrives as a bottom sheet over the stepper — same region, same focus
          contract, different place on the page. */}
      {isMobile && selected && (
        <DetailRegion
          cell={selected}
          returnFocusTo={lastFocused.current}
          onClose={closeCell}
          compact
          modal
        />
      )}
      {isMobile ? (
        <MobileStepper
          onOpen={openCell}
          reduceMotion={reduceMotion}
          themeToggle={
            <ThemeToggle
              theme={effectiveTheme}
              onToggle={() => setThemeOverride(effectiveTheme === "dark" ? "light" : "dark")}
            />
          }
        />
      ) : (
        <div
          className="cvt-scroll"
          data-chapter={chapter}
          data-panel={selected ? "open" : undefined}
        >
          <SheetFrame columns={columns} />
          {/* sheet-level chrome, so it sits in the sheet's margin rather than
              inside the drawing's own column, where it crowded the chapter rail */}
          <div className="cvt-sheet-actions">
            <span className="cvt-hud-tag">illustrative read-outs: no model ran here</span>
            <ThemeToggle
              theme={effectiveTheme}
              onToggle={() => setThemeOverride(effectiveTheme === "dark" ? "light" : "dark")}
            />
          </div>
          <TitleBlock />
          <MaturityInstrument live={CLAIMED_VERDICTS} />
          {/* The stage + chapters share one wrapper, placed directly by the grid. */}
          <div className="cvt-pinwrap">
            {/* ---- sticky stage: the fan IS the interface ---- */}
            <div className="cvt-stagecol">
              <div className="cvt-sticky">
                <Fan
                  p={p}
                  focus={focus}
                  onSelect={openCell}
                  onHover={setHovered}
                  reduceMotion={reduceMotion}
                  compact={isMobile}
                  viewBox={viewBox}
                  frame={zoomFrame}
                />
                <div className="cvt-hud">
                  <div className="cvt-hud-top">
                    {/* Operable, not just an indicator: the fan's own chips are
                        gated to their chapter's plateau, so before this a desktop
                        keyboard user could not reach the Component or Material
                        cells at all — only a scroll wheel could bring them on
                        stage. Each stop is a real button that goes there. */}
                    <ol className="cvt-ind" aria-label="Physical scale chapters">
                      {SCALES.map((s) => (
                        <li key={s} style={{ "--hue": SCALE_VAR[s] }}>
                          <button
                            type="button"
                            data-active={chapter === s}
                            aria-current={chapter === s ? "true" : undefined}
                            onClick={() => goToScale(s)}
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                      <li className="cvt-ind-end">
                        <a href="#cvt-matrix" data-active={chapter === "outro"}>
                          the map
                        </a>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* Both live in the narrative column. The rail stays mounted even
                while the detail is open, because its chapters ARE the scroll
                length the whole narrative is measured over — swapping it out
                collapsed the page and dropped the reader at the outro. */}
            <div
              className="cvt-railcol"
              ref={scrollRef}
              data-detail={selected ? "open" : undefined}
            >
              {/* before the rail, not after it: the detail is sticky, and sticky
                  cannot pin above its own static position — placed last it sat
                  at the far end of the rail's five thousand pixels and never
                  appeared on screen at all */}
              {selected && (
                // a zero-height sticky slot: the detail rides it down the column
                // without adding to the column's height, which is the scroll
                // timeline — a detail that lengthened it remapped every chapter
                // under the reader the moment it opened
                <div className="cvt-detail-slot">
                  <DetailRegion
                    cell={selected}
                    // a deep link has no opener; its cell's own callout is the
                    // nearest thing to one, and the link has scrolled it on stage
                    returnFocusTo={lastFocused.current ?? `cvt-co-${selected.id}`}
                    onClose={closeCell}
                  />
                </div>
              )}
              <Rail chapter={chapter} />
            </div>
          </div>
          {/* full-width row: the stage's sticky column ends here, and the matrix
              gets the whole canvas as a captioned paper figure */}
          <Outro />
        </div>
      )}

      {/* licences live in the repo (LICENSE + README), not the chrome */}
      <footer className="cvt-footer">
        <span>© 2026 Simon van Lierde</span>
        <a
          href="https://github.com/simonvanlierde/cv-ie-taxonomy"
          target="_blank"
          rel="noreferrer"
          aria-label="Source on GitHub"
          title="Source on GitHub"
        >
          <GitHubIcon />
        </a>
      </footer>
    </div>
  );
}

// ---- sheet furniture ---------------------------------------------------------
// The page is one drawing sheet, so its border, graticule references, title block
// and maturity instrument are fixed to the viewport rather than scrolling with the
// content: you stay on the sheet and the drawing moves under it. All of it is
// decorative chrome over a live document, so it takes no pointer events and is
// hidden from the accessibility tree — every fact it shows is stated in the
// document proper (the title block repeats the figure caption's provenance, the
// instrument repeats the legend).

const ROW_REFS = Array.from({ length: 20 }, (_, i) => i + 1);

/** `columns`: how many column references the sheet is wide enough to show,
 *  from the container measurement — the rest were DOM under overflow: hidden. */
const SheetFrame = memo(function SheetFrame({ columns }: { columns: number }) {
  return (
    <div className="cvt-sheet" aria-hidden>
      <div className="cvt-sheet-border" />
      <div className="cvt-ruler cvt-ruler-x">
        {COLUMN_REFS.slice(0, columns).map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="cvt-ruler cvt-ruler-y">
        {ROW_REFS.map((r) => (
          <span key={r}>{r}</span>
        ))}
      </div>
    </div>
  );
});

/** ISO 7200 corner. The DOI row is deliberately empty rather than absent: the
 *  deposit is planned, and a labelled blank says so without implying one exists. */
const TitleBlock = memo(function TitleBlock() {
  return (
    <dl className="cvt-titleblock" aria-hidden>
      <div className="cvt-tb-title">{taxonomy.meta.title}</div>
      <div className="cvt-tb-row">
        <dt>drawn</dt>
        <dd>S. van Lierde</dd>
      </div>
      <div className="cvt-tb-row">
        <dt>source</dt>
        <dd>Table S2 of the paper</dd>
      </div>
      <div className="cvt-tb-row">
        <dt>scan</dt>
        <dd>{taxonomy.meta.scanDate}</dd>
      </div>
      <div className="cvt-tb-row">
        <dt>sheet</dt>
        <dd>1 of 1</dd>
      </div>
      <div className="cvt-tb-row">
        <dt>doi</dt>
        <dd className="cvt-tb-blank">not yet deposited</dd>
      </div>
    </dl>
  );
});

/** The ramp as a permanent instrument. It replaces a legend that appeared once in
 *  the hero and scrolled away, leaving every letter after it to be recalled; the
 *  unclaimed Strong rung is drawn, because the empty top of the ramp is the
 *  paper's finding and belongs on screen the whole way down. */
const MaturityInstrument = memo(function MaturityInstrument({ live }: { live: Set<Verdict> }) {
  return (
    <div className="cvt-instrument" aria-hidden>
      <p className="cvt-instrument-head">maturity</p>
      {taxonomy.meta.maturityLevels.map((level) => (
        <p
          className="cvt-rung"
          key={level.verdict}
          data-claimed={live.has(level.verdict)}
          data-verdict={level.letter}
        >
          {/* an unclaimed rung is hollow, so it takes no fill at all rather than
              a fill the stylesheet has to override */}
          <i
            style={
              live.has(level.verdict)
                ? { background: VERDICT_VAR[level.verdict] ?? "none" }
                : undefined
            }
          />
          <b>{level.letter}</b>
          {level.verdict}
          {live.has(level.verdict) ? "" : " — unclaimed"}
        </p>
      ))}
    </div>
  );
});

/** Which rungs any cell actually reaches, so "unclaimed" is read off the data
 *  rather than hard-coded to Strong — a later verdict change updates the drawing. */
const CLAIMED_VERDICTS = new Set<Verdict>(
  cells.flatMap((c) => [c.maturity, ...(c.subVerdicts ?? []).map((s) => s.maturity)]),
);

// ---- narrative rail (memoized: only re-renders on chapter change, not on
// every scroll frame) ---------------------------------------------------------
const Rail = memo(function Rail({ chapter }: { chapter: Chapter }) {
  return (
    <div className="cvt-rail">
      <section className="cvt-hero">
        <Hero hint="Click any read-out on the fan to see the evidence." />
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
            style={{ "--hue": SCALE_VAR[scale] }}
          >
            {/* the prose pins while its chapter's overlays are on the stage, so the
                two are read together rather than in sequence */}
            <div className="cvt-chapter-inner">
              <h2>{copy.title}</h2>
              <p className="cvt-body">{copy.body}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
});

// ---- pieces shared between the desktop rail and the mobile stepper, so the
// claim-bearing copy and the cell buttons have exactly one source ---------------

/** The hero's shared copy: eyebrow, title, sub and maturity legend. `hint` is
 *  the interaction sentence — the desktop rail points at the fan's chips, which
 *  the compact fan does not render, so the stepper omits it. */
export function Hero({ hint }: { hint?: string }) {
  return (
    <>
      <h1 className="cvt-title">
        What can a machine
        <br />
        actually see?
      </h1>
      <p className="cvt-sub">
        Circular-economy research keeps asking cameras to judge discarded products: what is this,
        what's inside it, what's it worth? Here is one worn-out desk fan, and the twelve ways
        computer vision could answer. Each way is judged by how well it works today.
        {hint ? ` ${hint} ` : " "}Every verdict comes straight from the paper's{" "}
        <span className="cvt-cite">Table&nbsp;S2</span>:{" "}
        <em>the heavier the square, the stronger the evidence</em>. Colour just tells the three
        scales apart.
      </p>
    </>
  );
}

/** One scale's cells as a plain list of buttons: the mobile stand-in for the
 *  fan's chips. */
export function CellList({
  scale,
  onOpen,
}: {
  scale: Scale;
  onOpen: (cell: Cell, focusId?: string) => void;
}) {
  return (
    <div className="cvt-mgroup">
      {INFO_TYPES.map((info) => {
        const cell = cellAt(scale, info);
        const hid = `cvt-m-${cell.id}`;
        // a compound cell shows both sub-task verdicts, as the matrix does
        const split = splitOf(cell);
        return (
          <button
            key={cell.id}
            id={hid}
            type="button"
            className="cvt-mcell"
            data-ghost={!!cell.structurallyEmpty}
            onClick={() => onOpen(cell, hid)}
          >
            <VerdictSwatch verdict={cell.maturity} split={split} size={20} />
            <span className="cvt-mcell-info">{info}</span>
            <span className="cvt-mcell-task">
              {cell.structurallyEmpty
                ? "answered at the component scale"
                : cell.task.split(/[,;]/)[0]}
            </span>
            <b>
              {split
                ? split.map((v) => VERDICT_LETTER[v]).join(" / ")
                : VERDICT_LETTER[cell.maturity]}
            </b>
          </button>
        );
      })}
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="cvt-theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// ---- outro: the matrix, live — select a cell to fill the detail inline
// (memoized: nothing here depends on scroll progress, so the per-scroll-frame
// render skips it entirely) -----
export const Outro = memo(function Outro() {
  return (
    <section className="cvt-outro" id="cvt-matrix" aria-label="Full taxonomy matrix">
      <h2>
        The honest map is mostly gaps: by the paper's own rubric, none of the twelve tasks earns a
        Strong on worn, real-world products.
      </h2>
      <Explorable />
      <TableView />
      <p className="cvt-foot">
        Maturity of candidate CV tasks per physical scale × information type. Each block stands as
        high as its verdict, and its letter names it:{" "}
        {taxonomy.meta.maturityLevels.map((m, i) => (
          <span key={m.verdict}>
            {i > 0 ? " · " : ""}
            <b>{m.letter}</b> {m.verdict.toLowerCase()}
          </span>
        ))}
        . The rule across the top of every cell is Strong, and nothing reaches it. Dashed cells are
        structurally empty: no task of their own, because structure is a component-scale question. A
        cell with two letters carries two verdicts, one per sub-task; its block stands at the
        stronger and is ruled across at the weaker. Verdicts from the paper&rsquo;s Table&nbsp;S2;
        literature as of {taxonomy.meta.scanDate}.
      </p>
    </section>
  );
});

/** The figure's table twin: every verdict as text, nothing encoded by ink alone.
 *  A modal rather than an in-flow <details>: the scroll timeline is measured over
 *  this container, so expanding ~700px of table inline would remap every
 *  calibrated presence window under the reader (see timeline.ts). */
function TableView() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);
  return (
    <div className="cvt-tableview">
      <button
        type="button"
        className="cvt-tableview-open"
        onClick={() => {
          ref.current?.showModal();
          setOpen(true);
        }}
      >
        <TableIcon /> View as a plain table
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> already closes on Esc; onClick only adds backdrop-click for mouse users */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: a backdrop click lands on the <dialog> itself, so the handler has nowhere else to live */}
      <dialog
        ref={ref}
        className="cvt-panel cvt-tablepanel"
        aria-label="Table S2 as a plain table"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="cvt-panel-head">
          <h2 className="cvt-tableview-title">Table S2 · text view</h2>
          <button
            type="button"
            className="cvt-panel-close"
            onClick={() => ref.current?.close()}
            aria-label="Close table view"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="cvt-tablewrap">
          <table>
            <caption>
              The paper&rsquo;s Table S2 as text. Cells with two sub-tasks get a row each.
              <RubricKey />
            </caption>
            <thead>
              <tr>
                <th scope="col">Scale</th>
                <th scope="col">Information type</th>
                <th scope="col">Task</th>
                <th scope="col">Maturity</th>
                <th scope="col">{RUBRIC_LABEL}</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) =>
                (cell.subVerdicts ?? [{ label: null, maturity: cell.maturity }]).map((sub) => (
                  <tr key={`${cell.id}-${sub.label ?? "only"}`}>
                    <th scope="row">{cell.scale}</th>
                    <td>{cell.informationType}</td>
                    <td>
                      {cell.structurallyEmpty ? "structurally empty" : cell.task}
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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // no share sheet and no clipboard (e.g. an insecure embed): a button that
  // could only silently no-op is worse than no button
  if (typeof navigator.share !== "function" && !navigator.clipboard) return null;
  const share = async () => {
    // build on the current URL so host params survive (?theme=dark stays a dark
    // link); ?p is the dev-only scroll pin and has no business being shared
    const url = new URL(location.href);
    url.searchParams.set("cell", cellId);
    url.searchParams.delete("p");
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
    <button type="button" className="cvt-share" onClick={share}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

// What the paper's source-status flag means for a reader; n/a cells (nothing
// cited) show no chip at all rather than an unexplained "n/a".
const STATUS_LABEL: Record<string, string> = {
  Published: "peer-reviewed sources",
  Mixed: "peer-reviewed and preprint sources",
  Preprint: "preprint sources, not yet peer reviewed",
};

// The paper records each cell as an evidence mark and two gates. The marks are
// opaque on their own, so the key travels with them wherever they are shown.
const RUBRIC_LABEL = "Rubric marks (E · capture · deployed)";

function RubricKey() {
  return (
    <p className="cvt-rubric-key">
      <b>E</b>, how far a benchmarked capability reaches: <b>B</b> benchmarked product-general,{" "}
      <b>N</b> narrow class only, <b>C</b> concept or adjacent domain only, <b>–</b> no method, or
      derived. Then two gates, each ✓ or ✗: does it survive end-of-life capture, and is it deployed
      on the task. A ✗ on capture records why: ✗ᵐ measured drop, ✗ᵃ inferred from an adjacent
      domain, ✗ᵘ untested.
    </p>
  );
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
function DetailRegion({
  cell,
  onClose,
  returnFocusTo,
  compact = false,
  modal = false,
}: {
  cell: Cell;
  onClose: () => void;
  returnFocusTo: string | null;
  compact?: boolean;
  /** only the mobile sheet, which covers the drawing it belongs to */
  modal?: boolean;
}) {
  const ref = useDialogRegion({ open: true, onClose, returnFocusTo, modal });
  const shared = {
    className: compact ? "cvt-detail cvt-detail-sheet" : "cvt-detail",
    "aria-label": `${cell.scale} · ${cell.informationType}`,
    style: { "--hue": SCALE_VAR[cell.scale] } as CSSProperties,
    tabIndex: -1,
  };
  const body = <DetailPanel cell={cell} onClose={onClose} />;

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

function DetailPanel({ cell, onClose }: { cell: Cell; onClose: () => void }) {
  return (
    <>
      <div className="cvt-panel-head">
        <div>
          <h2>{cell.task}</h2>
          {/* under the title, not over it: the same words above a heading are a
              kicker, and this names which cell of the sheet the detail enlarges */}
          <p className="cvt-panel-scale">
            detail · {cell.scale} · {cell.informationType}
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
        <Row
          label="Why this verdict"
          value={<CitedProse text={cell.maturityNote} citeKeys={cell.citations} />}
        />
        {cell.failureMode && (
          <Row
            label="Where it breaks"
            value={<CitedProse text={cell.failureMode} citeKeys={cell.citations} />}
            mode="warn"
          />
        )}
        {/* The run belongs where the panel opens, not folded into "More detail":
            it is the derivation of the verdict stated three lines above it, and
            behind a closed <details> nobody meets the mechanism at all. */}
        <Row label="How the verdict was derived" value={<RubricCircuit cell={cell} />} />
      </dl>

      <details className="cvt-panel-more">
        <summary>More detail</summary>
        <dl className="cvt-panel-grid">
          {cell.methodFamily && (
            <Row
              label="Typical methods"
              value={<CitedProse text={cell.methodFamily} citeKeys={cell.citations} />}
            />
          )}
          {cell.example && (
            <Row
              label="Proven in a nearby field"
              value={<CitedProse text={cell.example} citeKeys={cell.citations} />}
            />
          )}
          {cell.hardware && <Row label="Typical hardware" value={cell.hardware} />}
          {/* the paper's own notation, for a reader checking against Table S2; the
              run above already glosses each mark, so the key stays with the table */}
          <Row label={RUBRIC_LABEL} value={<span className="cvt-mono">{cell.rubricMarks}</span>} />
          <Row label="How to handle the output" value={level.handling} />
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

// theme-toggle glyphs: sun shows in dark (→ switch to light), moon in light
/** Drawn, not a glyph: the sheet has an icon system (sun, moon, mark) in one
 *  stroke weight, and a Unicode ✕ rendered in whatever the fallback face is. */
function CloseIcon() {
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

// a small table glyph, so the table-view button reads as "this opens a table"
function TableIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10M15 10v10" />
    </svg>
  );
}

// the GitHub mark, as the footer's source link
function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
