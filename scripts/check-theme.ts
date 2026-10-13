// CI guard: the surface colour has one source (theme.ts). Fail if a literal
// that cannot read the token (the stylesheet, its <html> over-scroll rules,
// the HTML theme-color metas) has drifted from it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BREAKPOINT_PX, SURFACE } from "../src/theme.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const errors: string[] = [];

const must = (file: string, needle: string) => {
  if (!read(file).includes(needle)) {
    errors.push(`${file} does not carry the theme.ts value \`${needle}\` — sync it`);
  }
};
must("../src/CvTaxonomy.css", `--cvt-bg: light-dark(${SURFACE.light}, ${SURFACE.dark});`);
must("../index.html", `content="${SURFACE.light}"`);
must("../index.html", `content="${SURFACE.dark}"`);
must("../src/CvTaxonomy.css", `background-color: light-dark(${SURFACE.light}, ${SURFACE.dark});`);
must("../src/CvTaxonomy.css", `background-color: ${SURFACE.light};`);
must("../src/CvTaxonomy.css", `background-color: ${SURFACE.dark};`);

// the layout fork: container queries cannot read the TS constant, so the CSS
// hard-codes it — fail if either side of the layout seam drifts from theme.ts
must("../src/CvTaxonomy.css", `(width >= ${BREAKPOINT_PX}px)`);
must("../src/CvTaxonomy.css", `(width < ${BREAKPOINT_PX}px)`);

if (errors.length > 0) {
  console.error(`theme sync check failed:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log("theme sync OK");
