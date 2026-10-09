import { getItem, setItem, removeItem, KEYS, roleOf } from "./storage.js";

const STORAGE_VERSION = 2;

// Layout keys used before layouts were split by who they belong to.
const RENAMED_KEYS = [
  ["kgec_pages_layouts", KEYS.STUDENT_LAYOUTS],
  ["kgec_pages_last_used_layout", KEYS.STUDENT_LAST_USED_LAYOUT],
  ["kgec_pages_topsheet_layouts", KEYS.TEACHER_LAYOUTS],
  ["kgec_pages_topsheet_last_used_layout", KEYS.TEACHER_LAST_USED_LAYOUT],
];

// Brings data saved by older versions up to the current shape, once per device:
// layout keys renamed, every person and signature given a role (students, as before).
// Nothing is dropped; a failed write leaves the old data in place for the next run.
export function migrateStorage() {
  if (getItem(KEYS.STORAGE_VERSION) >= STORAGE_VERSION) return;

  let ok = true;
  for (const [from, to] of RENAMED_KEYS) {
    const old = getItem(from);
    if (old === null) continue;
    if (getItem(to) === null) ok = setItem(to, old) && ok;
    removeItem(from);
  }

  const users = getItem(KEYS.USERS);
  if (Array.isArray(users)) ok = setItem(KEYS.USERS, users.map((u) => ({ ...u, role: roleOf(u) }))) && ok;

  const sigs = getItem(KEYS.SIGNATURES);
  if (Array.isArray(sigs)) ok = setItem(KEYS.SIGNATURES, sigs.map((s) => ({ ...s, role: roleOf(s) }))) && ok;

  if (ok) setItem(KEYS.STORAGE_VERSION, STORAGE_VERSION);
}
