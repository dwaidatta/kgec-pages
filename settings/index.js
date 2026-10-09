import { getItem, setItem, removeItem, KEYS } from "../lib/storage.js";
import { renderNavbar } from "../lib/navbar.js";
import { showToast, confirmAndRun, bindSelectAll } from "../lib/ui.js";
import { getDefaultLayout, getStoredDefaultLayout } from "../lib/default-layout.js";
import { refreshSubjects } from "../lib/subjects.js";
import { loadUsers, saveUsers, generateUserId, USER_FIELDS } from "../lib/users.js";
import {
  listSignaturesForUser,
  listUnlinkedSignatures,
  linkSignature,
  removeSavedSignature,
} from "../lib/saved-signatures.js";
import { populateStudentSelect } from "../lib/student-link.js";
renderNavbar("../", "settings");

// ---------- USERS ----------

function renderUsers() {
  const users = loadUsers();
  const container = document.getElementById("user-list");
  const emptyState = document.getElementById("empty-state");

  document.getElementById("users-count-badge").textContent = users.length;
  container.innerHTML = "";
  emptyState.classList.toggle("d-none", users.length !== 0);

  users.forEach((user) => {
    const col = document.createElement("div");
    col.className = "col-sm-6 col-lg-4";

    const fieldsHtml = USER_FIELDS.map(
      (f) => `
        <div class="mb-2">
          <label class="form-label small text-muted mb-0">${f.label}</label>
          <input class="form-control field-${f.key}" placeholder="${f.label}" value="${user[f.key] || ""}">
        </div>
      `
    ).join("");

    col.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <input class="form-check-input user-checkbox" type="checkbox" data-id="${user.id}">
            <button class="btn btn-sm btn-outline-danger btn-delete-single" data-id="${user.id}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          ${fieldsHtml}
          <div class="small text-muted mt-3 mb-1">
            <i class="bi bi-pen"></i> Signatures
            <span class="badge rounded-pill text-bg-primary ms-1 user-sig-count">0</span>
          </div>
          <div class="d-flex flex-wrap gap-3 pt-2 pe-2 user-sigs"></div>
        </div>
      </div>
    `;

    const sigs = listSignaturesForUser(user.id);
    col.querySelector(".user-sig-count").textContent = sigs.length;
    const sigBox = col.querySelector(".user-sigs");
    if (sigs.length === 0) {
      sigBox.innerHTML = '<span class="small text-muted">None linked yet. Link one from the Signature Extractor.</span>';
    } else {
      sigBox.replaceChildren(...sigs.map((s) => signatureThumb(s)));
    }

    USER_FIELDS.forEach((f) => {
      col.querySelector(`.field-${f.key}`).addEventListener("input", (e) => {
        updateUserField(user.id, f.key, e.target.value);
      });
    });

    col.querySelector(".btn-delete-single").addEventListener("click", () => {
      deleteUsersByIds([user.id]);
    });

    container.appendChild(col);
  });

  // Student list changes affect which signatures count as unlinked.
  renderUnlinkedSignatures();
}

// Every variant of a signature in one tile, with a single delete button for the group.
function signatureThumb(group) {
  const wrap = document.createElement("div");
  wrap.className = "border rounded p-1 bg-white text-center position-relative";
  wrap.innerHTML = `
    <div class="d-flex gap-1 sig-variants"></div>
    <button type="button" class="btn btn-danger sig-del" title="Delete signature">
      <i class="bi bi-x"></i>
    </button>
  `;
  wrap.querySelector(".sig-variants").replaceChildren(...group.variants.map((v) => variantPreview(v)));
  wrap.querySelector("button").addEventListener("click", () => deleteSignature(group.id));
  return wrap;
}

function variantPreview(variant, maxHeight = 50) {
  const el = document.createElement("div");
  el.style.width = "100px";
  el.innerHTML = `
    <img alt="" style="max-width:100%;max-height:${maxHeight}px;">
    <div class="small text-muted text-truncate"></div>
  `;
  el.querySelector("img").src = variant.dataUrl;
  el.querySelector("div").textContent = variant.label;
  return el;
}

async function deleteSignature(id) {
  const done = await confirmAndRun("Delete this signature from this device?", () => {
    removeSavedSignature(id);
    renderUsers();
  });
  if (done) showToast("Signature deleted.", "success");
}

function updateUserField(id, key, value) {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return;
  user[key] = value;
  saveUsers(users);
  if (key === "name" || key === "roll") renderUnlinkedSignatures(); // keeps the link dropdowns current
}

async function addUserFromModal() {
  const newUser = {
    id: generateUserId(),
    name: document.getElementById("new-user-name").value.trim(),
    roll: document.getElementById("new-user-roll").value.trim(),
    reg: document.getElementById("new-user-reg").value.trim(),
    dept: document.getElementById("new-user-dept").value.trim(),
    course: document.getElementById("new-user-course").value.trim(),
    year: document.getElementById("new-user-year").value.trim(),
    sem: document.getElementById("new-user-sem").value.trim(),
  };

  if (!newUser.name) {
    showToast("Name is required.", "warning");
    return;
  }

  const users = loadUsers();
  users.push(newUser);
  saveUsers(users);
  renderUsers();

  document.getElementById("add-user-form").reset();

  const modalEl = document.getElementById("addUserModal");
  bootstrap.Modal.getInstance(modalEl).hide();
  showToast("User added.", "success");
}

async function deleteUsersByIds(ids) {
  if (ids.length === 0) return;
  const done = await confirmAndRun(`Delete ${ids.length} user(s)? This cannot be undone.`, () => {
    saveUsers(loadUsers().filter((u) => !ids.includes(u.id)));
    renderUsers();
  });
  if (done) showToast(`Deleted ${ids.length} user(s).`, "success");
}

function deleteSelectedUsers() {
  const checkedIds = [...document.querySelectorAll(".user-checkbox:checked")].map((cb) => cb.dataset.id);
  deleteUsersByIds(checkedIds);
}

function exportUsers() {
  const users = loadUsers();
  const blob = new Blob([JSON.stringify(users, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "kgec_pages_users_export.json";
  a.click();

  URL.revokeObjectURL(url);
  showToast("Exported users.", "success");
}

function importUsers(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Invalid file format");
      saveUsers(imported);
      renderUsers();
      showToast("Users imported.", "success");
    } catch (err) {
      showToast("Invalid users file.", "danger");
    }
  };
  reader.readAsText(file);
}

async function clearUsers() {
  const done = await confirmAndRun("Clear all locally saved users? This cannot be undone.", () => {
    removeItem(KEYS.USERS);
    renderUsers();
  });
  if (done) showToast("Users storage cleared.", "success");
}

// ---------- UNLINKED SIGNATURES ----------

function renderUnlinkedSignatures() {
  const users = loadUsers();
  const sigs = listUnlinkedSignatures(users);
  const container = document.getElementById("unlinked-sig-list");

  document.getElementById("unlinked-sig-count-badge").textContent = sigs.length;
  document.getElementById("unlinked-sig-empty").classList.toggle("d-none", sigs.length !== 0);

  container.replaceChildren(
    ...sigs.map((sig) => {
      const col = document.createElement("div");
      col.className = "col-sm-6 col-lg-4";
      col.innerHTML = `
        <div class="card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge text-bg-secondary">Unlinked</span>
              <button type="button" class="btn btn-sm btn-outline-danger" title="Delete signature">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <div class="border rounded p-2 mb-2 bg-white d-flex justify-content-center gap-2 sig-variants"></div>
            <select class="form-select form-select-sm" aria-label="Link to a student"></select>
          </div>
        </div>
      `;
      col.querySelector(".sig-variants").replaceChildren(...sig.variants.map((v) => variantPreview(v, 70)));

      const select = col.querySelector("select");
      populateStudentSelect(select, { unlinkedLabel: "Link to a student..." });
      select.addEventListener("change", () => {
        if (!select.value) return;
        if (linkSignature(sig.id, select.value)) {
          showToast("Signature linked.", "success");
          renderUsers();
        } else {
          showToast("Could not link the signature.", "danger");
        }
      });

      col.querySelector("button").addEventListener("click", () => deleteSignature(sig.id));
      return col;
    })
  );
}

// ---------- DEFAULT LAYOUT ----------

function renderDefaultLayoutInfo() {
  const layout = getStoredDefaultLayout();
  const el = document.getElementById("default-layout-info");
  const badge = document.getElementById("default-layout-badge");

  el.textContent = layout ? `Loaded: ${layout.label || "Default"} (locked, read-only)` : "Not loaded yet.";
  badge.textContent = layout ? "Loaded" : "Not loaded";
  badge.className = `badge ms-1 ${layout ? "text-bg-primary" : "text-bg-secondary"}`;
}

async function refreshDefaultLayout() {
  await getDefaultLayout();
  renderDefaultLayoutInfo();
  showToast("Default layout refreshed from server.", "success");
}

// ---------- SAVED LAYOUTS ----------

function renderLayouts() {
  const layouts = getItem(KEYS.LAYOUTS) || {};
  const container = document.getElementById("layout-list");
  container.innerHTML = "";

  const entries = Object.entries(layouts);
  document.getElementById("layouts-count-badge").textContent = entries.length;

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="empty-state">
          <i class="bi bi-collection empty-state-icon"></i>
          <h5>No saved layouts</h5>
          <p class="mb-0">Save a layout from the Front Page Generator to see it here.</p>
        </div>
      </div>
    `;
    return;
  }

  entries.forEach(([key, layout]) => {
    const col = document.createElement("div");
    col.className = "col-sm-6 col-lg-4";
    col.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <input class="form-check-input layout-checkbox" type="checkbox" data-key="${key}">
            <button class="btn btn-sm btn-outline-danger btn-delete-single-layout" data-key="${key}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <h6 class="mt-2 mb-1">${layout.label || key}</h6>
          <p class="text-muted small mb-0">Key: ${key}</p>
        </div>
      </div>
    `;

    col.querySelector(".btn-delete-single-layout").addEventListener("click", () => {
      deleteLayoutsByKeys([key]);
    });

    container.appendChild(col);
  });
}

async function deleteLayoutsByKeys(keys) {
  if (keys.length === 0) return;
  const done = await confirmAndRun(`Delete ${keys.length} layout(s)? This cannot be undone.`, () => {
    const layouts = getItem(KEYS.LAYOUTS) || {};
    keys.forEach((k) => delete layouts[k]);
    setItem(KEYS.LAYOUTS, layouts);
    renderLayouts();
  });
  if (done) showToast(`Deleted ${keys.length} layout(s).`, "success");
}

function deleteSelectedLayouts() {
  const checkedKeys = [...document.querySelectorAll(".layout-checkbox:checked")].map((cb) => cb.dataset.key);
  deleteLayoutsByKeys(checkedKeys);
}

async function deleteAllLayouts() {
  const layouts = getItem(KEYS.LAYOUTS) || {};
  deleteLayoutsByKeys(Object.keys(layouts));
}

// ---------- LAST USED LAYOUT ----------

function renderLastUsedInfo() {
  const lastUsed = getItem(KEYS.LAST_USED_LAYOUT);
  const el = document.getElementById("last-used-layout-info");
  const badge = document.getElementById("last-used-layout-badge");

  el.textContent = lastUsed ? "A last-used layout state is saved." : "No last-used layout saved yet.";
  badge.textContent = lastUsed ? "Saved" : "Empty";
  badge.className = `badge ms-1 ${lastUsed ? "text-bg-primary" : "text-bg-secondary"}`;
}

async function deleteLastUsedLayout() {
  const done = await confirmAndRun("Delete the last-used layout state? This cannot be undone.", () => {
    removeItem(KEYS.LAST_USED_LAYOUT);
    renderLastUsedInfo();
  });
  if (done) showToast("Last-used layout deleted.", "success");
}

// ---------- SUBJECTS ----------

function renderSubjects() {
  const subjects = getItem(KEYS.SUBJECTS) || {};
  const tbody = document.getElementById("subjects-table-body");
  tbody.innerHTML = "";

  const entries = Object.entries(subjects);
  document.getElementById("subjects-count-badge").textContent = entries.length;

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-muted">No subjects loaded.</td></tr>`;
    return;
  }

  entries.forEach(([code, name]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="font-monospace">${code}</td><td>${name}</td>`;
    tbody.appendChild(tr);
  });
}

async function refreshSubjectsList() {
  await refreshSubjects("../data/subjects.json");
  renderSubjects();
  showToast("Subjects refreshed from server.", "success");
}

// ---------- INIT ----------

function init() {
  renderUsers();
  renderDefaultLayoutInfo();
  renderLayouts();
  renderLastUsedInfo();
  renderSubjects();

  document.getElementById("btn-save-new-user").addEventListener("click", addUserFromModal);
  document.getElementById("btn-delete-user").addEventListener("click", deleteSelectedUsers);
  document.getElementById("btn-export").addEventListener("click", exportUsers);

  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("input-import-file").click();
  });

  document.getElementById("input-import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importUsers(file);
    e.target.value = "";
  });

  bindSelectAll("select-all-checkbox", ".user-checkbox");

  document.getElementById("btn-refresh-default-layout").addEventListener("click", refreshDefaultLayout);
  document.getElementById("btn-clear-users").addEventListener("click", clearUsers);
  document.getElementById("btn-delete-layout").addEventListener("click", deleteSelectedLayouts);
  document.getElementById("btn-delete-all-layouts").addEventListener("click", deleteAllLayouts);
  bindSelectAll("select-all-layouts-checkbox", ".layout-checkbox");
  document.getElementById("btn-delete-last-used").addEventListener("click", deleteLastUsedLayout);
  document.getElementById("btn-refresh-subjects").addEventListener("click", refreshSubjectsList);
}

if (document.getElementById("user-list")) {
  init();
}