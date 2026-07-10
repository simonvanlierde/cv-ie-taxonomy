// Codegen: write src/theme.generated.css from theme.ts. Run `pnpm gen:theme`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { themeCss } from "./theme-css.ts";

const target = fileURLToPath(new URL("../src/theme.generated.css", import.meta.url));
writeFileSync(target, themeCss());
console.log("gen:theme → src/theme.generated.css");
