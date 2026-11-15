# Deploy to Cloudflare Workers

GitHub Actions deploys the live site from `main`. It creates a named Cloudflare
Preview for each trusted, open, non-draft pull request. Fork pull requests run all
checks without deployment credentials.

## Account setup

1. Create a Worker named `cv-ie-taxonomy` in the Cloudflare account that owns the
   `simonvanlierde.com` zone. Enable its public `workers.dev` URL for pull request
   Previews.
2. Create an API token with Account Workers Scripts: Edit and Zone Workers Routes:
   Edit for `simonvanlierde.com`. Do not grant access to other zones.
3. Create the `cloudflare-preview` and `cloudflare-production` environments in the
   GitHub repository. Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as
   environment secrets in both. Missing values produce a visible skip notice.
4. Protect both environments so only trusted branches can use them. Require a
   reviewer for `cloudflare-production` during the cutover.

The workflows pin `cloudflare/wrangler-action` 4.1.3 and Wrangler 4.136.3. The
Worker routes only `simonvanlierde.com/cv-ie-taxonomy` and its descendants. Other
paths on the domain continue to use their existing origin.

## Cut over production

1. Open a pull request from a branch in this repository. Confirm that its GitHub
   deployment link opens the site and updates after another commit.
2. Run the Preview smoke check. It verifies the page, a `?cell=` deep link, the
   privacy page, images, fonts, model runtime files and OCR language data. It also
   requires `X-Robots-Tag: noindex`.
3. Convert the pull request to draft and confirm that `Retire Preview` removes its
   URL. Mark it ready again, confirm that the Preview returns, then close or merge
   it and confirm that the URL is removed again.
4. Merge to `main` and approve `cloudflare-production`. Its smoke check must pass
   at <https://simonvanlierde.com/cv-ie-taxonomy/> before GitHub Pages is disabled.
5. Disable the repository's GitHub Pages deployment only after the live URL and
   its assets pass. Keep the old Pages content until this point; it is the rollback
   origin when the Worker routes are removed.

Record the workflow run links with the cutover. The live checks cannot run until
the account, token, environments and Worker exist.

## Roll back

For a bad application build, revert the commit on `main`; the production workflow
deploys the previous files. For a Worker or routing outage, remove only these two
routes from the `cv-ie-taxonomy` Worker in the Cloudflare dashboard:

- `simonvanlierde.com/cv-ie-taxonomy`
- `simonvanlierde.com/cv-ie-taxonomy/*`

Requests then return to the existing origin. Re-enable GitHub Pages first if it
was disabled after the cutover. Do not delete or change any other route on the
domain.
