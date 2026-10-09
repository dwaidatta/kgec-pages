/**
 * Topsheet Maker: student flow.
 * Upload the PDF the teacher gave, place text and signatures on it, download it.
 * Fully client-side (pdf.js to show pages, pdf-lib to write the result).
 */

import { showToast } from "../../lib/ui.js";
import { preloadSignatureEngine } from "../../lib/signature-extract.js";
import { openSignaturePicker } from "../../lib/signature-picker.js";
import { listSavedSignatures, listUnlinkedSignatures, saveSignature, removeSavedSignature } from "../../lib/saved-signatures.js";
import { loadUsers, USER_FIELDS } from "../../lib/users.js";
import { linkBadge, populateStudentSelect } from "../../lib/student-link.js";

const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

const RENDER_SCALE = 2; // canvas pixels per PDF point
const MAX_PAGE_CSS_WIDTH = 820;
const DEFAULT_FONT_SIZE = 12; // PDF points
const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 72;
const DEFAULT_SIG_WIDTH = 0.25; // fraction of page width
const MIN_SIG_WIDTH = 0.04;

// Helvetica's baseline sits this far below the top of a line-height:1 box.
const BASELINE_RATIO = 0.8465;

const $ = (id) => document.getElementById(id);

const st = {
  fileName: "",
  pdfBytes: null,

  /** @type {Array<{w:number,h:number,ox:number,oy:number,el:HTMLElement}>} */
  pages: [],

  /** @type {Array<{id:string,page:number,kind:'text'|'sig',x:number,y:number,
   *   text?:string,fontSize?:number,w?:number,aspect?:number,dataUrl?:string,
   *   el:HTMLElement}>} */
  items: [],

  selectedId: null,

  /** What the next click on a page will place:
   *  {kind:'text', text?, field?} or {kind:'sig', sig}. */
  pending: null,

  /** Saved student whose details and signatures are offered ("" = none). */
  studentId: "",

  /** Signatures made this session but not saved on the device. */
  sessionSigs: [],

  nextId: 1,
  engineLoading: false,
};

// Helpers

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function findItem(id) {
  return st.items.find((i) => i.id === id);
}

function startDrag(e, el, onMove) {
  e.preventDefault();

  el.setPointerCapture(e.pointerId);

  const sx = e.clientX;
  const sy = e.clientY;

  const move = (ev) => onMove(ev.clientX - sx, ev.clientY - sy);

  const up = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };

  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}

// Pending placement

function setPending(pending) {
  st.pending = pending;

  st.pages.forEach((p) => p.el.classList.toggle("placing", !!pending));

  $("st-add-text").classList.toggle("active", pending?.kind === "text" && !pending.field);

  const hint = $("st-hint");

  if (pending) {
    hint.textContent = pending.field
      ? `Click on the page to place the ${pending.field.toLowerCase()}.`
      : pending.kind === "text"
        ? "Click on the page to place the text."
        : "Click on the page to place the signature.";
  }

  hint.style.display = pending ? "" : "none";

  renderSigList();
  renderStudentFields();
}

// Selection + sidebar controls

function select(id) {
  st.selectedId = id;

  st.items.forEach((i) => i.el.classList.toggle("selected", i.id === id));

  updateItemCard();
}

function updateItemCard() {
  const item = findItem(st.selectedId);

  $("st-item-card").style.display = item ? "" : "none";

  if (!item) return;

  if (item.kind === "text") {
    $("st-size-label").textContent = "Font size";
    $("st-size-value").textContent = `${item.fontSize} pt`;
  } else {
    $("st-size-label").textContent = "Size";
    $("st-size-value").textContent = `${Math.round(item.w * 100)}%`;
  }
}

function resizeSelected(direction) {
  const item = findItem(st.selectedId);

  if (!item) return;

  if (item.kind === "text") {
    item.fontSize = clamp(item.fontSize + direction, MIN_FONT_SIZE, MAX_FONT_SIZE);

    applyTextSize(item);
  } else {
    item.w = clamp(item.w * (direction > 0 ? 1.1 : 1 / 1.1), MIN_SIG_WIDTH, 1 - item.x);

    item.el.style.width = `${item.w * 100}%`;
  }

  updateItemCard();
}

function removeItem(id) {
  const idx = st.items.findIndex((i) => i.id === id);

  if (idx < 0) return;

  st.items[idx].el.remove();

  st.items.splice(idx, 1);

  if (st.selectedId === id) select(null);

  updateDownloadState();
}

// Item elements

function applyTextSize(item) {
  item.el.style.fontSize = `calc(var(--st-k) * ${item.fontSize}px)`;
}

function positionItem(item) {
  item.el.style.left = `${item.x * 100}%`;
  item.el.style.top = `${item.y * 100}%`;
}

function addTextItem(pageIdx, x, y, text = "Text") {
  const item = {
    id: `i${st.nextId++}`,
    page: pageIdx,
    kind: "text",
    x: clamp(x, 0, 0.95),
    y: clamp(y, 0, 0.98),
    text,
    fontSize: DEFAULT_FONT_SIZE,
  };

  const el = document.createElement("div");

  el.className = "st-item st-text";

  el.innerHTML =
    '<span class="st-grip" title="Drag to move"><i class="bi bi-arrows-move"></i></span>' +
    '<span class="st-edit" contenteditable="true" spellcheck="false"></span>';

  const edit = el.querySelector(".st-edit");

  edit.textContent = item.text;

  item.el = el;

  applyTextSize(item);
  positionItem(item);

  st.pages[pageIdx].el.appendChild(el);
  st.items.push(item);

  edit.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      edit.blur();
    }
  });

  edit.addEventListener("input", () => {
    item.text = edit.textContent;
    updateDownloadState();
  });

  edit.addEventListener("focus", () => select(item.id));

  edit.addEventListener("blur", () => {
    if (!edit.textContent.trim()) removeItem(item.id);
  });

  el.addEventListener("pointerdown", () => select(item.id));

  el.querySelector(".st-grip").addEventListener("pointerdown", (e) => {
    select(item.id);

    const start = { x: item.x, y: item.y };

    const rect = st.pages[pageIdx].el.getBoundingClientRect();

    startDrag(e, e.currentTarget, (dx, dy) => {
      item.x = clamp(start.x + dx / rect.width, 0, 0.98);
      item.y = clamp(start.y + dy / rect.height, 0, 0.98);

      positionItem(item);
    });
  });

  select(item.id);

  edit.focus();

  const range = document.createRange();

  range.selectNodeContents(edit);

  const sel = window.getSelection();

  sel.removeAllRanges();
  sel.addRange(range);

  updateDownloadState();
}

function addSigItem(pageIdx, cx, cy, sig) {
  const img = new Image();

  img.onload = () => {
    const page = st.pages[pageIdx];

    const w = DEFAULT_SIG_WIDTH;

    // height as a fraction of page height
    const hFrac = (w * page.w * (img.naturalHeight / img.naturalWidth)) / page.h;

    const item = {
      id: `i${st.nextId++}`,
      page: pageIdx,
      kind: "sig",
      x: clamp(cx - w / 2, 0, 1 - w),
      y: clamp(cy - hFrac / 2, 0, 1 - hFrac),
      w,
      aspect: img.naturalHeight / img.naturalWidth,
      dataUrl: sig.dataUrl,
    };

    const el = document.createElement("div");

    el.className = "st-item st-sig";

    el.innerHTML = `
      <img alt="Signature">
      <span class="st-resize"></span>
    `;

    el.querySelector("img").src = sig.dataUrl;

    el.style.width = `${w * 100}%`;
    el.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;

    item.el = el;

    positionItem(item);

    page.el.appendChild(el);
    st.items.push(item);

    el.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("st-resize")) return;

      select(item.id);

      const start = { x: item.x, y: item.y };

      const rect = page.el.getBoundingClientRect();

      startDrag(e, el, (dx, dy) => {
        const hF = (item.w * item.aspect * page.w) / page.h;

        item.x = clamp(start.x + dx / rect.width, 0, 1 - item.w);
        item.y = clamp(start.y + dy / rect.height, 0, 1 - hF);

        positionItem(item);
      });
    });

    el.querySelector(".st-resize").addEventListener("pointerdown", (e) => {
      select(item.id);

      const startW = item.w;

      const rect = page.el.getBoundingClientRect();

      startDrag(e, e.currentTarget, (dx) => {
        item.w = clamp(startW + dx / rect.width, MIN_SIG_WIDTH, 1 - item.x);

        el.style.width = `${item.w * 100}%`;

        updateItemCard();
      });
    });

    select(item.id);

    updateDownloadState();
  };

  img.src = sig.dataUrl;
}

// Page click places the pending item

function onPageClick(e, pageIdx) {
  if (e.target.closest(".st-item")) return;

  if (!st.pending) {
    select(null);
    return;
  }

  const rect = st.pages[pageIdx].el.getBoundingClientRect();

  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  const pending = st.pending;

  setPending(null);

  if (pending.kind === "text") {
    addTextItem(pageIdx, x, y, pending.text);
  } else {
    addSigItem(pageIdx, x, y, pending.sig);
  }
}

// PDF loading

function layoutPages() {
  const pane = $("st-pages").parentElement;

  const avail = Math.max(pane.clientWidth - 48, 200);

  const cssW = Math.min(MAX_PAGE_CSS_WIDTH, avail);

  st.pages.forEach((p) => {
    const k = cssW / p.w;

    p.el.style.width = `${cssW}px`;
    p.el.style.height = `${p.h * k}px`;
    p.el.style.setProperty("--st-k", k);
  });
}

function clearDocument() {
  st.items = [];
  st.pages = [];
  st.selectedId = null;

  $("st-empty").style.display = "";

  setPending(null);

  $("st-pages").replaceChildren();

  updateItemCard();
}

async function loadPdf(file) {
  const stat = $("st-pdf-stat");

  stat.textContent = "Loading...";

  try {
    const bytes = await file.arrayBuffer();

    // pdf.js may detach the buffer it is given; keep ours for export.
    const doc = await pdfjsLib.getDocument({
      data: bytes.slice(0),
    }).promise;

    clearDocument();

    st.pdfBytes = bytes;
    st.fileName = file.name.replace(/\.pdf$/i, "");

    let rotated = false;

    const container = $("st-pages");

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);

      if (page.rotate) rotated = true;

      const vp1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: RENDER_SCALE });

      const canvas = document.createElement("canvas");

      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);

      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: vp,
      }).promise;

      const el = document.createElement("div");

      el.className = "st-page";

      el.appendChild(canvas);

      const idx = n - 1;

      el.addEventListener("click", (e) => onPageClick(e, idx));

      container.appendChild(el);

      st.pages.push({
        w: vp1.width,
        h: vp1.height,
        ox: page.view[0],
        oy: page.view[1],
        el,
      });
    }

    layoutPages();

    $("st-empty").style.display = "none";

    $("st-add-text").disabled = false;

    stat.textContent = `${file.name}, ${doc.numPages} page(s)`;

    if (rotated) {
      showToast("This PDF has rotated pages. Placement on them may be off in the download.", "warning");
    }

    updateDownloadState();
  } catch (err) {
    stat.textContent = `Error: ${err.message || "Could not read this PDF."}`;

    showToast("Could not open this PDF.", "danger");
  }
}

// Signature list

function allSignatures() {
  const users = loadUsers("student");
  const unlinked = new Set(listUnlinkedSignatures(users, "student").map((s) => s.id));

  // Unlinked signatures are always offered; a student's own appear once chosen.
  const saved = listSavedSignatures("student").filter(
    (s) => (st.studentId && s.userId === st.studentId) || unlinked.has(s.id)
  );

  const extra = st.sessionSigs.filter((s) => !saved.some((x) => x.variants[0].dataUrl === s.variants[0].dataUrl));

  return [...saved.map((s) => ({ ...s, saved: true })), ...extra.map((s) => ({ ...s, saved: false }))];
}

function renderSigList() {
  const list = $("st-sig-list");

  const sigs = allSignatures();
  const users = loadUsers();

  $("st-sig-empty").style.display = sigs.length ? "none" : "";

  const student = users.find((u) => u.id === st.studentId);
  $("st-sig-scope").textContent = student
    ? `Showing ${student.name || "this student"}'s signatures and unlinked ones.`
    : "Showing unlinked signatures. Choose a student to see theirs.";

  list.replaceChildren(
    ...sigs.map((sig) => {
      const chip = document.createElement("div");

      chip.className = "st-sig-chip";

      // Each variant is placed on its own; the group is only for identifying
      // and managing them, so the student badge is shown once below the row.
      const row = document.createElement("div");

      row.className = "d-flex gap-1";

      sig.variants.forEach((variant) => {
        const btn = document.createElement("button");

        btn.type = "button";

        const active = st.pending?.groupId === sig.id && st.pending?.sig.key === variant.key;

        btn.className = "btn btn-outline-secondary p-1 st-sig-variant" + (active ? " active" : "");

        btn.title = `${variant.label}: click it, then click the page`;

        btn.innerHTML = '<img alt=""><div class="small text-muted"></div>';

        btn.querySelector("img").src = variant.dataUrl;
        btn.querySelector("div").textContent = variant.label;

        btn.addEventListener("click", () => {
          if (!st.pages.length) {
            showToast("Upload the PDF first.", "warning");
            return;
          }

          setPending({ kind: "sig", sig: variant, groupId: sig.id });
        });

        row.appendChild(btn);
      });

      chip.appendChild(row);

      const caption = document.createElement("div");

      caption.className = "small text-muted mt-1";

      if (!sig.saved) caption.append("Not saved ");
      caption.appendChild(linkBadge(sig.userId, users));

      chip.appendChild(caption);

      if (sig.saved) {
        const del = document.createElement("button");

        del.type = "button";
        del.className = "btn btn-danger sig-del";
        del.title = "Remove from this device";
        del.innerHTML = '<i class="bi bi-x"></i>';

        del.addEventListener("click", () => {
          removeSavedSignature(sig.id);
          if (st.pending?.groupId === sig.id) setPending(null);
          renderSigList();
        });

        chip.appendChild(del);
      }

      return chip;
    })
  );
}

// Student details

function renderStudentFields() {
  const box = $("st-student-fields");
  const user = loadUsers().find((u) => u.id === st.studentId);

  const fields = user ? USER_FIELDS.filter((f) => (user[f.key] || "").trim()) : [];

  box.replaceChildren(
    ...fields.map((f) => {
      const value = user[f.key].trim();
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className =
        "btn btn-sm btn-outline-secondary text-start" + (st.pending?.field === f.label ? " active" : "");
      btn.title = `Click, then click the page to place ${f.label.toLowerCase()}`;

      const label = document.createElement("span");
      label.className = "text-muted";
      label.textContent = `${f.label}: `;

      btn.append(label, value);

      btn.addEventListener("click", () => {
        if (!st.pages.length) {
          showToast("Upload the PDF first.", "warning");
          return;
        }

        setPending(st.pending?.field === f.label ? null : { kind: "text", text: value, field: f.label });
      });

      return btn;
    })
  );
}

function refreshStudents() {
  const select = $("st-student");
  st.studentId = "";

  const users = populateStudentSelect(select, { unlinkedLabel: "Choose a student..." });

  $("st-student-none").classList.toggle("d-none", users.length > 0);
  select.disabled = users.length === 0;

  st.studentId = select.value;
  renderStudentFields();
  renderSigList();
}

async function makeSignature() {
  const picked = await openSignaturePicker({
    title: "Extract signature from image",
    allowAsIs: true,
    offerSave: true, // shows the "link to a student" choice; saving is automatic
  });

  if (!picked?.variants.length) return;

  // Every variant (both inks) is stored as one group linked to the student.
  const failed = !saveSignature({ variants: picked.variants, userId: picked.userId });

  if (failed) {
    st.sessionSigs.push({ id: `tmp-${st.nextId++}`, userId: picked.userId, variants: picked.variants });
    showToast("Could not save on this device (storage full or blocked). Available for this session only.", "warning");
  } else {
    showToast("Saved on this device.", "success");
  }

  renderSigList();
}

// Export

function updateDownloadState() {
  $("st-download").disabled = !st.pdfBytes || !st.items.some((i) => i.kind === "sig" || i.text?.trim());
}

function toLatin1(font, text) {
  return [...text]
    .map((ch) => {
      try {
        font.widthOfTextAtSize(ch, 1);
        return ch;
      } catch {
        return "?";
      }
    })
    .join("");
}

async function downloadPdf() {
  const btn = $("st-download");

  btn.disabled = true;

  try {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

    const doc = await PDFDocument.load(st.pdfBytes);

    const font = await doc.embedFont(StandardFonts.Helvetica);

    const pdfPages = doc.getPages();

    const imageCache = new Map();

    let lossy = false;

    for (const item of st.items) {
      const meta = st.pages[item.page];

      const pdfPage = pdfPages[item.page];

      const left = meta.ox + item.x * meta.w;

      const top = meta.oy + meta.h - item.y * meta.h;

      if (item.kind === "text") {
        const raw = item.text.trim();

        if (!raw) continue;

        const safe = toLatin1(font, raw);

        if (safe !== raw) lossy = true;

        pdfPage.drawText(safe, {
          x: left,
          y: top - BASELINE_RATIO * item.fontSize,
          size: item.fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      } else {
        let img = imageCache.get(item.dataUrl);

        if (!img) {
          img = await doc.embedPng(item.dataUrl);
          imageCache.set(item.dataUrl, img);
        }

        const w = item.w * meta.w;

        const h = w * item.aspect;

        pdfPage.drawImage(img, {
          x: left,
          y: top - h,
          width: w,
          height: h,
        });
      }
    }

    const out = await doc.save();

    const url = URL.createObjectURL(new Blob([out], { type: "application/pdf" }));

    const a = document.createElement("a");

    a.href = url;
    a.download = `${st.fileName || "topsheet"}-filled.pdf`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

    showToast(
      lossy ? 'PDF downloaded. Some characters are not supported and were replaced with "?".' : "PDF downloaded.",
      lossy ? "warning" : "success"
    );
  } catch (err) {
    showToast(`Could not create the PDF: ${err.message || err}`, "danger");
  } finally {
    updateDownloadState();
  }
}

// Wiring

let initialised = false;

/** Called whenever the student flow is shown. */
export function activateStudentFlow() {
  if (initialised) {
    layoutPages();
    refreshStudents(); // saved students may have changed in Settings
    return;
  }

  initialised = true;

  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  // OpenCV is ~8 MB; start fetching it before the student needs it.
  preloadSignatureEngine().catch(() => showToast("Could not preload the signature engine. It will load when needed.", "warning"));

  $("st-pdf").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) loadPdf(file);
  });

  $("st-add-text").addEventListener("click", () => {
    if (st.pending?.kind === "text") {
      setPending(null);
      return;
    }

    setPending({ kind: "text" });
  });

  $("st-new-sig").addEventListener("click", makeSignature);

  $("st-student").addEventListener("change", (e) => {
    st.studentId = e.target.value;
    if (st.pending?.field) setPending(null);
    renderStudentFields();
    renderSigList();
  });

  $("st-smaller").addEventListener("click", () => resizeSelected(-1));
  $("st-larger").addEventListener("click", () => resizeSelected(1));

  $("st-delete").addEventListener("click", () => {
    if (st.selectedId) removeItem(st.selectedId);
  });

  $("st-download").addEventListener("click", downloadPdf);

  document.addEventListener("keydown", (e) => {
    if ($("flow-student").style.display === "none") return;

    if (e.key === "Escape") setPending(null);

    const editing = e.target.isContentEditable;

    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      st.selectedId &&
      !editing &&
      !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
    ) {
      removeItem(st.selectedId);
    }
  });

  window.addEventListener("resize", layoutPages);

  refreshStudents();
}
