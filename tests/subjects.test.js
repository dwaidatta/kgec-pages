import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { KEYS } from "../website/lib/storage.js";
import { loadSubjects, refreshSubjects } from "../website/lib/subjects.js";

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("loadSubjects returns cached subjects without fetching when already stored", async (t) => {
  const cached = { CS101: "Intro to CS" };
  globalThis.localStorage.setItem(KEYS.SUBJECTS, JSON.stringify(cached));
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("should not be called");
  });

  const result = await loadSubjects("../data/subjects.json");
  assert.deepEqual(result, cached);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("loadSubjects fetches and caches when nothing is stored", async (t) => {
  const fetched = { CS102: "Data Structures" };
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => fetched }));

  const result = await loadSubjects("../data/subjects.json");
  assert.deepEqual(result, fetched);
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(KEYS.SUBJECTS)), fetched);
});

test("refreshSubjects always re-fetches even when a cached value exists", async (t) => {
  globalThis.localStorage.setItem(KEYS.SUBJECTS, JSON.stringify({ OLD: "Stale" }));
  const fresh = { CS103: "Algorithms" };
  const fetchMock = t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => fresh }));

  const result = await refreshSubjects("../data/subjects.json");
  assert.deepEqual(result, fresh);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("refreshSubjects throws when the response is not ok", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 500 }));
  await assert.rejects(() => refreshSubjects("../data/subjects.json"));
});
