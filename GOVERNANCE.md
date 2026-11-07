# Governance

Simon van Lierde ([@simonvanlierde](https://github.com/simonvanlierde)) maintains
this site and makes the final decisions about changes. Propose changes through
[issues and pull requests](CONTRIBUTING.md).

## Roles and decisions

| Role        | Responsibilities                                                                                                   | Held by          |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Maintainer  | Triage issues and private security reports; review and merge changes; publish the site; manage repository settings | Simon van Lierde |
| Contributor | Report problems and propose changes through issues and pull requests                                               | Anyone           |

Discuss substantial changes in an issue before implementation. The maintainer
decides whether they fit the [roadmap](docs/roadmap.md). Changes to the paper's
ratings or numbers need evidence and a corresponding correction to the research
record; the website does not revise them independently.

## Access and continuity

Only the maintainer can merge to `main`. GitHub Actions publishes the site from
`main` using GitHub Pages permissions; it does not require a deployment password
in this repository. See the [deployment workflow](.github/workflows/ci.yml).

Bus factor: **1**. There is no documented replacement maintainer or transfer of
repository and domain access. The project cannot currently promise that another
person could triage reports, merge changes and publish within one week if the
maintainer became unavailable.

A new maintainer must be named here and receive the required access before taking
over. If the project is discontinued, the maintainer marks the README and archives
the repository. If the maintainer is unreachable, that action cannot be promised.
Anyone may fork the project under its [code](LICENSE) and [content](LICENSE-CONTENT)
licences; a fork does not transfer control of the current site or domain.
