import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { KEYS } from "../website/lib/storage.js";
import { loadUsers, saveUsers, generateUserId, createUser, USER_FIELDS } from "../website/lib/users.js";

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("loadUsers returns an empty array when nothing is stored", () => {
  assert.deepEqual(loadUsers(), []);
});

test("loadUsers returns an empty array if stored data isn't an array", () => {
  globalThis.localStorage.setItem(KEYS.USERS, JSON.stringify({ not: "an array" }));
  assert.deepEqual(loadUsers(), []);
});

test("saveUsers/loadUsers round-trips a list of users", () => {
  const users = [{ id: "id-1", name: "Jane" }];
  saveUsers(users);
  assert.deepEqual(loadUsers(), users);
});

test("saveUsers silently rejects non-array input and leaves storage untouched", () => {
  saveUsers([{ id: "id-1" }]);
  saveUsers("not-an-array");
  assert.deepEqual(loadUsers(), [{ id: "id-1" }]);
});

test("generateUserId produces unique id- prefixed strings", () => {
  const a = generateUserId();
  const b = generateUserId();
  assert.match(a, /^id-\d+-[0-9a-f]+$/);
  assert.notEqual(a, b);
});

test("createUser returns an id plus every USER_FIELDS key initialized to an empty string", () => {
  const user = createUser();
  assert.ok(user.id);
  USER_FIELDS.forEach((f) => {
    assert.equal(user[f.key], "");
  });
});
