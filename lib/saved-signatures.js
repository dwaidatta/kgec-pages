import { getItem, setItem, KEYS, roleOf } from "./storage.js";
import { loadUsers } from "./users.js";

// Signatures the user chose to keep on this device, stored as groups so the
// variants of one signature (black and blue ink) always travel together:
// [{ id, role, userId, variants: [{ key, label, dataUrl }] }]. role is "student" or
// "teacher". userId is the person (of that role) the group is linked to, or null
// when it is saved unlinked.
export function listSavedSignatures(role = null) {
  const items = getItem(KEYS.SIGNATURES);
  const groups = Array.isArray(items) ? items.map(toGroup) : [];
  return role ? groups.filter((g) => g.role === role) : groups;
}

// Older versions stored one flat entry per image: { id, label, dataUrl, userId }.
// Those become single-variant groups, and anything without a role is a student's,
// so nothing saved earlier is lost.
function toGroup(item) {
  if (Array.isArray(item.variants)) return item.role === roleOf(item) ? item : { ...item, role: roleOf(item) };
  return {
    id: item.id,
    role: roleOf(item),
    userId: item.userId ?? null,
    variants: [{ key: item.label, label: item.label, dataUrl: item.dataUrl }],
  };
}

const sameImages = (a, b) =>
  a.length === b.length && a.every((v) => b.some((w) => w.dataUrl === v.dataUrl));

// Saves all variants as one group. Returns the saved group, or null if the
// browser refused to store it.
export function saveSignature({ variants, userId = null, role = "student" }) {
  const items = listSavedSignatures();
  const clean = variants.map(({ key, label, dataUrl }) => ({ key, label, dataUrl }));
  const existing = items.find(
    (g) => g.role === role && (g.userId ?? null) === userId && sameImages(g.variants, clean)
  );
  if (existing) return existing;

  const group = { id: crypto.randomUUID(), role, userId, variants: clean };
  return setItem(KEYS.SIGNATURES, [...items, group]) ? group : null;
}

// Removes a whole group.
export function removeSavedSignature(id) {
  return setItem(
    KEYS.SIGNATURES,
    listSavedSignatures().filter((g) => g.id !== id)
  );
}

// Links a saved group to a person, or unlinks it when userId is null.
export function linkSignature(id, userId) {
  const items = listSavedSignatures();
  const target = items.find((g) => g.id === id);
  if (!target) return false;
  target.userId = userId;
  return setItem(KEYS.SIGNATURES, items);
}

// Moves a group to the other kind of owner; it becomes unlinked since the old
// person belongs to the other role.
export function setSignatureRole(id, role) {
  const items = listSavedSignatures();
  const target = items.find((g) => g.id === id);
  if (!target) return false;
  target.role = role;
  target.userId = null;
  return setItem(KEYS.SIGNATURES, items);
}

export function listSignaturesForUser(userId) {
  return listSavedSignatures().filter((g) => g.userId === userId);
}

// Groups of `role` (or any role) with no person, including ones whose person was deleted.
export function listUnlinkedSignatures(users = loadUsers(), role = null) {
  const ids = new Set(users.map((u) => u.id));
  return listSavedSignatures(role).filter((g) => !ids.has(g.userId));
}
