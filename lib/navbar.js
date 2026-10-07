import { loadSubjects } from "./subjects.js";
import { showToast } from "./ui.js";

const MAX_SUBJECT_RESULTS = 60;
const SEARCH_DEBOUNCE_MS = 150;

export function renderNavbar(basePath = "", current = "") {
  const root = document.getElementById("navbar-root");
  if (!root) return;

  root.innerHTML = `
    <header class="topbar">
      <div class="container-fluid d-flex align-items-center justify-content-between gap-2 py-2">
        <a class="navbar-brand fw-bold mb-0" href="${basePath}index.html">
          <span class="brand-badge"><i class="bi bi-journal-richtext"></i></span> KGEC Pages
        </a>
        <div class="d-flex align-items-center gap-2">
          <div class="topbar-meta" id="topbar-meta"></div>
        </div>
      </div>
    </header>

    <nav class="bottom-nav" aria-label="Primary">
      <div class="bottom-nav-inner">
        <a class="bottom-nav-link" data-page="generator" href="${basePath}front-page-generator/index.html">
          <i class="bi bi-file-earmark-plus"></i><span>Generate</span>
        </a>
        <a class="bottom-nav-link" data-page="multimerge" href="${basePath}multimerge/index.html">
          <i class="bi bi-files"></i><span>Merge</span>
        </a>
        <a class="bottom-nav-link" data-page="topsheet" href="${basePath}topsheet/index.html">
          <i class="bi bi-clipboard-data"></i><span>Topsheet</span>
        </a>
        <button type="button" class="bottom-nav-link" data-bs-toggle="modal" data-bs-target="#subjectsModal" aria-label="Search subjects">
          <i class="bi bi-journal-text"></i><span>Subjects</span>
        </button>
        <div class="dropup bottom-nav-more">
          <button type="button" class="bottom-nav-link w-100" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More pages">
            <i class="bi bi-three-dots"></i><span>More</span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end bottom-nav-menu">
            <li><a class="dropdown-item" data-page="readymade" href="${basePath}readymade/index.html"><i class="bi bi-download"></i> Readymade</a></li>
            <li><a class="dropdown-item" data-page="signature" href="${basePath}signature/index.html"><i class="bi bi-pen"></i> Signature</a></li>
            <li><a class="dropdown-item" data-page="settings" href="${basePath}settings/index.html"><i class="bi bi-gear"></i> Settings</a></li>
          </ul>
        </div>
      </div>
    </nav>

    <div class="modal fade" id="subjectsModal" tabindex="-1" aria-labelledby="subjectsModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="subjectsModalLabel"><i class="bi bi-journal-text"></i> Subjects</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <input type="text" id="nav-subjects-search" class="form-control mb-2"
              placeholder="Search by code or name...">
            <div id="nav-subjects-list" class="d-flex flex-column gap-1 custom-scroll subjects-list"></div>
            <div id="nav-subjects-meta" class="text-muted small mt-2 mb-0"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (current) {
    const activeLink = root.querySelector(`.bottom-nav-link[data-page="${current}"]`);
    if (activeLink) {
      activeLink.classList.add("active");
      activeLink.setAttribute("aria-current", "page");
    }

    const activeMenuItem = root.querySelector(`.dropdown-item[data-page="${current}"]`);
    if (activeMenuItem) {
      activeMenuItem.classList.add("active");
      activeMenuItem.setAttribute("aria-current", "page");
      root.querySelector(".bottom-nav-more > .bottom-nav-link").classList.add("active");
    }
  }

  const subjectsModal = document.getElementById("subjectsModal");
  subjectsModal.addEventListener("shown.bs.modal", () => {
    document.getElementById("nav-subjects-search").focus();
  });

  initSubjects(basePath);
  initVersionMeta(basePath);
}

async function initVersionMeta(basePath) {
  const container = document.getElementById("topbar-meta");
  if (!container) return;

  try {
    const res = await fetch(`${basePath}assets/config/version.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await res.json();

    container.innerHTML = `
      <a class="topbar-chip" href="${escapeHtml(info.repoUrl || "#")}" target="_blank" rel="noopener" title="View source on GitHub">
        <i class="bi bi-github"></i><span class="topbar-chip-label">Repo</span>
      </a>
      <span class="topbar-chip topbar-chip-primary" title="Deployed on ${escapeHtml(info.updatedDate || "N/A")}">
        <span>${escapeHtml(info.version || "v0.0.0")}</span>
      </span>
    `;
  } catch (err) {
    console.error("Failed to load version metadata:", err);
    container.innerHTML = "";
  }
}

async function initSubjects(basePath) {
  const searchInput = document.getElementById("nav-subjects-search");
  const listContainer = document.getElementById("nav-subjects-list");

  listContainer.innerHTML = `<p class="text-muted small mb-0">Loading subjects…</p>`;

  let subjects;
  try {
    subjects = await loadSubjects(`${basePath}data/subjects.json`);
  } catch (err) {
    console.error("Failed to load subjects:", err);
    listContainer.innerHTML = `<p class="text-danger small mb-0">Couldn't load subjects. Try refreshing the page.</p>`;
    return;
  }

  renderNavSubjectsList(subjects);

  // Rows are rebuilt on every keystroke, so clicks are delegated to one
  // listener instead of rebinding per-row handlers on a list this size.
  listContainer.addEventListener("click", (e) => {
    const codeBtn = e.target.closest(".copy-code");
    if (codeBtn) {
      navigator.clipboard.writeText(codeBtn.dataset.code);
      showToast(`Copied code: ${codeBtn.dataset.code}`, "success");
      return;
    }
    const nameBtn = e.target.closest(".copy-name");
    if (nameBtn) {
      navigator.clipboard.writeText(nameBtn.dataset.name);
      showToast(`Copied name: ${nameBtn.dataset.name}`, "success");
    }
  });

  let debounceTimer = null;
  searchInput.addEventListener("input", (e) => {
    const value = e.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderNavSubjectsList(subjects, value), SEARCH_DEBOUNCE_MS);
  });
}

function renderNavSubjectsList(subjects, filterText = "") {
  const container = document.getElementById("nav-subjects-list");
  const meta = document.getElementById("nav-subjects-meta");
  const query = normalizeForSearch(filterText);

  const filtered = Object.entries(subjects).filter(([code, name]) =>
    normalizeForSearch(code + " " + name).includes(query)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-muted small mb-0">No subjects found.</p>`;
    meta.textContent = "";
    return;
  }

  const shown = filtered.slice(0, MAX_SUBJECT_RESULTS);

  container.innerHTML = shown
    .map(
      ([code, name]) => `
        <div class="d-flex gap-1 subject-row">
          <button type="button" class="btn btn-sm copy-code btn-subject-code" data-code="${escapeHtml(code)}" style="flex: 0 0 40%;">${escapeHtml(code)}</button>
          <button type="button" class="btn btn-sm copy-name btn-subject-name text-start" data-name="${escapeHtml(name)}" style="flex: 1;">${escapeHtml(name)}</button>
        </div>
      `
    )
    .join("");

  meta.textContent =
    filtered.length > shown.length
      ? `Showing ${shown.length} of ${filtered.length} matches — keep typing to narrow down.`
      : `${filtered.length} subject${filtered.length === 1 ? "" : "s"}`;
}

function normalizeForSearch(str) {
  return str.trim().toLowerCase().replace(/[\s-]+/g, "");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
