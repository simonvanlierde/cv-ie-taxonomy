// The page surface lives in src/theme.ts (where the contrast tests read it).
// This renders it as the CSS custom property the stylesheet consumes, so the
// rendered surface and the tested value share one source. gen-theme-css.ts
// writes it; check-theme.ts proves the committed copy is current.
import { SURFACE } from "../src/theme.ts";

export const themeCss = () =>
  `/* Generated from src/theme.ts by scripts/gen-theme-css.ts. Do not edit — run \`pnpm gen:theme\`. */
.cvt {
  --cvt-bg: light-dark(${SURFACE.light}, ${SURFACE.dark});
}
`;
