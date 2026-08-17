import {
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
import type { Cell, InfoType, Scale } from "./data/types";
import { Explorable } from "./Explorable";
import { Fan } from "./Fan";
import { FRAMES, HOME_FRAME } from "./frames";
import { MobileStepper } from "./MobileStepper";
import { Cite, CitedProse } from "./References";
import { BREAKPOINT_PX, SCALE_VAR, SURFACE, THEME_VARS, type Theme } from "./theme";
import { plateauCentre, TIMELINE } from "./timeline";
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

/** Whether the component root is narrower than the layout breakpoint, measured via
 *  ResizeObserver. Stores the boolean, not the raw width, so a resize drag only
 *  re-renders on the frame the threshold is crossed. null until the first
 *  measurement, so callers fall back to a viewport guess for the first paint. */
function useContainerNarrow(ref: RefObject<HTMLElement | null>): boolean | null {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setNarrow(w < BREAKPOINT_PX);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return narrow;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocused = useRef<string | null>(null);

  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // render exactly one fan: full on desktop, compact on mobile. The container's own
  // width drives this (so an embed adapts to its slot, not the viewport); the
  // viewport query only stands in for the first paint, before anything is measured.
  const viewportIsMobile = useMediaQuery(`(max-width: ${BREAKPOINT_PX - 1}px)`);
  const containerNarrow = useContainerNarrow(rootRef);
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
  const [activeInfo, setActiveInfo] = useState<Set<InfoType>>(new Set());
  // the camera target derives from the selection (frames.test.ts holds FRAMES
  // to a frame per cell), so open/close paths cannot desync the two
  const zoomFrame = selected ? (FRAMES[selected.id] ?? HOME_FRAME) : null;
  // On mobile the compact fan ignores this viewBox, so cut instantly rather than
  // burn a per-frame spring re-rendering the whole tree for output nobody sees.
  const viewBox = useCamera(zoomFrame ?? HOME_FRAME, reduceMotion || isMobile);

  // the drawer's 0.28s exit keeps rendering after `selected` clears; hold the
  // last cell so it slides out with its content, not as an empty card
  const lastSelected = useRef<Cell | null>(null);
  if (selected) lastSelected.current = selected;
  const panelCell = selected ?? lastSelected.current;

  const focus = hovered ?? selected;
  const isDim = (c: Cell) => isDimmed(activeInfo, c);

  // A ?cell= deep link lands the desktop page on that cell's chapter plateau, so
  // the zoom frame (tuned for the chapter's explode state) frames real geometry
  // instead of a giant assembled close-up, and the chip is operable on close.
  // Declared BEFORE useBodyScrollLock below: effects run in order, and the lock
  // pins the page at whatever scroll position it finds — this must set it first.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design — a later mobile↔desktop resize must not yank the reader's scroll position
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!initialCell || isMobile || !scrollEl) return;
    const cell = cells.find((c) => c.id === initialCell);
    if (!cell) return;
    const span = scrollEl.offsetHeight - window.innerHeight;
    if (span > 0) window.scrollTo(0, scrollEl.offsetTop + plateauCentre(cell.scale) * span);
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

  useBodyScrollLock(selected !== null);

  return (
    <div
      className="cvt"
      ref={rootRef}
      data-theme={effectiveTheme}
      style={THEME_VARS[effectiveTheme]}
    >
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
        <div className="cvt-scroll" ref={scrollRef}>
          {/* The stage + chapters share one wrapper, placed directly by the grid. */}
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
                      <span className="cvt-hud-tag">illustrative read-outs: no model ran here</span>
                      <ThemeToggle
                        theme={effectiveTheme}
                        onToggle={() =>
                          setThemeOverride(effectiveTheme === "dark" ? "light" : "dark")
                        }
                      />
                    </div>
                  </div>
                  <div className="cvt-hud-bottom">
                    <ol className="cvt-ind" aria-label="Physical scale chapters">
                      {SCALES.map((s) => (
                        <li key={s} data-active={chapter === s} style={{ "--hue": SCALE_VAR[s] }}>
                          {s}
                        </li>
                      ))}
                    </ol>
                    <InfoFilter active={activeInfo} onChange={setActiveInfo} />
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

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> already closes on Esc; onClick only adds backdrop-click for mouse users */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: a backdrop click lands on the <dialog> itself, so the handler has nowhere else to live */}
      <dialog
        ref={dialogRef}
        className="cvt-panel"
        aria-label={panelCell ? `${panelCell.scale} · ${panelCell.informationType}` : undefined}
        style={panelCell ? { "--hue": SCALE_VAR[panelCell.scale] } : undefined}
        onClose={() => setSelected(null)}
        onClick={(e) => {
          // click on the backdrop (the dialog itself, outside its content) closes it
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {panelCell && <DetailPanel cell={panelCell} onClose={() => dialogRef.current?.close()} />}
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
              <p className="cvt-eyebrow">
                <span className="cvt-dot" aria-hidden /> {scale} scale
              </p>
              <h2>{copy.title}</h2>
              <p className="cvt-body">{copy.body}</p>
            </div>
            {/* mobile only: this scale's cells as a plain list */}
            <CellList scale={scale} activeInfo={activeInfo} onOpen={onOpen} />
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
      <p className="cvt-eyebrow">Review paper · interactive supplement</p>
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
        <span className="cvt-cite">Table&nbsp;S1</span>:{" "}
        <em>the heavier the square, the stronger the evidence</em>. Colour just tells the three
        scales apart.
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
    </>
  );
}

/** One scale's cells as a plain list of buttons (the mobile stand-in for the
 *  fan's chips), dimmed by the information-type filter like everything else. */
export function CellList({
  scale,
  activeInfo,
  onOpen,
}: {
  scale: Scale;
  activeInfo: Set<InfoType>;
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
            data-dim={isDimmed(activeInfo, cell)}
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

/** The information-type filter chips; owns the set arithmetic so both layouts
 *  just hand it their state. */
export function InfoFilter({
  active,
  onChange,
}: {
  active: Set<InfoType>;
  onChange: (next: Set<InfoType>) => void;
}) {
  return (
    <fieldset className="cvt-filtergroup">
      <legend className="cvt-filters-label">filter &gt; information type</legend>
      <div className="cvt-filters">
        {INFO_TYPES.map((info) => (
          <button
            key={info}
            type="button"
            className="cvt-chip"
            aria-pressed={active.has(info)}
            onClick={() => {
              const next = new Set(active);
              next.has(info) ? next.delete(info) : next.add(info);
              onChange(next);
            }}
          >
            {info}
          </button>
        ))}
      </div>
    </fieldset>
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
      <p className="cvt-eyebrow">The full matrix</p>
      <h2>
        The honest map is mostly gaps: by the paper's own rubric, none of the twelve tasks earns a
        Strong on worn, real-world products.
      </h2>
      <Explorable />
      <TableView />
      <p className="cvt-foot">
        Maturity of candidate CV tasks per physical scale × information type, shown by ink weight
        and letter:{" "}
        {taxonomy.meta.maturityLevels.map((m, i) => (
          <span key={m.verdict}>
            {i > 0 ? " · " : ""}
            <b>{m.letter}</b> {m.verdict.toLowerCase()}
          </span>
        ))}
        . Dashed cells are structurally empty: no task of their own, because structure is a
        component-scale question. A cell split on the diagonal carries two verdicts, one per
        sub-task. Verdicts from Paper 2, Table S1; literature as of {taxonomy.meta.scanDate}.
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
        aria-label="Table S1 as a plain table"
        onClose={() => setOpen(false)}
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
              The paper&rsquo;s Table S1 as text. Cells with two sub-tasks get a row each.
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
          <Row label="Rubric marks (i·ii·iii·m)" value={cell.rubricMarks} mono />
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
