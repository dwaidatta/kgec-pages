# 📄 KGEC Pages

A static, browser-only toolkit for KGEC students to generate print-ready assignment front pages and manage their submissions. Everything runs client-side. There is no backend or account system, and all data (students, teachers, signatures, stamps, layouts, subjects) is stored locally in the browser via `localStorage`.

This is a student-made project and is **not** an official college resource.

## ✨ Features

| Page | Path | Description |
| --- | --- | --- |
| Home | `index.html` | Landing page with links to every tool. |
| Generate Front Page | `front-page-generator/` | Design a front-page layout, link it to saved student details, preview it live, and export polished PDFs for one or many students at once. |
| Settings | `settings/` | Manage saved students and teachers, their signatures, stamps, student front-page and teacher topsheet layouts, and the subjects list. Import and export people as JSON, refresh the default layout and subjects from the server, and clear locally stored data. |
| Readymade Pages | `readymade/` | Browse and download pre-made front page templates without building one from scratch. *(Coming soon.)* |
| MultiMerge | `multimerge/` | Group PDFs, reorder pages by dragging, and export each group as one merged PDF with a custom or default file name. |
| Topsheet | `topsheet/` | Generate mark-tabulation top sheets for internal examinations, for teachers. |
| Signature Extractor | `signature/` | Turn a photo or scan of a signature into a clean, transparent PNG in black or blue ink, and save it for a student or teacher. |

## 🗂️ Project layout

```text
website/                      Public site, deployed as-is to GitHub Pages
  index.html, index.js        Landing page
  front-page-generator/       Layout editor + PDF export
  settings/                   Local data management
  readymade/                  Readymade templates (placeholder)
  multimerge/                 PDF merging tool
  signature/                  Signature extractor
  topsheet/                   Mark-tabulation top sheets
  lib/                        Shared browser modules (storage, users, subjects, layouts, PDF export, navbar, UI helpers)
  data/                       Static JSON data (subjects list, default layouts, emblem/logo assets)
  assets/                     Shared stylesheet, images and generated version metadata
tests/                        Unit tests for website/lib/ (Node test runner)
  e2e/                        End-to-end tests that drive the real pages (Playwright)
docs/                         Project documentation
.github/workflows/            CI and the manual GitHub Pages release workflow
```

## 🚀 Usage

Open `website/index.html` in a browser, or serve the `website/` folder with any static file server, and use the cards on the home page to move between tools. No build step or installation is needed to use the site.

## 🛠️ Development

The `website/lib/` modules are plain ES modules with no build step, so you can edit a file and refresh the browser.

| Command | What it runs |
| --- | --- |
| `npm test` | Unit tests, including the JSON validity check. |
| `npm run test:e2e` | End-to-end tests in a real Chromium browser. |
| `npm run test:all` | Both of the above. |

CI runs both suites on every push and pull request to `main`, and the manual Pages release only deploys after they pass. See [docs/TESTING.md](docs/TESTING.md) for setup and details, [docs/CI-AND-DEPLOYMENT.md](docs/CI-AND-DEPLOYMENT.md) for the workflows, and [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

## 📜 License

See [LICENSE](LICENSE). All rights reserved. Copying, redistribution, or reuse of this project or its code is not permitted.

## 📚 Documentation guide

| Doc | Read it for |
| --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branch, commit and pull request conventions, and code style. |
| [docs/TESTING.md](docs/TESTING.md) | Running and writing the unit and end-to-end tests. |
| [docs/CI-AND-DEPLOYMENT.md](docs/CI-AND-DEPLOYMENT.md) | The CI and GitHub Pages workflows, versioning, and release safeguards, with diagrams. |
