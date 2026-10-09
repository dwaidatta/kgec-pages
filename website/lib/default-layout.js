import { getItem, setItem, KEYS } from "./storage.js";

export async function getDefaultLayout(pathToJson = "../data/default_layout.json", storageKey = KEYS.DEFAULT_LAYOUT) {
  const res = await fetch(pathToJson);
  if (!res.ok) throw new Error(`Failed to load ${pathToJson}: ${res.status}`);

  const data = await res.json();
  setItem(storageKey, data); // always overwrite — never trust stale storage
  return data;
}

export function getStoredDefaultLayout(storageKey = KEYS.DEFAULT_LAYOUT) {
  return getItem(storageKey);
}

export function isLockedLayout(layout) {
  return Boolean(layout && layout.locked);
}
