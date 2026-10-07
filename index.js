import { getItem,KEYS } from "./lib/storage.js";
import { renderNavbar } from "./lib/navbar.js";
renderNavbar("");

function init() {
  const profile = getItem(KEYS.PROFILE);
  console.log("Landing page loaded. Profile exists:", Boolean(profile));
}

async function initHomeMeta() {
  const container = document.getElementById("home-meta");
  if (!container) return;

  try {
    const res = await fetch("assets/config/version.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await res.json();

    container.innerHTML = `
      <a class="topbar-chip" href="${escapeHtml(info.repoUrl || "#")}" target="_blank" rel="noopener" title="View source on GitHub">
        <i class="bi bi-github"></i><span>Repo</span>
      </a>
      <span class="topbar-chip topbar-chip-primary" title="Version">
        <span>${escapeHtml(info.version || "v0.0.0")}</span>
      </span>
      <span class="topbar-chip" title="Last deployed commit">
        <i class="bi bi-git"></i><span>${escapeHtml(info.commitHash || "------")}</span>
      </span>
      <span class="topbar-chip" title="Last updated">
        <i class="bi bi-clock-history"></i><span>${escapeHtml(info.updatedDate || "N/A")}</span>
      </span>
    `;
  } catch (err) {
    console.error("Failed to load version metadata:", err);
    container.innerHTML = "";
  }
}

const REPO = "dwaidatta/kgec-pages";

loadAndRender();

async function loadAndRender() {
  const container = document.getElementById("contributors-container");
  renderState(container, "loading");

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=100`);
    if (!res.ok) throw new Error(`GitHub API responded with ${res.status}`);

    const contributors = (await res.json()).filter((c) => c.type === "User");
    if (contributors.length === 0) {
      renderState(container, "empty");
      return;
    }
    renderContributors(container, contributors);
  } catch (err) {
    console.error("Failed to load contributors:", err);
    renderState(container, "error");
  }
}

function renderContributors(container, contributors) {
  container.innerHTML = contributors
    .map(
      (c) => `
        <div class="col">
          <a class="contributor-card" href="${escapeHtml(c.html_url)}" target="_blank" rel="noopener">
            <img src="${escapeHtml(c.avatar_url)}" alt="${escapeHtml(c.login)}" class="contributor-avatar" loading="lazy">
            <div class="contributor-name">${escapeHtml(c.login)}</div>
          </a>
        </div>
      `
    )
    .join("");
}

function renderState(container, state) {
  const states = {
    loading: `
      <div class="col-12 text-center text-muted py-5">
        <div class="spinner-border text-primary mb-2" role="status"><span class="visually-hidden">Loading…</span></div>
        <p class="mb-0">Loading contributors…</p>
      </div>
    `,
    error: `
      <div class="col-12">
        <div class="empty-state">
          <i class="bi bi-exclamation-triangle empty-state-icon"></i>
          <h5>Couldn't load contributors</h5>
          <p class="mb-3">GitHub's API might be rate-limiting or unreachable right now.</p>
          <button type="button" class="btn btn-primary" id="retry-contributors">Try again</button>
        </div>
      </div>
    `,
    empty: `
      <div class="col-12">
        <div class="empty-state">
          <i class="bi bi-people empty-state-icon"></i>
          <h5>No contributors found</h5>
        </div>
      </div>
    `,
  };

  container.innerHTML = states[state] || "";

  if (state === "error") {
    document.getElementById("retry-contributors").addEventListener("click", loadAndRender);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

init();
initHomeMeta();
loadAndRender();