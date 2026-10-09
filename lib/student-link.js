import { loadUsers } from "./users.js";

export const UNLINKED_LABEL = "Don't link (save unlinked on this device)";

export function studentLabel(user) {
  const name = user.name || (user.role === "teacher" ? "Unnamed teacher" : "Unnamed student");
  return user.roll ? `${name} (${user.roll})` : name;
}

// Fills a <select> with "unlinked" plus every person of `role` and returns the
// people it listed. Keeps the current choice if that person still exists.
export function populateStudentSelect(select, { unlinkedLabel = UNLINKED_LABEL, role = "student" } = {}) {
  const users = loadUsers(role);
  const previous = select.value;

  const options = [new Option(unlinkedLabel, "")];
  users.forEach((u) => options.push(new Option(studentLabel(u), u.id)));
  select.replaceChildren(...options);

  if (users.some((u) => u.id === previous)) select.value = previous;
  return users;
}

// Badge element: "<person>" or "Unlinked".
export function linkBadge(userId, users = loadUsers()) {
  const user = users.find((u) => u.id === userId);
  const badge = document.createElement("span");
  badge.className = `badge ${user ? "text-bg-primary" : "text-bg-secondary"}`;
  badge.textContent = user ? studentLabel(user) : "Unlinked";
  badge.title = badge.textContent; // full text when a narrow tile truncates it
  return badge;
}
