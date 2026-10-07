/**
 * Topsheet Maker: index.js
 * Fully client-side. No backend. No server uploads.
 * Imports shared libs from /lib/ (same as front-page-generator).
 */

import { renderNavbar } from "../lib/navbar.js";
import { showToast } from "../lib/ui.js";
import { extractMainSignature as processImage } from "../lib/signature-extract.js";
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
 * "firstname_lastname_roll"
 */
function makeStudentKey(name, roll) {
  return `${normalizeStr(name)}_${normalizeStr(roll)}`;
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
    if (dataURL) {
      img.src = dataURL;

      img.style.display = "";
    } else {
      img.src = "";

      img.style.display = "none";
    }
  });
}

// Image upload handlers

async function handleImageUpload(file, { stateKey, previewId, statusId, transparent, threshold, maxWidth, maxHeight }) {
  const statusEl = document.getElementById(statusId);

  const previewEl = document.getElementById(previewId);

  statusEl.textContent = "Processing...";

  previewEl.classList.remove("has-img");

  try {
    const dataURL = await processImage(file, {
      transparent,
      threshold,
      maxWidth,
      maxHeight,
    });

    if (!dataURL) {
      throw new Error("Blank or unreadable image.");
    }

    state.common[stateKey] = dataURL;

    previewEl.src = dataURL;

    previewEl.classList.add("has-img");

    statusEl.textContent = "Processed successfully";

    refreshCommonImages();
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;

    state.common[stateKey] = null;

    showToast(`Image processing failed: ${err.message}`, "danger");
  }
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
}

// Step 1 to Step 2

function goToStep2() {
  syncCommonFromDOM();

  const required = [
    "examinationTitle",

    "collegeName",

    "programme",

    "subject",

    "semester",

    "teacherName",

    "fullMarks",

    "duration",
  ];

  const missing = required.filter((k) => !state.common[k]?.trim());

  if (missing.length) {
    showToast(`Please fill: ${missing.join(", ")}`, "warning");

    return;
  }

  if (!state.common.processedTeacherSig) {
    showToast("Please upload and process the teacher signature.", "warning");

    return;
  }

  if (!state.common.processedCollegeSeal) {
    showToast("Please upload and process the college seal.", "warning");

    return;
  }

  state.step = 2;

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

    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length) {
    console.warn("CSV parse warnings:", result.errors);
  }

  const rows = result.data;

  if (!rows.length) {
    throw new Error("CSV is empty.");
  }

  if (!("name" in rows[0]) || !("roll" in rows[0])) {
    throw new Error('CSV must have "name" and "roll" columns (header row).');
  }

  return rows
    .map((r) => ({
      name: String(r.name || "").trim(),

      roll: String(r.roll || "").trim(),

      extra: r,
    }))
    .filter((r) => r.name && r.roll);
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

    const rollSuffix = "_" + normalizeStr(s.roll);

    for (const [fkey, file] of sigMap.entries()) {
      if (fkey.endsWith(rollSuffix)) {
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

  const btn = document.getElementById("btn-generate");

  btn.disabled = true;

  const needsProcessing = students.filter((s) => s.sigFile && !s.processedSig);

  if (needsProcessing.length === 0) {
    document.getElementById("btn-export-pdf").disabled = false;

    document.getElementById("btn-export-zip").disabled = false;

    state.generatedReady = true;

    showToast('All topsheets ready! Click "Export All as PDF" or "PDFs (ZIP)".', "success");

    btn.disabled = false;

    return;
  }

  showToast(`Processing ${needsProcessing.length} student signature(s)...`, "info");

  for (let i = 0; i < students.length; i++) {
    const s = students[i];

    const pct = Math.round((i / students.length) * 100);

    setProgress(`Processing student ${i + 1} / ${students.length}...`, pct);

    if (s.sigFile && !s.processedSig) {
      try {
        s.processedSig = await processImage(s.sigFile, {
          transparent: true,
          threshold: 230,
          maxWidth: 600,
          maxHeight: 200,
        });
      } catch (err) {
        console.warn(`Sig processing failed for ${s.name}:`, err);

        s.processedSig = null;
      }
    }

    await sleep(5);
  }

  setProgress("Done!", 100);

  await sleep(600);

  hideProgress();

  state.generatedReady = true;

  document.getElementById("btn-export-pdf").disabled = false;

  document.getElementById("btn-export-zip").disabled = false;

  btn.disabled = false;

  previewStudent(state.currentPreviewIdx);

  showToast(`${students.length} topsheets ready! Click "Export All as PDF" or "PDFs (ZIP)".`, "success");
}

// Build one student's topsheet for PDF export.
// The live sheet is cloned, so every edit and text format made in Step 1
// carries over; only the student-specific parts are filled in.

function buildTopsheetEl(student) {
  const doc = sheetDoc().getElementById("ts-preview").cloneNode(true);

  doc.removeAttribute("id");

  doc.classList.remove("ts-editable");

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
  // Make sure the web font is loaded before html2canvas captures the sheet.
  await document.fonts.load('7pt "Roboto Condensed"');

  await document.fonts.load('bold 7pt "Roboto Condensed"');

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

// Export all as PDF

async function exportAllAsPDF() {
  if (!state.generatedReady) {
    showToast('Click "Generate All Topsheets" first.', "warning");

    return;
  }

  const students = state.students;

  if (!students.length) {
    showToast("No students to export.", "warning");

    return;
  }

  const btnExport = document.getElementById("btn-export-pdf");

  const btnGenerate = document.getElementById("btn-generate");

  btnExport.disabled = true;

  btnGenerate.disabled = true;

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: "portrait",

    unit: "mm",

    format: "a4",
  });

  const wrap = document.createElement("div");

  wrap.style.cssText = [
    "position:fixed",

    "left:-9999px",

    "top:0",

    "width:794px",

    "height:1123px",

    "overflow:hidden",

    "background:#fff",

    "z-index:-9999",
  ].join(";");

  document.body.appendChild(wrap);

  try {
    for (let i = 0; i < students.length; i++) {
      const s = students[i];

      const pct = Math.round((i / students.length) * 100);

      setProgress(`Exporting page ${i + 1} / ${students.length}...`, pct);

      wrap.replaceChildren(buildTopsheetEl(s));

      await waitForImages(wrap);

      await sleep(60);

      const canvas = await html2canvas(wrap.firstElementChild, {
        scale: 2,

        useCORS: true,

        allowTaint: true,

        backgroundColor: "#ffffff",

        width: 794,

        height: 1123,

        scrollX: 0,

        scrollY: 0,

        logging: false,
      });

      if (i > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.92),

        "JPEG",

        0,

        0,

        210,

        297
      );

      await sleep(30);
    }

    setProgress("Saving...", 100);

    await sleep(200);

    pdf.save(`topsheets_${Date.now()}.pdf`);

    hideProgress();

    showToast(`PDF with ${students.length} page(s) saved!`, "success");
  } catch (err) {
    console.error("PDF export failed:", err);

    showToast("PDF export failed. See console for details.", "danger");

    hideProgress();
  } finally {
    document.body.removeChild(wrap);

    btnExport.disabled = false;

    btnGenerate.disabled = false;
  }
}

// Export all as separate PDFs in ZIP

async function exportAllAsZIP() {
  if (!state.generatedReady) {
    showToast('Click "Generate All Topsheets" first.', "warning");

    return;
  }

  const students = state.students;

  if (!students.length) {
    showToast("No students to export.", "warning");

    return;
  }

  const btnExportPdf = document.getElementById("btn-export-pdf");

  const btnExportZip = document.getElementById("btn-export-zip");

  const btnGenerate = document.getElementById("btn-generate");

  btnExportPdf.disabled = true;

  btnExportZip.disabled = true;

  btnGenerate.disabled = true;

  const zip = new JSZip();

  const wrap = document.createElement("div");

  wrap.style.cssText = [
    "position:fixed",

    "left:-9999px",

    "top:0",

    "width:794px",

    "height:1123px",

    "overflow:hidden",

    "background:#fff",

    "z-index:-9999",
  ].join(";");

  document.body.appendChild(wrap);

  try {
    for (let i = 0; i < students.length; i++) {
      const s = students[i];

      const pct = Math.round((i / students.length) * 100);

      setProgress(`Exporting PDF ${i + 1} / ${students.length}...`, pct);

      wrap.replaceChildren(buildTopsheetEl(s));

      await waitForImages(wrap);

      await sleep(60);

      const canvas = await html2canvas(wrap.firstElementChild, {
        scale: 2,

        useCORS: true,

        allowTaint: true,

        backgroundColor: "#ffffff",

        width: 794,

        height: 1123,

        scrollX: 0,

        scrollY: 0,

        logging: false,
      });

      const { jsPDF } = window.jspdf;

      const pdf = new jsPDF({
        orientation: "portrait",

        unit: "mm",

        format: "a4",
      });

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.92),

        "JPEG",

        0,

        0,

        210,

        297
      );

      const pdfArrayBuffer = pdf.output("arraybuffer");

      const rollClean = normalizeStr(s.roll || `student_${i + 1}`);

      const nameClean = normalizeStr(s.name || "");

      const filename = `${rollClean}_${nameClean}.pdf`.replace(/^_+|_+$/g, "");

      zip.file(filename, pdfArrayBuffer);

      await sleep(30);
    }

    setProgress("Zipping files...", 100);

    await sleep(200);

    const content = await zip.generateAsync({
      type: "blob",
    });

    const url = URL.createObjectURL(content);

    const a = document.createElement("a");

    a.href = url;

    a.download = `topsheets_${Date.now()}.zip`;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    hideProgress();

    showToast(`ZIP file with ${students.length} PDF(s) downloaded!`, "success");
  } catch (err) {
    console.error("ZIP export failed:", err);

    showToast("ZIP export failed. See console for details.", "danger");

    hideProgress();
  } finally {
    document.body.removeChild(wrap);

    btnExportPdf.disabled = false;

    btnExportZip.disabled = false;

    btnGenerate.disabled = false;
  }
}

// Bind sidebar events

function bindSidebarEvents() {
  // Teacher signature

  document.getElementById("inp-teacher-sig").addEventListener("change", (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    handleImageUpload(file, {
      stateKey: "processedTeacherSig",

      previewId: "prev-teacher-sig",

      statusId: "stat-teacher-sig",

      transparent: true,

      threshold: 225,

      maxWidth: 600,

      maxHeight: 200,
    });
  });

  // College seal

  document.getElementById("inp-college-seal").addEventListener("change", (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    handleImageUpload(file, {
      stateKey: "processedCollegeSeal",

      previewId: "prev-college-seal",

      statusId: "stat-college-seal",

      transparent: true,

      threshold: 240,

      maxWidth: 300,

      maxHeight: 300,
    });
  });

  // Step navigation

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

    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);

        state.students = rows.map((r) => ({
          name: r.name,

          roll: r.roll,

          sigFile: null,

          processedSig: null,

          matched: false,

          matchType: "none",
        }));

        document.getElementById("stat-csv").textContent = `${rows.length} student(s) loaded.`;

        document.getElementById("btn-export-pdf").disabled = true;

        document.getElementById("btn-export-zip").disabled = true;

        state.generatedReady = false;

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

    document.getElementById("btn-export-pdf").disabled = true;

    document.getElementById("btn-export-zip").disabled = true;

    state.generatedReady = false;

    tryMatch();
  });

  // Student preview selector

  document.getElementById("sel-student").addEventListener("change", (e) => {
    previewStudent(parseInt(e.target.value, 10));
  });

  // Generate

  document.getElementById("btn-generate").addEventListener("click", generateAllTopsheets);

  // Export PDF

  document.getElementById("btn-export-pdf").addEventListener("click", exportAllAsPDF);

  // Export ZIP

  document.getElementById("btn-export-zip").addEventListener("click", exportAllAsZIP);
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
    console.error(err);

    showToast("Could not load the default topsheet layout.", "danger");

    return;
  }

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

  bindInlineEditing();

  bindSidebarEvents();

  bindFormatting();
}

init();
