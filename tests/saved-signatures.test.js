import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import {
  listSavedSignatures,
  saveSignature,
  removeSavedSignature,
  linkSignature,
  listSignaturesForUser,
  listUnlinkedSignatures,
} from "../lib/saved-signatures.js";

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("listSavedSignatures is empty by default", () => {
  assert.deepEqual(listSavedSignatures(), []);
});

test("saveSignature stores an entry with an id", () => {
  const entry = saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA" });
  assert.ok(entry.id);
  assert.deepEqual(listSavedSignatures(), [entry]);
});

test("saveSignature does not duplicate the same image", () => {
  const a = saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA" });
  const b = saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA" });
  assert.equal(a.id, b.id);
  assert.equal(listSavedSignatures().length, 1);
});

test("removeSavedSignature deletes by id", () => {
  const a = saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA" });
  saveSignature({ label: "Blue ink", dataUrl: "data:image/png;base64,BBB" });
  removeSavedSignature(a.id);
  assert.deepEqual(listSavedSignatures().map((s) => s.label), ["Blue ink"]);
});

test("saveSignature defaults to unlinked", () => {
  const entry = saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA" });
  assert.equal(entry.userId, null);
});

test("the same image can be saved for different students", () => {
  const a = saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA", userId: "u1" });
  const b = saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA", userId: "u2" });
  assert.notEqual(a.id, b.id);
  assert.equal(listSavedSignatures().length, 2);
});

test("listSignaturesForUser returns only that student's signatures", () => {
  saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA", userId: "u1" });
  saveSignature({ label: "Blue ink", dataUrl: "data:image/png;base64,BBB" });
  assert.deepEqual(listSignaturesForUser("u1").map((s) => s.label), ["Black ink"]);
});

test("listUnlinkedSignatures includes signatures of deleted students", () => {
  saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA", userId: "u1" });
  saveSignature({ label: "Blue ink", dataUrl: "data:image/png;base64,BBB", userId: "gone" });
  saveSignature({ label: "Original image", dataUrl: "data:image/png;base64,CCC" });
  const unlinked = listUnlinkedSignatures([{ id: "u1" }]);
  assert.deepEqual(unlinked.map((s) => s.label), ["Blue ink", "Original image"]);
});

test("linkSignature links and unlinks", () => {
  const a = saveSignature({ label: "Black ink", dataUrl: "data:image/png;base64,AAA" });
  assert.ok(linkSignature(a.id, "u1"));
  assert.equal(listSignaturesForUser("u1").length, 1);
  assert.ok(linkSignature(a.id, null));
  assert.equal(listSignaturesForUser("u1").length, 0);
  assert.equal(linkSignature("missing", "u1"), false);
});
