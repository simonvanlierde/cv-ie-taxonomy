# Security policy

## Report a vulnerability

Report it privately through GitHub:
[open a private advisory](https://github.com/simonvanlierde/cv-ie-taxonomy/security/advisories/new),
or by email to <code@duinlab.nl>.

Do not open a public issue or pull request for a vulnerability. A public report
lets anyone read it before there is a fix.

Please include:

- What the problem is and where it is (page, file, or dependency).
- Steps to reproduce it, or a proof of concept.
- The impact you expect, and the browser or version you saw it in.

I will acknowledge your report within 14 days. After that I will tell you
whether I can reproduce it and when I expect a fix.

## Fixes and disclosure

This site has no releases. A fix lands on `main` and the site redeploys from there.
Once it is live, I publish the GitHub security advisory, with a CVE where one applies,
and credit you unless you would rather not be named.

## Scope

This repository is a static website that supports a journal article. It has no
server, no accounts, and no stored user data.

In scope:

- The published site and its source code in this repository.
- The build and CI setup (`.github/workflows`, `vite.config.ts`).
- The dependencies in `package.json` and `pnpm-lock.yaml`, when the problem
  affects this site.

Out of scope:

- Problems in the taxonomy's content or in the paper itself. Open an issue for
  those.
- Problems in a dependency that do not affect this site. Report those upstream.
