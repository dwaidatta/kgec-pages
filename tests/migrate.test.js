import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { KEYS, getItem } from "../website/lib/storage.js";
import { migrateStorage } from "../website/lib/migrate.js";

const put = (key, value) => globalThis.localStorage.setItem(key, JSON.stringify(value));
const raw = (key) => globalThis.localStorage.getItem(key);

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("old layout keys move to the student and teacher keys", () => {
  put("kgec_pages_layouts", { a: { label: "A" } });
  put("kgec_pages_last_used_layout", { label: "Last" });
  put("kgec_pages_topsheet_layouts", { t: { label: "T" } });
  put("kgec_pages_topsheet_last_used_layout", { label: "TLast" });
  migrateStorage();
  assert.deepEqual(getItem(KEYS.STUDENT_LAYOUTS), { a: { label: "A" } });
  assert.deepEqual(getItem(KEYS.STUDENT_LAST_USED_LAYOUT), { label: "Last" });
  assert.deepEqual(getItem(KEYS.TEACHER_LAYOUTS), { t: { label: "T" } });
  assert.deepEqual(getItem(KEYS.TEACHER_LAST_USED_LAYOUT), { label: "TLast" });
  assert.equal(raw("kgec_pages_layouts"), null);
  assert.equal(raw("kgec_pages_topsheet_layouts"), null);
});

test("layouts already under a new key are not overwritten", () => {
  put(KEYS.STUDENT_LAYOUTS, { keep: {} });
  put("kgec_pages_layouts", { old: {} });
  migrateStorage();
  assert.deepEqual(getItem(KEYS.STUDENT_LAYOUTS), { keep: {} });
});

test("existing people and signatures become students", () => {
  put(KEYS.USERS, [{ id: "u1", name: "Jane" }, { id: "t1", name: "Dr X", role: "teacher" }]);
  put(KEYS.SIGNATURES, [{ id: "s1", userId: null, variants: [] }]);
  migrateStorage();
  assert.deepEqual(getItem(KEYS.USERS).map((u) => u.role), ["student", "teacher"]);
  assert.equal(getItem(KEYS.SIGNATURES)[0].role, "student");
});

test("runs once and records the version", () => {
  migrateStorage();
  assert.equal(getItem(KEYS.STORAGE_VERSION), 2);
  put("kgec_pages_layouts", { late: {} });
  migrateStorage();
  assert.notEqual(raw("kgec_pages_layouts"), null);
});
