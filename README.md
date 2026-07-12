# What can a machine actually see? — CV × Industrial Ecology

[![CI & Deploy](https://github.com/simonvanlierde/cv-ie-taxonomy/actions/workflows/ci.yml/badge.svg)](https://github.com/simonvanlierde/cv-ie-taxonomy/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/live-demo-2b7a78?logo=githubpages&logoColor=white)](https://simonvanlierde.github.io/cv-ie-taxonomy/)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE)
[![License: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey)](LICENSE-CONTENT)

An interactive exploded-teardown map of the computer-vision-for-industrial-ecology
taxonomy from **Paper 2** (JIE Review): which vision task recovers which product
data, at which physical scale, and how far you can trust it. A self-contained
React + TypeScript island: runs standalone, drops into an Astro/Next portfolio,
and doubles as the interactive companion to the paper's Table S1.

![Exploded fan with interactive CV read-outs](public/screenshot.png)

**[▶ Open the live demo](https://simonvanlierde.github.io/cv-ie-taxonomy/)**

## What it does

An end-of-life **desk fan** comes apart patent-style as you scroll, through three
chapters: **Product → Component → Material**, one per physical scale of the
taxonomy. In each chapter, CV annotations paint onto the fan in the genre's own
vernacular: YOLO-style detection boxes with class tags ("blade ×3 · 0.91") for
Identity, per-instance segmentation masks for Structure, an OCR read-out on the
rating label, dimension call-outs for Quantity, anomaly tags for Condition, and
material tags over true-material tints at the Material scale.

Each annotation connects by leader line to a floating info chip carrying the
cell's maturity texture + letter. **Those chips are the controls.** Hovering
isolates a cell's annotations; clicking opens a panel with the task, verdict,
dominant failure mode, example, rubric marks, and sources. Filter chips narrow by
information type. On mobile the narrative pages instead of scrolling: the fan is a
full-screen backdrop that comes apart as you advance, each chapter's prose rides a
fold-away peek sheet over its lower third, and the annotations themselves are the
tap targets — each opens its cell's bottom-sheet panel.

At the end, the full 3 × 4 matrix appears as a **paper-figure-style recap**
(texture + letter, captioned, screenshot-ready), each cell still clickable, and
the paper's central finding: **no task-level cell reaches Strong under
end-of-life capture.**

All overlays are labelled *illustrative, not model output.*

## Data is the source of truth

[`src/data/taxonomy.json`](src/data/taxonomy.json) mirrors **Table S1** verbatim:
all twelve grid cells (ten populated + the two structurally-empty Structure
cells), the five-level maturity verdicts, rubric marks (i·ii·iii·*m*), failure
modes, examples, and citation keys. Nothing is invented.
[`src/data/taxonomy.test.ts`](src/data/taxonomy.test.ts) enforces the invariants
that would break if the JSON drifts from the paper.

## Accessibility

Maturity is encoded by **ink weight + letter, never colour**: a neutral ramp, monotone
in lightness and stepped against each theme's own surface (S darkest → U lightest, with
A the hollow no-data cell). Under `forced-colors` and print, where fills flatten, a
texture layer takes over — ordered by ink coverage, so the ranks survive (solid = S,
diagonal hatch = P, dots = E, ring = U, dashed hollow = A). Colour is reserved for
physical scale (colourblind-safe Okabe–Ito triad, selected per theme like the
segmentation hues: the light arms darken to the 3:1 mark floor), and carried by
swatches rather than
by coloured text, which would not clear 4.5:1 on either surface;
material tints are true material colours
(copper, steel, ABS, PCB). The instance-segmentation overlay hues — a deliberate quote of
COCO/YOLO output — are selected per theme rather than flipped: neon on the dark surface,
darkened to the same hues on the light one, where the neon reads at 1.2–2.2:1. Every mask
and box also carries a class label, so identity never rests on hue.
The SVG read-outs are keyboard-operable buttons with
full aria-labels, matrix cells and mobile rows are real buttons, the detail panel
is a dialog closed with `Esc`, and `prefers-reduced-motion` disables the idle spin
and scroll smoothing. Dark theme in dark mode, light in light. The host can force
either.

## Structure

```text
src/
  data/
    taxonomy.json       # source of truth: mirrors Table S1
    types.ts            # typed schema for the JSON
    taxonomy.ts         # typed loader + helpers
    taxonomy.test.ts    # data-layer invariants (vitest)
  CvTaxonomy.tsx        # orchestration: sticky stage, narrative rail, panel, shared pieces
  Fan.tsx               # the exploding fan + interactive CV read-outs (SVG)
  MobileStepper.tsx     # mobile act one: fan-first pages with a peek sheet
  Explorable.tsx        # act two: the matrix driving an inline detail
  MiniMatrix.tsx        # the selectable 3 × 4 grid itself
  chapters.ts           # narrative prose (figures test-locked to taxonomy.json)
  timeline.ts           # scroll pacing: presence windows, explode/drift beats
  frames.ts             # camera frames per cell (and the home view)
  useCamera.ts          # spring-animated viewBox camera
  useScrollProgress.ts  # spring-smoothed scroll scrub (Motion)
  theme.ts              # scale/seg/verdict hue tokens, per theme
  CvTaxonomy.css        # blueprint / teardown visual identity
  main.tsx              # standalone demo mount + dev deep links
```

Motion powers only the scroll scrub and the camera (both springs — the camera
zooms to the clicked cell on desktop and pages between step frames on mobile);
everything else is CSS — the OCR typing effect, the pseudo-3D tilt on the
exploding stack, and the panel's `@starting-style` transitions.
Type: **Overpass** for display, its **Overpass Mono** sibling for the machine
read-outs, **IBM Plex Sans** for body (all OFL, self-hosted woff2). Bundle:
~102 kB gzipped JS including React and Motion, +~108 kB fonts.

## Develop

```sh
pnpm install
pnpm dev         # http://localhost:5173
pnpm test        # data + interaction tests (vitest)
pnpm build       # typecheck + production build
```

Dev deep links (demo shell only): `?cell=component-structure` opens a panel,
`?theme=dark|light` forces a theme, `?p=0.56` pins scroll progress for screenshots.

## Embed as an island

```astro
---
import { CvTaxonomy } from "cv-ie-taxonomy-viz";
---
<CvTaxonomy client:visible />
```

Props (all optional): `theme: "light" | "dark"` forces a theme over the
media-query default; `initialCell: string` opens a cell's panel on load.

## Assumptions

- **Representative product = desk fan.** A real WEEE product with an iconic axial
  explode and a clean materials story (steel grille, ABS blades, copper windings,
  PCB base). The taxonomy itself is product-general; the paper's Table S2 walks a
  *laptop* through the same cells.
- Overlay numbers on the fan are **mock values** showing what each technique's
  output looks like. They claim nothing. Verdict letters on chips are the paper's.
- The fan drawing is schematic, not to scale.
- Verdicts are a **June 2026 snapshot** (as the paper states); the durable
  contribution is the taxonomy's structure, not any single verdict.

## License

Split so the software is freely reusable while the research stays citable:

- **Code**: [MIT](LICENSE).
- **Taxonomy data** (`src/data/taxonomy.json`, mirroring Table S1), **figures, and
  content**: [CC BY 4.0](LICENSE-CONTENT).
