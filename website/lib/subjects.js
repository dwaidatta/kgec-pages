import { getItem, setItem, KEYS } from "./storage.js";

export async function loadSubjects(fallbackUrl = "../data/subjects.json") {
  const existing = getItem(KEYS.SUBJECTS);
  if (existing) return existing;
  return refreshSubjects(fallbackUrl);
}

export async function refreshSubjects(fallbackUrl = "../data/subjects.json") {
  const res = await fetch(fallbackUrl);
  if (!res.ok) throw new Error(`Failed to load subjects.json: ${res.status}`);

  const data = await res.json();
  setItem(KEYS.SUBJECTS, data);
  return data;
}