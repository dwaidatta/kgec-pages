import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { KEYS } from "../website/lib/storage.js";
import { getDefaultLayout, getStoredDefaultLayout, isLockedLayout } from "../website/lib/default-layout.js";

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("isLockedLayout is true only when the layout has locked: true", () => {
  assert.equal(isLockedLayout({ locked: true }), true);
  assert.equal(isLockedLayout({ locked: false }), false);
  assert.equal(isLockedLayout({}), false);
  assert.equal(isLockedLayout(null), false);
  assert.equal(isLockedLayout(undefined), false);
});

test("getStoredDefaultLayout returns null when nothing has been fetched yet", () => {
  assert.equal(getStoredDefaultLayout(), null);
});

test("getDefaultLayout fetches, caches to storage, and returns the layout", async (t) => {
  const layout = { label: "Default", locked: true };
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => layout,
  }));

  const result = await getDefaultLayout("../data/default_layout.json");
  assert.deepEqual(result, layout);
  assert.deepEqual(getStoredDefaultLayout(), layout);
});

test("getDefaultLayout throws when the fetch response is not ok", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 404 }));

  await assert.rejects(() => getDefaultLayout("../data/default_layout.json"));
});

test("getDefaultLayout always overwrites previously stored data", async (t) => {
  globalThis.localStorage.setItem(KEYS.DEFAULT_LAYOUT, JSON.stringify({ label: "Stale" }));
  const fresh = { label: "Fresh", locked: true };
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => fresh }));

  await getDefaultLayout("../data/default_layout.json");
  assert.deepEqual(getStoredDefaultLayout(), fresh);
});
