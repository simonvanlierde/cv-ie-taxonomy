# What can a machine actually see? · CV × Industrial Ecology

[![CI & Deploy](https://github.com/simonvanlierde/cv-ie-taxonomy/actions/workflows/ci.yml/badge.svg)](https://github.com/simonvanlierde/cv-ie-taxonomy/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/live-demo-2b7a78?logo=githubpages&logoColor=white)](https://simonvanlierde.github.io/cv-ie-taxonomy/)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE)
[![License: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey)](LICENSE-CONTENT)

An interactive exploded-teardown map of the taxonomy in **Paper 2** (JIE Review).
It asks which vision task recovers which product data, at which physical scale,
and how far you can trust the answer.

It is one self-contained React + TypeScript island. It runs standalone, drops
into an Astro or Next portfolio, and doubles as the interactive companion to the
paper's Table S2.

![Exploded fan with interactive CV read-outs](public/screenshot.png)

**[▶ Open the live demo](https://simonvanlierde.github.io/cv-ie-taxonomy/)**

## What it does

An end-of-life **desk fan** comes apart patent-style as you scroll, through three
chapters: **Product → Component → Material**, one per physical scale of the
taxonomy. In each of them, CV annotations paint onto the fan in the genre's own
vernacular:

- YOLO-style detection boxes with class tags ("blade ×3 · 0.91") for Identity
- per-instance segmentation masks for Structure
- an OCR read-out on the rating label
- dimension call-outs for Quantity
- anomaly tags for Condition
- material tags over true-material tints at the Material scale

Each annotation connects by leader line to a floating info chip carrying the
cell's maturity texture and letter. **Those chips are the controls.** Hover to
isolate a cell's annotations. Click to open a panel with the task, verdict,
dominant failure mode, example, rubric marks, and sources. Filter chips narrow
the view by information type.

On mobile the narrative pages instead of scrolling. The fan is a full-screen
backdrop that comes apart as you advance, and each chapter's prose rides a
fold-away peek sheet over its lower third. There the annotations themselves are
the tap targets: each one opens its cell's bottom-sheet panel.

At the end, the full 3 × 4 matrix appears as a **paper-figure-style recap**:
texture and letter, captioned, screenshot-ready, every cell still clickable. It
carries the paper's central finding: **no task-level cell reaches Strong under
end-of-life capture.**

All overlays are labelled *illustrative, not model output.*

## Data is the source of truth

[`src/data/taxonomy.json`](src/data/taxonomy.json) mirrors **Table S2** verbatim:
all twelve grid cells, the five-level maturity verdicts, rubric marks
(i·ii·iii·*m*), failure modes, examples, and citation keys. Ten of those cells
carry a task; the two structurally empty Structure cells do not. Nothing here is
invented.

[`src/data/taxonomy.test.ts`](src/data/taxonomy.test.ts) enforces the invariants
that would break if the JSON drifted from the paper.

## Accessibility

**Maturity is ink weight and letter, never colour.** The ramp is one hue, monotone in
lightness and stepped against each theme's own surface: S darkest, U lightest. A is
the hollow no-data cell.

**Texture takes over where fills flatten.** Under `forced-colors` and in print, a
texture layer carries the ranks, ordered by ink coverage. Solid = S, diagonal hatch = P,
dots = E, ring = U, dashed hollow = A.

**Colour means physical scale.** The triad is colourblind-safe (Okabe–Ito), selected per
theme like the segmentation hues, and its light arms darken to the 3:1 mark floor.
Swatches carry it rather than coloured text, which would not clear 4.5:1 on either
surface. Material tints are the exception: those are true material colours (copper,
steel, ABS, PCB).

**The segmentation hues are a deliberate quote of COCO/YOLO output.** They are selected
per theme rather than flipped: neon on the dark surface, the same hues darkened on the
light one, where the neon itself would read at 1.2–2.2:1. Every mask and box also
carries a class label, so identity never rests on hue.

**Everything interactive is a real control.** The SVG read-outs are keyboard-operable
buttons with full aria-labels. Matrix cells and mobile rows are buttons too, and the
detail panel is a dialog that closes with `Esc`.

**Motion and theme follow the reader.** `prefers-reduced-motion` disables the idle spin
and the scroll smoothing. The island is dark in dark mode and light in light, and the
host can force either.

## Structure

```text
src/
  data/
    taxonomy.json       # source of truth: mirrors Table S2
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

Motion powers only the scroll scrub and the camera, both springs. The camera zooms
to the clicked cell on desktop, and pages between step frames on mobile. Everything
else is CSS: the OCR typing effect, the pseudo-3D tilt on the exploding stack, and
the panel's `@starting-style` transitions.

Type is **Overpass** for display, its **Overpass Mono** sibling for the machine
read-outs, and **IBM Plex Sans** for body text. All three are OFL, self-hosted as
woff2. The bundle is ~102 kB of gzipped JS including React and Motion, plus ~108 kB
of fonts.

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
  PCB base). It is the paper's own worked example: Table S3 and Figure S1 walk this
  same fan through three disassembly stages. The taxonomy itself is product-general,
  since its axes are physical scale and information type, and the evidence behind the
  verdicts spans washing machines, laptops, smartphones and vehicles.
- Overlay numbers on the fan are **mock values** showing what each technique's
  output looks like. They claim nothing. Verdict letters on chips are the paper's.
- The fan drawing is schematic, not to scale.
- Verdicts are a **June 2026 snapshot** (as the paper states); the durable
  contribution is the taxonomy's structure, not any single verdict.

## License

Split so the software is freely reusable while the research stays citable:

- **Code**: [MIT](LICENSE).
- **Taxonomy data** (`src/data/taxonomy.json`, mirroring Table S2), **figures, and
  content**: [CC BY 4.0](LICENSE-CONTENT).
