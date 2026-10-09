import { getItem, setItem, removeItem, KEYS, roleOf } from "../lib/storage.js";
import { renderNavbar } from "../lib/navbar.js";
import { showToast, confirmAndRun } from "../lib/ui.js";
import { getDefaultLayout, getStoredDefaultLayout } from "../lib/default-layout.js";
import { refreshSubjects } from "../lib/subjects.js";
import { loadUsers, saveUsers, generateUserId, ROLE_FIELDS } from "../lib/users.js";
import {
  listSignaturesForUser,
  listUnlinkedSignatures,
  linkSignature,
  setSignatureRole,
  removeSavedSignature,
} from "../lib/saved-signatures.js";
import { listStamps, renameStamp, removeStamp } from "../lib/saved-stamps.js";
import { populateStudentSelect } from "../lib/student-link.js";
renderNavbar("../", "settings");

// What differs between the two kinds of people and the two kinds of layouts.
const PEOPLE = [
  {
    role: "student",
    title: "Students",
    icon: "bi-mortarboard",
    singular: "Student",
    emptyTitle: "No Students Yet",
    exportFile: "kgec_pages_students_export.json",
  },
  {
    role: "teacher",
    title: "Teachers",
    icon: "bi-person-badge",
    singular: "Teacher",
    emptyTitle: "No Teachers Yet",
    exportFile: "kgec_pages_teachers_export.json",
  },
];

const LAYOUT_KINDS = [
  {
    id: "student",
    title: "Student Front Page Layouts",
    icon: "bi-file-earmark-text",
    layoutsKey: KEYS.STUDENT_LAYOUTS,
    lastKey: KEYS.STUDENT_LAST_USED_LAYOUT,
    hint: "Save a layout from the Front Page Generator to see it here.",
    hasDefault: true,
  },
  {
    id: "teacher",
    title: "Teacher Topsheet Layouts",
    icon: "bi-layout-text-window",
    layoutsKey: KEYS.TEACHER_LAYOUTS,
    lastKey: KEYS.TEACHER_LAST_USED_LAYOUT,
    hint: "Save a layout from the Topsheet Maker to see it here.",
    hasDefault: false,
  },
];

// Clones a <template> and returns its card plus the elements marked data-ref.
function cloneCard(templateId) {
  const card = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
  const refs = {};
  card.querySelectorAll("[data-ref]").forEach((el) => (refs[el.dataset.ref] = el));
  return { card, refs };
}

// Gives the card's body and its toggle button a shared collapse id.
function linkCollapse(refs, id) {
  refs.body.id = id;
  refs.toggle.dataset.bsTarget = `#${id}`;
}

function bindSelectAll(selectAll, items) {
  selectAll.addEventListener("change", () => items().forEach((cb) => (cb.checked = selectAll.checked)));
}

// ---------- PEOPLE ----------

const peopleViews = {};

// People whose card the user has opened up; kept across re-renders.
const expandedPeople = new Set();

function buildPeopleCards() {
  const host = document.getElementById("people-sections");

  for (const cfg of PEOPLE) {
    const { card, refs } = cloneCard("people-card-tpl");
    linkCollapse(refs, `people-${cfg.role}-body`);
    refs.icon.classList.add(cfg.icon);
    refs.title.textContent = cfg.title;
    refs["add-label"].textContent = `Add ${cfg.singular}`;
    refs["select-all-label"].textContent = "Select All";
    refs["empty-icon"].classList.add(cfg.icon);
    refs["empty-title"].textContent = cfg.emptyTitle;
    refs["empty-text"].textContent = `Click "Add ${cfg.singular}" to create one.`;

    refs.add.addEventListener("click", () => openAddPerson(cfg));
    refs.delete.addEventListener("click", () => {
      const ids = [...refs.list.querySelectorAll(".person-checkbox:checked")].map((cb) => cb.dataset.id);
      deletePeopleByIds(ids);
    });
    refs.export.addEventListener("click", () => exportPeople(cfg));
    refs.import.addEventListener("click", () => refs["import-file"].click());
    refs["import-file"].addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importPeople(cfg, file);
      e.target.value = "";
    });
    refs.clear.addEventListener("click", () => clearPeople(cfg));
    bindSelectAll(refs["select-all"], () => refs.list.querySelectorAll(".person-checkbox"));

    peopleViews[cfg.role] = refs;
    host.appendChild(card);
  }
}

function renderPeople() {
  for (const cfg of PEOPLE) renderPeopleCard(cfg, peopleViews[cfg.role]);

  // The people list decides which signatures count as unlinked.
  renderUnlinkedSignatures();
}

function renderPeopleCard(cfg, refs) {
  const users = loadUsers(cfg.role);
  const fields = ROLE_FIELDS[cfg.role];

  refs.count.textContent = users.length;
  refs.empty.classList.toggle("d-none", users.length !== 0);
  refs["select-all"].checked = false;

  refs.list.replaceChildren(
    ...users.map((user) => {
      const col = document.createElement("div");
      col.className = "col-sm-6 col-lg-4";

      col.innerHTML = `
        <div class="card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <input class="form-check-input person-checkbox" type="checkbox">
              <button class="btn btn-sm btn-outline-danger btn-delete-single" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <div class="person-body">
              <div class="person-fields"></div>
              <div class="small text-muted mt-3 mb-1">
                <i class="bi bi-pen"></i> Signatures
                <span class="badge rounded-pill text-bg-primary ms-1 user-sig-count">0</span>
              </div>
              <div class="d-flex flex-wrap gap-3 pt-2 pe-2 user-sigs"></div>
            </div>
            <button type="button" class="btn btn-sm btn-link p-0 mt-2 person-toggle"></button>
          </div>
        </div>
      `;
      col.querySelector(".person-checkbox").dataset.id = user.id;

      col.querySelector(".person-fields").replaceChildren(
        ...fields.map((f) => {
          const wrap = document.createElement("div");
          wrap.className = "mb-2";
          wrap.innerHTML = `<label class="form-label small text-muted mb-0"></label><input class="form-control">`;
          wrap.querySelector("label").textContent = f.label;
          const input = wrap.querySelector("input");
          input.placeholder = f.label;
          input.value = user[f.key] || "";
          input.addEventListener("input", (e) => updatePersonField(user.id, f.key, e.target.value));
          return wrap;
        })
      );

      const sigs = listSignaturesForUser(user.id);
      col.querySelector(".user-sig-count").textContent = sigs.length;
      const sigBox = col.querySelector(".user-sigs");
      if (sigs.length === 0) {
        sigBox.innerHTML = '<span class="small text-muted">None linked yet. Link one from the Signature Extractor.</span>';
      } else {
        sigBox.replaceChildren(...sigs.map((s) => signatureThumb(s)));
      }

      // Cards stay a fixed height so many signatures do not stretch the page.
      const body = col.querySelector(".person-body");
      const toggle = col.querySelector(".person-toggle");
      const sync = () => {
        const open = expandedPeople.has(user.id);
        body.classList.toggle("person-collapsed", !open);
        toggle.textContent = open ? "Show less" : "Show more";
      };
      toggle.addEventListener("click", () => {
        if (!expandedPeople.delete(user.id)) expandedPeople.add(user.id);
        sync();
      });
      sync();

      col.querySelector(".btn-delete-single").addEventListener("click", () => deletePeopleByIds([user.id]));
      return col;
    })
  );
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
    renderPeople();
  });
  if (done) showToast("Signature deleted.", "success");
}

function updatePersonField(id, key, value) {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return;
  user[key] = value;
  saveUsers(users);
  if (key === "name" || key === "roll") renderUnlinkedSignatures(); // keeps the link dropdowns current
}

function openAddPerson(cfg) {
  const form = document.getElementById("add-person-form");
  form.dataset.role = cfg.role;
  document.getElementById("add-person-title").textContent = `Add ${cfg.singular}`;
  form.replaceChildren(
    ...ROLE_FIELDS[cfg.role].map((f) => {
      const wrap = document.createElement("div");
      wrap.className = "mb-2";
      wrap.innerHTML = `<label class="form-label"></label><input type="text" class="form-control">`;
      wrap.querySelector("label").textContent = f.label;
      const input = wrap.querySelector("input");
      input.name = f.key;
      input.required = f.key === "name";
      return wrap;
    })
  );
  bootstrap.Modal.getOrCreateInstance(document.getElementById("addPersonModal")).show();
}

function addPersonFromModal() {
  const form = document.getElementById("add-person-form");
  const role = form.dataset.role;
  const person = { id: generateUserId(), role };
  ROLE_FIELDS[role].forEach((f) => (person[f.key] = form.elements[f.key].value.trim()));

  if (!person.name) {
    showToast("Name is required.", "warning");
    return;
  }

  saveUsers([...loadUsers(), person]);
  renderPeople();
  bootstrap.Modal.getInstance(document.getElementById("addPersonModal")).hide();
  showToast(`${role === "teacher" ? "Teacher" : "Student"} added.`, "success");
}

async function deletePeopleByIds(ids) {
  if (ids.length === 0) return;
  const done = await confirmAndRun(
    `Delete ${ids.length} record(s)? Their signatures stay on this device as unlinked. This cannot be undone.`,
    () => {
      saveUsers(loadUsers().filter((u) => !ids.includes(u.id)));
      renderPeople();
    }
  );
  if (done) showToast(`Deleted ${ids.length} record(s).`, "success");
}

function exportPeople(cfg) {
  const blob = new Blob([JSON.stringify(loadUsers(cfg.role), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = cfg.exportFile;
  a.click();

  URL.revokeObjectURL(url);
  showToast(`Exported ${cfg.title.toLowerCase()}.`, "success");
}

// Replaces this kind of person only; the other kind is left alone.
function importPeople(cfg, file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Invalid file format");
      const others = loadUsers().filter((u) => roleOf(u) !== cfg.role);
      saveUsers([...others, ...imported.map((u) => ({ ...u, role: cfg.role }))]);
      renderPeople();
      showToast(`${cfg.title} imported.`, "success");
    } catch (err) {
      showToast(`Invalid ${cfg.title.toLowerCase()} file.`, "danger");
    }
  };
  reader.readAsText(file);
}

async function clearPeople(cfg) {
  const done = await confirmAndRun(`Clear all locally saved ${cfg.title.toLowerCase()}? This cannot be undone.`, () => {
    const others = loadUsers().filter((u) => roleOf(u) !== cfg.role);
    if (others.length) saveUsers(others);
    else removeItem(KEYS.USERS);
    renderPeople();
  });
  if (done) showToast(`${cfg.title} cleared.`, "success");
}

// ---------- UNLINKED SIGNATURES ----------

function renderUnlinkedSignatures() {
  const sigs = listUnlinkedSignatures(loadUsers());
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
              <select class="form-select form-select-sm w-auto role-select" aria-label="Whose signature is this?">
                <option value="student">Student's</option>
                <option value="teacher">Teacher's</option>
              </select>
              <button type="button" class="btn btn-sm btn-outline-danger" title="Delete signature">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <div class="border rounded p-2 mb-2 bg-white d-flex justify-content-center gap-2 sig-variants"></div>
            <select class="form-select form-select-sm link-select"></select>
          </div>
        </div>
      `;
      col.querySelector(".sig-variants").replaceChildren(...sig.variants.map((v) => variantPreview(v, 70)));

      const roleSelect = col.querySelector(".role-select");
      roleSelect.value = sig.role;
      roleSelect.addEventListener("change", () => {
        if (setSignatureRole(sig.id, roleSelect.value)) renderUnlinkedSignatures();
        else showToast("Could not change the signature.", "danger");
      });

      const select = col.querySelector(".link-select");
      populateStudentSelect(select, { unlinkedLabel: `Link to a ${sig.role}...`, role: sig.role });
      select.addEventListener("change", () => {
        if (!select.value) return;
        if (linkSignature(sig.id, select.value)) {
          showToast("Signature linked.", "success");
          renderPeople();
        } else {
          showToast("Could not link the signature.", "danger");
        }
      });

      col.querySelector("button").addEventListener("click", () => deleteSignature(sig.id));
      return col;
    })
  );
}

// ---------- STAMPS ----------

function renderStamps() {
  const stamps = listStamps();
  document.getElementById("stamps-count-badge").textContent = stamps.length;
  document.getElementById("stamps-empty").classList.toggle("d-none", stamps.length !== 0);

  document.getElementById("stamp-list").replaceChildren(
    ...stamps.map((stamp) => {
      const col = document.createElement("div");
      col.className = "col-sm-6 col-lg-4";
      col.innerHTML = `
        <div class="card">
          <div class="card-body">
            <div class="d-flex justify-content-end mb-2">
              <button type="button" class="btn btn-sm btn-outline-danger" title="Delete stamp">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <div class="border rounded p-2 mb-2 bg-white d-flex justify-content-center align-items-center" style="height:90px;">
              <img alt="" style="max-width:100%;max-height:80px;">
            </div>
            <input class="form-control form-control-sm" aria-label="Stamp name">
          </div>
        </div>
      `;
      col.querySelector("img").src = stamp.dataUrl;
      const input = col.querySelector("input");
      input.value = stamp.label;
      input.addEventListener("change", () => {
        if (!renameStamp(stamp.id, input.value.trim() || "Stamp")) showToast("Could not rename the stamp.", "danger");
      });
      col.querySelector("button").addEventListener("click", async () => {
        const done = await confirmAndRun("Delete this stamp from this device?", () => {
          removeStamp(stamp.id);
          renderStamps();
        });
        if (done) showToast("Stamp deleted.", "success");
      });
      return col;
    })
  );
}

// ---------- LAYOUTS ----------

const layoutViews = {};

function buildLayoutCards() {
  const host = document.getElementById("layout-sections");

  for (const kind of LAYOUT_KINDS) {
    const { card, refs } = cloneCard("layout-card-tpl");
    linkCollapse(refs, `layouts-${kind.id}-body`);
    refs.icon.classList.add(kind.icon);
    refs.title.textContent = kind.title;
    refs["select-all-label"].textContent = "Select All";
    refs["default-wrap"].classList.toggle("d-none", !kind.hasDefault);

    refs["default-refresh"].addEventListener("click", refreshDefaultLayout);
    refs["last-delete"].addEventListener("click", () => deleteLastUsed(kind));
    refs.delete.addEventListener("click", () => {
      const keys = [...refs.list.querySelectorAll(".layout-checkbox:checked")].map((cb) => cb.dataset.key);
      deleteLayoutsByKeys(kind, keys);
    });
    refs["delete-all"].addEventListener("click", () =>
      deleteLayoutsByKeys(kind, Object.keys(getItem(kind.layoutsKey) || {}))
    );
    bindSelectAll(refs["select-all"], () => refs.list.querySelectorAll(".layout-checkbox"));

    layoutViews[kind.id] = refs;
    host.appendChild(card);
  }
}

function renderLayoutCard(kind) {
  const refs = layoutViews[kind.id];
  const entries = Object.entries(getItem(kind.layoutsKey) || {});
  refs.count.textContent = entries.length;
  refs["select-all"].checked = false;

  if (kind.hasDefault) {
    const layout = getStoredDefaultLayout();
    refs["default-info"].textContent = layout ? `${layout.label || "Default"} (locked, read-only)` : "";
    refs["default-badge"].textContent = layout ? "Loaded" : "Not loaded";
    refs["default-badge"].className = `badge ms-1 ${layout ? "text-bg-primary" : "text-bg-secondary"}`;
  }

  const lastUsed = getItem(kind.lastKey);
  refs["last-info"].textContent = lastUsed ? "A last-used layout state is saved." : "No last-used layout saved yet.";
  refs["last-badge"].textContent = lastUsed ? "Saved" : "Empty";
  refs["last-badge"].className = `badge ms-1 ${lastUsed ? "text-bg-primary" : "text-bg-secondary"}`;

  if (entries.length === 0) {
    refs.list.innerHTML = `
      <div class="col-12">
        <div class="empty-state">
          <i class="bi bi-collection empty-state-icon"></i>
          <h5>No Saved Layouts</h5>
          <p class="mb-0"></p>
        </div>
      </div>
    `;
    refs.list.querySelector("p").textContent = kind.hint;
    return;
  }

  refs.list.replaceChildren(
    ...entries.map(([key, layout]) => {
      const col = document.createElement("div");
      col.className = "col-sm-6 col-lg-4";
      col.innerHTML = `
        <div class="card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <input class="form-check-input layout-checkbox" type="checkbox">
              <button class="btn btn-sm btn-outline-danger" title="Delete layout"><i class="bi bi-trash"></i></button>
            </div>
            <h6 class="mt-2 mb-1 layout-label"></h6>
            <p class="text-muted small mb-0 layout-key"></p>
          </div>
        </div>
      `;
      col.querySelector(".layout-checkbox").dataset.key = key;
      col.querySelector(".layout-label").textContent = layout.label || key;
      col.querySelector(".layout-key").textContent = `Key: ${key}`;
      col.querySelector("button").addEventListener("click", () => deleteLayoutsByKeys(kind, [key]));
      return col;
    })
  );
}

function renderLayouts() {
  LAYOUT_KINDS.forEach(renderLayoutCard);
}

async function refreshDefaultLayout() {
  await getDefaultLayout();
  renderLayouts();
  showToast("Default layout refreshed from server.", "success");
}

async function deleteLayoutsByKeys(kind, keys) {
  if (keys.length === 0) return;
  const done = await confirmAndRun(`Delete ${keys.length} layout(s)? This cannot be undone.`, () => {
    const layouts = getItem(kind.layoutsKey) || {};
    keys.forEach((k) => delete layouts[k]);
    setItem(kind.layoutsKey, layouts);
    renderLayoutCard(kind);
  });
  if (done) showToast(`Deleted ${keys.length} layout(s).`, "success");
}

async function deleteLastUsed(kind) {
  const done = await confirmAndRun("Delete the last-used layout state? This cannot be undone.", () => {
    removeItem(kind.lastKey);
    renderLayoutCard(kind);
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
    tr.innerHTML = `<td class="font-monospace"></td><td></td>`;
    tr.children[0].textContent = code;
    tr.children[1].textContent = name;
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
  buildPeopleCards();
  buildLayoutCards();

  renderPeople();
  renderStamps();
  renderLayouts();
  renderSubjects();

  document.getElementById("btn-save-new-person").addEventListener("click", addPersonFromModal);
  document.getElementById("add-person-form").addEventListener("submit", (e) => {
    e.preventDefault();
    addPersonFromModal();
  });
  document.getElementById("btn-refresh-subjects").addEventListener("click", refreshSubjectsList);
}

if (document.getElementById("people-sections")) {
  init();
}
