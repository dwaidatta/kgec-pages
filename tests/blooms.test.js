import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { KEYS, getItem } from "../website/lib/storage.js";
import { DEFAULT_BLOOMS, getBlooms, saveBlooms, resetBlooms } from "../website/lib/blooms.js";

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("getBlooms returns the defaults and persists them the first time", () => {
  assert.deepEqual(getBlooms(), DEFAULT_BLOOMS);
  assert.deepEqual(getItem(KEYS.TEACHER_BLOOMS), DEFAULT_BLOOMS);
});

test("getBlooms returns a copy so callers cannot mutate the defaults", () => {
  getBlooms().push("X - Extra");
  assert.equal(DEFAULT_BLOOMS.includes("X - Extra"), false);
});

test("saveBlooms replaces the stored list", () => {
  assert.equal(saveBlooms(["I - Define"]), true);
  assert.deepEqual(getBlooms(), ["I - Define"]);
});

test("an empty saved list is kept, not replaced by the defaults", () => {
  saveBlooms([]);
  assert.deepEqual(getBlooms(), []);
});

test("resetBlooms restores the defaults", () => {
  saveBlooms(["Custom"]);
  resetBlooms();
  assert.deepEqual(getBlooms(), DEFAULT_BLOOMS);
});
