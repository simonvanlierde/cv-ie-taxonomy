# Security assurance case

This document states the site's security expectations, the controls that support
them and their limits. [The security policy](../.github/SECURITY.md) covers private
reports, responses and disclosure. This is an argument from the listed evidence,
not an independent security audit.

## Architecture and security requirements

The site is a static React application built with Vite and TypeScript. GitHub
Actions builds and tests it before publishing `dist` to GitHub Pages. There is no
application server, account system or photo-upload endpoint.

[`CvTaxonomy.tsx`](../src/CvTaxonomy.tsx) presents the review's
[`taxonomy.json`](../src/data/taxonomy.json).
[`rubricMarks.ts`](../src/rubricMarks.ts) applies the verdict rules;
[`sandbox.ts`](../src/sandbox.ts) computes temporary assessment changes and CSV
exports. Those changes do not rewrite the stored research data.
[`RealPhoto.tsx`](../src/RealPhoto.tsx) accepts a local image and runs models through
[`realModels.ts`](../src/realModels.ts). OCR workers and runtime files come from
the site. OWL-ViT weights come from a fixed Hugging Face revision.

Readers can expect their selected photos to stay in their browser in the current
implementation. Models run only after the reader presses **Analyse photo**.
Readers cannot expect model results to validate the paper or establish that an
item is safe to repair or recycle. Model downloads disclose network information
to their host and can occupy browser storage; the
[privacy notice](../public/privacy.html) explains this.

## Threat model and trust boundaries

Assets include visitors' photos, the integrity of the published research data,
and the build and deployment process. Threats include hostile pull requests,
compromised dependencies or model files, malicious links and malformed images.

| Boundary                    | What crosses                            | Control and evidence                                                                                                                                     |
| --------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fork to CI                  | Contributor code                        | Pull requests run without deployment access; deployment requires `main` in [CI](../.github/workflows/ci.yml)                                             |
| Registry to build           | Packages and action code                | [Lockfile](../pnpm-lock.yaml), action commit pins, and [Renovate updates](../renovate.json5)                                                             |
| Model host to browser       | Model data                              | Fixed revision in [realModels.ts](../src/realModels.ts); connection allowlist in [Vite's content security policy](../vite.config.ts)                     |
| Local file to browser model | A visitor's photo                       | Local object URL and browser decoding in [RealPhoto.tsx](../src/RealPhoto.tsx); no upload request in the model path                                      |
| URL to page state           | Scene, theme and cell parameters        | Scene allowlist in [params.ts](../src/params.ts), theme allowlist in [main.tsx](../src/main.tsx), cell lookup in [CvTaxonomy.tsx](../src/CvTaxonomy.tsx) |
| Build to public site        | Executable scripts and research content | Build and test jobs precede the deploy job in [CI](../.github/workflows/ci.yml)                                                                          |

## Secure design and common weaknesses

| Principle or weakness     | Argument and evidence                                                                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Least privilege           | [CI](../.github/workflows/ci.yml) defaults to read-only contents access. Only the deployment job has Pages write access. Checkout does not persist credentials.                                                                                                            |
| Fail-safe defaults        | [Model code](../src/realModels.ts) loads on demand. [Photo controls](../src/RealPhoto.tsx) require an explicit run; stale results are discarded after a photo changes.                                                                                                     |
| Small attack surface      | Static hosting has no application authentication, database or upload API; see the [entry point](../src/main.tsx) and [build configuration](../vite.config.ts).                                                                                                             |
| Script injection          | React renders model text as text in [RealPhoto.tsx](../src/RealPhoto.tsx). The production [content security policy](../vite.config.ts) limits scripts, workers and connections. It permits inline styles and WebAssembly compilation required by the interface and models. |
| Supply-chain substitution | Packages use a [lockfile](../pnpm-lock.yaml), actions use commit pins in [CI](../.github/workflows/ci.yml), and model downloads use a fixed revision in [realModels.ts](../src/realModels.ts). Pins do not establish that upstream code or weights are safe.               |
| Common coding mistakes    | [Biome](../biome.jsonc) enables security rules. [TypeScript](../tsconfig.json) enables strict checking and checked indexing. [CI](../.github/workflows/ci.yml) runs lint, tests and the production build.                                                                  |
| Resource cleanup          | [realModels.ts](../src/realModels.ts) terminates OCR workers even on failure. [RealPhoto.tsx](../src/RealPhoto.tsx) revokes replaced photo URLs and reports model errors.                                                                                                  |

## Residual risks and unverified claims

- A compromised maintainer account or upstream package can affect the published
  site. This single-maintainer project has no independent approval requirement.
  [Governance](../GOVERNANCE.md) records the continuity limit.
- The file picker's `accept="image/*"` is a browser hint, not a validation boundary.
  There is no explicit file-size or decoded-pixel limit. Large or malformed images
  may exhaust resources or reach defects in the browser or model runtime.
- Third-party WebAssembly and model parsers remain part of the attack surface.
  The tests do not establish their memory safety or resistance to hostile images.
- HTTPS relies on the browser and hosting providers. This application implements
  no cryptography and stores no account passwords or private keys.
- No independent security review, complete input-validation audit, reproducible
  build proof or release-signature verification is established by this document.
