import { getItem, setItem, KEYS } from "../lib/storage.js";
import { loadUsers } from "../lib/users.js";
import { showToast, promptForText } from "../lib/ui.js";
import { renderNavbar } from "../lib/navbar.js";
import { generateFrontPagePdf } from "../lib/pdf-generate.js";
import { askToSaveLayout } from "../lib/layout-save-prompt.js";
import { getDefaultLayout, getStoredDefaultLayout, isLockedLayout } from "../lib/default-layout.js";


let currentLayout = null;
let selectedUserIds = [];
let defaultLayoutRef = null;

function getIframeWindow() {
  return document.getElementById("preview-frame").contentWindow;
}

let saveLastUsedTimer = null;
function saveLastUsedLayout() {
  clearTimeout(saveLastUsedTimer);
  saveLastUsedTimer = setTimeout(() => {
    setItem(KEYS.LAST_USED_LAYOUT, currentLayout);
  }, 400);
}

function updatePreview() {
  const frameWindow = getIframeWindow();
  if (frameWindow && frameWindow.applyLayout) {
    frameWindow.applyLayout(buildLayoutForUser(selectedUserIds[0]));
  }
  saveLastUsedLayout();
}

function buildLayoutForUser(userId) {
  const users = loadUsers();
  const user = users.find((u) => u.id === userId) || {};

  const rows = currentLayout.detailsSpace.rows.map((row) => {
    if (!row.linkedField) return row;
    return { ...row, value: user[row.linkedField] || "" };
  });

  return {
    ...currentLayout,
    detailsSpace: { ...currentLayout.detailsSpace, rows },
  };
}

function renderMakeForList() {
  const users = loadUsers();
  const container = document.getElementById("make-for-list");
  container.innerHTML = "";

  if (users.length === 0) {
    container.innerHTML = `<p class="text-muted mb-0">No users yet — add one in <a href="../settings/index.html">Settings</a>.</p>`;
    return;
  }

  users.forEach((user) => {
    const wrap = document.createElement("div");
    wrap.className = "form-check";
    wrap.innerHTML = `
      <input class="form-check-input make-for-checkbox" type="checkbox" value="${user.id}" id="mf-${user.id}">
      <label class="form-check-label" for="mf-${user.id}">${user.name || "(unnamed)"} | ${user.roll || ""}</label>
    `;
    container.appendChild(wrap);
  });

  container.querySelectorAll(".make-for-checkbox").forEach((cb) => {
    cb.addEventListener("change", () => {
      selectedUserIds = [...container.querySelectorAll(".make-for-checkbox:checked")].map((c) => c.value);
      updatePreview();
    });
  });
}

function renderLayoutSelect(savedLayouts, defaultLayout) {
  defaultLayoutRef = defaultLayout;
  const select = document.getElementById("layout-select");
  select.innerHTML = "";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "__default__";
  defaultOpt.textContent = defaultLayout.label || "Default";
  select.appendChild(defaultOpt);

  const lastUsed = getItem(KEYS.LAST_USED_LAYOUT);
  if (lastUsed) {
    const lastUsedOpt = document.createElement("option");
    lastUsedOpt.value = "__last_used__";
    lastUsedOpt.textContent = "Last used";
    select.appendChild(lastUsedOpt);
  }

  Object.entries(savedLayouts).forEach(([key, layout]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = layout.label || key;
    select.appendChild(opt);
  });

  select.value = lastUsed ? "__last_used__" : "__default__";

  select.addEventListener("change", () => {
    const key = select.value;
    const freshLayouts = getItem(KEYS.LAYOUTS) || {};
    const freshLastUsed = getItem(KEYS.LAST_USED_LAYOUT);

    let next = null;
    if (key === "__default__") next = defaultLayout;
    else if (key === "__last_used__") next = freshLastUsed;
    else next = freshLayouts[key];

    if (!next) {
      showToast(`Layout "${key}" not found, using the default.`, "warning");
      next = defaultLayout;
      select.value = "__default__";
    }

    currentLayout = structuredClone(next);
    syncControlsFromLayout();
    updatePreview();
  });

  syncOverwriteButtonState();
}

function syncOverwriteButtonState() {
  const selectedKey = document.getElementById("layout-select").value;
  const btn = document.getElementById("btn-overwrite-layout");
  const locked = isLockedLayout(currentLayout);
  btn.disabled = selectedKey === "__default__" || selectedKey === "__last_used__" || locked;
  document.getElementById("layout-lock-badge").classList.toggle("d-none", !locked);
}

function syncControlsFromLayout() {
  layoutSnapshot = snapshotLayout();
  document.getElementById("btn-save-layout").disabled = false;
  syncOverwriteButtonState();

  const pm = currentLayout.pageMargin;
  document.getElementById("margin-left").value = pm.left;
  document.getElementById("margin-right").value = pm.right;
  document.getElementById("margin-top").value = pm.top;
  document.getElementById("margin-bottom").value = pm.bottom;

  document.getElementById("border-thickness").value = currentLayout.pageBorder.thickness;

  document.getElementById("emblem-size").value = currentLayout.collegeEmblem.size;
  document.getElementById(
    currentLayout.collegeEmblem.textStyle === "curved" ? "emblem-curved" : "emblem-straight"
  ).checked = true;

  document.getElementById("fs-details").value = currentLayout.detailsSpace.fontSize;

  document.getElementById("session-text").value = currentLayout.academicSession.text;
  document.getElementById("fs-session").value = currentLayout.academicSession.fontSize;
  document.getElementById(
    currentLayout.academicSession.mode === "onlyYear" ? "session-only-year" : "session-show-text"
  ).checked = true;

  renderTitleLineControls();
  renderDetailRowControls();
}

function renderTitleLineControls() {
  const container = document.getElementById("title-lines");
  container.innerHTML = "";

  currentLayout.titleSpace.forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "d-flex flex-column gap-2 border rounded p-2";
    row.dataset.index = index;
    row.innerHTML = `
      <div class="d-flex gap-2 align-items-center">
        <span class="drag-handle" style="cursor:grab;"><i class="bi bi-grip-vertical"></i></span>
        <input type="text" class="form-control title-line-text" value="${line.text}">
        <button class="btn btn-sm btn-outline-danger remove-title-line"><i class="bi bi-trash"></i></button>
      </div>
      <div>
        <label class="form-label small mb-1">Font size</label>
        <input type="number" class="form-control title-line-fontsize" value="${line.fontSize}">
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-secondary toggle-bold flex-fill ${line.bold ? "active" : ""}"><i class="bi bi-type-bold"></i></button>
        <button class="btn btn-sm btn-outline-secondary toggle-italic flex-fill ${line.italic ? "active" : ""}"><i class="bi bi-type-italic"></i></button>
        <button class="btn btn-sm btn-outline-secondary toggle-underline flex-fill ${line.underline ? "active" : ""}"><i class="bi bi-type-underline"></i></button>
      </div>
    `;

    row.querySelector(".title-line-text").addEventListener("input", (e) => {
      currentLayout.titleSpace[index].text = e.target.value;
      updatePreview();
    });
    row.querySelector(".title-line-fontsize").addEventListener("input", (e) => {
      currentLayout.titleSpace[index].fontSize = parseFloat(e.target.value) || 0;
      updatePreview();
    });
    row.querySelector(".toggle-bold").addEventListener("click", (e) => {
      currentLayout.titleSpace[index].bold = !currentLayout.titleSpace[index].bold;
      e.currentTarget.classList.toggle("active");
      updatePreview();
    });
    row.querySelector(".toggle-italic").addEventListener("click", (e) => {
      currentLayout.titleSpace[index].italic = !currentLayout.titleSpace[index].italic;
      e.currentTarget.classList.toggle("active");
      updatePreview();
    });
    row.querySelector(".toggle-underline").addEventListener("click", (e) => {
      currentLayout.titleSpace[index].underline = !currentLayout.titleSpace[index].underline;
      e.currentTarget.classList.toggle("active");
      updatePreview();
    });
    row.querySelector(".remove-title-line").addEventListener("click", () => {
      currentLayout.titleSpace.splice(index, 1);
      renderTitleLineControls();
      updatePreview();
    });

    container.appendChild(row);
  });

  makeSortable("title-lines", currentLayout.titleSpace, renderTitleLineControls);
}

function renderDetailRowControls() {
  const container = document.getElementById("details-rows");
  container.innerHTML = "";
  const linkOptions = ["", "name", "roll", "reg", "dept", "course", "year", "sem"];

  currentLayout.detailsSpace.rows.forEach((row, index) => {
    const div = document.createElement("div");
    div.className = "d-flex flex-column gap-2 border rounded p-2";
    div.dataset.index = index;
    div.innerHTML = `
      <div class="d-flex gap-2 align-items-center">
        <span class="drag-handle" style="cursor:grab;"><i class="bi bi-grip-vertical"></i></span>
        <input type="text" class="form-control detail-label" placeholder="Label" value="${row.label}">
        <button class="btn btn-sm btn-outline-danger remove-detail-row"><i class="bi bi-trash"></i></button>
      </div>
      <div>
        <label class="form-label small mb-1">Link to</label>
        <select class="form-select detail-linked-field">
          ${linkOptions.map((f) => `<option value="${f}">${f ? f : "Manual"}</option>`).join("")}
        </select>
      </div>
      <div>
        <label class="form-label small mb-1">Value</label>
        <input type="text" class="form-control detail-value" placeholder="Value" value="${row.value || ""}">
      </div>
    `;

    const linkedSelect = div.querySelector(".detail-linked-field");
    linkedSelect.value = row.linkedField || "";

    const valueInput = div.querySelector(".detail-value");
    valueInput.disabled = Boolean(row.linkedField);

    div.querySelector(".detail-label").addEventListener("input", (e) => {
      currentLayout.detailsSpace.rows[index].label = e.target.value;
      updatePreview();
    });

    linkedSelect.addEventListener("change", (e) => {
      currentLayout.detailsSpace.rows[index].linkedField = e.target.value || null;
      valueInput.disabled = Boolean(e.target.value);
      updatePreview();
    });

    valueInput.addEventListener("input", (e) => {
      currentLayout.detailsSpace.rows[index].value = e.target.value;
      updatePreview();
    });

    div.querySelector(".remove-detail-row").addEventListener("click", () => {
      currentLayout.detailsSpace.rows.splice(index, 1);
      renderDetailRowControls();
      updatePreview();
    });

    container.appendChild(div);
  });

  makeSortable("details-rows", currentLayout.detailsSpace.rows, renderDetailRowControls);
}

function makeSortable(containerId, arrayRef, rerenderFn) {
  const container = document.getElementById(containerId);
  if (container._sortableInstance) container._sortableInstance.destroy();

  container._sortableInstance = new Sortable(container, {
    handle: ".drag-handle",
    animation: 150,
    onEnd: () => {
      const newOrder = [...container.children].map((el) => Number(el.dataset.index));
      const reordered = newOrder.map((i) => arrayRef[i]);
      arrayRef.length = 0;
      arrayRef.push(...reordered);
      rerenderFn();
      updatePreview();
    },
  });
}

function bindGlobalControls() {
  document.getElementById("margin-left").addEventListener("input", (e) => {
    currentLayout.pageMargin.left = parseFloat(e.target.value) || 0;
    updatePreview();
  });
  document.getElementById("margin-right").addEventListener("input", (e) => {
    currentLayout.pageMargin.right = parseFloat(e.target.value) || 0;
    updatePreview();
  });
  document.getElementById("margin-top").addEventListener("input", (e) => {
    currentLayout.pageMargin.top = parseFloat(e.target.value) || 0;
    updatePreview();
  });
  document.getElementById("margin-bottom").addEventListener("input", (e) => {
    currentLayout.pageMargin.bottom = parseFloat(e.target.value) || 0;
    updatePreview();
  });

  document.getElementById("border-thickness").addEventListener("input", (e) => {
    currentLayout.pageBorder.thickness = parseFloat(e.target.value) || 0;
    updatePreview();
  });

  document.getElementById("emblem-size").addEventListener("input", (e) => {
    currentLayout.collegeEmblem.size = parseFloat(e.target.value) || 0;
    updatePreview();
  });
  document.querySelectorAll('input[name="emblem-style"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      currentLayout.collegeEmblem.textStyle = e.target.value;
      updatePreview();
    });
  });

  document.getElementById("fs-details").addEventListener("input", (e) => {
    currentLayout.detailsSpace.fontSize = parseFloat(e.target.value) || 0;
    updatePreview();
  });

  document.getElementById("session-text").addEventListener("input", (e) => {
    currentLayout.academicSession.text = e.target.value;
    updatePreview();
  });
  document.getElementById("fs-session").addEventListener("input", (e) => {
    currentLayout.academicSession.fontSize = parseFloat(e.target.value) || 0;
    updatePreview();
  });
  document.querySelectorAll('input[name="session-mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      currentLayout.academicSession.mode = e.target.value;
      updatePreview();
    });
  });

  document.getElementById("btn-add-title-line").addEventListener("click", () => {
    currentLayout.titleSpace.push({ text: "", bold: false, italic: false, underline: false, fontSize: 5 });
    renderTitleLineControls();
    updatePreview();
  });

  document.getElementById("btn-add-detail-row").addEventListener("click", () => {
    currentLayout.detailsSpace.rows.push({ label: "", value: "", linkedField: null });
    renderDetailRowControls();
    updatePreview();
  });

  document.getElementById("btn-save-pdf").addEventListener("click", exportCurrentAsPdf);

  document.getElementById("btn-save-layout").addEventListener("click", saveLayoutAsNew);
  document.getElementById("btn-overwrite-layout").addEventListener("click", overwriteCurrentLayout);
}

// Before exporting: if the layout changed since it was loaded, saved or last
// asked about, offer to save it. Resolves false when cancelled.
let layoutSnapshot = null;

function snapshotLayout() {
  return JSON.stringify(currentLayout);
}

async function offerToSaveLayout() {
  if (snapshotLayout() === layoutSnapshot) return true;

  const key = document.getElementById("layout-select").value;
  const layouts = getItem(KEYS.LAYOUTS) || {};
  const selected = layouts[key];
  const canOverwrite = Boolean(selected) && !isLockedLayout(currentLayout);

  const choice = await askToSaveLayout({ canOverwrite, overwriteLabel: selected?.label });
  if (!choice) return false;

  if (choice.action === "new") {
    currentLayout.locked = false;
    currentLayout.label = choice.name;
    const newKey = "layout-" + Date.now();
    layouts[newKey] = structuredClone(currentLayout);
    setItem(KEYS.LAYOUTS, layouts);
    renderLayoutSelect(layouts, defaultLayoutRef);
    document.getElementById("layout-select").value = newKey;
    syncControlsFromLayout();
    showToast("Saved as new layout.", "success");
  } else if (choice.action === "overwrite") {
    layouts[key] = structuredClone(currentLayout);
    setItem(KEYS.LAYOUTS, layouts);
    showToast("Layout overwritten.", "success");
  }

  layoutSnapshot = snapshotLayout();
  return true;
}

async function saveLayoutAsNew() {
  const name = await promptForText("Enter a name for this layout:");
  if (!name || !name.trim()) return;

  const layouts = getItem(KEYS.LAYOUTS) || {};
  const newKey = "layout-" + Date.now();

  // Update currentLayout itself first — not just a throwaway clone
  currentLayout.locked = false;
  currentLayout.label = name.trim();

  layouts[newKey] = structuredClone(currentLayout);
  setItem(KEYS.LAYOUTS, layouts);

  renderLayoutSelect(layouts, defaultLayoutRef);
  document.getElementById("layout-select").value = newKey;
  syncControlsFromLayout();
  showToast("Saved as new layout.", "success");
}

async function overwriteCurrentLayout() {
  const selectedKey = document.getElementById("layout-select").value;

  if (selectedKey === "__default__" || selectedKey === "__last_used__" || isLockedLayout(currentLayout)) {
    showToast("This layout cannot be overwritten.", "warning");
    return;
  }

  const layouts = getItem(KEYS.LAYOUTS) || {};
  layouts[selectedKey] = structuredClone(currentLayout);
  setItem(KEYS.LAYOUTS, layouts);
  layoutSnapshot = snapshotLayout();
  showToast("Layout overwritten.", "success");
}

async function exportCurrentAsPdf() {
  if (!(await offerToSaveLayout())) return;

  const users = loadUsers();
  const idsToExport = selectedUserIds.length > 0 ? selectedUserIds : [null];

  showToast("Generating PDF(s)...", "info");

  for (let index = 0; index < idsToExport.length; index++) {
    const userId = idsToExport[index];
    const user = userId ? users.find((u) => u.id === userId) : null;
    try {
      document.title = buildExportFilename(user, index);
      await generateFrontPagePdf(currentLayout, user, "./front-page/front-page.html");
      await sleep(300);
    } catch (err) {
      showToast(`Failed to generate PDF${user ? ` for ${user.name}` : ""}.`, "danger");
    }
  }

  showToast(`Generated ${idsToExport.length} PDF(s).`, "success");
}

export function buildExportFilename(user, index) {
  const namePart = (user?.name || "unnamed").trim().replace(/\s+/g, "_");
  const rollPart = user?.roll || "no-roll";
  const timestamp = Date.now();
  return `${index + 1}_${namePart}_${rollPart}_${timestamp}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function init() {
  renderNavbar("../", "generator");

  let defaultLayout;
  try {
    defaultLayout = await getDefaultLayout();
  } catch (err) {
    showToast("Could not load the default layout from the server. Using the stored one.", "warning");
    defaultLayout = getStoredDefaultLayout();
  }

  const savedLayouts = getItem(KEYS.LAYOUTS) || {};
  const lastUsed = getItem(KEYS.LAST_USED_LAYOUT);

  renderMakeForList();
  renderLayoutSelect(savedLayouts, defaultLayout);

  currentLayout = lastUsed ? structuredClone(lastUsed) : structuredClone(defaultLayout);
  syncControlsFromLayout();
  bindGlobalControls();

  waitForIframeReadyThenRender();
}

function waitForIframeReadyThenRender(attempt = 0) {
  const frameWindow = getIframeWindow();

  if (frameWindow && frameWindow.applyLayout) {
    updatePreview();
    return;
  }

  if (attempt > 50) {
    showToast("The preview could not be loaded. Try refreshing the page.", "danger");
    return;
  }

  setTimeout(() => waitForIframeReadyThenRender(attempt + 1), 100);
}

if (document.getElementById("preview-frame")) {
  init();
}