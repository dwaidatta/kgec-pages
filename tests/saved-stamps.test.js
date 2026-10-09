import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { listStamps, saveStamp, renameStamp, removeStamp } from "../lib/saved-stamps.js";

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("listStamps is empty by default", () => {
  assert.deepEqual(listStamps(), []);
});

test("saveStamp stores an image once", () => {
  const a = saveStamp({ label: "Seal", dataUrl: "data:image/png;base64,AAA" });
  const b = saveStamp({ label: "Other name", dataUrl: "data:image/png;base64,AAA" });
  assert.equal(a.id, b.id);
  assert.equal(listStamps().length, 1);
});

test("saveStamp falls back to a default name", () => {
  assert.equal(saveStamp({ label: "", dataUrl: "data:image/png;base64,AAA" }).label, "Stamp");
});

test("renameStamp and removeStamp change the saved list", () => {
  const a = saveStamp({ label: "Seal", dataUrl: "data:image/png;base64,AAA" });
  assert.ok(renameStamp(a.id, "College seal"));
  assert.equal(listStamps()[0].label, "College seal");
  assert.equal(renameStamp("missing", "x"), false);
  removeStamp(a.id);
  assert.deepEqual(listStamps(), []);
});
