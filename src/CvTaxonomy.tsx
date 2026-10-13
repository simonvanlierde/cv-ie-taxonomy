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
import { CHAPTER_COPY, cap, FIELD_SPLIT } from "./chapters";
import "./CvTaxonomy.css";
import {
  cellAt,
  cells,
  INFO_TYPES,
  maturityLevel,
  maturityName,
  SCALES,
  splitOf,
  taskName,
  taxonomy,
  VERDICT_LETTER,
} from "./data/taxonomy";
import type { Cell, Scale, Verdict } from "./data/types";
import { Explorable } from "./Explorable";
import { chipFrame, Fan } from "./Fan";
import {
  CHAPTER_FRAMES,
  type Chapter,
  clampFrame,
  FRAMES,
  type Frame,
  unionFrame,
  VIEW,
} from "./frames";
import { RealPhoto } from "./RealPhoto";
import { Cite, CitedProse } from "./References";
import { RubricCircuit } from "./RubricCircuit";
import { gapsOf, gapText } from "./rubricMarks";
import { BREAKPOINT_PX, SCALE_VAR, SURFACE, THEME_VARS, type Theme, VERDICT_VAR } from "./theme";
import { useDialogRegion } from "./useDialogRegion";
import { VerdictSwatch } from "./VerdictSwatch";

/** The camera as a CSS transform on the drawing's box: scale the frame up to
 *  fill the box (contain, like a viewBox with `meet`) and centre it. The box has
 *  VIEW's aspect ratio and `transform-origin: 0 0`; translate percentages are of
 *  the box itself. A CSS transition does the move. */
export function cameraTransform(f: Frame): string {
  const z = Math.min(VIEW.w / f.w, VIEW.h / f.h);
  const cx = (f.x + f.w / 2 - VIEW.x) / VIEW.w;
  const cy = (f.y + f.h / 2 - VIEW.y) / VIEW.h;
  const pct = (v: number) => `${+(v * 100).toFixed(3)}%`;
  return `translate(${pct(0.5 - cx * z)}, ${pct(0.5 - cy * z)}) scale(${+z.toFixed(4)})`;
}

/** Which scene the reader is in: the section crossing a line across the
 *  screen. Each scene is a section marked `data-chapter-at`. The line is the
 *  middle of the screen, or on a phone the middle of the text under the sticky
 *  figure (55% of the screen tall). Where IntersectionObserver is missing
 *  (jsdom), the opening scene stands. */
function useActiveChapter(ref: RefObject<HTMLElement | null>, phone: boolean): Chapter {
  const [chapter, setChapter] = useState<Chapter>("hero");
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const at = (entry.target as HTMLElement).dataset.chapterAt as Chapter | undefined;
          if (entry.isIntersecting && at) setChapter(at);
        }
      },
      { rootMargin: phone ? "-77% 0px -23% 0px" : "-50% 0px -50% 0px" },
    );
    for (const el of root.querySelectorAll("[data-chapter-at]")) io.observe(el);
    return () => io.disconnect();
  }, [ref, phone]);
  return chapter;
}

/** The camera frame for a cell's detail: its part frame, grown to hold its own
 *  chip, kept inside the drawing. */
export function frameFor(cellId: string): Frame {
  const part = FRAMES[cellId] ?? VIEW;
  const chip = chipFrame(cellId);
  return chip ? clampFrame(unionFrame(part, chip, 16), VIEW) : part;
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
  startViewTransition?: (
    cb: () => void,
  ) => { ready?: Promise<unknown>; finished?: Promise<unknown> } | undefined;
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
    // The browser aborts the morph if, say, the viewport resizes, and rejects `ready`.
    // The update itself still ran, so there is nothing to recover.
    doc.startViewTransition(() => flushSync(run))?.ready?.catch(() => {});
  } else {
    run();
  }
}

/**
 * The closing move: each named cell's chip flies into its matrix cell. Each pair
 * shares one view-transition-name, on the chip for the old snapshot and on the
 * cell for the new one, so the browser animates the chip's box into the cell's.
 * Nothing else changes, so a browser without view transitions loses nothing.
 */
export function flyIntoMap(ids: readonly string[]): void {
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== "function") return;
  const pairs = ids.flatMap((id) => {
    const chip = document.getElementById(`cvt-co-${id}`);
    const cell = document.getElementById(`cvt-mx-${id}`);
    return chip && cell ? [{ chip, cell, name: `cvt-fly-${id}` }] : [];
  });
  if (pairs.length === 0) return;
  for (const p of pairs) {
    p.chip.style.setProperty("view-transition-name", p.name);
    // the class gives the flight its own timing (::view-transition-group in CSS)
    p.chip.style.setProperty("view-transition-class", "cvt-fly");
    p.cell.style.setProperty("view-transition-class", "cvt-fly");
  }
  const t = doc.startViewTransition(() => {
    for (const p of pairs) {
      p.chip.style.removeProperty("view-transition-name");
      p.cell.style.setProperty("view-transition-name", p.name);
    }
  });
  const clear = () => {
    for (const p of pairs) {
      p.cell.style.removeProperty("view-transition-name");
      p.chip.style.removeProperty("view-transition-class");
      p.cell.style.removeProperty("view-transition-class");
    }
  };
  // aborted or done, the names come off so the next open-cell morph is clean
  t?.ready?.catch(() => {});
  t?.finished?.then(clear, clear);
}

// ---- main -------------------------------------------------------------------------
export function CvTaxonomy({
  theme,
  initialCell,
  debugChapter,
}: {
  theme?: Theme;
  /** deep-link: open this cell's panel on load */
  initialCell?: string;
  /** dev and tests: pin the page to one scene (?scene=0..4) */
  debugChapter?: Chapter;
} = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<string | null>(null);
  /** cancels a chapter stop's pending focus landing (timer + scrollend listener) */
  const cancelLanding = useRef<(() => void) | null>(null);

  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // The container's own width picks the layout; the viewport query only stands in
  // for the first paint, before anything is measured.
  const viewportIsMobile = useMediaQuery(`(max-width: ${BREAKPOINT_PX - 1}px)`);
  const { narrow: containerNarrow, columns } = useContainerSize(rootRef);
  const isMobile = containerNarrow ?? viewportIsMobile;

  // Theme has one owner, resolved here: `?theme=` beats the OS. There is no
  // in-page switch; the OS already says which ground the reader wants.
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const effectiveTheme: Theme = theme ?? (systemDark ? "dark" : "light");

  // A forced theme is also stamped on <html>, so the over-scroll area and the
  // form controls follow it. Both the attribute and color-scheme: the attribute
  // because build targets that predate light-dark() get it lowered to a
  // prefers-color-scheme shim, which would follow the OS instead.
  const forcedTheme = theme;
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

  const observed = useActiveChapter(rootRef, isMobile);
  const chapter = debugChapter ?? observed;

  const [selected, setSelected] = useState<Cell | null>(
    () => cells.find((c) => c.id === initialCell) ?? null,
  );
  const [hovered, setHovered] = useState<Cell | null>(null);
  // The zoom holds only while the reader is in the selected cell's chapter: the
  // sheet is not locked while a detail is open, and a frame tuned for one
  // chapter's pose frames the wrong geometry once the parts move on, so
  // scrolling on pulls the camera home while the detail stays docked.
  // The frame is the part's frame grown to hold the chip that opened it.
  const zoomFrame = selected && chapter === selected.scale ? frameFor(selected.id) : null;
  // Mounted at home, then moved to its target on the next frame: a ?cell= deep
  // link then dives from the whole drawing to the part, instead of opening on a
  // close-up of one corner.
  const [cameraLive, setCameraLive] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCameraLive(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const cameraFrame = cameraLive ? (zoomFrame ?? CHAPTER_FRAMES[chapter]) : VIEW;

  const focus = hovered ?? selected;

  /** Scroll a scene into view. The deep link, the chapter stops and a pinned
   *  scene share it. With `land`, focus then moves to the scene's first chip,
   *  so a stop behaves like the skip link it is. */
  const goToChapter = useCallback(
    (to: Chapter, smooth: boolean, land = false) => {
      const el = rootRef.current?.querySelector<HTMLElement>(`[data-chapter-at="${to}"]`);
      el?.scrollIntoView?.({ behavior: smooth ? "smooth" : "auto", block: "start" });
      if (!land || isMobile) return;
      const target = cells.find((c) => c.scale === to && !c.structurallyEmpty);
      if (!target) return;
      const landOn = () => {
        const chip = document.getElementById(`cvt-co-${target.id}`);
        // only once the chapter is actually on stage; before that it is inert
        if (chip && !chip.inert) chip.focus();
      };
      // scrollend fires when the smooth scroll settles; the timeout covers engines
      // without it, and landing twice is harmless. Both are cancellable: a pending
      // landing that outlives the component would move focus into a tree that is
      // no longer on the page.
      cancelLanding.current?.();
      const timer = setTimeout(landOn, 700);
      window.addEventListener("scrollend", landOn, { once: true });
      cancelLanding.current = () => {
        clearTimeout(timer);
        window.removeEventListener("scrollend", landOn);
      };
    },
    [isMobile],
  );

  useEffect(() => () => cancelLanding.current?.(), []);

  // A ?cell= deep link lands on that cell's scene, so the zoom frame points at
  // real geometry and the chip is operable on close. A pinned scene scrolls there
  // too, so the scroll-driven drawing agrees with it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design — a later mobile↔desktop resize must not yank the reader's scroll position
  useEffect(() => {
    const cell = cells.find((c) => c.id === initialCell);
    const to = debugChapter ?? cell?.scale;
    if (to) goToChapter(to, false);
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

  // Arrow keys step the docked detail through its chapter's siblings — the
  // chips are the controls, and while a detail is open most of them are out of
  // frame, so the keyboard needs a way along the ring that is not Tab.
  useEffect(() => {
    if (!selected || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step || e.altKey || e.metaKey || e.ctrlKey) return;
      // scoped to the drawing and its docked detail; the map has its own
      const t = e.target as HTMLElement | null;
      if (
        !t?.closest(".cvt-detail, .cvt-fan") ||
        t.closest("input, textarea, select, dialog, [popover]")
      )
        return;
      const ring = cells.filter((c) => c.scale === selected.scale);
      const i = ring.findIndex((c) => c.id === selected.id);
      const next = ring[(i + step + ring.length) % ring.length];
      if (!next) return;
      e.preventDefault();
      openCell(next, `cvt-co-${next.id}`);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, isMobile, openCell]);

  const closeCell = useCallback(() => {
    withViewTransition(() => setSelected(null), !reduceMotion);
  }, [reduceMotion]);

  // An open detail is a place the reader went, so the browser's Back closes it
  // rather than leaving the page. One history entry per open detail, however
  // many cells the reader steps through.
  // NOTE: closing the detail any other way leaves its entry behind, so the next
  // Back is a no-op. Taking it off with history.back() would restore the scroll
  // position from when the detail opened, and the detail also closes itself
  // when the reader scrolls to the matrix, so that would yank the page back.
  // The next detail reuses that leftover entry instead of pushing another, so
  // there is never more than one.
  // The entry carries a token of its own, so an entry left by an earlier mount
  // is never mistaken for this one.
  const historyEntry = useRef<string | null>(null);
  const lastEntry = useRef<string | null>(null);
  useEffect(() => {
    if (selected && !historyEntry.current) {
      const token = `${Date.now()}-${Math.random()}`;
      const state = { ...history.state, cvtDetail: token };
      if (lastEntry.current && history.state?.cvtDetail === lastEntry.current) {
        history.replaceState(state, "");
      } else {
        history.pushState(state, "");
      }
      historyEntry.current = lastEntry.current = token;
    } else if (!selected) {
      historyEntry.current = null;
    }
  }, [selected]);
  useEffect(() => {
    const onPop = () => {
      if (!historyEntry.current || history.state?.cvtDetail === historyEntry.current) return;
      historyEntry.current = null;
      closeCell();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [closeCell]);

  // Crossing from the last scene into the map, its chips fly into their cells.
  // Only forwards, on the sheet, and with motion welcome: the phone has no chips.
  const lastChapter = useRef(chapter);
  useEffect(() => {
    const from = lastChapter.current;
    lastChapter.current = chapter;
    // an open detail closes on the same step, in a view transition of its own;
    // a second transition at once would cancel the first, so the flight gives way
    if (from !== "Material" || chapter !== "outro" || reduceMotion || isMobile || selected) {
      return;
    }
    flyIntoMap(cells.filter((c) => c.scale === "Material").map((c) => c.id));
  }, [chapter, reduceMotion, isMobile, selected]);

  // The docked detail belongs to the drawing, so once the map arrives it would
  // sit over the matrix instead of leaving with the drawing. The map has its own
  // selection; reaching it closes the drawing's.
  useEffect(() => {
    if (selected && !isMobile && chapter === "outro") closeCell();
  }, [selected, isMobile, chapter, closeCell]);

  const backToStart = useCallback(() => {
    // A deep link has no opener to restore focus to. Return to the named hero
    // instead, and focus that landmark after the detail unmounts.
    lastFocused.current = null;
    closeCell();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    requestAnimationFrame(() =>
      document.getElementById("cvt-start")?.focus({ preventScroll: true }),
    );
  }, [closeCell, reduceMotion]);

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
      {/* the first tab stop: past the drawing and its scene buttons to the map */}
      <a className="cvt-skip-first" href="#cvt-matrix">
        Skip to the map
      </a>
      {/* On a phone the detail arrives as a sheet over the scenes — same region,
          same focus contract, different place on the page. */}
      {isMobile && selected && (
        <DetailRegion
          cell={selected}
          returnFocusTo={lastFocused.current}
          onClose={closeCell}
          onBackToStart={
            selected.id === initialCell && !lastFocused.current ? backToStart : undefined
          }
          compact
          modal
        />
      )}
      <div
        className="cvt-scroll"
        data-layout={isMobile ? "phone" : "sheet"}
        data-chapter={chapter}
        data-panel={selected ? "open" : undefined}
        // the sheet covers the scenes, so their controls leave the accessibility
        // tree with them: a browse cursor walks past a focus trap
        inert={isMobile && selected !== null}
      >
        {!isMobile && <SheetFrame columns={columns} />}
        {/* ---- sticky figure: the fan IS the interface ---- */}
        <div className="cvt-stagecol">
          <div className="cvt-sticky">
            <div className="cvt-stage">
              <div
                className="cvt-cam"
                style={isMobile ? undefined : { transform: cameraTransform(cameraFrame) }}
              >
                <Fan
                  chapter={chapter}
                  focus={focus}
                  onSelect={openCell}
                  onHover={setHovered}
                  reduceMotion={reduceMotion}
                  compact={isMobile}
                  frame={zoomFrame}
                />
              </div>
            </div>
            <div className="cvt-hud">
              {!isMobile && (
                <nav className="cvt-hud-top" aria-label="Scenes">
                  {/* Operable, not just an indicator: the fan's own chips are
                      gated to their scene, so each stop is a real button that
                      goes there and lands focus on its first chip. */}
                  <ol className="cvt-ind">
                    {SCALES.map((s) => (
                      <li key={s} style={{ "--hue": SCALE_VAR[s] }}>
                        <button
                          type="button"
                          data-active={chapter === s}
                          aria-current={chapter === s ? "true" : undefined}
                          onClick={() => goToChapter(s, !reduceMotion, true)}
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                    <li className="cvt-ind-end">
                      <a
                        href="#cvt-matrix"
                        data-active={chapter === "outro"}
                        aria-current={chapter === "outro" ? "true" : undefined}
                      >
                        the map
                      </a>
                    </li>
                  </ol>
                </nav>
              )}
              <div className="cvt-hud-foot">
                {!isMobile && (
                  <MaturityInstrument
                    live={CLAIMED_VERDICTS}
                    reading={focus ? (splitOf(focus) ?? [focus.maturity]).join("|") : ""}
                  />
                )}
                <IllustrativeDisclosure />
              </div>
            </div>
          </div>
        </div>

        <div className="cvt-railcol" data-detail={selected ? "open" : undefined}>
          {/* before the rail, not after it: the detail is sticky, and sticky
              cannot pin above its own static position */}
          {!isMobile && selected && (
            // a zero-height sticky slot: the detail rides it down the column
            // without pushing the scenes it covers
            <div className="cvt-detail-slot">
              <DetailRegion
                cell={selected}
                // a deep link has no opener; its cell's own callout is the
                // nearest thing to one, and the link has scrolled it on stage
                returnFocusTo={lastFocused.current ?? `cvt-co-${selected.id}`}
                onClose={closeCell}
                onBackToStart={
                  selected.id === initialCell && !lastFocused.current ? backToStart : undefined
                }
              />
            </div>
          )}
          <Rail chapter={chapter} phone={isMobile} onOpen={openCell} />
        </div>
        {/* full-width row: the figure's sticky column ends here, and the matrix
            gets the whole canvas as a captioned paper figure */}
        <Outro />
      </div>

      {/* licences live in the repo (LICENSE + README), not the chrome */}
      <SheetFooter inert={isMobile && selected !== null} />
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

/** The title block's fields, once: the fixed ISO 7200 block on the sheet and the
 *  page footer both draw them, so the two cannot disagree. The DOI row is
 *  deliberately empty rather than absent: the deposit is planned, and a
 *  labelled blank says so without implying one exists. */
function TitleRows() {
  return (
    <>
      <div className="cvt-tb-row">
        <dt>date</dt>
        <dd>{taxonomy.meta.scanDate}</dd>
      </div>
      <div className="cvt-tb-row">
        <dt>doi</dt>
        <dd className="cvt-tb-blank">not yet deposited</dd>
      </div>
    </>
  );
}

/** The sheet's end: the title block again, laid along the bottom edge as one
 *  strip, with the page's own two fields (©, code) added. The fixed block fades
 *  as the closing figure rises, and this is where its content lands. */
function SheetFooter({ inert }: { inert: boolean }) {
  return (
    // behind the phone's sheet, like the scenes
    <footer className="cvt-footer" inert={inert}>
      <dl className="cvt-foot-tb">
        <div className="cvt-tb-row cvt-tb-row-title">
          <dt>title</dt>
          <dd>{taxonomy.meta.title}</dd>
        </div>
        <TitleRows />
        <div className="cvt-tb-row">
          <dt>©</dt>
          <dd>2026 Simon van Lierde</dd>
        </div>
        <div className="cvt-tb-row">
          <dt>code</dt>
          <dd>
            <a
              href="https://github.com/simonvanlierde/cv-ie-taxonomy"
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon /> GitHub
            </a>
          </dd>
        </div>
        <div className="cvt-tb-row">
          <dt>privacy</dt>
          <dd>
            <a href={`${import.meta.env.BASE_URL}privacy.html`}>No tracking</a>
          </dd>
        </div>
      </dl>
    </footer>
  );
}

/** The ramp as a permanent instrument. It replaces a legend that appeared once in
 *  the hero and scrolled away, leaving every letter after it to be recalled. The
 *  hollow Strong rung keeps the paper's finding on screen without explaining it twice. */
const MaturityInstrument = memo(function MaturityInstrument({
  live,
  reading,
}: {
  live: Set<Verdict>;
  /** the verdicts of the cell under the pointer or focus, "|"-joined (a string
   *  so the memo holds across scroll frames): an instrument reads the thing
   *  being pointed at, so its rungs light while the chip is hot, both rungs for
   *  a split cell */
  reading: string;
}) {
  return (
    <div className="cvt-instrument" aria-hidden>
      <p className="cvt-instrument-head">maturity</p>
      {taxonomy.meta.maturityLevels.map((level) => (
        <p
          className="cvt-rung"
          key={level.verdict}
          data-claimed={live.has(level.verdict)}
          data-verdict={level.letter}
          data-reading={reading.split("|").includes(level.verdict)}
        >
          {/* an unreached rung is hollow, so it takes no fill at all rather than
              a fill the stylesheet has to override */}
          <i
            style={
              live.has(level.verdict)
                ? { "--fill": VERDICT_VAR[level.verdict] ?? "none" }
                : undefined
            }
          />
          <b>{level.letter}</b>
          <span className="cvt-rung-name">{level.verdict}</span>
        </p>
      ))}
    </div>
  );
});

/** Which rungs any cell actually reaches, so a later verdict change updates the drawing. */
const CLAIMED_VERDICTS = new Set<Verdict>(
  cells.flatMap((c) => [c.maturity, ...(c.subVerdicts ?? []).map((s) => s.maturity)]),
);

// ---- the scenes' text (memoized: only re-renders on chapter change) ----------
const Rail = memo(function Rail({
  chapter,
  phone,
  onOpen,
}: {
  chapter: Chapter;
  /** on a phone the fan has no chips, so each scene lists its cells as buttons */
  phone: boolean;
  onOpen: (cell: Cell, focusId?: string) => void;
}) {
  return (
    <div className="cvt-rail">
      <section className="cvt-hero" id="cvt-start" tabIndex={-1} data-chapter-at="hero">
        <Hero
          hint={
            phone
              ? "Each scene lists its cells. Tap one to see its evidence."
              : "Once labels appear on the fan, click one to see its evidence."
          }
        />
        <p className="cvt-scrollhint" aria-hidden>
          scroll to take it apart{" "}
          <span className="cvt-scrollhint-arrow">
            <ChevronIcon dir="down" />
          </span>
        </p>
        <a className="cvt-skip" href="#cvt-matrix">
          or skip to the map
        </a>
      </section>

      {SCALES.map((scale) => {
        const copy = CHAPTER_COPY[scale];
        return (
          <section
            key={scale}
            id={`cvt-ch-${scale}`}
            className="cvt-chapter"
            data-chapter-at={scale}
            data-active={chapter === scale}
            style={{ "--hue": SCALE_VAR[scale] }}
          >
            {/* the text pins while its scene holds the figure, so the two are
                read together rather than in sequence */}
            <div className="cvt-chapter-inner">
              <h2>{copy.title}</h2>
              <p className="cvt-body">{copy.body}</p>
              {phone && <CellList scale={scale} onOpen={onOpen} />}
              <RealPhoto scale={scale} />
            </div>
          </section>
        );
      })}
    </div>
  );
});

// ---- pieces shared between the scenes, the detail and the map, so the
// claim-bearing copy and the cell buttons have exactly one source ---------------

export function IllustrativeDisclosure() {
  return <p className="cvt-illustrative-note">Simulated read-outs · no model run</p>;
}

export function MaturityKey() {
  return (
    <ul className="cvt-maturity-key" aria-label="Maturity letter key">
      {taxonomy.meta.maturityLevels
        .filter((level) => level.verdict !== "Strong")
        .map((level) => (
          <li key={level.verdict}>
            <b>{level.letter}</b> {level.verdict}
          </li>
        ))}
    </ul>
  );
}

/** The opening's copy. `hint` is the interaction sentence, which differs
 *  between the fan's chips and the phone's cell lists. */
export function Hero({ hint }: { hint: string }) {
  return (
    <>
      <h1 className="cvt-title">
        What can a machine
        <br />
        actually see?
      </h1>
      <p className="cvt-hero-contract">
        Every verdict comes from the paper&rsquo;s <span className="cvt-cite">Table&nbsp;S2</span>.
        The more solid the mark, the stronger the evidence. Colour only shows the physical scale.
      </p>
      <p className="cvt-sub">
        Research on reuse and recycling (the circular economy) keeps asking cameras to judge
        discarded products. What is this? What&rsquo;s inside? What is it worth? Here is one
        worn-out desk fan, and ten tasks that computer vision (software that reads images) could
        take on. Most of them work in the lab. Almost none has been tested on photos taken where
        products are repaired, collected or recycled.
        {` ${hint}`}
      </p>
      <p className="cvt-hero-split">{FIELD_SPLIT}</p>
    </>
  );
}

/** One scale's cells as a plain list of buttons: the phone's stand-in for the
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
        const maturity = split ? split.join(" and ") : cell.maturity;
        return (
          <button
            key={cell.id}
            id={hid}
            type="button"
            className="cvt-mcell"
            data-ghost={!!cell.structurallyEmpty}
            onClick={() => onOpen(cell, hid)}
          >
            {/* the name is the visible text, in order, with the scale before it
                and the verdict after it for a listener: a voice user says what
                they see */}
            <span className="cvt-sr">{scale} ·</span>{" "}
            <VerdictSwatch verdict={cell.maturity} split={split} size={20} />
            <span className="cvt-mcell-info">{info}</span>{" "}
            <span className="cvt-mcell-task">
              {cell.structurallyEmpty ? "answered at the component scale" : cell.task}
            </span>{" "}
            <b>
              {cell.structurallyEmpty
                ? ""
                : split
                  ? split.map((v) => VERDICT_LETTER[v]).join(" / ")
                  : VERDICT_LETTER[cell.maturity]}
            </b>{" "}
            <span className="cvt-sr">Maturity: {maturity}. Open details.</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- outro: the matrix, live — select a cell to fill the detail inline
// (memoized: nothing here changes with the scene or the hovered chip) ------------
export const Outro = memo(function Outro() {
  return (
    // tabIndex -1: the skip link and the rail's "the map" target this id, and a
    // focusable target is where the browser puts focus after the jump — without
    // it a keyboard reader's next Tab started from wherever it was before
    <section
      className="cvt-outro"
      id="cvt-matrix"
      aria-label="The full map of twelve cells"
      tabIndex={-1}
      data-chapter-at="outro"
    >
      <h2>
        Most of these tools exist. Almost none has been tested where products are actually handled.
      </h2>
      <MaturityKey />
      {/* the caption and the table twin ride the narrative column beside the
          figure, and step aside for the detail the way act one's prose does */}
      <Explorable>
        <div className="cvt-foot">
          <p>
            How mature ten vision tasks are, across twelve cells: physical scale by type of
            information. Each block is as tall as its verdict. The dashed line is Strong, and
            nothing reaches it. The words under a block say what it is missing. Verdicts come from
            the paper&rsquo;s Table&nbsp;S2 and cover the literature as of {taxonomy.meta.scanDate}.
          </p>
          <p>
            Hatched cells have no task of their own, because structure is a question for the
            Component scale. Two letters mean two sub-tasks. The block stands at the stronger
            verdict, with a line across at the weaker one.
          </p>
          <p>
            By the paper&rsquo;s own scoring rules (its rubric), no task earns a Strong on field
            photos. What is missing comes in three shapes. Some tasks have no shared taxonomy yet,
            for example for a product&rsquo;s condition across product types, or for how its parts
            are fastened. One has no method at all: seeing what lies under the surface. The rest
            have methods that have not been tested on field photos.
          </p>
          <p>
            Industrial ecology already describes products by hand, so it can help build those shared
            words and a shared set of field photos to test on.
          </p>
        </div>
        <TableView />
      </Explorable>
    </section>
  );
});

/** The figure's table twin: every verdict as text, nothing encoded by ink alone. */
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
        <TableIcon /> Plain table
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> already closes on Esc; onClick only adds backdrop-click for mouse users */}
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
              Table S2 as text. A cell with two sub-tasks has a row each.
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
const RUBRIC_LABEL = "Rubric marks (evidence · field · deployed)";

function RubricKey() {
  return (
    <p className="cvt-rubric-key">
      The first mark is the evidence. <b>B</b>: a general method, benchmarked on these or similar
      products (benchmarked product-general). <b>N</b>: one narrow class only. <b>C</b>: a concept,
      or shown only in a neighbouring field. <b>–</b>: no method, or worked out from other cells.
      Then come two gates, each ✓ or ✗. The field gate asks whether it survives end-of-life photos.
      The deployment gate asks whether it is in use on this task. A ✗ on the field gate says why: ✗ᵐ
      measured drop, ✗ᵃ inferred from adjacent evidence, ✗ᵘ untested.
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
  onBackToStart,
  compact = false,
  modal = false,
}: {
  cell: Cell;
  onClose: () => void;
  returnFocusTo: string | null;
  onBackToStart?: () => void;
  compact?: boolean;
  /** only the mobile sheet, which covers the drawing it belongs to */
  modal?: boolean;
}) {
  const ref = useDialogRegion({ open: true, onClose, returnFocusTo, modal, contentKey: cell.id });
  const shared = {
    className: compact ? "cvt-detail cvt-detail-sheet" : "cvt-detail",
    "aria-label": `${cell.scale} · ${cell.informationType}`,
    style: { "--hue": SCALE_VAR[cell.scale] } as CSSProperties,
    tabIndex: -1,
  };
  const body = <DetailPanel cell={cell} onClose={onClose} onBackToStart={onBackToStart} />;

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

function DetailPanel({
  cell,
  onClose,
  onBackToStart,
}: {
  cell: Cell;
  onClose: () => void;
  onBackToStart?: () => void;
}) {
  return (
    <>
      <div className="cvt-panel-head">
        <div>
          <h2>{taskName(cell)}</h2>
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
      <IllustrativeDisclosure />
      <DetailBody cell={cell} />
      {onBackToStart && (
        <button type="button" className="cvt-back-start" onClick={onBackToStart}>
          Back to start
        </button>
      )}
    </>
  );
}

export function DetailBody({ cell }: { cell: Cell }) {
  const level = maturityLevel(cell.maturity);
  // a compound cell states both verdicts, and each sub-task keeps its own
  // handling: the weaker one's "do not populate" must not read as "verify"
  const split = splitOf(cell);
  const mentionsEol = [cell.maturityNote, cell.failureMode, cell.example].some((value) =>
    /EoL|end-of-life|end of life/i.test(value ?? ""),
  );
  return (
    <>
      {mentionsEol && (
        <p className="cvt-term-note">
          End-of-life (<abbr title="End-of-life">EoL</abbr>) capture means photos of products after
          use. They are often damaged, dirty, incomplete or poorly framed.
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
          {!split && <span>{level.gloss}</span>}
        </div>
      </div>

      {cell.subVerdicts && (
        <ul className="cvt-subverdicts">
          {cell.subVerdicts.map((s) => (
            <li key={s.label}>
              <b>{VERDICT_LETTER[s.maturity]}</b> {s.label}: {s.maturity}
              <span>{maturityLevel(s.maturity).gloss}</span>
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
            label="Where it fails"
            value={<CitedProse text={cell.failureMode} citeKeys={cell.citations} />}
            mode="warn"
          />
        )}
        <GapRow cell={cell} />
        {/* The run belongs where the panel opens, not folded into "More detail":
            it is the derivation of the verdict stated three lines above it, and
            behind a closed <details> nobody meets the mechanism at all. */}
        <Row label="How it was derived" value={<RubricCircuit cell={cell} />} />
      </dl>

      <details className="cvt-panel-more">
        <summary>More</summary>
        <dl className="cvt-panel-grid">
          {cell.methodFamily && (
            <Row
              label="Typical methods"
              value={<CitedProse text={cell.methodFamily} citeKeys={cell.citations} />}
            />
          )}
          {cell.example && (
            <Row
              label="Nearby examples"
              value={<CitedProse text={cell.example} citeKeys={cell.citations} />}
            />
          )}
          {cell.hardware && <Row label="Where it runs" value={cell.hardware} />}
          {/* the paper's own notation, for a reader checking against Table S2; the
              run above already glosses each mark, so the key stays with the table */}
          <Row label={RUBRIC_LABEL} value={<span className="cvt-mono">{cell.rubricMarks}</span>} />
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

/** A drawn chevron in the close icon's stroke, for the scroll cue; always beside
 *  words that name the action. */
export function ChevronIcon({ dir }: { dir: "left" | "right" | "down" }) {
  const d = { left: "M15 5l-7 7 7 7", right: "M9 5l7 7-7 7", down: "M5 9l7 7 7-7" }[dir];
  return (
    <svg
      className="cvt-chevron"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
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
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
