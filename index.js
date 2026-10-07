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

const AUTOPLAY_MS = 3500;
const VISIBLE_RANGE = 2;

let credits = [];
let active = 0;
let timer = null;

async function loadCredits() {
  const stage = document.getElementById("credits-stage");
  if (!stage) return;

  try {
    const res = await fetch("assets/config/credits.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    credits = data.cards || [];
    if (credits.length === 0) return;

    stage.innerHTML = credits
      .map(
        (c, i) => `
          <article class="credit-card" data-index="${i}">
            <span class="feature-icon icon-${escapeHtml(c.tone || "green")}"><i class="bi ${escapeHtml(c.icon || "bi-star-fill")}"></i></span>
            <span class="credit-label">${escapeHtml(c.label || "")}</span>
            <h3 class="credit-name">${escapeHtml(c.name || "")}</h3>
            <p class="credit-desc">${escapeHtml(c.description || "")}</p>
          </article>
        `
      )
      .join("");

    stage.querySelectorAll(".credit-card").forEach((card) => {
      card.addEventListener("click", () => goTo(Number(card.dataset.index)));
    });
    document.getElementById("credits-prev").addEventListener("click", () => goTo(active - 1));
    document.getElementById("credits-next").addEventListener("click", () => goTo(active + 1));
    stage.addEventListener("mouseenter", stopAutoplay);
    stage.addEventListener("mouseleave", startAutoplay);

    layoutCredits();
    startAutoplay();
  } catch (err) {
    console.error("Failed to load credits:", err);
    document.querySelector(".credits")?.remove();
  }
}

function goTo(index) {
  active = (index + credits.length) % credits.length;
  layoutCredits();
  startAutoplay();
}

// Shortest signed distance from the active card, so the stack wraps around endlessly.
function offsetFor(index) {
  const n = credits.length;
  let d = (index - active) % n;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

function layoutCredits() {
  document.querySelectorAll(".credit-card").forEach((card, i) => {
    const d = offsetFor(i);
    const dist = Math.abs(d);
    const hidden = dist > VISIBLE_RANGE;

    card.style.transform = `translateX(calc(-50% + ${d * 34}%)) scale(${1 - dist * 0.14})`;
    card.style.opacity = hidden ? 0 : 1 - dist * 0.35;
    card.style.zIndex = 10 - dist;
    card.style.pointerEvents = hidden ? "none" : "";
    card.classList.toggle("is-active", d === 0);
    card.setAttribute("aria-hidden", d === 0 ? "false" : "true");
  });
}

function startAutoplay() {
  stopAutoplay();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  timer = setInterval(() => goTo(active + 1), AUTOPLAY_MS);
}

function stopAutoplay() {
  clearInterval(timer);
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
loadCredits();