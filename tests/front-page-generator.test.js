import { test } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { buildExportFilename } from "../website/front-page-generator/index.js";

test("buildExportFilename combines index, name, roll, and a timestamp", (t) => {
  t.mock.method(Date, "now", () => 1700000000000);
  const filename = buildExportFilename({ name: "Jane Doe", roll: "12" }, 0);
  assert.equal(filename, "1_Jane_Doe_12_1700000000000");
});

test("buildExportFilename falls back to defaults when there is no user", (t) => {
  t.mock.method(Date, "now", () => 42);
  const filename = buildExportFilename(null, 2);
  assert.equal(filename, "3_unnamed_no-roll_42");
});

test("buildExportFilename falls back to a default roll when the user has none", (t) => {
  t.mock.method(Date, "now", () => 1);
  const filename = buildExportFilename({ name: "Jane" }, 0);
  assert.equal(filename, "1_Jane_no-roll_1");
});

test("buildExportFilename collapses internal whitespace and trims the name", (t) => {
  t.mock.method(Date, "now", () => 1);
  const filename = buildExportFilename({ name: "  Jane   Doe  ", roll: "12" }, 0);
  assert.equal(filename, "1_Jane_Doe_12_1");
});
