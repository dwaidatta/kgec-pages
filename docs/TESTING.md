# 🧪 Testing

> **Written for:** Contributors who change the site and need to run or add tests.

The project has two test suites. Unit tests check the logic in `website/lib/`, and end-to-end tests click through the real pages in a browser.

## 📋 Test suites

| Suite | Location | Runner | Needs a browser |
| --- | --- | --- | --- |
| Unit | `tests/*.test.js` | Node's built-in test runner | No |
| End-to-end | `tests/e2e/*.spec.js` | Playwright (Chromium) | Yes |

## ▶️ Running the tests

1. Install the dev dependencies:

   ```bash
   npm ci
   ```

2. Run the unit tests:

   ```bash
   npm test
   ```

3. Download Chromium once, then run the end-to-end tests:

   ```bash
   npx playwright install chromium
   npm run test:e2e
   ```

To run a single file or test:

```bash
node --test tests/storage.test.js
npx playwright test tests/e2e/multimerge.spec.js -g "merges the selected group"
```

> [!NOTE]
> The pages load Bootstrap, pdf-lib, pdf.js and Sortable from CDNs, so the end-to-end tests need network access.

## 🔬 Unit tests

Unit tests cover the pure logic exported from `website/lib/` and the page modules. They also check that every `.json` file in the repo parses (`tests/json-files.test.js`).

`tests/setup.js` provides small browser stand-ins (`localStorage`, `document`, `bootstrap.Toast`) so modules can be imported under plain Node. Toasts that are shown are recorded in `globalThis.__toasts`, so a test can assert that a warning appeared.

DOM rendering and event wiring are covered by the end-to-end tests, not here. Keep new logic in small, exported, DOM-free functions so it stays unit testable.

## 🌐 End-to-end tests

| File | Covers |
| --- | --- |
| `navigation.spec.js` | Home cards, bottom navbar, subjects search, and a check that no page throws a script error. |
| `settings.spec.js` | Adding, editing, deleting, exporting and importing people, and Bloom's levels. |
| `front-page-generator.spec.js` | Live preview, title lines, emblem style, student linking, and saving a layout. |
| `multimerge.spec.js` | Attaching and removing PDFs, merging (file name and page count), deleting groups, and select-all. |
| `signature-topsheet.spec.js` | Signature owner switch, starting an extraction, and both topsheet flows. |

How they work:

- `playwright.config.js` starts `tests/e2e/server.js`, a small static server for `website/` on port 4173.
- `tests/e2e/helpers.js` seeds `localStorage` before a page loads and builds small PDFs in the page, so no fixture files are needed.
- Each test gets a fresh browser context, so tests do not share saved data.

## ⚙️ Continuous integration

CI runs both suites on every pull request and push to `main`, and the Pages release only deploys after they pass. See [CI-AND-DEPLOYMENT.md](CI-AND-DEPLOYMENT.md) for the workflows and diagrams.
