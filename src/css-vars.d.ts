// React's CSSProperties has no index signature (@types/react removed it, and
// points at module augmentation as the fix), so a CSS custom property in an
// inline style otherwise needs a per-key `["--x" as string]` cast. Declaring it
// once here types every `style={{ "--hue": … }}` in the codebase.
import type {} from "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
