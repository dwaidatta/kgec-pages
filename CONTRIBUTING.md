# 🤝 Contributing to KGEC Pages

> **Written for:** Anyone who wants to change KGEC Pages, including first-time contributors.

Thanks for your interest in improving KGEC Pages! This is a small, student-maintained project, so the process is intentionally lightweight. This guide walks through it step by step, so it's fine if this is your first time opening a pull request anywhere.

## 📝 Before you start

This repository is proprietary (see [LICENSE](LICENSE)) and isn't open source. By submitting a pull request, you agree that your contribution may be used, modified, and distributed as part of this project under its existing license, and you confirm you have the right to submit the contribution.

If you're planning a larger change, please open an issue first to discuss the approach before investing a lot of time.

## 🗂️ Project structure

The site (in `website/`) is plain HTML/CSS/JS with no build step or framework. See the "Project layout" section of the [README](README.md) for where things live. Shared logic used by more than one page belongs in `website/lib/`; page-specific code stays in that page's `index.js`.

## 🔧 Making a change

1. Fork the repository and create a branch off `main` for your change (see [Branch naming](#-branch-naming) below).
2. Open `website/index.html` (or the relevant page) directly in a browser, or serve the `website/` folder with any static file server, to try your change.
3. Keep pure logic (parsing, formatting, storage access, etc.) in `lib/` functions that don't touch the DOM, so it stays easy to unit test.
4. Add or update tests for any logic or page behavior you add or change (see [Tests](#-tests) below).
5. Run the tests and make sure they pass:

   ```bash
   npm test
   npm run test:e2e
   ```

6. Commit your changes following the [commit message conventions](#-commit-messages) below.
7. Push your branch and open a pull request against `main`, following the [pull request conventions](#-pull-requests) below.

## 🌿 Branch naming

Name your branch `<type>/<short-description>`, using lowercase words separated by hyphens for the description. The `type` should match the kind of change you're making:

| Type | Use it for |
| --- | --- |
| `feat` | A new feature or page |
| `fix` | A bug fix |
| `docs` | Documentation-only changes (README, CONTRIBUTING, docs, comments) |
| `chore` | Tooling, CI, config, or maintenance work that isn't a feature or fix |
| `refactor` | Restructuring code with no behavior change |
| `test` | Adding or fixing tests only |

Examples:

```text
feat/readymade-templates
fix/pdf-export-filename
docs/update-readme
chore/add-ci-workflow
```

## 💬 Commit messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/): `<type>: <short summary>`, using the same `type` values as branch names above, written in the imperative mood (e.g. "add", not "added" or "adds").

```text
feat: add readymade template browser
fix: correct roll number field in PDF export
docs: describe the settings page in the README
```

- Keep the summary line short (under ~70 characters) and specific about *what* changed.
- If the change needs more explanation, add a blank line after the summary and explain *why* the change was made. The diff already shows *what* changed, so use the body for context that isn't obvious from the code (a bug's root cause, a trade-off, a decision).
- Keep each commit focused on one logical change. It's fine, and encouraged, to make several small commits rather than one large one.

## 🔀 Pull requests

**Title:** Use the same format as commit messages, `<type>: <short summary>`, describing the overall change the PR introduces. If your PR only has one commit, the title can simply match that commit's message.

**Description:** Fill in these sections (delete any that genuinely don't apply):

```markdown
## Summary
One or two sentences on what this PR does.

## Motivation
Why this change is needed: the problem, bug, or use case behind it.
(Skip this for small or obvious changes like typo fixes.)

## Changes
A short list of what was added, changed, or removed, and where.

## Test plan
How you verified the change works: commands you ran, pages you
tested in a browser, screenshots for UI changes, etc.
```

A clear description helps reviewers (and future contributors reading the history) understand *why* a change was made, not just what it touched.

**Before opening the PR:**

- Make sure `npm test` and `npm run test:e2e` pass locally.
- Keep the PR focused on one change. Unrelated fixes should be their own PR.
- Link any related issue in the description (e.g. `Closes #12`).

> [!IMPORTANT]
> Every pull request and push to `main` runs the unit and end-to-end tests through the `CI` workflow (`.github/workflows/ci.yml`). A red CI check blocks merges, so make sure both suites pass locally before opening a PR.

## 🧪 Tests

Unit tests live in `tests/` and end-to-end tests in `tests/e2e/`. Keep new logic in small, exported, DOM-free functions so it can be unit tested.

| Command | What it runs |
| --- | --- |
| `npm test` | Unit tests, including the JSON validity check |
| `npm run test:e2e` | End-to-end tests in Chromium |

See [docs/TESTING.md](docs/TESTING.md) for setup, and how to run a single test.

## 🎨 Style

- Match the existing code style in the file you're editing (plain ES modules, `const`/`let`, template strings for HTML fragments).
- Keep pages and shared modules browser-native (no bundler, no transpilation) and free of runtime dependencies.
- Avoid adding new tooling or dependencies unless there's a strong reason. The only dev dependency today is Playwright, used for the end-to-end tests.

## 🐛 Reporting bugs and requesting features

Open a GitHub issue with steps to reproduce (for bugs) or a description of the use case (for feature requests). Screenshots are helpful for UI issues.

## 📚 Related docs

| Doc | Read it for |
| --- | --- |
| [README.md](README.md) | What the project is and how it is laid out. |
| [docs/TESTING.md](docs/TESTING.md) | Running and writing tests. |
| [docs/CI-AND-DEPLOYMENT.md](docs/CI-AND-DEPLOYMENT.md) | What CI checks and how releases are deployed. |
