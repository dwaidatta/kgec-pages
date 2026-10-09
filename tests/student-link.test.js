import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { saveUsers } from "../website/lib/users.js";
import { studentLabel, linkBadge } from "../website/lib/student-link.js";

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("studentLabel shows name and roll when both exist", () => {
  assert.equal(studentLabel({ name: "Jane", roll: "12" }), "Jane (12)");
});

test("studentLabel shows only the name when there is no roll", () => {
  assert.equal(studentLabel({ name: "Jane" }), "Jane");
});

test("studentLabel falls back to a role-specific placeholder for nameless people", () => {
  assert.equal(studentLabel({}), "Unnamed student");
  assert.equal(studentLabel({ role: "teacher" }), "Unnamed teacher");
});

test("linkBadge shows the linked person's label", () => {
  saveUsers([{ id: "a", name: "Jane", roll: "12" }]);
  const badge = linkBadge("a");
  assert.equal(badge.textContent, "Jane (12)");
  assert.match(badge.className, /text-bg-primary/);
});

test("linkBadge shows Unlinked for an unknown or empty id", () => {
  for (const id of ["missing", "", null]) {
    const badge = linkBadge(id, []);
    assert.equal(badge.textContent, "Unlinked");
    assert.match(badge.className, /text-bg-secondary/);
  }
});
