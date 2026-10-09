/**
 * Topsheet Maker: index.js
 * Fully client-side. No backend. No server uploads.
 * Imports shared libs from /lib/ (same as front-page-generator).
 */

import { renderNavbar } from "../lib/navbar.js";
import { showToast, promptForText } from "../lib/ui.js";
import { getItem, setItem, KEYS } from "../lib/storage.js";
import { askToSaveLayout } from "../lib/layout-save-prompt.js";
import { openSignaturePicker } from "../lib/signature-picker.js";
import { activateStudentFlow } from "./student/pdf-annotator.js";

// Default sheet content (texts, text formats, page settings, rubrics and
// marks rows) lives in data/topsheet_default_layout.json, like the front
// page's default layout. state.layout is the working copy of that model.

async function loadTopsheetLayout(pathToJson = "../data/topsheet_default_layout.json") {
  const res = await fetch(pathToJson);

  if (!res.ok) {
    throw new Error(`Failed to load topsheet_default_layout.json: ${res.status}`);
  }

  return res.json();
}

// Application state

const state = {
  step: 1,

  /** Working copy of data/topsheet_default_layout.json */
  layout: null,

  common: {
    // Text fields are filled from layout.texts by applyLayout().
    rubrics: [],

    markRows: [],

    processedTeacherSig: null,

    processedCollegeSeal: null,
  },

  /** @type {Array<{name:string, roll:string, sigFile:File|null, processedSig:string|null, matched:boolean, matchType:string}>} */
  students: [],

  /** @type {Map<string, File>} */
  sigFileMap: new Map(),

  generatedReady: false,

  /** Hidden page holding every student's sheet, prepared by Generate and printed by Export. */
  printFrame: null,

  currentPreviewIdx: 0,
};

// Currently active marks-table row in Step 1.
let selectedMarkRow = null;

// The A4 sheet lives in its own page (./topsheet/topsheet.html) inside an
// iframe, like the front page generator. Every sheet element is looked up
// in that document.

function sheetDoc() {
  return document.getElementById("ts-frame").contentDocument;
}

function waitForSheet() {
  const frame = document.getElementById("ts-frame");

  return new Promise((resolve) => {
    const ready = () => frame.contentDocument?.readyState === "complete" && frame.contentDocument.getElementById("ts-preview");

    if (ready()) {
      resolve();

      return;
    }

    frame.addEventListener("load", () => resolve(), { once: true });
  });
}

// Utility helpers

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize a string:
 * lowercase, trim, collapse whitespace/hyphens/dots to underscore.
 */
function normalizeStr(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[\s\-\.]+/g, "_")
    .replace(/_+/g, "_");
}

/**
 * Canonical matching key:
 * "roll_full_name" (spaces in the full name become underscores)
 */
function makeStudentKey(name, roll) {
  return `${normalizeStr(roll)}_${normalizeStr(name)}`;
}

/**
 * Strip file extension, then normalise.
 */
function normalizeFilename(filename) {
  const noExt = filename.replace(/\.[^.]+$/, "");

  return normalizeStr(noExt);
}

function setProgress(label, pct) {
  document.getElementById("pdf-progress").style.display = "";

  document.getElementById("prog-label").textContent = label;

  document.getElementById("prog-pct").textContent = `${pct}%`;

  document.getElementById("prog-bar").style.width = `${pct}%`;
}

function hideProgress() {
  document.getElementById("pdf-progress").style.display = "none";
}

// Render rubrics

function renderRubrics() {
  const tbody = sheetDoc().getElementById("ts-rubrics-body");

  if (!tbody) return;

  tbody.innerHTML = state.common.rubrics
    .map(
      (row, ri) => `

      <tr>

        <td class="ts-rb-letter">

          <span
            class="ts-rubric-content"
            data-rb="${ri}"
            data-rb-col="letter"
            contenteditable="true"
            spellcheck="false"
            style="${recordToCss(row.fmt?.letter)}"
          >${escHtml(row.letter)}</span>

        </td>


        <td class="ts-rb-criteria">

          <span
            class="ts-rubric-content"
            data-rb="${ri}"
            data-rb-col="criteria"
            contenteditable="true"
            spellcheck="false"
            style="${recordToCss(row.fmt?.criteria)}"
          >${escHtml(row.criteria)}</span>

        </td>


        ${["c1", "c2", "c3", "c4"]
          .map(
            (col) => `

            <td>

              <span
                class="ts-rubric-content"
                data-rb="${ri}"
                data-rb-col="${col}"
                contenteditable="true"
                spellcheck="false"
                style="${recordToCss(row.fmt?.[col])}"
              >${escHtml(row[col])}</span>

            </td>

          `
          )
          .join("")}

      </tr>

    `
    )
    .join("");

  tbody.querySelectorAll("[data-rb]").forEach((el) => {
    preventNewlines(el);

    el.addEventListener("input", () => {
      const ri = parseInt(el.dataset.rb, 10);

      const col = el.dataset.rbCol;

      if (!state.common.rubrics[ri]) {
        return;
      }

      state.common.rubrics[ri][col] = el.textContent;
    });
  });
}

// Render marks rows

function renderMarkRows() {
  const tbody = sheetDoc().getElementById("ts-marks-body");

  if (!tbody) return;

  tbody.innerHTML = state.common.markRows
    .map(
      (row, ri) => `

      <tr
        data-mark-row="${ri}"
        class="${selectedMarkRow === ri ? "ts-mark-row-selected" : ""}"
      >


        <!-- Q. No. -->

        <td class="ts-qno">

          <span
            class="ts-mark-content"
            data-mk="${ri}"
            data-mk-col="qno"
            contenteditable="true"
            spellcheck="false"
            style="${recordToCss(row.fmt?.qno)}"
          >${escHtml(row.qno)}</span>

        </td>


        <!-- Marks Allotted -->

        <td class="ts-allotted">

          <span
            class="ts-mark-content"
            data-mk="${ri}"
            data-mk-col="allotted"
            contenteditable="true"
            spellcheck="false"
            style="${recordToCss(row.fmt?.allotted)}"
          >${escHtml(row.allotted)}</span>

        </td>


        <!-- Marks Awarded -->

        <td class="ts-awarded">

          <span
            class="ts-mark-content"
            data-mk="${ri}"
            data-mk-col="awarded"
            contenteditable="true"
            spellcheck="false"
            style="${recordToCss(row.fmt?.awarded)}"
          >${escHtml(row.awarded || "")}</span>

        </td>


        <!-- Course Outcome -->

        <td class="ts-co">

          <span
            class="ts-mark-content"
            data-mk="${ri}"
            data-mk-col="co"
            contenteditable="true"
            spellcheck="false"
            style="${recordToCss(row.fmt?.co)}"
          >${escHtml(row.co)}</span>

        </td>


        <!-- Bloom's Level -->

        <td class="ts-bloom">

          <span
            class="ts-mark-content"
            data-mk="${ri}"
            data-mk-col="bloom"
            contenteditable="true"
            spellcheck="false"
            style="${recordToCss(row.fmt?.bloom)}"
          >${escHtml(row.bloom)}</span>

        </td>


        <!-- Remarks -->

        <td class="ts-remarks">

          <span
            class="ts-mark-content"
            data-mk="${ri}"
            data-mk-col="remarks"
            contenteditable="true"
            spellcheck="false"
            style="${recordToCss(row.fmt?.remarks)}"
          >${escHtml(row.remarks || "")}</span>

        </td>


      </tr>

    `
    )
    .join("");

  // Bind every editable mark cell.
  tbody.querySelectorAll("[data-mk]").forEach((el) => {
    preventNewlines(el);

    /*
      When the user focuses any field in a row,
      that row becomes the active row.
    */
    el.addEventListener("focus", () => {
      selectMarkRow(parseInt(el.dataset.mk, 10));
    });

    /*
      Also select the row on click.
    */
    el.addEventListener("click", () => {
      selectMarkRow(parseInt(el.dataset.mk, 10));
    });

    /*
      Save the edited value into application state.
    */
    el.addEventListener("input", () => {
      const ri = parseInt(el.dataset.mk, 10);

      const col = el.dataset.mkCol;

      if (!state.common.markRows[ri]) {
        return;
      }

      state.common.markRows[ri][col] = el.textContent;
    });
  });

  // A re-render replaces the cells, so drop a format target that no longer exists.
  if (fmtEl && !fmtEl.isConnected) clearFormatSelection();

  updateMarkRowActionUI();
}

// Marks row selection

function selectMarkRow(index) {
  if (index < 0 || index >= state.common.markRows.length) {
    return;
  }

  selectedMarkRow = index;

  // Highlight the selected row.
  sheetDoc().querySelectorAll("#ts-marks-body tr[data-mark-row]").forEach((row) => {
    const rowIndex = parseInt(row.dataset.markRow, 10);

    row.classList.toggle("ts-mark-row-selected", rowIndex === selectedMarkRow);
  });

  updateMarkRowActionUI();
}

// Update marks row actions panel

function updateMarkRowActionUI() {
  const card = document.getElementById("card-mark-row-actions");

  if (!card) return;

  /*
    No row selected:
    hide the action card.
  */
  if (selectedMarkRow === null || !state.common.markRows[selectedMarkRow]) {
    card.style.display = "none";

    return;
  }

  /*
    Valid row selected:
    show action card.
  */
  card.style.display = "";

  const rowNumberEl = document.getElementById("mark-row-number");

  if (rowNumberEl) {
    rowNumberEl.textContent = `Row ${selectedMarkRow + 1} of ${state.common.markRows.length}`;
  }

  /*
    Do not allow deleting the final remaining row.
  */
  const removeBtn = document.getElementById("btn-remove-mark-row");

  if (removeBtn) {
    removeBtn.disabled = state.common.markRows.length <= 1;
  }
}

// Create blank marks row

function createBlankMarkRow() {
  return {
    qno: "",

    allotted: "",

    awarded: "",

    co: "",

    bloom: "",

    remarks: "",

    fmt: {},
  };
}

// Remove selected marks row

function removeSelectedMarkRow() {
  if (selectedMarkRow === null) {
    return;
  }

  if (state.common.markRows.length <= 1) {
    showToast("At least one marks row must remain.", "warning");

    return;
  }

  const removedIndex = selectedMarkRow;

  state.common.markRows.splice(removedIndex, 1);

  /*
    After deleting:

    - if the deleted row was the last row,
      select the new last row.

    - otherwise keep the same numeric index,
      which now points at the next row.
  */
  if (removedIndex >= state.common.markRows.length) {
    selectedMarkRow = state.common.markRows.length - 1;
  } else {
    selectedMarkRow = removedIndex;
  }

  renderMarkRows();

  showToast("Marks row removed.", "success");
}

// Add row ABOVE selected row

function addMarkRowAbove() {
  const insertIndex = selectedMarkRow === null ? 0 : selectedMarkRow;

  state.common.markRows.splice(insertIndex, 0, createBlankMarkRow());

  selectedMarkRow = insertIndex;

  renderMarkRows();

  focusNewMarkRow(insertIndex);

  showToast("New row added above.", "success");
}

// Add row BELOW selected row

function addMarkRowBelow() {
  const insertIndex = selectedMarkRow === null ? state.common.markRows.length : selectedMarkRow + 1;

  state.common.markRows.splice(insertIndex, 0, createBlankMarkRow());

  selectedMarkRow = insertIndex;

  renderMarkRows();

  focusNewMarkRow(insertIndex);

  showToast("New row added below.", "success");
}

// Focus newly-created row

function focusNewMarkRow(index) {
  requestAnimationFrame(() => {
    const el = sheetDoc().querySelector(`#ts-marks-body tr[data-mark-row="${index}"] [data-mk-col="qno"]`);

    if (!el) {
      return;
    }

    el.focus();

    /*
      Put caret at the beginning of the new row.
    */
    const range = sheetDoc().createRange();

    range.selectNodeContents(el);

    range.collapse(true);

    const selection = sheetDoc().defaultView.getSelection();

    if (selection) {
      selection.removeAllRanges();

      selection.addRange(range);
    }
  });
}

// Prevent Enter in single-line fields

function preventNewlines(el) {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  });
}

// Bind inline editing

function bindInlineEditing() {
  const preview = sheetDoc().getElementById("ts-preview");

  preview.querySelectorAll("[data-label]").forEach(preventNewlines);

  preview.querySelectorAll("[data-field]").forEach((el) => {
    preventNewlines(el);

    el.addEventListener("input", () => {
      state.common[el.dataset.field] = el.textContent;
    });
  });
}

// Sync DOM to state

function syncCommonFromDOM() {
  const preview = sheetDoc().getElementById("ts-preview");

  // Common fields.
  preview.querySelectorAll("[data-field]").forEach((el) => {
    state.common[el.dataset.field] = el.textContent;
  });

  // Rubrics.
  preview.querySelectorAll("[data-rb]").forEach((el) => {
    const ri = parseInt(el.dataset.rb, 10);

    const col = el.dataset.rbCol;

    if (state.common.rubrics[ri]) {
      state.common.rubrics[ri][col] = el.textContent;
    }
  });

  // Marks.
  preview.querySelectorAll("[data-mk]").forEach((el) => {
    const ri = parseInt(el.dataset.mk, 10);

    const col = el.dataset.mkCol;

    if (state.common.markRows[ri]) {
      state.common.markRows[ri][col] = el.textContent;
    }
  });
}

// Update teacher signature / seal

function refreshCommonImages() {
  setImgEl(".ts-teacher-sig", state.common.processedTeacherSig);

  setImgEl(".ts-college-seal", state.common.processedCollegeSeal);
}

function setImgEl(selector, dataURL) {
  sheetDoc().querySelectorAll(selector).forEach((img) => {
    img.parentElement.classList.toggle("ts-has-img", !!dataURL);

    if (dataURL) {
      img.src = dataURL;

      img.style.display = "";
    } else {
      img.src = "";

      img.style.display = "none";
    }
  });
}

// Signature / seal pickers (same popup as the student flow)

function applyPickedImage({ stateKey, previewId, statusId, variantsId }, variants) {
  const previewEl = document.getElementById(previewId);

  const variantsEl = document.getElementById(variantsId);

  const use = (v) => {
    state.common[stateKey] = v.dataUrl;

    previewEl.src = v.dataUrl;

    previewEl.classList.add("has-img");

    document.getElementById(statusId).textContent = "Ready";

    refreshCommonImages();

    variantsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.key === v.key));
  };

  variantsEl.replaceChildren();

  variantsEl.classList.toggle("d-none", variants.length < 2);

  for (const v of variants) {
    const b = document.createElement("button");

    b.type = "button";

    b.dataset.key = v.key;

    b.className = "btn btn-sm btn-outline-secondary flex-fill";

    b.textContent = v.label;

    b.addEventListener("click", () => use(v));

    variantsEl.appendChild(b);
  }

  use(variants[0]);
}

async function pickImage(opts, title) {
  const picked = await openSignaturePicker({ title, allowAsIs: true });

  if (!picked?.variants.length) {
    return;
  }

  applyPickedImage(opts, picked.variants);
}

// Apply the layout model to the sheet

function applyLayout(layout) {
  const doc = sheetDoc().getElementById("ts-preview");

  const page = layout.page || {};

  const margin = page.margin || {};

  doc.style.fontSize = `${page.fontSize}pt`;

  doc.style.setProperty("--ts-m-top", `${margin.top}mm`);

  doc.style.setProperty("--ts-m-right", `${margin.right}mm`);

  doc.style.setProperty("--ts-m-bottom", `${margin.bottom}mm`);

  doc.style.setProperty("--ts-m-left", `${margin.left}mm`);

  doc.style.setProperty("--ts-sig-h", `${page.signatureHeight}mm`);

  doc.querySelectorAll("[data-key]").forEach((el) => {
    const rec = layout.texts[el.dataset.key];

    if (!rec) return;

    if (rec.text !== undefined) {
      el.textContent = rec.text;
    }

    if (el.dataset.field && rec.text !== undefined) {
      state.common[el.dataset.field] = rec.text;
    }

    applyRecordStyle(el, rec);
  });

  state.common.rubrics = layout.rubrics;

  state.common.markRows = layout.markRows;
}

// Text formatting (bold / italic / underline / size)

/*
  The format applies to the whole editable element that was last
  clicked on the sheet. Formatting is written as inline style on that
  element. Table cells are re-rendered from state, so their style
  string is also kept on the row (row.fmt[col]).
*/

let fmtEl = null;

function readFormat(el) {
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);

  return {
    bold: parseInt(cs.fontWeight, 10) >= 600,

    italic: cs.fontStyle === "italic",

    underline: cs.textDecorationLine.includes("underline"),

    sizePt: Math.round(parseFloat(cs.fontSize) * 0.75 * 10) / 10,
  };
}

function updateFormatUI() {
  const card = document.getElementById("card-text-format");

  if (!card) return;

  if (!fmtEl) {
    card.style.display = "none";

    return;
  }

  card.style.display = "";

  const f = readFormat(fmtEl);

  document.getElementById("fmt-bold").classList.toggle("active", f.bold);

  document.getElementById("fmt-italic").classList.toggle("active", f.italic);

  document.getElementById("fmt-underline").classList.toggle("active", f.underline);

  document.getElementById("fmt-size").value = f.sizePt;

  const text = fmtEl.textContent.trim();

  document.getElementById("fmt-target").textContent = text ? `Editing: ${text}` : "Editing: (empty text)";
}

function selectFormatEl(el) {
  if (fmtEl && fmtEl !== el) {
    fmtEl.classList.remove("ts-fmt-selected");
  }

  fmtEl = el;

  fmtEl.classList.add("ts-fmt-selected");

  updateFormatUI();
}

function clearFormatSelection() {
  if (fmtEl) {
    fmtEl.classList.remove("ts-fmt-selected");
  }

  fmtEl = null;

  updateFormatUI();
}

// Format record of an editable element inside the layout model:
// { fontSize, bold, italic, underline }. Table cells keep it on their row
// (row.fmt[col]); every other text keeps it in layout.texts[key].
function formatRecord(el) {
  const cells = [
    ["rb", "rbCol", state.common.rubrics],

    ["mk", "mkCol", state.common.markRows],
  ];

  for (const [attr, colAttr, rows] of cells) {
    if (el.dataset[attr] === undefined) continue;

    const row = rows[parseInt(el.dataset[attr], 10)];

    if (!row) return null;

    row.fmt = row.fmt || {};

    row.fmt[el.dataset[colAttr]] = row.fmt[el.dataset[colAttr]] || {};

    return row.fmt[el.dataset[colAttr]];
  }

  const key = el.dataset.key;

  if (!key) return null;

  state.layout.texts[key] = state.layout.texts[key] || {};

  return state.layout.texts[key];
}

function recordToCss(rec = {}) {
  const css = [];

  if (rec.fontSize != null) css.push(`font-size:${rec.fontSize}pt`);

  if (rec.bold != null) css.push(`font-weight:${rec.bold ? 700 : 400}`);

  if (rec.italic != null) css.push(`font-style:${rec.italic ? "italic" : "normal"}`);

  if (rec.underline != null) css.push(`text-decoration:${rec.underline ? "underline" : "none"}`);

  return css.join(";");
}

function applyRecordStyle(el, rec) {
  el.style.cssText = recordToCss(rec);
}

function applyFormat(change) {
  if (!fmtEl) return;

  const rec = formatRecord(fmtEl);

  if (!rec) return;

  change(rec, readFormat(fmtEl));

  applyRecordStyle(fmtEl, rec);

  updateFormatUI();
}

function bindFormatting() {
  sheetDoc().addEventListener("focusin", (e) => {
    const el = e.target.closest?.('[contenteditable="true"]');

    if (el) selectFormatEl(el);
  });

  document.getElementById("fmt-bold").addEventListener("click", () => {
    applyFormat((rec, f) => {
      rec.bold = !f.bold;
    });
  });

  document.getElementById("fmt-italic").addEventListener("click", () => {
    applyFormat((rec, f) => {
      rec.italic = !f.italic;
    });
  });

  document.getElementById("fmt-underline").addEventListener("click", () => {
    applyFormat((rec, f) => {
      rec.underline = !f.underline;
    });
  });

  document.getElementById("fmt-size").addEventListener("input", (e) => {
    const size = parseFloat(e.target.value);

    if (!(size >= 4 && size <= 30)) return;

    applyFormat((rec) => {
      rec.fontSize = size;
    });
  });

  // Keep the text in the layout model in step with what is typed.
  sheetDoc().addEventListener("input", (e) => {
    const el = e.target.closest?.("[data-label], [data-field]");

    if (!el?.dataset.key) return;

    const rec = formatRecord(el);

    if (rec) rec.text = el.textContent;
  });

  initImagePlacement();
}

// Free placement of the teacher signature and the college seal:
// drag the image to move it, drag the corner handle to scale it.

const PLACEABLE = ".ts-teacher-sig, .ts-college-seal";

let placeTarget = null;

let placeBox = null;

function showPlaceBox() {
  if (!placeTarget || state.step !== 1) {
    placeBox.style.display = "none";

    return;
  }

  const r = placeTarget.getBoundingClientRect();

  Object.assign(placeBox.style, {
    display: "block",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
}

// Takes the image out of the layout flow, keeping it exactly where it is now.
function detachForPlacing(img) {
  if (img.dataset.placed) return;

  const r = img.getBoundingClientRect();

  const parent = img.offsetParent.getBoundingClientRect();

  Object.assign(img.style, {
    maxWidth: "none",
    maxHeight: "none",
    width: `${r.width}px`,
    height: "auto",
    position: "absolute",
    left: `${r.left - parent.left}px`,
    top: `${r.top - parent.top}px`,
  });

  img.dataset.placed = "1";
}

function resetPlacement(selector) {
  const img = sheetDoc().querySelector(selector);

  if (!img) return;

  ["maxWidth", "maxHeight", "width", "height", "position", "left", "top"].forEach((k) => {
    img.style[k] = "";
  });

  delete img.dataset.placed;

  showPlaceBox();
}

function initImagePlacement() {
  const doc = sheetDoc();

  placeBox = doc.createElement("div");

  placeBox.style.cssText =
    "position:fixed;display:none;box-sizing:border-box;border:1px dashed #047857;pointer-events:none;z-index:50";

  const handle = doc.createElement("span");

  handle.style.cssText =
    "position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;background:#047857;border:2px solid #fff;border-radius:50%;cursor:nwse-resize;pointer-events:auto;touch-action:none";

  placeBox.appendChild(handle);

  doc.body.appendChild(placeBox);

  doc.addEventListener("pointerdown", (e) => {
    if (e.target === handle || e.target.closest?.(PLACEABLE)) return;

    placeTarget = null;

    showPlaceBox();
  });

  doc.addEventListener("pointerdown", (e) => {
    const img = e.target.closest?.(PLACEABLE);

    if (!img || state.step !== 1) return;

    e.preventDefault();

    placeTarget = img;

    detachForPlacing(img);

    showPlaceBox();

    const start = { x: e.clientX, y: e.clientY, left: parseFloat(img.style.left), top: parseFloat(img.style.top) };

    img.setPointerCapture(e.pointerId);

    img.style.cursor = "move";

    const move = (ev) => {
      img.style.left = `${start.left + ev.clientX - start.x}px`;

      img.style.top = `${start.top + ev.clientY - start.y}px`;

      showPlaceBox();
    };

    const up = () => {
      img.removeEventListener("pointermove", move);

      img.removeEventListener("pointerup", up);
    };

    img.addEventListener("pointermove", move);

    img.addEventListener("pointerup", up);
  });

  handle.addEventListener("pointerdown", (e) => {
    if (!placeTarget) return;

    e.preventDefault();

    e.stopPropagation();

    const img = placeTarget;

    const startW = img.getBoundingClientRect().width;

    const startX = e.clientX;

    handle.setPointerCapture(e.pointerId);

    const move = (ev) => {
      img.style.width = `${Math.max(20, startW + ev.clientX - startX)}px`;

      showPlaceBox();
    };

    const up = () => {
      handle.removeEventListener("pointermove", move);

      handle.removeEventListener("pointerup", up);
    };

    handle.addEventListener("pointermove", move);

    handle.addEventListener("pointerup", up);
  });
}

// Step 1 to Step 2

function goToStep2() {
  syncCommonFromDOM();

  state.step = 2;

  placeTarget = null;

  showPlaceBox();

  clearFormatSelection();

  document.getElementById("sidebar-s1").style.display = "none";

  document.getElementById("sidebar-s2").style.display = "";

  /*
    Lock Step 1 fields.
  */
  sheetDoc()
    .getElementById("ts-preview")
    .querySelectorAll("[contenteditable]")
    .forEach((el) => {
      el.removeAttribute("contenteditable");
    });

  sheetDoc().getElementById("ts-preview").classList.remove("ts-editable");

  sheetDoc().getElementById("ts-preview").classList.add("ts-show-sigbox");

  /*
    The marks action panel belongs
    to Step 1, so it disappears with
    sidebar-s1 automatically.
  */
  updateMarkRowActionUI();

  showToast("Step 1 complete! Now upload student data.", "success");
}

// Step 2 to Step 1

function goToStep1() {
  state.step = 1;

  document.getElementById("sidebar-s2").style.display = "none";

  document.getElementById("sidebar-s1").style.display = "";

  const preview = sheetDoc().getElementById("ts-preview");

  preview.classList.add("ts-editable");

  preview.classList.remove("ts-show-sigbox");

  // Step 1 can change the sheet, so the prepared pages are out of date.
  discardPrintFrame();

  restorePreviewFromState();
}

// Restore preview from state

function restorePreviewFromState() {
  const preview = sheetDoc().getElementById("ts-preview");

  preview.querySelectorAll("[data-field]").forEach((el) => {
    const f = el.dataset.field;

    if (state.common[f] !== undefined) {
      el.textContent = state.common[f];
    }

    el.setAttribute("contenteditable", "true");

    el.setAttribute("spellcheck", "false");

    preventNewlines(el);

    el.addEventListener("input", () => {
      state.common[f] = el.textContent;
    });
  });

  preview.querySelectorAll("[data-label]").forEach((el) => {
    el.setAttribute("contenteditable", "true");

    el.setAttribute("spellcheck", "false");
  });

  renderRubrics();

  renderMarkRows();
}

// CSV parsing

function parseCSV(text) {
  const result = Papa.parse(text, {
    header: true,

    skipEmptyLines: true,

    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length) {
    showToast(`CSV had ${result.errors.length} parse warning(s). Check the rows.`, "warning");
  }

  const rows = result.data;

  if (!rows.length) {
    throw new Error("CSV is empty.");
  }

  return { headers: result.meta.fields || Object.keys(rows[0]), rows };
}

// Popup asking which CSV columns hold the roll and the name.
// Resolves { roll, name } (column headers) or null if cancelled.

function openColumnMapper(headers) {
  return new Promise((resolve) => {
    const guess = (word) => headers.find((h) => h.toLowerCase().includes(word)) ?? "";

    const dlg = document.createElement("dialog");

    dlg.className = "rounded-3 border-0 shadow p-0";

    dlg.style.maxWidth = "420px";

    dlg.style.width = "92vw";

    const options = (selected) =>
      [`<option value="">Select a column...</option>`]
        .concat(headers.map((h) => `<option value="${escHtml(h)}"${h === selected ? " selected" : ""}>${escHtml(h)}</option>`))
        .join("");

    dlg.innerHTML = `
      <form method="dialog" class="p-3 d-flex flex-column gap-3">
        <div class="fw-semibold"><i class="bi bi-table"></i> Map CSV columns</div>
        <p class="small text-muted mb-0">Choose which column holds each value.</p>
        <label class="small">Roll
          <select class="form-select form-select-sm mt-1" data-f="roll">${options(guess("roll"))}</select>
        </label>
        <label class="small">Full name
          <select class="form-select form-select-sm mt-1" data-f="name">${options(guess("name"))}</select>
        </label>
        <div class="small text-danger d-none" data-err></div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-sm btn-outline-secondary" data-cancel>Cancel</button>
          <button type="submit" class="btn btn-sm btn-primary">Use these columns</button>
        </div>
      </form>
    `;

    let result = null;

    const rollSel = dlg.querySelector('[data-f="roll"]');

    const nameSel = dlg.querySelector('[data-f="name"]');

    const errEl = dlg.querySelector("[data-err]");

    dlg.querySelector("[data-cancel]").addEventListener("click", () => dlg.close());

    dlg.querySelector("form").addEventListener("submit", (e) => {
      if (!rollSel.value || !nameSel.value || rollSel.value === nameSel.value) {
        e.preventDefault();

        errEl.textContent = "Pick a different column for roll and for name.";

        errEl.classList.remove("d-none");

        return;
      }

      result = { roll: rollSel.value, name: nameSel.value };
    });

    dlg.addEventListener("close", () => {
      dlg.remove();

      resolve(result);
    });

    document.body.appendChild(dlg);

    dlg.showModal();
  });
}

// Student signatures are used exactly as supplied (no extraction).

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () => reject(reader.error);

    reader.readAsDataURL(file);
  });
}

// Signature folder map

function buildSigFileMap(fileList) {
  const map = new Map();

  for (const file of fileList) {
    if (!file.type.startsWith("image/")) {
      continue;
    }

    const basename = file.name.split("/").pop().split("\\").pop();

    const key = normalizeFilename(basename);

    map.set(key, file);
  }

  return map;
}

// Match students

function matchStudents(csvStudents, sigMap) {
  return csvStudents.map((s) => {
    const exactKey = makeStudentKey(s.name, s.roll);

    // 1. Exact match

    if (sigMap.has(exactKey)) {
      return {
        ...s,

        sigFile: sigMap.get(exactKey),

        matched: true,

        matchType: "exact",
      };
    }

    // 2. Roll fallback

    const rollPrefix = normalizeStr(s.roll) + "_";

    for (const [fkey, file] of sigMap.entries()) {
      if (fkey.startsWith(rollPrefix)) {
        return {
          ...s,

          sigFile: file,

          matched: true,

          matchType: "roll-fallback",
        };
      }
    }

    // 3. Missing

    return {
      ...s,

      sigFile: null,

      matched: false,

      matchType: "none",

      processedSig: null,
    };
  });
}

// Validation UI

function renderValidationUI() {
  const students = state.students;

  const total = students.length;

  const matched = students.filter((s) => s.matched).length;

  const unmatched = total - matched;

  const sigTotal = state.sigFileMap.size;

  const summaryEl = document.getElementById("val-summary");

  summaryEl.innerHTML = `

    <div class="d-flex flex-wrap gap-2">

      <span class="badge text-bg-primary">
        Students: ${total}
      </span>

      <span class="badge text-bg-secondary">
        Signatures found: ${sigTotal}
      </span>

      <span class="badge text-bg-success">
        Matched: ${matched}
      </span>

      ${
        unmatched
          ? `
            <span class="badge text-bg-danger">
              Missing: ${unmatched}
            </span>
          `
          : ""
      }

    </div>

  `;

  const tbody = document.getElementById("val-table-body");

  tbody.innerHTML = students
    .map((s) => {
      const statusBadge = s.matched
        ? `
                <span class="badge text-bg-success">
                  ${s.matchType === "roll-fallback" ? "roll-match" : "matched"}
                </span>
              `
        : `
                <span class="badge text-bg-danger">
                  missing
                </span>
              `;

      const sigName = s.sigFile ? escHtml(s.sigFile.name) : "-";

      return `

            <tr>

              <td>
                ${escHtml(s.roll)}
              </td>

              <td>
                ${escHtml(s.name)}
              </td>

              <td
                style="
                  word-break:break-all;
                  font-size:.65rem;
                "
              >
                ${sigName}
              </td>

              <td>
                ${statusBadge}
              </td>

            </tr>

          `;
    })
    .join("");

  document.getElementById("card-validation").style.display = "";

  const hasMatched = matched > 0;

  document.getElementById("card-generate").style.display = hasMatched ? "" : "none";

  if (unmatched > 0) {
    showToast(`${unmatched} student(s) have no signature file.`, "warning");
  }
}

// Try matching

function tryMatch() {
  if (!state.students.length && !state.sigFileMap.size) {
    return;
  }

  const matched = matchStudents(state.students, state.sigFileMap);

  state.students = matched.map((s, i) => ({
    ...s,

    processedSig: state.students[i]?.processedSig ?? null,
  }));

  renderValidationUI();

  buildStudentSelector();
}

// Student selector

function buildStudentSelector() {
  const sel = document.getElementById("sel-student");

  sel.innerHTML = state.students
    .map(
      (s, i) => `

          <option value="${i}">

            ${escHtml(s.roll)}
            |
            ${escHtml(s.name)}

          </option>

        `
    )
    .join("");

  document.getElementById("card-preview-sel").style.display = state.students.length ? "" : "none";

  if (state.students.length) {
    previewStudent(0);
  }
}

// Student preview

function previewStudent(idx) {
  state.currentPreviewIdx = idx;

  const s = state.students[idx];

  if (!s) {
    return;
  }

  const nameEl = sheetDoc().querySelector(".ts-student-name");

  const rollEl = sheetDoc().querySelector(".ts-student-roll");

  if (nameEl) {
    nameEl.textContent = s.name;

    nameEl.classList.remove("ts-ph");
  }

  if (rollEl) {
    rollEl.textContent = s.roll;

    rollEl.classList.remove("ts-ph");
  }

  const sigImg = sheetDoc().querySelector(".ts-student-sig");

  if (sigImg) {
    if (s.processedSig) {
      sigImg.src = s.processedSig;

      sigImg.style.display = "";
    } else {
      sigImg.src = "";

      sigImg.style.display = "none";
    }
  }
}

// Generate all topsheets

async function generateAllTopsheets() {
  const students = state.students;

  if (!students.length) {
    showToast("No matched students.", "warning");

    return;
  }

  if (!(await offerToSaveLayout())) return;

  const btn = document.getElementById("btn-generate");

  btn.disabled = true;

  discardPrintFrame();

  const needsProcessing = students.filter((s) => s.sigFile && !s.processedSig);

  if (needsProcessing.length) {
    showToast(`Loading ${needsProcessing.length} student signature(s)...`, "info");
  }

  for (let i = 0; i < students.length; i++) {
    const s = students[i];

    const pct = Math.round((i / students.length) * 90);

    setProgress(`Loading student ${i + 1} / ${students.length}...`, pct);

    if (s.sigFile && !s.processedSig) {
      try {
        s.processedSig = await readAsDataUrl(s.sigFile);
      } catch (err) {
        showToast(`Could not read the signature for ${s.name}.`, "warning");

        s.processedSig = null;
      }
    }

    await sleep(5);
  }

  try {
    setProgress("Preparing pages...", 90);

    state.printFrame = await buildPrintFrame(students, document.getElementById("ts-all-inner"), true);

    showAllPages(students.length + 1);

    state.generatedReady = true;

    document.getElementById("btn-export-pdf").disabled = false;

    showToast(`${students.length} topsheets ready, plus 1 spare blank sheet on page 1. Click "Export All as PDF".`, "success");
  } catch (err) {
    showToast(`Could not prepare the pages: ${err.message || err}`, "danger");
  }

  setProgress("Done!", 100);

  await sleep(300);

  hideProgress();

  btn.disabled = false;

  previewStudent(state.currentPreviewIdx);
}

// Build one student's topsheet for PDF export.
// The live sheet is cloned, so every edit and text format made in Step 1
// carries over; only the student-specific parts are filled in.

function buildTopsheetEl(student) {
  const doc = sheetDoc().getElementById("ts-preview").cloneNode(true);

  doc.removeAttribute("id");

  doc.classList.remove("ts-editable", "ts-show-sigbox");

  doc.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));

  doc.querySelectorAll(".ts-fmt-selected").forEach((el) => el.classList.remove("ts-fmt-selected"));

  doc.querySelectorAll(".ts-mark-row-selected").forEach((el) => el.classList.remove("ts-mark-row-selected"));

  doc.style.width = "794px";

  doc.style.height = "1123px";

  doc.style.minHeight = "0";

  doc.style.boxSizing = "border-box";

  const nameEl = doc.querySelector(".ts-student-name");

  const rollEl = doc.querySelector(".ts-student-roll");

  nameEl.textContent = student?.name ?? "";

  rollEl.textContent = String(student?.roll ?? "");

  nameEl.classList.remove("ts-ph");

  rollEl.classList.remove("ts-ph");

  const sigImg = doc.querySelector(".ts-student-sig");

  if (student?.processedSig) {
    sigImg.src = student.processedSig;

    sigImg.style.display = "block";
  } else {
    sigImg.removeAttribute("src");

    sigImg.style.display = "none";
  }

  return doc;
}

// Wait for all images

async function waitForImages(container) {
  const imgs = [...container.querySelectorAll("img")].filter((img) => img.src);

  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        img.onload = resolve;

        img.onerror = resolve;

        setTimeout(resolve, 3000);
      });
    })
  );
}

// Download the sheet as it is now, with the student fields left blank.

async function downloadBlankSheet() {
  if (!(await offerToSaveLayout())) return;

  const btn = document.getElementById("btn-download-blank");

  btn.disabled = true;

  let frame = null;

  const done = () => {
    frame?.remove();

    btn.disabled = false;
  };

  try {
    frame = await buildPrintFrame([null]);

    frame.contentWindow.addEventListener("afterprint", done, { once: true });

    frame.contentWindow.focus();

    frame.contentWindow.print();
  } catch (err) {
    showToast(`Download failed: ${err.message || err}`, "danger");

    done();
  }
}

// Build a hidden page with one sheet per entry (null = blank student fields), one
// per page, ready to print. Printing a copy of the sheet (like the front page
// generator) keeps real text, so the PDF is sharp. The browser's print dialog
// saves it as PDF. Building is the slow part, so the student export does it ahead
// of time, during Generate.

// Each page takes 297mm plus PAGE_GAP of space between pages on screen.
const PAGE_GAP_MM = 8;

// With a `host`, the page is built inside it so it can be shown on screen (every
// sheet stacked, one below the other); without one it stays off screen.

// With `spareFirst`, one extra sheet with blank student fields is placed on the
// first page, for the teacher's own use during the exam.

async function buildPrintFrame(students, host = null, spareFirst = false) {
  if (spareFirst) students = [null, ...students];

  const iframe = document.createElement("iframe");

  iframe.style.cssText = host
    ? `display:block;width:210mm;height:${students.length * (297 + PAGE_GAP_MM) + 1}mm;border:0`
    : "position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:0";

  // The left pane scrolls the pages; the frame itself must not.
  iframe.scrolling = "no";

  (host ?? document.body).appendChild(iframe);

  try {
    syncCommonFromDOM();

    await new Promise((resolve, reject) => {
      iframe.onload = resolve;

      iframe.onerror = reject;

      iframe.src = "./topsheet/topsheet.html";
    });

    const doc = iframe.contentDocument;

    const sheets = students.map((s, i) => {
      const sheet = buildTopsheetEl(s);

      sheet.style.width = "210mm";

      sheet.style.height = "297mm";

      sheet.style.overflow = "hidden";

      if (i < students.length - 1) {
        sheet.style.breakAfter = "page";
      }

      return sheet;
    });

    doc.getElementById("ts-preview").replaceWith(...sheets);

    const style = doc.createElement("style");

    style.textContent = `
      @page { size: A4; margin: 0; }
      html, body { background: #fff; margin: 0; }
      @media screen {
        html, body { overflow: hidden; }
        html, body { background: #dcece6; }
        .ts-doc { margin: 0 0 ${PAGE_GAP_MM}mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.25); }
      }
    `;

    doc.head.appendChild(style);

    // Text keeps the weights it has on screen.
    await doc.fonts.load("500 7pt 'IBM Plex Sans Condensed'");

    await doc.fonts.load("700 7pt 'IBM Plex Sans Condensed'");

    await doc.fonts.ready;

    await waitForImages(doc.body);

    return iframe;
  } catch (err) {
    iframe.remove();

    throw err;
  }
}

// The prepared student pages go stale when anything feeding them changes.

function discardPrintFrame() {
  state.printFrame?.remove();

  state.printFrame = null;

  document.getElementById("ts-all-outer").classList.remove("ts-all-on");

  document.getElementById("ts-single-outer").style.display = "";

  state.generatedReady = false;

  document.getElementById("btn-export-pdf").disabled = true;
}

// Show every student's page in the preview pane in place of the single sheet.

function showAllPages(count) {
  const outer = document.getElementById("ts-all-outer");

  outer.style.setProperty("--ts-all-h", `${count * (297 + PAGE_GAP_MM) + 1}mm`);

  outer.classList.add("ts-all-on");

  document.getElementById("ts-single-outer").style.display = "none";
}

// Scroll the stacked pages to one student's page.

function scrollToPage(idx) {
  state.printFrame?.contentDocument.querySelectorAll(".ts-doc")[idx + 1]?.scrollIntoView({ block: "start", behavior: "smooth" });
}

// Export all students as one PDF (the pages were prepared by Generate).

async function exportAllAsPDF() {
  if (!state.generatedReady || !state.printFrame) {
    showToast('Click "Generate All Topsheets" first.', "warning");

    return;
  }

  if (!(await offerToSaveLayout())) return;

  showToast('In the print dialog, choose "Save as PDF".', "info");

  state.printFrame.contentWindow.focus();

  state.printFrame.contentWindow.print();
}

// Bind sidebar events

function bindSidebarEvents() {
  // Teacher signature and college seal

  document.getElementById("btn-teacher-sig").addEventListener("click", () =>
    pickImage(
      { stateKey: "processedTeacherSig", previewId: "prev-teacher-sig", statusId: "stat-teacher-sig", variantsId: "var-teacher-sig" },
      "Add teacher signature"
    )
  );

  document.getElementById("btn-reset-teacher-sig").addEventListener("click", () => resetPlacement(".ts-teacher-sig"));

  document.getElementById("btn-reset-college-seal").addEventListener("click", () => resetPlacement(".ts-college-seal"));

  document.getElementById("btn-college-seal").addEventListener("click", () =>
    pickImage(
      { stateKey: "processedCollegeSeal", previewId: "prev-college-seal", statusId: "stat-college-seal", variantsId: "var-college-seal" },
      "Add college seal"
    )
  );

  // Step navigation

  document.getElementById("btn-download-blank").addEventListener("click", downloadBlankSheet);

  document.getElementById("btn-go-s2").addEventListener("click", goToStep2);

  document.getElementById("btn-back-s1").addEventListener("click", goToStep1);

  // Marks row actions

  document.getElementById("btn-remove-mark-row").addEventListener("click", removeSelectedMarkRow);

  document.getElementById("btn-add-mark-row-above").addEventListener("click", addMarkRowAbove);

  document.getElementById("btn-add-mark-row-below").addEventListener("click", addMarkRowBelow);

  // CSV

  document.getElementById("inp-csv").addEventListener("change", (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = async (ev) => {
      try {
        const { headers, rows: rawRows } = parseCSV(ev.target.result);

        const map = await openColumnMapper(headers);

        if (!map) {
          e.target.value = "";

          document.getElementById("stat-csv").textContent = "Column mapping cancelled.";

          return;
        }

        const rows = rawRows
          .map((r) => ({ name: String(r[map.name] || "").trim(), roll: String(r[map.roll] || "").trim() }))
          .filter((r) => r.name && r.roll);

        if (!rows.length) {
          throw new Error("No rows with both a roll and a name in the chosen columns.");
        }

        state.students = rows.map((r) => ({
          name: r.name,

          roll: r.roll,

          sigFile: null,

          processedSig: null,

          matched: false,

          matchType: "none",
        }));

        document.getElementById("stat-csv").textContent = `${rows.length} student(s) loaded.`;

        discardPrintFrame();

        tryMatch();
      } catch (err) {
        document.getElementById("stat-csv").textContent = `Error: ${err.message}`;

        showToast(err.message, "danger");
      }
    };

    reader.readAsText(file);
  });

  // Signature folder

  document.getElementById("inp-sig-folder").addEventListener("change", (e) => {
    const files = e.target.files;

    if (!files.length) {
      return;
    }

    state.sigFileMap = buildSigFileMap(files);

    document.getElementById("stat-folder").textContent = `${state.sigFileMap.size} image file(s) found.`;

    discardPrintFrame();

    tryMatch();
  });

  // Student preview selector

  document.getElementById("sel-student").addEventListener("change", (e) => {
    const idx = parseInt(e.target.value, 10);

    previewStudent(idx);

    scrollToPage(idx);
  });

  // Generate

  document.getElementById("btn-generate").addEventListener("click", generateAllTopsheets);

  // Export PDF

  document.getElementById("btn-export-pdf").addEventListener("click", exportAllAsPDF);
}

// Role chooser (teacher / student)

const ROLES = ["teacher", "student"];

function showRole(role) {
  const active = ROLES.includes(role) ? role : null;

  document.getElementById("role-chooser").style.display = active ? "none" : "";

  document.getElementById("flow-teacher").style.display = active === "teacher" ? "" : "none";

  document.getElementById("flow-student").style.display = active === "student" ? "" : "none";

  if (active === "student") activateStudentFlow();
}

function bindRoleChooser() {
  document.querySelectorAll("[data-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = btn.dataset.role;
    });
  });

  window.addEventListener("hashchange", () => {
    showRole(location.hash.slice(1));
  });

  showRole(location.hash.slice(1));
}

// Init

async function init() {
  renderNavbar("../", "topsheet");

  bindRoleChooser();

  await waitForSheet();

  try {
    state.layout = await loadTopsheetLayout();
  } catch (err) {
    showToast("Could not load the default topsheet layout.", "danger");

    return;
  }

  defaultLayout = structuredClone(state.layout);

  const lastUsed = getItem(KEYS.TOPSHEET_LAST_USED_LAYOUT);

  loadLayoutIntoSheet(lastUsed ? structuredClone(lastUsed) : state.layout);

  bindInlineEditing();

  bindSidebarEvents();

  bindFormatting();

  initLayoutControls(Boolean(lastUsed));
}

// Saved layouts (browser storage, like the front page generator)

let defaultLayout = null;

function loadLayoutIntoSheet(layout) {
  state.layout = layout;

  state.layout.texts = state.layout.texts || {};

  applyLayout(state.layout);

  /*
    Normalize all marks rows so even
    older row objects receive the
    new editable fields.
  */
  state.common.markRows = state.common.markRows.map((row) => ({
    qno: row.qno || "",

    allotted: row.allotted || "",

    awarded: row.awarded || "",

    co: row.co || "",

    bloom: row.bloom || "",

    remarks: row.remarks || "",

    fmt: row.fmt || {},
  }));

  state.layout.markRows = state.common.markRows;

  renderRubrics();

  renderMarkRows();

  selectedMarkRow = null;

  clearFormatSelection();

  layoutSnapshot = snapshotLayout();
}

// What the sheet looked like when it was loaded, saved or last asked about.
let layoutSnapshot = null;

function snapshotLayout() {
  return JSON.stringify(collectLayout(""));
}

// Snapshot of the sheet as it is now: texts, formats, page settings, rubrics, marks rows.
function collectLayout(label) {
  syncCommonFromDOM();

  return structuredClone({
    label,
    page: state.layout.page,
    texts: state.layout.texts,
    rubrics: state.common.rubrics,
    markRows: state.common.markRows,
  });
}

function renderLayoutSelect(selectedKey = "__default__") {
  const lastUsed = getItem(KEYS.TOPSHEET_LAST_USED_LAYOUT);

  const select = document.getElementById("layout-select");

  select.innerHTML = "";

  const defaultOpt = document.createElement("option");

  defaultOpt.value = "__default__";

  defaultOpt.textContent = defaultLayout.label || "Default";

  select.appendChild(defaultOpt);

  if (lastUsed) {
    const lastUsedOpt = document.createElement("option");

    lastUsedOpt.value = "__last_used__";

    lastUsedOpt.textContent = "Last used";

    select.appendChild(lastUsedOpt);
  }

  Object.entries(getItem(KEYS.TOPSHEET_LAYOUTS) || {}).forEach(([key, layout]) => {
    const opt = document.createElement("option");

    opt.value = key;

    opt.textContent = layout.label || key;

    select.appendChild(opt);
  });

  select.value = selectedKey;

  syncOverwriteButton();
}

function syncOverwriteButton() {
  const key = document.getElementById("layout-select").value;

  document.getElementById("btn-overwrite-layout").disabled = key === "__default__" || key === "__last_used__";
}

// Keeps the sheet as it is now, so the next visit starts where this one stopped.
let saveLastUsedTimer = null;

function saveLastUsedLayout() {
  clearTimeout(saveLastUsedTimer);

  saveLastUsedTimer = setTimeout(() => {
    setItem(KEYS.TOPSHEET_LAST_USED_LAYOUT, collectLayout("Last used"));
  }, 400);
}

function storeNewLayout(name) {
  const layouts = getItem(KEYS.TOPSHEET_LAYOUTS) || {};

  const key = "layout-" + Date.now();

  layouts[key] = collectLayout(name);

  if (!setItem(KEYS.TOPSHEET_LAYOUTS, layouts)) {
    showToast("Could not save the layout.", "danger");

    return false;
  }

  renderLayoutSelect(key);

  layoutSnapshot = snapshotLayout();

  return true;
}

function storeOverwrite() {
  const select = document.getElementById("layout-select");

  const layouts = getItem(KEYS.TOPSHEET_LAYOUTS) || {};

  if (select.value === "__default__" || select.value === "__last_used__" || !layouts[select.value]) {
    showToast("This layout cannot be overwritten.", "warning");

    return false;
  }

  layouts[select.value] = collectLayout(layouts[select.value].label);

  if (!setItem(KEYS.TOPSHEET_LAYOUTS, layouts)) {
    showToast("Could not save the layout.", "danger");

    return false;
  }

  layoutSnapshot = snapshotLayout();

  return true;
}

async function saveLayoutAsNew() {
  const name = await promptForText("Enter a name for this layout:");

  if (!name || !name.trim()) return;

  if (storeNewLayout(name.trim())) showToast("Saved as new layout.", "success");
}

function overwriteLayout() {
  if (storeOverwrite()) showToast("Layout overwritten.", "success");
}

// Before generating / exporting: if the layout changed since it was loaded,
// saved or last asked about, offer to save it. Resolves false when cancelled.
async function offerToSaveLayout() {
  if (snapshotLayout() === layoutSnapshot) return true;

  const layouts = getItem(KEYS.TOPSHEET_LAYOUTS) || {};

  const selected = layouts[document.getElementById("layout-select").value];

  const choice = await askToSaveLayout({
    canOverwrite: Boolean(selected),
    overwriteLabel: selected?.label,
  });

  if (!choice) return false;

  if (choice.action === "new" && storeNewLayout(choice.name)) {
    showToast("Saved as new layout.", "success");
  } else if (choice.action === "overwrite" && storeOverwrite()) {
    showToast("Layout overwritten.", "success");
  } else {
    layoutSnapshot = snapshotLayout();
  }

  return true;
}

function initLayoutControls(hasLastUsed) {
  renderLayoutSelect(hasLastUsed ? "__last_used__" : "__default__");

  document.getElementById("layout-select").addEventListener("change", (e) => {
    const key = e.target.value;

    const saved =
      key === "__last_used__"
        ? getItem(KEYS.TOPSHEET_LAST_USED_LAYOUT)
        : (getItem(KEYS.TOPSHEET_LAYOUTS) || {})[key];

    const next = key === "__default__" || !saved ? defaultLayout : saved;

    if (key !== "__default__" && !saved) {
      showToast(`Layout "${key}" not found, using the default.`, "warning");

      renderLayoutSelect();
    }

    loadLayoutIntoSheet(structuredClone(next));

    syncOverwriteButton();

    saveLastUsedLayout();
  });

  document.getElementById("btn-save-layout").addEventListener("click", saveLayoutAsNew);

  document.getElementById("btn-overwrite-layout").addEventListener("click", overwriteLayout);

  // Any change to the sheet (text, formats, table rows, placement) updates "Last used".
  new MutationObserver(saveLastUsedLayout).observe(sheetDoc().getElementById("ts-preview"), {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["style"],
  });
}

init();
