import { getItem, setItem, KEYS } from "./storage.js";

// Stamps (college seal and the like) kept on this device: [{ id, label, dataUrl }].
// They belong to nobody in particular, so any teacher or student flow can use them.
export function listStamps() {
  const items = getItem(KEYS.STAMPS);
  return Array.isArray(items) ? items : [];
}

// Returns the saved stamp, or null if the browser refused to store it.
export function saveStamp({ label, dataUrl }) {
  const items = listStamps();
  const existing = items.find((s) => s.dataUrl === dataUrl);
  if (existing) return existing;

  const stamp = { id: crypto.randomUUID(), label: label || "Stamp", dataUrl };
  return setItem(KEYS.STAMPS, [...items, stamp]) ? stamp : null;
}

export function renameStamp(id, label) {
  const items = listStamps();
  const target = items.find((s) => s.id === id);
  if (!target) return false;
  target.label = label;
  return setItem(KEYS.STAMPS, items);
}

export function removeStamp(id) {
  return setItem(
    KEYS.STAMPS,
    listStamps().filter((s) => s.id !== id)
  );
}
