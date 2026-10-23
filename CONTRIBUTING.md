# Contributing

Thanks for taking a look. Small fixes and suggestions are welcome.

## Report a problem or suggest a change

Open an [issue](https://github.com/simonvanlierde/cv-ie-taxonomy/issues). Say
what you saw, what you expected, and the browser you used.

To report a security problem, do not open an issue. Follow
[SECURITY.md](.github/SECURITY.md).

## Send a pull request

1. Fork the repository and branch from `main`.
2. Install and run the site:

   ```sh
   pnpm install
   pnpm dev
   ```

3. Run the checks before you push:

   ```sh
   pnpm check       # Biome lint and format
   pnpm test:all    # unit and browser tests
   ```

4. Open the pull request against `main`. Keep it small and say what it changes.

The taxonomy in `src/data/taxonomy.json` mirrors the paper, and a test fails if
they drift. Open an issue first if you think a verdict or number is wrong.
