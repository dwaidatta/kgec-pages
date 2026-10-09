import { renderNavbar } from "../lib/navbar.js";
import { showToast, showLoadingToast, confirmAndRun } from "../lib/ui.js";
import { buildMergedFilename, mergeGroupFiles, renderFirstPageThumbnail } from "../lib/pdf-merge.js";

let groups = [];
let pendingFileTargetGroupId = null;
const sortables = new Map();

function generateId() {
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render() {
  const container = document.getElementById("groups-list");
  const emptyState = document.getElementById("empty-state");

  sortables.forEach((instance) => instance.destroy());
  sortables.clear();

  if (groups.length === 0) {
    container.innerHTML = "";
    emptyState.classList.remove("d-none");
  } else {
    emptyState.classList.add("d-none");
    container.innerHTML = groups.map(renderGroup).join("");
    groups.forEach(initSortableForGroup);
  }

  updateToolbarState();
}

function renderFileThumb(f) {
  if (f.thumbnail === "error") {
    return `<i class="bi bi-file-earmark-pdf merge-file-thumb-fallback"></i>`;
  }
  if (f.thumbnail) {
    return `<img src="${f.thumbnail}" alt="" class="merge-file-thumb-img">`;
  }
  return `<div class="spinner-border spinner-border-sm text-secondary" role="status"><span class="visually-hidden">Loading preview</span></div>`;
}

function renderGroup(group) {
  const fileTiles = group.files.map((f) => `
    <div class="merge-file-tile" data-file-id="${f.id}" title="${escapeHtml(f.name)}">
      <button type="button" class="merge-file-remove" data-action="remove-file" aria-label="Remove file">
        <i class="bi bi-x-circle-fill"></i>
      </button>
      <div class="merge-file-thumb">${renderFileThumb(f)}</div>
      <div class="merge-file-name">${escapeHtml(f.name)}</div>
      <div class="merge-file-handle"><i class="bi bi-grip-horizontal"></i></div>
    </div>
  `).join("");

  return `
    <div class="card merge-group" data-group-id="${group.id}">
      <div class="card-header d-flex align-items-center gap-2">
        <input type="checkbox" class="form-check-input flex-shrink-0 group-checkbox" ${group.selected ? "checked" : ""}>
        <input type="text" class="form-control form-control-sm merge-group-label-input" placeholder="Untitled group" value="${escapeHtml(group.label)}">
      </div>
      <div class="card-body">
        <div class="merge-file-list d-flex flex-wrap gap-2">
          ${fileTiles}
          <button type="button" class="merge-file-add-tile" data-action="add-file" aria-label="Add PDF(s)">
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function initSortableForGroup(group) {
  const list = document.querySelector(`.merge-group[data-group-id="${group.id}"] .merge-file-list`);
  if (!list) return;

  const instance = Sortable.create(list, {
    animation: 150,
    filter: ".merge-file-add-tile",
    preventOnFilter: false,
    handle: ".merge-file-handle",
    onEnd: () => {
      const orderedIds = [...list.querySelectorAll(".merge-file-tile")].map((el) => el.dataset.fileId);
      group.files.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
      render();
    },
  });

  sortables.set(group.id, instance);
}

function updateToolbarState() {
  const selectedCount = groups.filter((g) => g.selected).length;

  document.getElementById("btn-delete-groups").disabled = selectedCount === 0;
  document.getElementById("btn-merge-save").disabled = selectedCount === 0;

  const selectAll = document.getElementById("select-all-groups");
  selectAll.checked = groups.length > 0 && selectedCount === groups.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < groups.length;
}

function focusNewestLabel() {
  const inputs = document.querySelectorAll(".merge-group-label-input");
  const last = inputs[inputs.length - 1];
  if (last) last.focus();
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleMergeAndSave() {
  const selectedGroups = groups.filter((g) => g.selected);
  if (selectedGroups.length === 0) return;

  const withFiles = selectedGroups.filter((g) => g.files.length > 0);
  const emptyCount = selectedGroups.length - withFiles.length;

  if (withFiles.length === 0) {
    showToast("Selected group(s) have no PDFs to merge.", "warning");
    return;
  }

  const loading = showLoadingToast(`Merging ${withFiles.length} group(s). Please wait...`);

  let successCount = 0;
  for (const [i, group] of withFiles.entries()) {
    loading.update(`Merging group ${i + 1} of ${withFiles.length}. Please wait...`);
    try {
      const mergedBytes = await mergeGroupFiles(window.PDFLib, group.files);
      const filename = buildMergedFilename(group.label, group.files);
      downloadBytes(mergedBytes, filename);
      successCount++;
      await sleep(300);
    } catch (err) {
      showToast(`Failed to merge "${group.label || "Untitled group"}". Make sure every file is a valid PDF.`, "danger");
    }
  }

  loading.close();

  if (emptyCount > 0) {
    showToast(`Skipped ${emptyCount} selected group(s) with no PDFs.`, "warning");
  }
  if (successCount > 0) {
    showToast(`Merged and downloaded ${successCount} PDF(s).`, "success");
  }
}

function wireEvents() {
  document.getElementById("btn-add-group").addEventListener("click", () => {
    groups.push({ id: generateId(), label: "", selected: false, files: [] });
    render();
    focusNewestLabel();
  });

  document.getElementById("btn-delete-groups").addEventListener("click", async () => {
    const selected = groups.filter((g) => g.selected);
    if (selected.length === 0) return;

    await confirmAndRun(
      `Delete ${selected.length} selected group${selected.length > 1 ? "s" : ""}? This can't be undone.`,
      () => {
        groups = groups.filter((g) => !g.selected);
        render();
      }
    );
  });

  document.getElementById("btn-merge-save").addEventListener("click", handleMergeAndSave);

  document.getElementById("select-all-groups").addEventListener("change", (e) => {
    groups.forEach((g) => (g.selected = e.target.checked));
    document.querySelectorAll(".group-checkbox").forEach((cb) => (cb.checked = e.target.checked));
    updateToolbarState();
  });

  const groupsList = document.getElementById("groups-list");

  groupsList.addEventListener("change", (e) => {
    const checkbox = e.target.closest(".group-checkbox");
    if (!checkbox) return;

    const groupEl = checkbox.closest(".merge-group");
    const group = groups.find((g) => g.id === groupEl.dataset.groupId);
    if (group) group.selected = checkbox.checked;
    updateToolbarState();
  });

  groupsList.addEventListener("input", (e) => {
    const input = e.target.closest(".merge-group-label-input");
    if (!input) return;

    const groupEl = input.closest(".merge-group");
    const group = groups.find((g) => g.id === groupEl.dataset.groupId);
    if (group) group.label = input.value;
  });

  groupsList.addEventListener("click", (e) => {
    const removeBtn = e.target.closest('[data-action="remove-file"]');
    if (removeBtn) {
      const tile = removeBtn.closest(".merge-file-tile");
      const groupEl = removeBtn.closest(".merge-group");
      const group = groups.find((g) => g.id === groupEl.dataset.groupId);
      if (group) group.files = group.files.filter((f) => f.id !== tile.dataset.fileId);
      render();
      return;
    }

    const addBtn = e.target.closest('[data-action="add-file"]');
    if (addBtn) {
      const groupEl = addBtn.closest(".merge-group");
      pendingFileTargetGroupId = groupEl.dataset.groupId;
      document.getElementById("file-input").click();
    }
  });

  document.getElementById("file-input").addEventListener("change", (e) => {
    const files = [...e.target.files];
    e.target.value = "";

    if (!pendingFileTargetGroupId || files.length === 0) return;

    const group = groups.find((g) => g.id === pendingFileTargetGroupId);
    pendingFileTargetGroupId = null;
    if (!group) return;

    const newFiles = files.map((file) => ({ id: generateId(), name: file.name, blob: file, thumbnail: null }));
    group.files.push(...newFiles);
    render();
    newFiles.forEach(loadThumbnail);
  });
}

async function loadThumbnail(fileEntry) {
  try {
    fileEntry.thumbnail = await renderFirstPageThumbnail(pdfjsLib, fileEntry.blob);
  } catch (err) {
    showToast(`Could not render a preview for "${fileEntry.name}".`, "warning");
    fileEntry.thumbnail = "error";
  }
  render();
}

function init() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  renderNavbar("../", "multimerge");
  wireEvents();
  render();
}

if (document.getElementById("groups-list")) {
  init();
}
