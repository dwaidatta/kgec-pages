import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const IGNORE_DIRS = new Set(["node_modules", ".git", "_site", "test-results", "playwright-report"]);

function findJsonFiles(dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) findJsonFiles(fullPath, results);
    else if (entry.name.endsWith(".json")) results.push(fullPath);
  }
  return results;
}

const files = findJsonFiles(ROOT);

test("the repo contains JSON files to validate", () => {
  assert.ok(files.length > 0);
});

for (const file of files) {
  test(`${relative(ROOT, file).replaceAll("\\", "/")} is valid JSON`, () => {
    assert.doesNotThrow(() => JSON.parse(readFileSync(file, "utf8")));
  });
}
