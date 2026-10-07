import { getItem, setItem, KEYS } from "./storage.js";
import { loadUsers } from "./users.js";

// Signatures the user chose to keep on this device:
// [{ id, label, dataUrl, userId }]. userId is the student record the signature
// is linked to, or null when it is saved unlinked.
export function listSavedSignatures() {
  const items = getItem(KEYS.SIGNATURES);
  return Array.isArray(items) ? items : [];
}

// Returns the saved entry, or null if the browser refused to store it.
export function saveSignature({ label, dataUrl, userId = null }) {
  const items = listSavedSignatures();
  const existing = items.find((s) => s.dataUrl === dataUrl && (s.userId ?? null) === userId);
  if (existing) return existing;

  const entry = { id: crypto.randomUUID(), label, dataUrl, userId };
  return setItem(KEYS.SIGNATURES, [...items, entry]) ? entry : null;
}

export function removeSavedSignature(id) {
  return setItem(
    KEYS.SIGNATURES,
    listSavedSignatures().filter((s) => s.id !== id)
  );
}

// Links a saved signature to a student, or unlinks it when userId is null.
export function linkSignature(id, userId) {
  const items = listSavedSignatures();
  const target = items.find((s) => s.id === id);
  if (!target) return false;
  target.userId = userId;
  return setItem(KEYS.SIGNATURES, items);
}

export function listSignaturesForUser(userId) {
  return listSavedSignatures().filter((s) => s.userId === userId);
}

// Signatures with no student, including ones whose student was deleted.
export function listUnlinkedSignatures(users = loadUsers()) {
  const ids = new Set(users.map((u) => u.id));
  return listSavedSignatures().filter((s) => !ids.has(s.userId));
}
