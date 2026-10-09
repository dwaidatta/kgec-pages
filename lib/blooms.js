import { getItem, setItem, KEYS } from "./storage.js";

// Bloom's levels offered as a guide when a teacher fills the Bloom's Level column.
export const DEFAULT_BLOOMS = [
  "I - Define",
  "I - Memorize",
  "I - Recall",
  "I - Remember",
  "I - Understand",
  "II - Understand",
  "V - Explain",
  "VI - Describe",
  "VI - Discuss",
];

// Returns the saved list. The first time, the default set is written to storage.
export function getBlooms() {
  const stored = getItem(KEYS.TEACHER_BLOOMS);
  if (Array.isArray(stored)) return stored;
  setItem(KEYS.TEACHER_BLOOMS, DEFAULT_BLOOMS);
  return [...DEFAULT_BLOOMS];
}

export function saveBlooms(list) {
  return setItem(KEYS.TEACHER_BLOOMS, list);
}

export function resetBlooms() {
  return saveBlooms([...DEFAULT_BLOOMS]);
}
