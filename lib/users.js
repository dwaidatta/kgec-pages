import { showToast } from "./ui.js";
import { getItem, setItem, KEYS } from "./storage.js";

export const USER_FIELDS = [
  { key: "name", label: "Name" },
  { key: "roll", label: "Roll" },
  { key: "reg", label: "Reg" },
  { key: "dept", label: "Dept" },
  { key: "course", label: "Course" },
  { key: "year", label: "Year" },
  { key: "sem", label: "Sem" },
];

export function loadUsers() {
  const data = getItem(KEYS.USERS);
  return Array.isArray(data) ? data : [];
}

export function saveUsers(users) {
  if (!Array.isArray(users)) {
    showToast("Could not save users: invalid data.", "danger");
    return;
  }
  setItem(KEYS.USERS, users);
}

export function generateUserId() {
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function createUser() {
  const user = { id: generateUserId() };
  USER_FIELDS.forEach((f) => (user[f.key] = ""));
  return user;
}
