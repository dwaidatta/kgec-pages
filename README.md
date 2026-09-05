# KGEC Pages

A static, browser-only toolkit for KGEC students to generate print-ready assignment front pages and manage their submissions. Everything runs client-side — there is no backend or account system; all data (students, layouts, subjects) is stored locally in the browser via `localStorage`.

This is a student-made project and is **not** an official college resource.

## Features

| Page | Path | Description |
| --- | --- | --- |
| Home | `index.html` | Landing page with links to every tool. |
| Generate Front Page | `front-page-generator/` | Design a front-page layout, link it to saved student details, preview it live, and export polished PDFs for one or many students at once. |
| Settings | `settings/` | Manage saved students, saved/default layouts, and the subjects list — import/export students as JSON, refresh the default layout and subjects from the server, and clear locally stored data. |
| Readymade Pages | `readymade/` | Browse and download pre-made front page templates without building one from scratch. *(Coming soon.)* |
| MultiMerge | `multimerge/` | Merge multiple generated pages into a single combined document. *(Coming soon.)* |
| Topsheet | `topsheet/` | Generate mark-tabulation top sheets for internal examinations, for teachers. *(Coming soon.)* |
| Contributors | `contributors/` | Lists everyone who has contributed code, pulled live from the GitHub API. |

## Project layout

```text
index.html, index.js          Landing page
front-page-generator/         Layout editor + PDF export
settings/                     Local data management (students, layouts, subjects)
readymade/                    Readymade templates (placeholder)
multimerge/                   PDF merging tool (placeholder)
topsheet/                     Mark-tabulation top sheets for teachers (placeholder)
contributors/                 GitHub contributors list, fetched live from the GitHub API
lib/                          Shared browser modules (storage, users, subjects, layouts, PDF export, navbar, UI helpers)
data/                         Static JSON data (subjects list, default layout, saved layouts, emblem/logo assets)
assets/                       Shared stylesheet and generated version metadata
tests/                        Node test-runner unit tests for the modules in lib/
.github/workflows/            CI (tests on every push/PR) and the manual GitHub Pages release workflow
```

## Usage

Open `index.html` in a browser (or serve the repo root with any static file server) and use the cards on the home page to navigate between tools. No build step or installation is required to use the site.

## Development

The `lib/` modules are plain ES modules with no build step, so you can edit and refresh the browser directly.

Run the unit test suite (Node's built-in test runner, no dependencies to install):

```bash
npm test
```

CI runs this same test suite, plus a JSON validation check, on every push and pull request targeting `main` (see [.github/workflows/ci.yml](.github/workflows/ci.yml)). Deploys to GitHub Pages are triggered manually and also run the full test suite before releasing (see [.github/workflows/pages-build.yml](.github/workflows/pages-build.yml)).

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing changes.

## License

See [LICENSE](LICENSE). All rights reserved — copying, redistribution, or reuse of this project or its code is not permitted.

<!-- sample PR: verifying branch protection + "Validate & Test" required check -->
