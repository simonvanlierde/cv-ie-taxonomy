# What can a machine actually see? · CV × industrial ecology

[![CI & Deploy](https://github.com/simonvanlierde/cv-ie-taxonomy/actions/workflows/ci.yml/badge.svg)](https://github.com/simonvanlierde/cv-ie-taxonomy/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/simonvanlierde/cv-ie-taxonomy/branch/main/graph/badge.svg)](https://codecov.io/gh/simonvanlierde/cv-ie-taxonomy)
[![Live demo](https://img.shields.io/badge/live-demo-2b7a78?logo=githubpages&logoColor=white)](https://simonvanlierde.github.io/cv-ie-taxonomy/)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE)
[![License: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey)](LICENSE-CONTENT)

An interactive map from the review article *Benchmarked, Rarely Field-Tested:
Computer Vision for End-of-Life Product Data in Industrial Ecology* (van Lierde
et al., [citation: forthcoming]). It shows what cameras and image software
(computer vision) can tell about a used product, and how far you can trust each
answer.

![A desk fan drawn as a cyanotype teardown, ringed by computer-vision read-outs](public/screenshot.png)

**[▶ Open the live demo](https://simonvanlierde.github.io/cv-ie-taxonomy/)**

## What it does

A worn-out **desk fan** comes apart as you scroll. It goes through three
physical scales: **Product → Component → Material**. Along the way, the fan
shows the kinds of output computer vision produces:

- boxes around detected parts, for Identity
- outlines of each part (segmentation masks), for Structure
- text read off the rating label (OCR)
- measurements, for Quantity
- flags on possible damage, for Condition
- material labels, at the Material scale

These read-outs are simulated: I didn't run a model on the drawing. Two scenes
also show a real finding from the paper, drawn as a measuring scale beside the
fan. Label reading falls from 95.7% on repair photos to 39.7% at the recycler.
Mapping how parts connect falls from ~82% to ~39% on new objects.

The page has five scenes: the opening, one per scale, and the map. The fan
moves with the scroll in plain CSS, using scroll-driven animations. A browser
without them, or a reader who asks for reduced motion, sees each scene's
finished state.

Each label on the fan opens one cell of the map. Hover over a label to pick out
its cell. Click it to see the task, the verdict, where it fails, an example, the
rubric marks and the sources. With a detail open, the arrow keys step to the
next cell: within the scale on the fan, or across the whole map at the end.

On a phone or tablet (a page under 1180px wide), the drawing stays at the top of
the screen while the text scrolls under it, and each scene lists its cells as
buttons.

The last screen shows all twelve cells as a 3 × 4 grid. Every cell can be
clicked, and a **Plain table** button shows the same data as a table. Hatching
marks the two structurally empty cells, which have no verdict. No task reaches
Strong on field photos. Under each block, the cell says what it is missing,
using the paper's three kinds of gap: no shared taxonomy yet, no method yet, or
too few field photos.

## Data is the source of truth

[`src/data/taxonomy.json`](src/data/taxonomy.json) mirrors **Table S2**: twelve
cells, five-level maturity verdicts, rubric marks, failure modes, examples, and
citation keys. Ten cells carry a task; the two structurally empty Structure cells
do not.

[`src/data/taxonomy.test.ts`](src/data/taxonomy.test.ts) checks the rules the
JSON has to follow, so a test fails if it drifts from the paper.

## Accessibility

Maturity shows as ink weight and letters, not colour: S is darkest, U is
lightest, and A is hollow for no data.

In `forced-colors` mode and in print, textures keep the ranks apart: solid = S,
diagonal hatch = P, dots = E, ring = U, and dashed hollow = A. In
`forced-colors` mode the drawing's lines also follow the system text colour.

Colour shows the physical scale. The three scale colours come from the
colourblind-safe Okabe–Ito palette, with material tints for copper, steel, ABS,
and PCB.

Segmentation masks and boxes carry class labels, so you can tell parts apart
without colour. Their hues follow COCO/YOLO conventions and adapt to the theme.

The labels on the fan, the matrix cells and the phone's cell lists are buttons
with accessible names. Their text, and all body text, is at least 13px. Only the
simulated read-outs on the drawing scale down with it. The detail view closes
with `Esc`.

`prefers-reduced-motion` stops the idle spin, and the fan then jumps between its
poses instead of moving with the scroll; only the read-outs fade. The page
follows the colour scheme: paper white in light mode, the blue cyanotype sheet
in dark mode. `?theme=dark|light` forces one.

## Develop

```sh
pnpm install
pnpm dev         # http://localhost:5173
pnpm test        # data + interaction tests, jsdom (vitest)
pnpm build       # typecheck + production build
```

The tests are split into two Vitest projects. `pnpm test` runs `unit` in
jsdom, which is fast enough to run on every change. `pnpm test:browser` runs
`browser` in real Chromium, for the few behaviours jsdom can't fake: a dialog
handing focus back when it closes, `inert`, the top layer, and real
`ResizeObserver` layout. `pnpm test:all` runs both, and so does CI.

The demo takes a few URL parameters. `?cell=component-structure` opens a
detail, `?theme=dark|light` forces a theme, and `?scene=2` pins a scene for
screenshots (0 is the opening, 4 the map). Cell ids are
`<scale>-<information type>` in lower case, for example `material-quantity`.
The page ignores values it doesn't know.

Requires Node 26 or later. `pnpm test:browser` needs Chromium once:
`pnpm exec playwright install chromium`. CI also runs `pnpm check` (Biome) and
`pnpm check:theme`, which fails if a surface colour in CSS or HTML differs from `src/theme.ts`.

## Assumptions

- The desk fan stands in for any WEEE product (waste electrical and electronic
  equipment). The taxonomy isn't tied to one product: its evidence comes from
  washing machines, laptops, smartphones, and vehicles.
- Overlay numbers are **mock values** that show what each technique outputs.
  The verdict letters come from the paper.
- The fan drawing is schematic, not to scale.
- Verdicts are a **June 2026 snapshot**. The taxonomy's structure is the part
  meant to last.

## License

The license is split so anyone can reuse the code, while the research stays
citable:

- **Code**: [MIT](LICENSE).
- **Taxonomy data** (`src/data/taxonomy.json`, mirroring Table S2), **figures, and
  content**: [CC BY 4.0](LICENSE-CONTENT).
