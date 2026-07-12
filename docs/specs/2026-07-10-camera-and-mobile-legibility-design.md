# Two-act hybrid — engagement & mobile legibility

2026-07-11 · status: **locked** for planning · untracked by request (reference, not committed)

> **Redesign update (2026-07-12), as built.** Two deviations from the plan below, made
> after seeing it live:
> - **Act two dropped its linked fan.** The explorable is now the matrix grid + the inline
>   `DetailBody` only (side by side on desktop, stacked on mobile). The static diagram fan
>   and its cell→part highlight were removed as too much on screen (and the Fan `diagram`
>   mode + `parts.ts` were deleted as dead code).
> - **Mobile act one is a paged stepper, not a repaired scroll.** `MobileStepper` pages
>   five steps (intro → Product → Component → Material → full matrix) with Back/Next arrows
>   and position dots, so the fan and prose never crowd one screen. Each scale step shows
>   the compact fan at that chapter's explode + the scale's tappable cell rows; the matrix
>   step is the explorable. Desktop keeps the scroll teardown unchanged.
> - **PR 4 (coverage HUD + gap lens) was not built** — the HUD was the plan's own flagged
>   cut candidate once act two delivered the overview, and the direction turned to the
>   mobile redesign instead.

## Problem

- **Desktop.** Clicking a read-out chip opens the panel but the fan does not react, and
  the panel covers the fan — verdict text and its evidence are never on screen together.
- **Mobile (≤ ~700 px).** The sticky stage draws the whole fan at ~180 px wide, so CV
  annotations are illegible; filter chips wrap and collide with the fan; the stage eats
  ~40 % of the viewport; the recap matrix scrolls sideways.
- **Thesis is told, not discovered.** "No cell reaches Strong" is a sentence at the end,
  not something the reader uncovers by interacting.

## Architecture: two acts, hybrid by surface

Both surfaces run **act one (scroll teardown) → act two (interactive explorable)**. Act
two is one shared component and replaces today's flat recap. Act one diverges by surface:

| | Act one | Act two |
|---|---|---|
| **Desktop** | Scroll teardown + camera zoom + coverage HUD | Interactive matrix explorable |
| **Mobile** | Scroll teardown, legibility-repaired (no camera) | Interactive matrix explorable |

The camera and HUD are the desktop signature; the explorable is the shared payoff and
the anchor of the mobile experience. Colour stays reserved for physical scale; every new
state reads through ink weight, opacity, marker, and letter, so forced-colors and print
survive untouched. `src/data/taxonomy.json` is not touched — everything here is
presentation.

## Act two — interactive matrix explorable (shared)

The end of the page stops being a flat table and becomes a driveable instrument.
Shneiderman's mantra: overview first, details on demand.

- The 3×4 grid is shown in full — the thesis (a board with no Strong cell) is legible at
  a glance.
- The exploded fan sits beside it as a **static** patent-style diagram (fully apart, not
  animated). Selecting a cell highlights the matching part on the fan and fills an inline
  detail region; clicking a part selects its cell. The link runs both ways.
- Selection is click / tap / arrow-key. No modal here, no camera — linked-view highlight.
- On mobile the two columns stack: grid, then detail card, then the diagram.
- Reuses `taxonomy.json`, the verdict encoding, `VerdictSwatch`, the panel content, and
  the fan SVG. The grid is a `MiniMatrix` component (also reused by the desktop HUD).

## Act one — desktop (camera + HUD)

### Camera primitive
A `useCamera` hook owns the Fan SVG `viewBox` as animated state, springing between target
frames with `motion` (already a dependency); `prefers-reduced-motion` → instant cut.
Frames are data: each callout-table row in `Fan.tsx` gains a `frame {x,y,w,h}` in viewBox
coords; chapters get default frames the same way.

### Click = zoom + panel together
Clicking a read-out chip springs the camera to that cell's frame **and** opens the panel
over the right prose rail (not the fan). Panel stays a modal `<dialog>` — existing Esc /
focus-return contract and tests hold; backdrop near-transparent so the zoomed fan stays
visible; body scroll locks. Close/Esc springs back to the chapter frame. Hover keeps
isolate; no hover zoom.

### Coverage HUD
A compact `MiniMatrix` persists during the scroll: current cell highlighted, each cell
filling in with its verdict as its annotation scrolls past — the matrix assembles as you
read, then the act-two explorable is the payoff. Cells are buttons (click = zoom + panel).
Labelled "taxonomy coverage" for AT. *Most cuttable item in the plan* — if act two already
delivers the overview, the HUD is a nicety; keep it if the desktop scroll feels
directionless without it.

## Act one — mobile (legibility repair only)

No camera. Just make the existing teardown legible as a lead-in to act two:
- filter chips collapse to one horizontally scrollable row that never overlaps the fan;
- sticky stage height → ~30 % vh;
- container queries + scroll polish (below).

## Gap lens

One toggle re-weights the board by trust: cells that clear the bar quiet down, cells that
fall short are spotlighted — across the explorable grid, the fan, and (desktop) the HUD.
Because no task-level cell reaches Strong, the board lights up: the finding becomes
something the reader *discovers by pressing a button*. Implementation: a boolean toggling
a marker/opacity class by verdict, reusing the verdict already bound to each cell. Copy
says what happens, not a mood word. Works by ink/opacity/marker, so it survives
forced-colors and print.

## Smaller, folded in

- **Panel / detail progressive disclosure.** Lead with verdict + dominant failure mode;
  method family, adjacent example, hardware, rubric marks, recommended handling expand on
  demand (native `<details>`). Decided during build: the citations foot (source-status
  pill + `@citekey` chips + copy-link) stays always-visible — it is already compact and
  sits with the panel's action controls, so collapsing it would fragment the foot.
- **First-run chip affordance.** One subtle pulse teaching that chips are controls,
  dismissed on first interaction and under reduced motion.

## Platform enhancements (progressive, no new deps)

- `@starting-style` + `::backdrop` transitions for the desktop panel; off under reduced motion.
- View-transition morph: clicked chip's verdict swatch → panel's verdict header via a
  shared `view-transition-name`; no-API browsers get current behaviour.
- Container queries: breakpoints move to `@container` on the component root, so the Astro
  embed adapts to its slot; standalone demo behaves identically.
- `overscroll-behavior: contain` on mobile; `scroll-snap-type: y proximity` so chapters
  settle on their pinned prose.
- Per-cell share: expose the existing `?cell=…` link via copy / `navigator.share`.

Rejected as decoration: CSS scroll-driven animations (scrub already drives SVG via React
state), popover-API hover previews (redundant with hover-isolate), WebGPU/3D, parallax,
cursor effects.

## Guardrails

- Reduced motion: instant cuts for every camera move, fill, morph, pulse.
- Forced-colors / print: geometry and ink/marker only — untouched.
- Keyboard: chips, HUD cells, explorable cells, and the lens toggle are buttons; keyboard
  activation does the same thing; focus return on close unchanged.
- README: correct the stale "no animation library" line (scrub uses `motion`).

## Testing

- Unit: every populated cell resolves an in-bounds frame; chapter frames exist; the
  gap-lens predicate flags the right verdict set; `MiniMatrix` renders all 12 cells;
  explorable selection maps cell ↔ fan part both ways.
- Interaction (jsdom, extending `CvTaxonomy.test.tsx`): chip click sets camera target +
  opens panel; HUD/explorable cell click selects + shows detail; close returns camera to
  chapter frame; gap-lens toggle flips cell state; reduced-motion path sets state without
  animation.
- Existing suites pass unchanged, especially the dialog contract tests.

## Delivery — independent PRs, stop after any

1. **Desktop act one.** `useCamera`, frames, click-zoom, panel reposition + progressive
   disclosure, dialog transitions, view-transition morph, per-cell share, first-run
   affordance, README fix.
2. **Mobile act-one repair.** Single scrollable chip row, stage height, container queries,
   scroll polish.
3. **Act two — interactive explorable (both surfaces).** Shared `MiniMatrix` + linked
   static fan + inline detail, replacing the flat recap. Mobile's payload lands here.
4. **Instruments.** Coverage HUD on desktop (reusing `MiniMatrix`) + gap lens across
   explorable, fan, and HUD.

Each PR is independently valuable and shippable. PR 4 reuses `MiniMatrix` from PR 3; the
HUD half of PR 4 is the one piece to drop if scope needs trimming.
