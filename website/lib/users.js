import { showToast } from "./ui.js";
import { getItem, setItem, KEYS, roleOf } from "./storage.js";

export const USER_FIELDS = [
  { key: "name", label: "Name" },
  { key: "roll", label: "Roll" },
  { key: "reg", label: "Reg" },
  { key: "dept", label: "Dept" },
  { key: "course", label: "Course" },
  { key: "year", label: "Year" },
  { key: "sem", label: "Sem" },
];

// Fields kept for each kind of person.
export const ROLE_FIELDS = {
  student: USER_FIELDS,
  teacher: [
    { key: "name", label: "Name" },
    { key: "mobile", label: "Mobile" },
  ],
};

// Every saved person (students and teachers). Pass `role` to get only one kind;
// records saved before roles existed count as students.
export function loadUsers(role = null) {
  const data = getItem(KEYS.USERS);
  const users = Array.isArray(data) ? data : [];
  return role ? users.filter((u) => roleOf(u) === role) : users;
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

export function createUser(role = "student") {
  const user = { id: generateUserId(), role };
  ROLE_FIELDS[role].forEach((f) => (user[f.key] = ""));
  return user;
}
