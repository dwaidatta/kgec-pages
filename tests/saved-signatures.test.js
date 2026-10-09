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
  setSignatureRole,
} from "../lib/saved-signatures.js";
import { KEYS } from "../lib/storage.js";

const black = (n = "AAA") => ({ key: "black", label: "Black ink", dataUrl: `data:image/png;base64,${n}` });
const blue = (n = "BBB") => ({ key: "blue", label: "Blue ink", dataUrl: `data:image/png;base64,${n}` });

beforeEach(() => {
  globalThis.localStorage.clear();
});

test("listSavedSignatures is empty by default", () => {
  assert.deepEqual(listSavedSignatures(), []);
});

test("saveSignature stores both variants as one group with an id", () => {
  const group = saveSignature({ variants: [black(), blue()] });
  assert.ok(group.id);
  assert.deepEqual(group.variants.map((v) => v.label), ["Black ink", "Blue ink"]);
  assert.deepEqual(listSavedSignatures(), [group]);
});

test("saveSignature does not duplicate the same group", () => {
  const a = saveSignature({ variants: [black(), blue()] });
  const b = saveSignature({ variants: [black(), blue()] });
  assert.equal(a.id, b.id);
  assert.equal(listSavedSignatures().length, 1);
});

test("removeSavedSignature deletes the whole group", () => {
  const a = saveSignature({ variants: [black(), blue()] });
  saveSignature({ variants: [black("CCC"), blue("DDD")] });
  removeSavedSignature(a.id);
  assert.equal(listSavedSignatures().length, 1);
  assert.equal(listSavedSignatures()[0].variants[0].dataUrl, "data:image/png;base64,CCC");
});

test("saveSignature defaults to unlinked", () => {
  assert.equal(saveSignature({ variants: [black()] }).userId, null);
});

test("the same images can be saved for different students", () => {
  const a = saveSignature({ variants: [black(), blue()], userId: "u1" });
  const b = saveSignature({ variants: [black(), blue()], userId: "u2" });
  assert.notEqual(a.id, b.id);
  assert.equal(listSavedSignatures().length, 2);
});

test("listSignaturesForUser returns only that student's groups", () => {
  saveSignature({ variants: [black(), blue()], userId: "u1" });
  saveSignature({ variants: [black("CCC")] });
  assert.equal(listSignaturesForUser("u1").length, 1);
  assert.equal(listSignaturesForUser("u1")[0].variants.length, 2);
});

test("listUnlinkedSignatures includes groups of deleted students", () => {
  saveSignature({ variants: [black()], userId: "u1" });
  saveSignature({ variants: [black("CCC")], userId: "gone" });
  saveSignature({ variants: [{ key: "original", label: "Original image", dataUrl: "data:image/png;base64,EEE" }] });
  const unlinked = listUnlinkedSignatures([{ id: "u1" }]);
  assert.deepEqual(unlinked.map((g) => g.variants[0].label), ["Black ink", "Original image"]);
});

test("linkSignature links and unlinks the whole group", () => {
  const a = saveSignature({ variants: [black(), blue()] });
  assert.ok(linkSignature(a.id, "u1"));
  assert.equal(listSignaturesForUser("u1").length, 1);
  assert.ok(linkSignature(a.id, null));
  assert.equal(listSignaturesForUser("u1").length, 0);
  assert.equal(linkSignature("missing", "u1"), false);
});

test("signatures saved as single images are read as one-variant groups", () => {
  globalThis.localStorage.setItem(
    KEYS.SIGNATURES,
    JSON.stringify([{ id: "old", label: "Blue ink", dataUrl: "data:image/png;base64,OLD", userId: "u1" }])
  );
  const [group] = listSignaturesForUser("u1");
  assert.equal(group.id, "old");
  assert.deepEqual(group.variants, [{ key: "Blue ink", label: "Blue ink", dataUrl: "data:image/png;base64,OLD" }]);
});

test("signatures carry a role and default to student", () => {
  const s = saveSignature({ variants: [black()] });
  const t = saveSignature({ variants: [black("TTT")], role: "teacher" });
  assert.equal(s.role, "student");
  assert.equal(t.role, "teacher");
  assert.deepEqual(listSavedSignatures("teacher").map((g) => g.id), [t.id]);
});

test("the same image can be saved for both a student and a teacher", () => {
  saveSignature({ variants: [black()], role: "student" });
  saveSignature({ variants: [black()], role: "teacher" });
  assert.equal(listSavedSignatures().length, 2);
});

test("listUnlinkedSignatures can be limited to one role", () => {
  saveSignature({ variants: [black()], role: "student" });
  const t = saveSignature({ variants: [black("TTT")], role: "teacher" });
  assert.deepEqual(listUnlinkedSignatures([], "teacher").map((g) => g.id), [t.id]);
});

test("setSignatureRole moves a group to the other role and unlinks it", () => {
  const a = saveSignature({ variants: [black()], userId: "u1" });
  assert.ok(setSignatureRole(a.id, "teacher"));
  const [g] = listSavedSignatures("teacher");
  assert.equal(g.userId, null);
  assert.equal(setSignatureRole("missing", "teacher"), false);
});
