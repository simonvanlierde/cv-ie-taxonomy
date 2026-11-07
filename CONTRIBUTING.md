# Contributing

Small fixes and suggestions are welcome. Please follow the [code of conduct](CODE_OF_CONDUCT.md).

## Report a problem or suggest a change

Open an [issue](https://github.com/simonvanlierde/cv-ie-taxonomy/issues). Say
what you saw, what you expected, what happened, and the browser you used.

To report a security problem, do not open an issue. Follow
[SECURITY.md](.github/SECURITY.md).

## Send a pull request

1. Fork the repository and branch from `main`.
2. Use Node 26 or later and the pnpm version in `package.json`. Install and run the site:

   ```sh
   pnpm install
   pnpm exec playwright install chromium
   pnpm dev
   ```

3. Run the checks before you push:

   ```sh
   pnpm check       # Biome lint and format
   pnpm check:theme # theme colours
   pnpm test:all    # unit and browser tests
   pnpm build       # TypeScript and production build
   ```

4. Open the pull request against `main`. Say what it changes and which checks passed.
   Use a title such as `fix: correct the photo panel label` or `docs: explain a rating`.

The ratings in `src/data/taxonomy.json` mirror the paper. Tests check their scoring
rules, marks and citation keys against the stored deposit data. Open an issue first if you think
a rating or number is wrong. For page copy, explain each finding in words a reader
without computer-vision training can follow. Keep the evidence and its limits intact.

## Tests and code style

A pull request that adds major functionality must add automated tests for it.
Update tests when behaviour changes. A bug fix must include a regression test
that fails before the fix.

Use Vitest for logic and component tests. Use the Chromium test project when a
test needs real browser layout, focus or accessibility behaviour. The commands
above run both projects. TypeScript and React code must follow the rules in
[`biome.jsonc`](biome.jsonc); `pnpm format` applies the formatting rules.
`pnpm check` enforces lint and format in CI. `pnpm build` enforces the strict
TypeScript settings in [`tsconfig.json`](tsconfig.json).

Update the documentation when a change affects the instructions or behaviour it
describes. Keep any earned badges in the README linked to their evidence; add a
newly awarded badge within 48 hours of public recognition.

## Who maintains this

Simon van Lierde ([@simonvanlierde](https://github.com/simonvanlierde)) maintains the
site and reviews pull requests. [Governance](GOVERNANCE.md) defines his responsibilities,
how decisions are made and the limits of continuity with one maintainer.
