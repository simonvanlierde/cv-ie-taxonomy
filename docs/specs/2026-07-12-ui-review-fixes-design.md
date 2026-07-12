# UI review fixes: explorable legibility, light-theme contrast, fan-first mobile, copy pass

Design agreed 2026-07-12, following a full UI review (desktop + mobile, both themes) and
owner decisions. Builds on `fd8546a`, which already closed the view-transition morph
pairing, the stepper/outro dedup, and the layout-seam plumbing.

Owner decisions:

- Desktop detail stays a side drawer (context-preserving), upgraded — no centered modal.
- Info-type filters: dropped on mobile, kept on desktop.
- Mobile layout: fan-first with a peek sheet (maps-app pattern).
- Copy voice: plain-English explainer for a curious JIE reader; locked figures verbatim.

## PR-1 — explorable legibility + contrast

1. **Matrix selected state.** `.cvt-mx-cell[aria-pressed="true"]` gets a visible style
   (ink border + raised card bg). Today the attribute exists but nothing styles it.
2. **Inline detail header.** The Explorable's detail column names its cell: scale-swatch
   eyebrow ("Component · Structure") + task heading, same pattern as the drawer head.
3. **Prompt above matrix.** Empty state renders the "Select any cell…" hint above the
   matrix; the detail column only exists once a cell is selected. No layout shift: the
   matrix track is `max-content`-sized either way, and the fixed-height detail column
   keeps the scroll-timeline container stable.
4. **Filters off mobile.** `InfoFilter` leaves the stepper (state, chips, its test, and
   the then-dead chip-row CSS); the shared component remains for the desktop HUD.
5. **Per-theme scale hues.** `SCALE_HUE` becomes `Record<Theme, Record<Scale, string>>`
   like `SEG_HUE`: dark keeps the Okabe–Ito originals; light darkens Component green and
   Material pink to ≥3:1 against both light surfaces (Product blue already passes at
   4.16:1). Consumers move to `var(--cvt-sc-*)` via `THEME_VARS` / a `SCALE_VAR` map.
6. **Status/warn tokens.** New `--cvt-ok` replaces the hardcoded `#2ea043`
   (2.91:1 on the light panel); light arms of `--cvt-ok` and `--cvt-warn` darken to
   ≥4.5:1 on the panel surface. A theme test holds every mark to 3:1 and every text
   token to 4.5:1, in the spirit of `verdictRamp.test.ts`.
7. **Split verdicts in lists.** `splitOf` moves from MiniMatrix to `data/taxonomy.ts`;
   `CellList` rows render compound cells as "P / E" with the diagonal swatch instead of
   flattening to the primary maturity.
8. **Mobile matrix fits.** Under the narrow container query the matrix drops
   `.cvt-mx-name`, tightens padding/gap and loses its 660px min-width, so all four
   information-type columns fit a 390px viewport.
9. **Deep links land right.** With `?cell=`, desktop scrolls to the cell's chapter
   plateau on load (`plateauCentre` moves from MobileStepper to `timeline.ts`), so the
   camera frame matches the fan's explode state and the chip is operable on close.
10. **Drawer upgrade.** Width `min(520px, 94vw)`; task title up a step with the verdict
    block directly under it. Backdrop stays near-transparent (the zoom is the context).

## PR-2 — fan-first mobile + copy deck (stacked on PR-1)

1. **Fan-first stepper.** The fan becomes a full-viewport backdrop; the top bar (caveat +
   theme toggle) floats over it; arrow nav stays fixed at the bottom. Prose + cell list
   live in a peek sheet (~40dvh, rounded top, grabber bar) with internal scroll — a
   fixed-peek sheet, not drag-snap; visually identical at rest, upgrade path open.
   The matrix step has no fan and stays a normal scrolling page.
2. **Per-step camera frames.** The compact fan accepts a `viewBox`; MobileStepper drives
   it with `useCamera` over per-step compact frames (assembled steps zoom tight,
   exploded steps pull back). Overlay tags become legible as a side effect.
3. **Copy deck.** Plain-English rewrite of the hero sub, three chapter bodies, outro
   thesis, inline prompt, table-view button and the structurally-empty string, per the
   approved deck (recorded in the PR description). Locked figures (95.7%, 39.7%, ~82%,
   ~39%) stay verbatim; `chapters.test.ts` continues to enforce them. Panel field labels
   keep the paper's rubric vocabulary. Titles stay.

## Constraints

- `src/data/taxonomy.json` untouched; no verdict, gloss or citation changes.
- Reduced motion: the sheet and camera cut instantly; no new persistent animation.
- No new dependencies.
