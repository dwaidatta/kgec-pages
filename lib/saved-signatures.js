import { getItem, setItem, KEYS } from "./storage.js";
import { loadUsers } from "./users.js";

// Signatures the user chose to keep on this device, stored as groups so the
// variants of one signature (black and blue ink) always travel together:
// [{ id, userId, variants: [{ key, label, dataUrl }] }]. userId is the student
// record the group is linked to, or null when it is saved unlinked.
export function listSavedSignatures() {
  const items = getItem(KEYS.SIGNATURES);
  return Array.isArray(items) ? items.map(toGroup) : [];
}

// Older versions stored one flat entry per image: { id, label, dataUrl, userId }.
// Those become single-variant groups, so nothing saved earlier is lost.
function toGroup(item) {
  if (Array.isArray(item.variants)) return item;
  return {
    id: item.id,
    userId: item.userId ?? null,
    variants: [{ key: item.label, label: item.label, dataUrl: item.dataUrl }],
  };
}

const sameImages = (a, b) =>
  a.length === b.length && a.every((v) => b.some((w) => w.dataUrl === v.dataUrl));

// Saves all variants as one group. Returns the saved group, or null if the
// browser refused to store it.
export function saveSignature({ variants, userId = null }) {
  const items = listSavedSignatures();
  const clean = variants.map(({ key, label, dataUrl }) => ({ key, label, dataUrl }));
  const existing = items.find((g) => (g.userId ?? null) === userId && sameImages(g.variants, clean));
  if (existing) return existing;

  const group = { id: crypto.randomUUID(), userId, variants: clean };
  return setItem(KEYS.SIGNATURES, [...items, group]) ? group : null;
}

// Removes a whole group.
export function removeSavedSignature(id) {
  return setItem(
    KEYS.SIGNATURES,
    listSavedSignatures().filter((g) => g.id !== id)
  );
}

// Links a saved group to a student, or unlinks it when userId is null.
export function linkSignature(id, userId) {
  const items = listSavedSignatures();
  const target = items.find((g) => g.id === id);
  if (!target) return false;
  target.userId = userId;
  return setItem(KEYS.SIGNATURES, items);
}

export function listSignaturesForUser(userId) {
  return listSavedSignatures().filter((g) => g.userId === userId);
}

// Groups with no student, including ones whose student was deleted.
export function listUnlinkedSignatures(users = loadUsers()) {
  const ids = new Set(users.map((u) => u.id));
  return listSavedSignatures().filter((g) => !ids.has(g.userId));
}
