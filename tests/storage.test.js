import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { getItem, setItem, removeItem, KEYS } from "../lib/storage.js";

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("setItem/getItem round-trips a JSON-serializable value", () => {
  setItem(KEYS.USERS, [{ id: "1", name: "Jane" }]);
  assert.deepEqual(getItem(KEYS.USERS), [{ id: "1", name: "Jane" }]);
});

test("getItem returns null for a missing key", () => {
  assert.equal(getItem("nonexistent-key"), null);
});

test("getItem returns null and does not throw on corrupt JSON", () => {
  globalThis.localStorage.setItem(KEYS.USERS, "{not valid json");
  assert.equal(getItem(KEYS.USERS), null);
});

test("removeItem clears a stored key", () => {
  setItem(KEYS.USERS, [{ id: "1" }]);
  removeItem(KEYS.USERS);
  assert.equal(getItem(KEYS.USERS), null);
});

test("setItem returns true on success and getItem preserves falsy values", () => {
  assert.equal(setItem(KEYS.STUDENT_LAST_USED_LAYOUT, 0), true);
  assert.equal(getItem(KEYS.STUDENT_LAST_USED_LAYOUT), 0);
});
