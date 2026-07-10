// CI guard: the surface colour has one source (theme.ts). Fail if the generated
// CSS is stale, or if a literal that cannot read the token — the HTML
// theme-color metas, demo.css's over-scroll shim — has drifted from it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SURFACE } from "../src/theme.ts";
import { themeCss } from "./theme-css.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const errors: string[] = [];

if (read("../src/theme.generated.css") !== themeCss()) {
  errors.push("src/theme.generated.css is stale — run `pnpm gen:theme`");
}

const must = (file: string, needle: string) => {
  if (!read(file).includes(needle)) {
    errors.push(
      `${file} does not carry theme.ts SURFACE (\`${needle}\`) — sync it or re-run gen:theme`,
    );
  }
};
must("../index.html", `content="${SURFACE.light}"`);
must("../index.html", `content="${SURFACE.dark}"`);
must("../src/demo.css", `light-dark(${SURFACE.light}, ${SURFACE.dark})`);
must("../src/demo.css", `background-color: ${SURFACE.light}`);
must("../src/demo.css", `background-color: ${SURFACE.dark}`);

if (errors.length > 0) {
  console.error(`theme sync check failed:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log("theme sync OK");
