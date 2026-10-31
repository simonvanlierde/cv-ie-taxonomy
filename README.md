# What can a machine actually see? · CV × industrial ecology

[![CI & Deploy](https://github.com/simonvanlierde/cv-ie-taxonomy/actions/workflows/ci.yml/badge.svg)](https://github.com/simonvanlierde/cv-ie-taxonomy/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/simonvanlierde/cv-ie-taxonomy/branch/main/graph/badge.svg)](https://codecov.io/gh/simonvanlierde/cv-ie-taxonomy)
[![Live demo](https://img.shields.io/badge/live-demo-2b7a78?logo=githubpages&logoColor=white)](https://simonvanlierde.com/cv-ie-taxonomy/)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE)
[![License: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey)](LICENSE-CONTENT)

A photo may help identify a used appliance, find a part or recognise a material.
Can we trust that information when deciding what to repair, reuse or recycle?
This page shows what the research has tested and what still needs checking on
photos taken in those settings.

![A drawing of a desk fan with labels showing what image software might identify](public/screenshot.png)

**[Open the interactive map](https://simonvanlierde.com/cv-ie-taxonomy/)**

Follow a desk fan from the whole product to its parts and materials. Select a
label or a cell to see the evidence for one task. No task earns the review's
highest rating, Strong. Label reading, for example, drops from 95.7% on repair
photos to 39.7% at recycler intake.

The page accompanies the review article *Benchmarked, Rarely Field-Tested:
Computer Vision for End-of-Life Product Data in Industrial Ecology* (van Lierde
et al., [citation: forthcoming]).

## What the page shows

- **The research:** ratings and evidence mirror the paper's Table S2 in
  [`src/data/taxonomy.json`](src/data/taxonomy.json). Tests check the scoring
  rules, ratings, marks and citation keys against the stored deposit data. The evidence covers the
  literature as of June 2026, including washing machines, laptops, phones and vehicles.
- **The illustration:** the fan and its read-outs show what the methods might
  output. No image analysis was run on the drawing. The fan is schematic and not to scale.
- **The sources:** select an author–year citation or a named model or dataset
  to open its full reference and DOI. **Plain table** shows the ratings as text.
- **Your own assessment:** **What if?** lets you change the evidence marks and
  see how the rating changes. A dashed outline keeps the paper's rating visible.
  **Export CSV** saves your changes in the deposit's `rubric-marks.csv` format.

## Try software on your own photo

Each scene has a panel for running a model, meaning image-analysis software,
in your browser. Tesseract 5 reads labels; OWL-ViT looks for parts and materials.
Both use the Apache-2.0 licence. A result on one photo illustrates what the
software does; it does not validate the review's ratings.

Nothing runs until you press **Analyse photo**, and your photo stays on your
device. The first run downloads about 7 MB for Tesseract, all from this site,
or about 165 MB for OWL-ViT. OWL-ViT's model files come from Hugging Face at a
fixed commit. **Remove OWL-ViT downloads** clears its stored model files.
[Privacy](https://simonvanlierde.com/cv-ie-taxonomy/privacy.html) explains those requests and browser storage.

## Accessibility

Ratings use letters and ink weight as well as colour. High-contrast mode and
print add textures. Each task is a named button, and `Esc` closes its details.
The page respects reduced-motion settings. Chromium tests run axe WCAG 2.2 AA
checks, including the assessment editor and model panels. Automated checks do
not cover every accessibility need; axe cannot judge text contrast over the grid.

## Develop

Requires Node 26 or later and the pnpm version in `package.json`.

```sh
pnpm install
pnpm exec playwright install chromium
pnpm dev         # http://localhost:5173
pnpm test:all    # unit and Chromium tests
pnpm check       # lint and format
pnpm check:theme # colours match src/theme.ts
pnpm build       # typecheck and production build
```

Use `pnpm test` for unit tests or `pnpm test:browser` for Chromium tests.
[Contributing](CONTRIBUTING.md) covers issues and pull requests.
[The changelog](CHANGELOG.md) records changes.

URL parameters: `?cell=component-structure` opens a task's details. Cell IDs use
`<scale>-<information type>` in lower case. `?theme=dark|light` sets the theme;
`?scene=2` pins a scene for screenshots (0 is the opening, 4 the map).

## Writing the page copy

Start with the decision a reader faces: what can be repaired, reused or recycled?
Explain what a photo could tell us, then what the evidence supports. Write for
industrial ecologists and readers arriving without a computer-vision background.
Define a necessary technical term when it first appears. Keep the paper's ratings,
numbers and qualifications intact. Distinguish a failed test, indirect evidence
and a test that has not been done.

## License

[MIT](LICENSE) covers the code. [CC BY 4.0](LICENSE-CONTENT) covers the taxonomy
data, figures and page content. The code of conduct has its own attribution and
licence in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
