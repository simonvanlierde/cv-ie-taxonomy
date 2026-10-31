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

## Who maintains this

Simon van Lierde ([@simonvanlierde](https://github.com/simonvanlierde)) maintains the
site and reviews pull requests. Only he can merge to `main`. A new maintainer would
be named here first. If he stops maintaining it, the README says so and the repository
is archived. Anyone may fork it under its licences: MIT for code, CC BY 4.0 for content.
