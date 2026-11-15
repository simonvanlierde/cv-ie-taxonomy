import {
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CHAPTER_COPY, FIELD_SPLIT } from "./chapters";
import "./CvTaxonomy.css";
import { CloseIcon, DetailRegion, IllustrativeDisclosure, RUBRIC_LABEL, RubricKey } from "./Detail";
import {
  cellAt,
  cells,
  INFO_TYPES,
  SCALES,
  splitOf,
  taxonomy,
  VERDICT_LETTER,
} from "./data/taxonomy";
import type { Cell, Scale, Verdict } from "./data/types";
import { Explorable } from "./Explorable";
import { chipFrame, Fan } from "./Fan";
import {
  CHAPTER_FRAMES,
  type Chapter,
  cameraTransform,
  clampFrame,
  FRAMES,
  type Frame,
  unionFrame,
  VIEW,
} from "./frames";
import { RealPhoto } from "./RealPhoto";
import { Cite } from "./References";
import { BREAKPOINT_PX, SCALE_VAR, SURFACE, THEME_VARS, type Theme, VERDICT_VAR } from "./theme";
import { VerdictSwatch } from "./VerdictSwatch";
import { flyIntoMap, withViewTransition } from "./viewTransitions";

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

/** Observe only the layout breakpoint; intermediate widths need no render. */
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
  const containerNarrow = useContainerNarrow(rootRef);
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
      }, !reduceMotion && !isMobile);
    },
    [reduceMotion, isMobile],
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
    withViewTransition(() => setSelected(null), !reduceMotion && !isMobile);
  }, [reduceMotion, isMobile]);

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
          returnFocusTo={
            lastFocused.current?.replace("cvt-co-", "cvt-m-") ?? `cvt-m-${selected.id}`
          }
          onClose={closeCell}
          onBackToStart={
            selected.id === initialCell && !lastFocused.current ? backToStart : undefined
          }
          onNavigate={(step) => {
            const ring = cells.filter((c) => c.scale === selected.scale);
            const index = ring.findIndex((c) => c.id === selected.id);
            const next = ring[(index + step + ring.length) % ring.length];
            if (next) openCell(next, `cvt-m-${next.id}`);
          }}
          compact
          modal
        />
      )}
      <div
        className="cvt-scroll"
        data-layout={isMobile ? "phone" : "sheet"}
        data-chapter={isMobile && selected ? selected.scale : chapter}
        data-cell={selected?.id}
        data-panel={selected ? "open" : undefined}
        // the sheet covers the scenes, so their controls leave the accessibility
        // tree with them: a browse cursor walks past a focus trap
        inert={isMobile && selected !== null}
      >
        {!isMobile && <div className="cvt-sheet" aria-hidden />}
        {/* ---- sticky figure: the fan IS the interface ---- */}
        <div className="cvt-stagecol">
          <div className="cvt-sticky">
            <div className="cvt-stage">
              <div
                className="cvt-cam"
                style={isMobile ? undefined : { transform: cameraTransform(cameraFrame) }}
              >
                <Fan
                  chapter={isMobile && selected ? selected.scale : chapter}
                  focus={isMobile && selected ? selected : focus}
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
                    reading={
                      focus && !focus.structurallyEmpty
                        ? (splitOf(focus) ?? [focus.maturity]).join("|")
                        : ""
                    }
                  />
                )}
                {/* the phone's figure band has no room under the drawing; its detail sheet says it */}
                <IllustrativeDisclosure scores={!isMobile} />
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
                returnFocusTo={
                  lastFocused.current?.replace("cvt-m-", "cvt-co-") ?? `cvt-co-${selected.id}`
                }
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

/** The labelled DOI blank records a planned deposit without implying one exists. */
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

/** Provenance and site links share the footer's ruled title block. */
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
        <div className="cvt-tb-row">
          <dt>accessibility</dt>
          <dd>
            <a href={`${import.meta.env.BASE_URL}accessibility.html`}>Statement</a>
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
              ? "Tap a task in each scene to see what the research found."
              : "Then select any label on the fan to see what the research found."
          }
        />
        <a className="cvt-skip" href="#cvt-matrix">
          Explore the evidence map
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
              {scale === "Product" && (
                <Cite
                  citeKey="sterkensProductLabelIdentification2023"
                  label="Sterkens et al., 2023, Table 3"
                />
              )}
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

/** A rating's gloss cut to its first sentence, for the key beside the map. */
const shortGloss = (gloss: string) => {
  const first = /^[^.]*\./.exec(gloss)?.[0] ?? gloss;
  return first.charAt(0).toLowerCase() + first.slice(1);
};

export function MaturityKey() {
  return (
    <ul className="cvt-maturity-key" aria-label="Maturity letter key">
      {taxonomy.meta.maturityLevels
        .filter((level) => level.verdict !== "Strong")
        .map((level) => (
          <li key={level.verdict}>
            <b>{level.letter}</b> {level.verdict}:{" "}
            <span>{level.verdict === "Partial" ? level.gloss : shortGloss(level.gloss)}</span>
          </li>
        ))}
    </ul>
  );
}

/** The opening's copy. `hint` is the interaction sentence, which differs
 *  between the fan's chips and the phone's cell lists. */
function Hero({ hint }: { hint: string }) {
  return (
    <>
      <h1 className="cvt-title">
        What can a machine
        <br />
        actually see?
      </h1>
      <p className="cvt-hero-contract">
        Good results on carefully taken photos do not guarantee useful answers at a repair shop or
        recycling site.
      </p>
      <p className="cvt-sub">
        Before a used fan can be repaired or recycled, someone needs to identify it, check its parts
        and work out what it is made of. Can a photo help? We reviewed ten tasks for computer
        vision, software that reads images. Follow the fan as it comes apart to see what the
        research can support.
        {` ${hint}`}
      </p>
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
            <span className="cvt-sr">
              {cell.structurallyEmpty ? "Not applicable" : `Maturity: ${maturity}`}. Open details.
            </span>
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
      <h2>A useful tool must work on the photos people can actually take.</h2>
      <MaturityKey />
      {/* the caption and the table twin ride the narrative column beside the
          figure, and step aside for the detail the way act one's prose does */}
      <Explorable>
        <div className="cvt-foot">
          <p>
            Columns ask what something is, how much is there, how it is put together and what
            condition it is in; rows run from the whole product to its parts and materials. Ratings
            come from the paper&rsquo;s Table&nbsp;S2, a review of the literature as of{" "}
            {taxonomy.meta.scanDate}. Taller blocks mean stronger evidence.
          </p>
          <p>
            The dashed line marks Strong, the highest rating, and no task reaches it. Strong needs a
            method meant for many product types, evidence that it works on recycler-intake photos,
            and documented use for the task. A missing test leaves a requirement unmet; it does not
            show failure.
          </p>
          {/* the method and the gap analysis on demand: three chunks stay in view,
              so the map, not the caption, is what the eye lands on */}
          <details className="cvt-panel-more cvt-foot-more">
            <summary>How the ratings were reached</summary>
            <p>
              The review used targeted searches, with assessments recorded by one researcher. A
              missing method means the review did not find one.
            </p>
            <p>
              Finding parts and identifying how they attach are rated separately, so ten tasks give
              eleven assessments. The two hatched cells have no rating of their own: connections are
              assessed at the parts level.
            </p>
            <p>{FIELD_SPLIT}</p>
            <p>
              Some gaps need more than another test. Describing damage across product types, or how
              parts connect, needs agreed categories first. Measuring hidden material composition
              needs a method. The remaining gaps are about how existing methods perform on photos
              taken where used products are handled.
            </p>
            <p>
              For the reviewed tasks using ordinary field photos, only label reading has
              collection-site pilot evidence, from one research group. Reliable product data need
              tests of the whole workflow, from taking photos to checking what the software reads
              and what a person confirms.
            </p>
          </details>
          <details className="cvt-panel-more cvt-foot-more">
            <summary>Contribute product evidence</summary>
            <p>
              Help build that evidence:{" "}
              <a href="https://r9lab.io/">contribute a product record through R9lab</a>, a platform
              for documenting products as they are taken apart. Pair your own photographs with
              measurements and notes on how you checked each value. Follow its{" "}
              <a href="https://docs.r9lab.io/user-guides/data-collection/">collection guide</a> for
              what to photograph and record. These records can support research. Comparing methods
              on the same products still needs clean and field photographs of each item, paired with
              checked model numbers, material names or measurements.
            </p>
            <p>
              R9lab uploads are public. Keep people and personal details out of your photographs,
              and read its <a href="https://r9lab.io/terms/">contributor terms</a> and{" "}
              <a href="https://r9lab.io/privacy/">privacy policy</a> before uploading.
            </p>
          </details>
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
                      {cell.structurallyEmpty ? "See Component · Structure" : cell.task}
                      {sub.label && <span className="cvt-subtask"> · {sub.label}</span>}
                    </td>
                    <td>
                      {cell.structurallyEmpty ? (
                        "Not applicable"
                      ) : (
                        <>
                          <b>{VERDICT_LETTER[sub.maturity]}</b> {sub.maturity}
                        </>
                      )}
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
