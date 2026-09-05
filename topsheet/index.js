/**
 * Topsheet Maker — index.js
 * Fully client-side. No backend. No server uploads.
 * Imports shared libs from /lib/ (same as front-page-generator).
 */

import { renderNavbar } from '../lib/navbar.js';
import { showToast }    from '../lib/ui.js';


// ─────────────────────────────────────────────
//  Default rubric content
// ─────────────────────────────────────────────

const DEFAULT_RUBRICS = [
  {
    letter: 'A',
    criteria: 'Conceptual Understanding',
    c1: 'Complete accuracy, deep insight – (Editable as per subject)',
    c2: 'Mostly correct, minor gaps – (Editable as per subject)',
    c3: 'Basic understanding – (Editable as per subject)',
    c4: 'Poor understanding – (Editable as per subject)',
  },

  {
    letter: 'B',
    criteria: 'Application / Problem Solving',
    c1: 'Accurate and logical application – (Editable as per subject)',
    c2: 'Minor errors in application – (Editable as per subject)',
    c3: 'Limited application ability – (Editable as per subject)',
    c4: 'Incorrect approach – (Editable as per subject)',
  },

  {
    letter: 'C',
    criteria: 'Presentation & Clarity',
    c1: 'Well-structured, clear steps – (Editable as per subject)',
    c2: 'Mostly clear – (Editable as per subject)',
    c3: 'Some lack of clarity – (Editable as per subject)',
    c4: 'Poor presentation – (Editable as per subject)',
  },

  {
    letter: 'D',
    criteria: 'Analytical Ability',
    c1: 'Strong reasoning and justification – (Editable as per subject)',
    c2: 'Adequate reasoning – (Editable as per subject)',
    c3: 'Limited reasoning – (Editable as per subject)',
    c4: 'No logical justification – (Editable as per subject)',
  },
];


const DEFAULT_MARK_ROWS = [
  {
    qno: '1.a)',
    allotted: '1',
    awarded: '',
    co: 'CO1',
    bloom: 'I - Understand',
    remarks: ''
  },

  {
    qno: '1.b)',
    allotted: '1',
    awarded: '',
    co: 'CO3',
    bloom: 'I - Recall',
    remarks: ''
  },

  {
    qno: '1.c)',
    allotted: '1',
    awarded: '',
    co: 'CO2',
    bloom: 'I - Remember',
    remarks: ''
  },

  {
    qno: '1.d)',
    allotted: '1',
    awarded: '',
    co: 'CO1',
    bloom: 'I - Recall',
    remarks: ''
  },

  {
    qno: '1.e)',
    allotted: '1',
    awarded: '',
    co: 'CO1',
    bloom: 'II - Understand',
    remarks: ''
  },

  {
    qno: '1.f)',
    allotted: '1',
    awarded: '',
    co: 'CO1',
    bloom: 'I - Memorize',
    remarks: ''
  },

  {
    qno: '1.g)',
    allotted: '1',
    awarded: '',
    co: 'CO3',
    bloom: 'I - Memorize',
    remarks: ''
  },

  {
    qno: '2',
    allotted: '5',
    awarded: '',
    co: 'CO1,CO3',
    bloom: 'VI - Discuss',
    remarks: ''
  },

  {
    qno: '3',
    allotted: '5',
    awarded: '',
    co: 'CO2',
    bloom: 'VI - Describe',
    remarks: ''
  },

  {
    qno: '4',
    allotted: '5',
    awarded: '',
    co: 'CO2',
    bloom: 'V - Explain',
    remarks: ''
  },

  {
    qno: '5',
    allotted: '5',
    awarded: '',
    co: 'CO2',
    bloom: 'I - Define',
    remarks: ''
  },

  {
    qno: '6',
    allotted: '5',
    awarded: '',
    co: 'CO2',
    bloom: 'V - Explain',
    remarks: ''
  },

  {
    qno: '7',
    allotted: '5',
    awarded: '',
    co: 'CO3',
    bloom: 'V - Explain',
    remarks: ''
  },
];


// ─────────────────────────────────────────────
//  Application state
// ─────────────────────────────────────────────

const state = {

  step: 1,

  common: {

    examinationTitle:
      'Maulana Abul Kalam Azad University of Technology, West Bengal Top Sheet for CA1 Marks Submission',

    examinationSubtitle:
      '(Written Test as a part of Continuous Assessment)',

    collegeCode: '102',

    collegeName:
      'Kalyani Government Engineering College',

    programme:
      'Enter programme',

    subject:
      'Enter Subject',

    semester:
      'Enter year / semester',

    courseCode:
      'Enter Paper Code',

    upid:
      'Enter UPID',

    examDate:
      'Enter Date of Examination',

    teacherName:
      "Enter Teacher's name",

    teacherPhone:
      'Enter Mobile number',

    fullMarks:
      'Enter Full Marks',

    duration:
      'Enter Duration',

    feedbackStrengths:
      '',

    feedbackImprovements:
      '',

    feedbackCorrective:
      '',

    rubrics:
      DEFAULT_RUBRICS.map(r => ({ ...r })),

    markRows:
      DEFAULT_MARK_ROWS.map(r => ({ ...r })),

    processedTeacherSig:
      null,

    processedCollegeSeal:
      null,
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


// ─────────────────────────────────────────────
//  Utility helpers
// ─────────────────────────────────────────────

function escHtml(str) {

  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


function sleep(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));

}


/**
 * Normalize a string:
 * lowercase, trim, collapse whitespace/hyphens/dots to underscore.
 */
function normalizeStr(s) {

  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[\s\-\.]+/g, '_')
    .replace(/_+/g, '_');

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

  const noExt =
    filename.replace(/\.[^.]+$/, '');

  return normalizeStr(noExt);

}


function setProgress(label, pct) {

  document.getElementById(
    'pdf-progress'
  ).style.display = '';

  document.getElementById(
    'prog-label'
  ).textContent = label;

  document.getElementById(
    'prog-pct'
  ).textContent = `${pct}%`;

  document.getElementById(
    'prog-bar'
  ).style.width = `${pct}%`;

}


function hideProgress() {

  document.getElementById(
    'pdf-progress'
  ).style.display = 'none';

}


// ─────────────────────────────────────────────
//  Render rubrics
// ─────────────────────────────────────────────

function renderRubrics() {

  const tbody =
    document.getElementById('ts-rubrics-body');

  if (!tbody) return;


  tbody.innerHTML =
    state.common.rubrics.map((row, ri) => `

      <tr>

        <td class="ts-rb-letter">
          ${escHtml(row.letter)}
        </td>


        <td class="ts-rb-criteria">

          <span
            class="ts-rubric-content"
            data-rb="${ri}"
            data-rb-col="criteria"
            contenteditable="true"
            spellcheck="false"
          >${escHtml(row.criteria)}</span>

        </td>


        ${['c1', 'c2', 'c3', 'c4']
          .map(col => `

            <td>

              <span
                class="ts-rubric-content"
                data-rb="${ri}"
                data-rb-col="${col}"
                contenteditable="true"
                spellcheck="false"
              >${escHtml(row[col])}</span>

            </td>

          `)
          .join('')}

      </tr>

    `)
    .join('');


  tbody.querySelectorAll('[data-rb]').forEach(el => {

    preventNewlines(el);


    el.addEventListener('input', () => {

      const ri =
        parseInt(el.dataset.rb, 10);

      const col =
        el.dataset.rbCol;


      if (!state.common.rubrics[ri]) {
        return;
      }


      state.common.rubrics[ri][col] =
        el.textContent;

    });

  });

}


// ─────────────────────────────────────────────
//  Render marks rows
// ─────────────────────────────────────────────

function renderMarkRows() {

  const tbody =
    document.getElementById('ts-marks-body');

  if (!tbody) return;


  tbody.innerHTML =
    state.common.markRows.map((row, ri) => `

      <tr
        data-mark-row="${ri}"
        class="${
          selectedMarkRow === ri
            ? 'ts-mark-row-selected'
            : ''
        }"
      >


        <!-- Q. No. -->

        <td class="ts-qno">

          <span
            class="ts-mark-content"
            data-mk="${ri}"
            data-mk-col="qno"
            contenteditable="true"
            spellcheck="false"
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
          >${escHtml(row.awarded || '')}</span>

        </td>


        <!-- Course Outcome -->

        <td class="ts-co">

          <span
            class="ts-mark-content"
            data-mk="${ri}"
            data-mk-col="co"
            contenteditable="true"
            spellcheck="false"
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
          >${escHtml(row.remarks || '')}</span>

        </td>


      </tr>

    `)
    .join('');


  // Bind every editable mark cell.
  tbody.querySelectorAll('[data-mk]').forEach(el => {

    preventNewlines(el);


    /*
      When the user focuses any field in a row,
      that row becomes the active row.
    */
    el.addEventListener('focus', () => {

      selectMarkRow(
        parseInt(el.dataset.mk, 10)
      );

    });


    /*
      Also select the row on click.
    */
    el.addEventListener('click', () => {

      selectMarkRow(
        parseInt(el.dataset.mk, 10)
      );

    });


    /*
      Save the edited value into application state.
    */
    el.addEventListener('input', () => {

      const ri =
        parseInt(el.dataset.mk, 10);

      const col =
        el.dataset.mkCol;


      if (!state.common.markRows[ri]) {
        return;
      }


      state.common.markRows[ri][col] =
        el.textContent;

    });

  });


  updateMarkRowActionUI();

}


// ─────────────────────────────────────────────
//  Marks row selection
// ─────────────────────────────────────────────

function selectMarkRow(index) {

  if (
    index < 0 ||
    index >= state.common.markRows.length
  ) {

    return;

  }


  selectedMarkRow = index;


  // Highlight the selected row.
  document
    .querySelectorAll(
      '#ts-marks-body tr[data-mark-row]'
    )
    .forEach(row => {

      const rowIndex =
        parseInt(row.dataset.markRow, 10);

      row.classList.toggle(
        'ts-mark-row-selected',
        rowIndex === selectedMarkRow
      );

    });


  updateMarkRowActionUI();

}


// ─────────────────────────────────────────────
//  Update marks row actions panel
// ─────────────────────────────────────────────

function updateMarkRowActionUI() {

  const card =
    document.getElementById(
      'card-mark-row-actions'
    );

  if (!card) return;


  /*
    No row selected:
    hide the action card.
  */
  if (
    selectedMarkRow === null ||
    !state.common.markRows[selectedMarkRow]
  ) {

    card.style.display = 'none';

    return;

  }


  /*
    Valid row selected:
    show action card.
  */
  card.style.display = '';


  const rowNumberEl =
    document.getElementById(
      'mark-row-number'
    );


  if (rowNumberEl) {

    rowNumberEl.textContent =
      `Row ${selectedMarkRow + 1} of ${state.common.markRows.length}`;

  }


  /*
    Do not allow deleting the final remaining row.
  */
  const removeBtn =
    document.getElementById(
      'btn-remove-mark-row'
    );


  if (removeBtn) {

    removeBtn.disabled =
      state.common.markRows.length <= 1;

  }

}


// ─────────────────────────────────────────────
//  Create blank marks row
// ─────────────────────────────────────────────

function createBlankMarkRow() {

  return {

    qno: '',

    allotted: '',

    awarded: '',

    co: '',

    bloom: '',

    remarks: '',

  };

}


// ─────────────────────────────────────────────
//  Remove selected marks row
// ─────────────────────────────────────────────

function removeSelectedMarkRow() {

  if (selectedMarkRow === null) {

    return;

  }


  if (
    state.common.markRows.length <= 1
  ) {

    showToast(
      'At least one marks row must remain.',
      'warning'
    );

    return;

  }


  const removedIndex =
    selectedMarkRow;


  state.common.markRows.splice(
    removedIndex,
    1
  );


  /*
    After deleting:

    - if the deleted row was the last row,
      select the new last row.

    - otherwise keep the same numeric index,
      which now points at the next row.
  */
  if (
    removedIndex >=
    state.common.markRows.length
  ) {

    selectedMarkRow =
      state.common.markRows.length - 1;

  } else {

    selectedMarkRow =
      removedIndex;

  }


  renderMarkRows();


  showToast(
    'Marks row removed.',
    'success'
  );

}


// ─────────────────────────────────────────────
//  Add row ABOVE selected row
// ─────────────────────────────────────────────

function addMarkRowAbove() {

  const insertIndex =
    selectedMarkRow === null
      ? 0
      : selectedMarkRow;


  state.common.markRows.splice(
    insertIndex,
    0,
    createBlankMarkRow()
  );


  selectedMarkRow =
    insertIndex;


  renderMarkRows();


  focusNewMarkRow(
    insertIndex
  );


  showToast(
    'New row added above.',
    'success'
  );

}


// ─────────────────────────────────────────────
//  Add row BELOW selected row
// ─────────────────────────────────────────────

function addMarkRowBelow() {

  const insertIndex =
    selectedMarkRow === null
      ? state.common.markRows.length
      : selectedMarkRow + 1;


  state.common.markRows.splice(
    insertIndex,
    0,
    createBlankMarkRow()
  );


  selectedMarkRow =
    insertIndex;


  renderMarkRows();


  focusNewMarkRow(
    insertIndex
  );


  showToast(
    'New row added below.',
    'success'
  );

}


// ─────────────────────────────────────────────
//  Focus newly-created row
// ─────────────────────────────────────────────

function focusNewMarkRow(index) {

  requestAnimationFrame(() => {

    const el =
      document.querySelector(
        `#ts-marks-body tr[data-mark-row="${index}"] [data-mk-col="qno"]`
      );


    if (!el) {

      return;

    }


    el.focus();


    /*
      Put caret at the beginning of the new row.
    */
    const range =
      document.createRange();

    range.selectNodeContents(el);

    range.collapse(true);


    const selection =
      window.getSelection();


    if (selection) {

      selection.removeAllRanges();

      selection.addRange(range);

    }

  });

}


// ─────────────────────────────────────────────
//  Prevent Enter in single-line fields
// ─────────────────────────────────────────────

function preventNewlines(el) {

  el.addEventListener(
    'keydown',
    e => {

      if (e.key === 'Enter') {

        e.preventDefault();

      }

    }
  );

}


// ─────────────────────────────────────────────
//  Bind inline editing
// ─────────────────────────────────────────────

function bindInlineEditing() {

  const preview =
    document.getElementById(
      'ts-preview'
    );


  preview
    .querySelectorAll('[data-field]')
    .forEach(el => {

      preventNewlines(el);


      el.addEventListener(
        'input',
        () => {

          state.common[
            el.dataset.field
          ] = el.textContent;

        }
      );

    });

}


// ─────────────────────────────────────────────
//  Sync DOM → state
// ─────────────────────────────────────────────

function syncCommonFromDOM() {

  const preview =
    document.getElementById(
      'ts-preview'
    );


  // Common fields.
  preview
    .querySelectorAll('[data-field]')
    .forEach(el => {

      state.common[
        el.dataset.field
      ] = el.textContent;

    });


  // Rubrics.
  preview
    .querySelectorAll('[data-rb]')
    .forEach(el => {

      const ri =
        parseInt(el.dataset.rb, 10);

      const col =
        el.dataset.rbCol;


      if (state.common.rubrics[ri]) {

        state.common.rubrics[ri][col] =
          el.textContent;

      }

    });


  // Marks.
  preview
    .querySelectorAll('[data-mk]')
    .forEach(el => {

      const ri =
        parseInt(el.dataset.mk, 10);

      const col =
        el.dataset.mkCol;


      if (state.common.markRows[ri]) {

        state.common.markRows[ri][col] =
          el.textContent;

      }

    });

}


// ─────────────────────────────────────────────
//  Image processing
// ─────────────────────────────────────────────

async function processImage(file, {

  transparent = true,

  threshold = 200,

  maxWidth = 600,

  maxHeight = 200,

  debugCanvasId = null,

} = {}) {

  return new Promise(
    (resolve, reject) => {

      if (
        typeof cv === 'undefined' ||
        typeof cv.Mat !== 'function'
      ) {

        reject(
          new Error(
            'OpenCV is still loading. Please try again in a few seconds.'
          )
        );

        return;

      }


      const reader =
        new FileReader();


      reader.onload = e => {

        const img =
          new Image();


        img.onload = () => {

          const mats = [];


          const owned =
            mat => {

              mats.push(mat);

              return mat;

            };


          try {

            /* 1. Read source image. */
            const src =
              owned(
                cv.imread(img)
              );


            /* 2. Convert to grayscale. */

            const gray =
              owned(
                new cv.Mat()
              );


            cv.cvtColor(
              src,
              gray,
              cv.COLOR_RGBA2GRAY,
              0
            );


            /*
              3. Estimate paper/background illumination.
            */

            let ksize =
              Math.max(
                31,
                Math.floor(
                  Math.min(
                    src.cols,
                    src.rows
                  ) / 8
                ) | 1
              );


            if (
              (ksize & 1) === 0
            ) {

              ksize++;

            }


            ksize =
              Math.min(
                ksize,
                151
              );


            const bg =
              owned(
                new cv.Mat()
              );


            cv.GaussianBlur(
              gray,
              bg,
              new cv.Size(
                ksize,
                ksize
              ),
              0,
              0,
              cv.BORDER_REPLICATE
            );


            /*
              4. Flatten uneven lighting.
            */

            const safeBg =
              owned(
                bg.clone()
              );


            const safeBgData =
              safeBg.data;


            for (
              let i = 0;
              i < safeBgData.length;
              i++
            ) {

              if (
                safeBgData[i] < 1
              ) {

                safeBgData[i] = 1;

              }

            }


            const norm =
              owned(
                new cv.Mat()
              );


            cv.divide(
              gray,
              safeBg,
              norm,
              255
            );


            /*
              5. Conservative foreground mask.
            */

            let blockSize =
              Math.max(
                15,
                Math.floor(
                  Math.min(
                    src.cols,
                    src.rows
                  ) / 18
                ) | 1
              );


            if (
              (blockSize & 1) === 0
            ) {

              blockSize++;

            }


            blockSize =
              Math.min(
                blockSize,
                101
              );


            const mask =
              owned(
                new cv.Mat()
              );


            cv.adaptiveThreshold(
              norm,
              mask,
              255,
              cv.ADAPTIVE_THRESH_GAUSSIAN_C,
              cv.THRESH_BINARY_INV,
              blockSize,
              7
            );


            /*
              Only opening.
              Do NOT use morphological closing.
            */

            const morphKernel =
              owned(
                cv.getStructuringElement(
                  cv.MORPH_ELLIPSE,
                  new cv.Size(
                    3,
                    3
                  )
                )
              );


            cv.morphologyEx(
              mask,
              mask,
              cv.MORPH_OPEN,
              morphKernel
            );


            /*
              6. Connected components.
            */

            const labels =
              owned(
                new cv.Mat()
              );


            const stats =
              owned(
                new cv.Mat()
              );


            const centroids =
              owned(
                new cv.Mat()
              );


            const componentCount =
              cv.connectedComponentsWithStats(
                mask,
                labels,
                stats,
                centroids,
                8,
                cv.CV_32S
              );


            const cleanedMask =
              owned(
                cv.Mat.zeros(
                  src.rows,
                  src.cols,
                  cv.CV_8UC1
                )
              );


            const imgArea =
              src.cols * src.rows;


            const minArea =
              Math.max(
                8,
                imgArea * 0.00002
              );


            const maxArea =
              imgArea * 0.35;


            const validLabels =
              new Uint8Array(
                componentCount
              );


            for (
              let label = 1;
              label < componentCount;
              label++
            ) {

              const x =
                stats.intAt(
                  label,
                  cv.CC_STAT_LEFT
                );


              const y =
                stats.intAt(
                  label,
                  cv.CC_STAT_TOP
                );


              const w =
                stats.intAt(
                  label,
                  cv.CC_STAT_WIDTH
                );


              const h =
                stats.intAt(
                  label,
                  cv.CC_STAT_HEIGHT
                );


              const area =
                stats.intAt(
                  label,
                  cv.CC_STAT_AREA
                );


              const touchesBorder =
                (
                  x <= 0 ||
                  y <= 0 ||
                  x + w >= src.cols ||
                  y + h >= src.rows
                );


              if (
                !touchesBorder &&
                area >= minArea &&
                area <= maxArea
              ) {

                validLabels[label] =
                  1;

              }

            }


            /*
              Copy original mask pixels.
              Do not fill contours.
            */

            const labelsData =
              labels.data32S;


            const cleanData =
              cleanedMask.data;


            for (
              let i = 0;
              i < labelsData.length;
              i++
            ) {

              const label =
                labelsData[i];


              if (
                label > 0 &&
                validLabels[label]
              ) {

                cleanData[i] =
                  255;

              }

            }


            /*
              Fallback.
            */

            let hasForeground =
              false;


            for (
              let i = 0;
              i < cleanData.length;
              i++
            ) {

              if (
                cleanData[i]
              ) {

                hasForeground =
                  true;

                break;

              }

            }


            if (!hasForeground) {

              mask.copyTo(
                cleanedMask
              );

            }


            /*
              7. Determine bounding box.
            */

            const bboxPoints =
              new cv.MatVector();


            mats.push(
              bboxPoints
            );


            const bboxHierarchy =
              owned(
                new cv.Mat()
              );


            cv.findContours(
              cleanedMask,
              bboxPoints,
              bboxHierarchy,
              cv.RETR_EXTERNAL,
              cv.CHAIN_APPROX_SIMPLE
            );


            let minX =
              src.cols;


            let minY =
              src.rows;


            let maxX =
              0;


            let maxY =
              0;


            let found =
              false;


            for (
              let i = 0;
              i < bboxPoints.size();
              i++
            ) {

              const cnt =
                bboxPoints.get(i);


              const rect =
                cv.boundingRect(
                  cnt
                );


              cnt.delete();


              if (
                rect.width > 1 &&
                rect.height > 1
              ) {

                minX =
                  Math.min(
                    minX,
                    rect.x
                  );


                minY =
                  Math.min(
                    minY,
                    rect.y
                  );


                maxX =
                  Math.max(
                    maxX,
                    rect.x +
                    rect.width
                  );


                maxY =
                  Math.max(
                    maxY,
                    rect.y +
                    rect.height
                  );


                found =
                  true;

              }

            }


            bboxPoints.delete();


            if (!found) {

              cleanup();

              resolve(null);

              return;

            }


            const PAD =
              4;


            minX =
              Math.max(
                0,
                minX - PAD
              );


            minY =
              Math.max(
                0,
                minY - PAD
              );


            maxX =
              Math.min(
                src.cols,
                maxX + PAD
              );


            maxY =
              Math.min(
                src.rows,
                maxY + PAD
              );


            const cropRect =
              new cv.Rect(
                minX,
                minY,
                Math.max(
                  1,
                  maxX - minX
                ),
                Math.max(
                  1,
                  maxY - minY
                )
              );


            /*
              8. Crop source and alpha mask.
            */

            const croppedSrc =
              owned(
                src.roi(
                  cropRect
                )
              );


            const croppedMask =
              owned(
                cleanedMask.roi(
                  cropRect
                )
              );


            /*
              9. Preserve original RGB.
              Use cleaned mask only as alpha.
            */

            const finalRgba =
              owned(
                croppedSrc.clone()
              );


            if (transparent) {

              const rgbaPlanes =
                owned(
                  new cv.MatVector()
                );


              cv.split(
                finalRgba,
                rgbaPlanes
              );


              rgbaPlanes.set(
                3,
                croppedMask
              );


              cv.merge(
                rgbaPlanes,
                finalRgba
              );

            }


            /*
              10. Resize only when required.
            */

            let outW =
              finalRgba.cols;


            let outH =
              finalRgba.rows;


            if (
              outW > maxWidth ||
              outH > maxHeight
            ) {

              const scale =
                Math.min(
                  maxWidth / outW,
                  maxHeight / outH,
                  1
                );


              outW =
                Math.max(
                  1,
                  Math.round(
                    outW * scale
                  )
                );


              outH =
                Math.max(
                  1,
                  Math.round(
                    outH * scale
                  )
                );

            }


            const finalDst =
              owned(
                new cv.Mat()
              );


            cv.resize(
              finalRgba,
              finalDst,
              new cv.Size(
                outW,
                outH
              ),
              0,
              0,
              cv.INTER_AREA
            );


            /*
              11. Export PNG.
            */

            const outCanvas =
              document.createElement(
                'canvas'
              );


            cv.imshow(
              outCanvas,
              finalDst
            );


            const dataURL =
              outCanvas.toDataURL(
                'image/png'
              );


            /*
              Optional debug output.
            */

            if (debugCanvasId) {

              const dbgContainer =
                document.getElementById(
                  debugCanvasId
                );


              if (dbgContainer) {

                dbgContainer.innerHTML =
                  '';


                const debugItems = [

                  [
                    '1. Original',
                    src
                  ],

                  [
                    '2. Normalized',
                    norm
                  ],

                  [
                    '3. Threshold Mask',
                    mask
                  ],

                  [
                    '4. Cleaned Mask',
                    cleanedMask
                  ],

                  [
                    '5. Final',
                    finalDst
                  ],

                ];


                for (
                  const [
                    title,
                    mat
                  ] of debugItems
                ) {

                  const c =
                    document.createElement(
                      'canvas'
                    );


                  c.title =
                    title;


                  c.style.maxWidth =
                    '200px';


                  c.style.margin =
                    '5px';


                  c.style.border =
                    '1px solid #ccc';


                  cv.imshow(
                    c,
                    mat
                  );


                  dbgContainer.appendChild(
                    c
                  );

                }

              }

            }


            cleanup();

            resolve(
              dataURL
            );


            function cleanup() {

              for (
                const mat of mats
              ) {

                try {

                  if (
                    mat &&
                    typeof mat.delete ===
                      'function'
                  ) {

                    mat.delete();

                  }

                } catch (_) {

                  // Ignore cleanup errors.

                }

              }

            }


          } catch (err) {

            for (
              const mat of mats
            ) {

              try {

                if (
                  mat &&
                  typeof mat.delete ===
                    'function'
                ) {

                  mat.delete();

                }

              } catch (_) {

                // Ignore cleanup errors.

              }

            }


            console.error(
              'OpenCV processing error:',
              err
            );


            reject(
              new Error(
                `Failed to process image with OpenCV: ${
                  err.message || err
                }`
              )
            );

          }

        };


        img.onerror = () => {

          reject(
            new Error(
              'Image load failed'
            )
          );

        };


        img.src =
          e.target.result;

      };


      reader.onerror = () => {

        reject(
          new Error(
            'FileReader failed'
          )
        );

      };


      reader.readAsDataURL(
        file
      );

    }
  );

}


// ─────────────────────────────────────────────
//  Update teacher signature / seal
// ─────────────────────────────────────────────

function refreshCommonImages() {

  setImgEl(
    '.ts-teacher-sig',
    state.common.processedTeacherSig
  );


  setImgEl(
    '.ts-college-seal',
    state.common.processedCollegeSeal
  );

}


function setImgEl(
  selector,
  dataURL
) {

  document
    .querySelectorAll(selector)
    .forEach(img => {

      if (dataURL) {

        img.src =
          dataURL;

        img.style.display =
          '';

      } else {

        img.src =
          '';

        img.style.display =
          'none';

      }

    });

}


// ─────────────────────────────────────────────
//  Image upload handlers
// ─────────────────────────────────────────────

async function handleImageUpload(
  file,
  {
    stateKey,
    previewId,
    statusId,
    transparent,
    threshold,
    maxWidth,
    maxHeight,
  }
) {

  const statusEl =
    document.getElementById(
      statusId
    );


  const previewEl =
    document.getElementById(
      previewId
    );


  statusEl.textContent =
    '⏳ Processing…';


  previewEl.classList.remove(
    'has-img'
  );


  try {

    const dataURL =
      await processImage(
        file,
        {
          transparent,
          threshold,
          maxWidth,
          maxHeight,
        }
      );


    if (!dataURL) {

      throw new Error(
        'Blank or unreadable image.'
      );

    }


    state.common[stateKey] =
      dataURL;


    previewEl.src =
      dataURL;


    previewEl.classList.add(
      'has-img'
    );


    statusEl.textContent =
      '✅ Processed successfully';


    refreshCommonImages();


  } catch (err) {

    statusEl.textContent =
      `❌ ${err.message}`;


    state.common[stateKey] =
      null;


    showToast(
      `Image processing failed: ${err.message}`,
      'danger'
    );

  }

}


// ─────────────────────────────────────────────
//  Step 1 → Step 2
// ─────────────────────────────────────────────

function goToStep2() {

  syncCommonFromDOM();


  const required = [

    'examinationTitle',

    'collegeName',

    'programme',

    'subject',

    'semester',

    'teacherName',

    'fullMarks',

    'duration',

  ];


  const missing =
    required.filter(
      k => !state.common[k]?.trim()
    );


  if (missing.length) {

    showToast(
      `Please fill: ${missing.join(', ')}`,
      'warning'
    );

    return;

  }


  if (
    !state.common.processedTeacherSig
  ) {

    showToast(
      'Please upload and process the teacher signature.',
      'warning'
    );

    return;

  }


  if (
    !state.common.processedCollegeSeal
  ) {

    showToast(
      'Please upload and process the college seal.',
      'warning'
    );

    return;

  }


  state.step =
    2;


  document.getElementById(
    'sidebar-s1'
  ).style.display =
    'none';


  document.getElementById(
    'sidebar-s2'
  ).style.display =
    '';


  document.getElementById(
    'pill-s1'
  ).classList.replace(
    'active',
    'done'
  );


  document.getElementById(
    'pill-s2'
  ).classList.add(
    'active'
  );


  /*
    Lock Step 1 fields.
  */
  document
    .getElementById('ts-preview')
    .querySelectorAll(
      '[contenteditable]'
    )
    .forEach(el => {

      el.removeAttribute(
        'contenteditable'
      );

    });


  document
    .getElementById(
      'ts-preview'
    )
    .classList.remove(
      'ts-editable'
    );


  /*
    The marks action panel belongs
    to Step 1, so it disappears with
    sidebar-s1 automatically.
  */
  updateMarkRowActionUI();


  showToast(
    'Step 1 complete! Now upload student data.',
    'success'
  );

}


// ─────────────────────────────────────────────
//  Step 2 → Step 1
// ─────────────────────────────────────────────

function goToStep1() {

  state.step =
    1;


  document.getElementById(
    'sidebar-s2'
  ).style.display =
    'none';


  document.getElementById(
    'sidebar-s1'
  ).style.display =
    '';


  document.getElementById(
    'pill-s2'
  ).classList.remove(
    'active'
  );


  document.getElementById(
    'pill-s1'
  ).classList.replace(
    'done',
    'active'
  );


  const preview =
    document.getElementById(
      'ts-preview'
    );


  preview.classList.add(
    'ts-editable'
  );


  restorePreviewFromState();

}


// ─────────────────────────────────────────────
//  Restore preview from state
// ─────────────────────────────────────────────

function restorePreviewFromState() {

  const preview =
    document.getElementById(
      'ts-preview'
    );


  preview
    .querySelectorAll(
      '[data-field]'
    )
    .forEach(el => {

      const f =
        el.dataset.field;


      if (
        state.common[f] !==
        undefined
      ) {

        el.textContent =
          state.common[f];

      }


      el.setAttribute(
        'contenteditable',
        'true'
      );


      el.setAttribute(
        'spellcheck',
        'false'
      );


      preventNewlines(
        el
      );


      el.addEventListener(
        'input',
        () => {

          state.common[f] =
            el.textContent;

        }
      );

    });


  renderRubrics();

  renderMarkRows();

}


// ─────────────────────────────────────────────
//  CSV parsing
// ─────────────────────────────────────────────

function parseCSV(text) {

  const result =
    Papa.parse(
      text,
      {
        header: true,

        skipEmptyLines: true,

        transformHeader:
          h => h.trim().toLowerCase(),
      }
    );


  if (
    result.errors.length
  ) {

    console.warn(
      'CSV parse warnings:',
      result.errors
    );

  }


  const rows =
    result.data;


  if (!rows.length) {

    throw new Error(
      'CSV is empty.'
    );

  }


  if (
    !('name' in rows[0]) ||
    !('roll' in rows[0])
  ) {

    throw new Error(
      'CSV must have "name" and "roll" columns (header row).'
    );

  }


  return rows
    .map(r => ({

      name:
        String(
          r.name || ''
        ).trim(),

      roll:
        String(
          r.roll || ''
        ).trim(),

      extra:
        r,

    }))
    .filter(
      r => r.name && r.roll
    );

}


// ─────────────────────────────────────────────
//  Signature folder map
// ─────────────────────────────────────────────

function buildSigFileMap(
  fileList
) {

  const map =
    new Map();


  for (
    const file of fileList
  ) {

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {

      continue;

    }


    const basename =
      file.name
        .split('/')
        .pop()
        .split('\\')
        .pop();


    const key =
      normalizeFilename(
        basename
      );


    map.set(
      key,
      file
    );

  }


  return map;

}


// ─────────────────────────────────────────────
//  Match students
// ─────────────────────────────────────────────

function matchStudents(
  csvStudents,
  sigMap
) {

  return csvStudents.map(
    s => {

      const exactKey =
        makeStudentKey(
          s.name,
          s.roll
        );


      // 1. Exact match

      if (
        sigMap.has(
          exactKey
        )
      ) {

        return {

          ...s,

          sigFile:
            sigMap.get(
              exactKey
            ),

          matched:
            true,

          matchType:
            'exact',

        };

      }


      // 2. Roll fallback

      const rollSuffix =
        '_' +
        normalizeStr(
          s.roll
        );


      for (
        const [
          fkey,
          file
        ] of sigMap.entries()
      ) {

        if (
          fkey.endsWith(
            rollSuffix
          )
        ) {

          return {

            ...s,

            sigFile:
              file,

            matched:
              true,

            matchType:
              'roll-fallback',

          };

        }

      }


      // 3. Missing

      return {

        ...s,

        sigFile:
          null,

        matched:
          false,

        matchType:
          'none',

        processedSig:
          null,

      };

    }
  );

}


// ─────────────────────────────────────────────
//  Validation UI
// ─────────────────────────────────────────────

function renderValidationUI() {

  const students =
    state.students;


  const total =
    students.length;


  const matched =
    students.filter(
      s => s.matched
    ).length;


  const unmatched =
    total - matched;


  const sigTotal =
    state.sigFileMap.size;


  const summaryEl =
    document.getElementById(
      'val-summary'
    );


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
          : ''
      }

    </div>

  `;


  const tbody =
    document.getElementById(
      'val-table-body'
    );


  tbody.innerHTML =
    students
      .map(
        s => {

          const statusBadge =
            s.matched

              ? `
                <span class="badge text-bg-success">
                  ${
                    s.matchType ===
                    'roll-fallback'
                      ? '⚠ roll-match'
                      : '✓ matched'
                  }
                </span>
              `

              : `
                <span class="badge text-bg-danger">
                  ✗ missing
                </span>
              `;


          const sigName =
            s.sigFile
              ? escHtml(
                  s.sigFile.name
                )
              : '—';


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

        }
      )
      .join('');


  document.getElementById(
    'card-validation'
  ).style.display =
    '';


  const hasMatched =
    matched > 0;


  document.getElementById(
    'card-generate'
  ).style.display =
    hasMatched
      ? ''
      : 'none';


  if (
    unmatched > 0
  ) {

    showToast(
      `⚠ ${unmatched} student(s) have no signature file.`,
      'warning'
    );

  }

}


// ─────────────────────────────────────────────
//  Try matching
// ─────────────────────────────────────────────

function tryMatch() {

  if (
    !state.students.length &&
    !state.sigFileMap.size
  ) {

    return;

  }


  const matched =
    matchStudents(
      state.students,
      state.sigFileMap
    );


  state.students =
    matched.map(
      (s, i) => ({

        ...s,

        processedSig:
          state.students[i]
            ?.processedSig ??
          null,

      })
    );


  renderValidationUI();

  buildStudentSelector();

}


// ─────────────────────────────────────────────
//  Student selector
// ─────────────────────────────────────────────

function buildStudentSelector() {

  const sel =
    document.getElementById(
      'sel-student'
    );


  sel.innerHTML =
    state.students
      .map(
        (s, i) => `

          <option value="${i}">

            ${escHtml(s.roll)}
            —
            ${escHtml(s.name)}

          </option>

        `
      )
      .join('');


  document.getElementById(
    'card-preview-sel'
  ).style.display =
    state.students.length
      ? ''
      : 'none';


  if (
    state.students.length
  ) {

    previewStudent(0);

  }

}


// ─────────────────────────────────────────────
//  Student preview
// ─────────────────────────────────────────────

function previewStudent(idx) {

  state.currentPreviewIdx =
    idx;


  const s =
    state.students[idx];


  if (!s) {

    return;

  }


  const nameEl =
    document.querySelector(
      '.ts-student-name'
    );


  const rollEl =
    document.querySelector(
      '.ts-student-roll'
    );


  if (nameEl) {

    nameEl.textContent =
      s.name;

    nameEl.classList.remove(
      'ts-ph'
    );

  }


  if (rollEl) {

    rollEl.textContent =
      s.roll;

    rollEl.classList.remove(
      'ts-ph'
    );

  }


  const sigImg =
    document.querySelector(
      '.ts-student-sig'
    );


  if (sigImg) {

    if (
      s.processedSig
    ) {

      sigImg.src =
        s.processedSig;

      sigImg.style.display =
        '';

    } else {

      sigImg.src =
        '';

      sigImg.style.display =
        'none';

    }

  }

}


// ─────────────────────────────────────────────
//  Generate all topsheets
// ─────────────────────────────────────────────

async function generateAllTopsheets() {

  const students =
    state.students;


  if (!students.length) {

    showToast(
      'No matched students.',
      'warning'
    );

    return;

  }


  const btn =
    document.getElementById(
      'btn-generate'
    );


  btn.disabled =
    true;


  const needsProcessing =
    students.filter(
      s =>
        s.sigFile &&
        !s.processedSig
    );


  if (
    needsProcessing.length === 0
  ) {

    document.getElementById(
      'btn-export-pdf'
    ).disabled =
      false;


    document.getElementById(
      'btn-export-zip'
    ).disabled =
      false;


    state.generatedReady =
      true;


    showToast(
      'All topsheets ready! Click "Export All as PDF" or "PDFs (ZIP)".',
      'success'
    );


    btn.disabled =
      false;


    return;

  }


  showToast(
    `Processing ${needsProcessing.length} student signature(s)…`,
    'info'
  );


  for (
    let i = 0;
    i < students.length;
    i++
  ) {

    const s =
      students[i];


    const pct =
      Math.round(
        (i / students.length) *
        100
      );


    setProgress(
      `Processing student ${i + 1} / ${students.length}…`,
      pct
    );


    if (
      s.sigFile &&
      !s.processedSig
    ) {

      try {

        s.processedSig =
          await processImage(
            s.sigFile,
            {
              transparent: true,
              threshold: 230,
              maxWidth: 600,
              maxHeight: 200,
            }
          );

      } catch (err) {

        console.warn(
          `Sig processing failed for ${s.name}:`,
          err
        );


        s.processedSig =
          null;

      }

    }


    await sleep(5);

  }


  setProgress(
    'Done!',
    100
  );


  await sleep(
    600
  );


  hideProgress();


  state.generatedReady =
    true;


  document.getElementById(
    'btn-export-pdf'
  ).disabled =
    false;


  document.getElementById(
    'btn-export-zip'
  ).disabled =
    false;


  btn.disabled =
    false;


  previewStudent(
    state.currentPreviewIdx
  );


  showToast(
    `${students.length} topsheets ready! Click "Export All as PDF" or "PDFs (ZIP)".`,
    'success'
  );

}


// ─────────────────────────────────────────────
//  Build static topsheet HTML for PDF
// ─────────────────────────────────────────────

function buildTopsheetHTML(
  common,
  student
) {

  const rubricRows =
    common.rubrics
      .map(
        r => `

          <tr>

            <td class="ts-rb-letter">
              ${escHtml(r.letter)}
            </td>

            <td class="ts-rb-criteria">
              <span class="ts-rubric-content">
                ${escHtml(r.criteria)}
              </span>
            </td>

            <td>
              <span class="ts-rubric-content">
                ${escHtml(r.c1)}
              </span>
            </td>

            <td>
              <span class="ts-rubric-content">
                ${escHtml(r.c2)}
              </span>
            </td>

            <td>
              <span class="ts-rubric-content">
                ${escHtml(r.c3)}
              </span>
            </td>

            <td>
              <span class="ts-rubric-content">
                ${escHtml(r.c4)}
              </span>
            </td>

          </tr>

        `
      )
      .join('');


  /*
    Use the actual editable marks-row state.
    Added / deleted / edited rows therefore
    appear in exported PDFs as well.
  */
  const markRows =
    common.markRows
      .map(
        r => `

          <tr>

            <td class="ts-qno">
              <span class="ts-mark-content">
                ${escHtml(r.qno)}
              </span>
            </td>

            <td class="ts-allotted">
              <span class="ts-mark-content">
                ${escHtml(r.allotted)}
              </span>
            </td>

            <td class="ts-awarded">
              <span class="ts-mark-content">
                ${escHtml(r.awarded || '')}
              </span>
            </td>

            <td class="ts-co">
              <span class="ts-mark-content">
                ${escHtml(r.co)}
              </span>
            </td>

            <td class="ts-bloom">
              <span class="ts-mark-content">
                ${escHtml(r.bloom)}
              </span>
            </td>

            <td class="ts-remarks">
              <span class="ts-mark-content">
                ${escHtml(r.remarks || '')}
              </span>
            </td>

          </tr>

        `
      )
      .join('');


  const studentSig =
    student?.processedSig

      ? `
        <img
          class="ts-sig-img ts-student-sig"
          src="${student.processedSig}"
          alt=""
          style="display:block;"
        >
      `

      : '';


  const teacherSig =
    common.processedTeacherSig

      ? `
        <img
          class="ts-sig-img ts-teacher-sig"
          src="${common.processedTeacherSig}"
          alt=""
          style="display:block;"
        >
      `

      : '';


  const collegeSeal =
    common.processedCollegeSeal

      ? `
        <img
          class="ts-seal-img ts-college-seal"
          src="${common.processedCollegeSeal}"
          alt=""
          style="display:block;"
        >
      `

      : '';


  return `

    <div
      class="ts-doc"
      style="
        width:794px;
        height:1123px;
        min-height:0;
        box-sizing:border-box;
      "
    >


      <!-- HEADER -->

      <div class="ts-header">

        <div class="ts-title-line">
          ${escHtml(common.examinationTitle)}
        </div>

        <div class="ts-subtitle-line">
          ${escHtml(common.examinationSubtitle)}
        </div>

        <div class="ts-college-line">
          College Code &amp; No:&nbsp;
          ${escHtml(common.collegeCode)},
          &nbsp;
          ${escHtml(common.collegeName)}
        </div>

      </div>


      <!-- INFORMATION TABLE -->

      <table class="ts-info-table">

        <tbody>

          <tr>

            <td>
              Programme:&nbsp;
              ${escHtml(common.programme)}
            </td>

            <td>
              Year/Semester:&nbsp;
              ${escHtml(common.semester)}
            </td>

          </tr>


          <tr>

            <td>
              Subject (course):&nbsp;
              ${escHtml(common.subject)}
            </td>

            <td>
              Paper (course) Code:&nbsp;
              ${escHtml(common.courseCode)}
            </td>

          </tr>


          <tr>

            <td>
              UPID:&nbsp;
              ${escHtml(common.upid)}
            </td>

            <td>
              Date of Examination:&nbsp;
              ${escHtml(common.examDate)}
            </td>

          </tr>


          <tr>

            <td>
              Name of the Student:&nbsp;
              ${escHtml(student?.name ?? '')}
            </td>

            <td>
              Roll Number:&nbsp;
              ${escHtml(String(student?.roll ?? ''))}
            </td>

          </tr>


          <tr>

            <td>
              Subject Teacher:&nbsp;
              ${escHtml(common.teacherName)}
            </td>

            <td>
              Mobile Number:&nbsp;
              ${escHtml(common.teacherPhone)}
            </td>

          </tr>


          <tr>

            <td>
              Full Marks:&nbsp;
              ${escHtml(common.fullMarks)}
            </td>

            <td>
              Duration:&nbsp;
              ${escHtml(common.duration)}
            </td>

          </tr>

        </tbody>

      </table>


      <!-- ASSESSMENT RUBRICS -->

      <p class="ts-sec-lbl">
        Assessment Rubrics:
      </p>


      <table class="ts-rubrics-table">

        <thead>

          <tr>

            <th class="ts-rb-letter"></th>

            <th class="ts-rb-criteria">
              Criteria
            </th>

            <th>
              (1) Excellent (80–100%)
            </th>

            <th>
              (2) Good (60–79%)
            </th>

            <th>
              (3) Satisfactory (40–59%)
            </th>

            <th>
              (4) Needs Improvement (&lt;40%)
            </th>

          </tr>

        </thead>


        <tbody>

          ${rubricRows}

        </tbody>

      </table>


      <!-- MARKS TABULATION -->

      <p class="ts-sec-lbl">
        Marks Tabulation:
      </p>


      <table class="ts-marks-table">

        <thead>

          <tr>

            <th class="ts-qno">
              Q. No.
            </th>

            <th class="ts-allotted">
              Marks Allotted
            </th>

            <th class="ts-awarded">
              Marks Awarded
            </th>

            <th class="ts-co">
              Course Outcome
            </th>

            <th class="ts-bloom">
              Bloom's Level
            </th>

            <th class="ts-remarks">
              Remarks
            </th>

          </tr>

        </thead>


        <tbody>

          ${markRows}

        </tbody>

      </table>


      <!-- FEEDBACK -->

      <div class="ts-feedback">

        <span class="ts-fb-lbl">
          Examiner's Feedback:
        </span>

        <br>

        <span class="ts-fb-line">
          Strengths of the Student:&nbsp;
          ${escHtml(common.feedbackStrengths)}
        </span>

        <br>

        <span class="ts-fb-line">
          Areas for Improvement:&nbsp;
          ${escHtml(common.feedbackImprovements)}
        </span>

        <br>

        <span class="ts-fb-line">
          Suggested Corrective Measures:&nbsp;
          ${escHtml(common.feedbackCorrective)}
        </span>

      </div>


      <!-- SIGNATURES -->

      <div class="ts-sigs">


        <!-- EXAMINER -->

        <div
          class="ts-sigs-row"
          style="margin-bottom: 6mm;"
        >

          <div class="ts-sig-left">

            <p class="ts-review-text">
              I have reviewed my evaluated answer script and understood the marks and feedback awarded.
            </p>

          </div>


          <div class="ts-sig-right">

            <div class="ts-sig-img-area">

              ${teacherSig}

            </div>

            <p class="ts-sig-lbl">
              Signature of the Examiner with date
            </p>

          </div>

        </div>


        <!-- STUDENT / SEAL -->

        <div class="ts-sigs-row">

          <div class="ts-sig-left">

            <div class="ts-sig-img-area">

              ${studentSig}

            </div>

            <p class="ts-sig-lbl">
              Signature of the student with date
            </p>

          </div>


          <div class="ts-sig-right">

            ${collegeSeal}

          </div>

        </div>


      </div>


    </div>

  `;

}


// ─────────────────────────────────────────────
//  Wait for all images
// ─────────────────────────────────────────────

async function waitForImages(
  container
) {

  const imgs =
    [
      ...container.querySelectorAll(
        'img'
      )
    ]
    .filter(
      img => img.src
    );


  await Promise.all(

    imgs.map(
      img => {

        if (
          img.complete &&
          img.naturalWidth > 0
        ) {

          return Promise.resolve();

        }


        return new Promise(
          resolve => {

            img.onload =
              resolve;

            img.onerror =
              resolve;


            setTimeout(
              resolve,
              3000
            );

          }
        );

      }
    )

  );

}


// ─────────────────────────────────────────────
//  Export all as PDF
// ─────────────────────────────────────────────

async function exportAllAsPDF() {

  if (
    !state.generatedReady
  ) {

    showToast(
      'Click "Generate All Topsheets" first.',
      'warning'
    );

    return;

  }


  const students =
    state.students;


  if (!students.length) {

    showToast(
      'No students to export.',
      'warning'
    );

    return;

  }


  const btnExport =
    document.getElementById(
      'btn-export-pdf'
    );


  const btnGenerate =
    document.getElementById(
      'btn-generate'
    );


  btnExport.disabled =
    true;


  btnGenerate.disabled =
    true;


  const {
    jsPDF
  } =
    window.jspdf;


  const pdf =
    new jsPDF({
      orientation:
        'portrait',

      unit:
        'mm',

      format:
        'a4'
    });


  const wrap =
    document.createElement(
      'div'
    );


  wrap.style.cssText = [

    'position:fixed',

    'left:-9999px',

    'top:0',

    'width:794px',

    'height:1123px',

    'overflow:hidden',

    'background:#fff',

    'z-index:-9999',

  ].join(';');


  document.body.appendChild(
    wrap
  );


  try {

    for (
      let i = 0;
      i < students.length;
      i++
    ) {

      const s =
        students[i];


      const pct =
        Math.round(
          (i / students.length) *
          100
        );


      setProgress(
        `Exporting page ${i + 1} / ${students.length}…`,
        pct
      );


      wrap.innerHTML =
        buildTopsheetHTML(
          state.common,
          s
        );


      await waitForImages(
        wrap
      );


      await sleep(
        60
      );


      const canvas =
        await html2canvas(
          wrap.firstElementChild,
          {

            scale:
              2,

            useCORS:
              true,

            allowTaint:
              true,

            backgroundColor:
              '#ffffff',

            width:
              794,

            height:
              1123,

            scrollX:
              0,

            scrollY:
              0,

            logging:
              false,

          }
        );


      if (
        i > 0
      ) {

        pdf.addPage();

      }


      pdf.addImage(
        canvas.toDataURL(
          'image/jpeg',
          0.92
        ),

        'JPEG',

        0,

        0,

        210,

        297
      );


      await sleep(
        30
      );

    }


    setProgress(
      'Saving…',
      100
    );


    await sleep(
      200
    );


    pdf.save(
      `topsheets_${Date.now()}.pdf`
    );


    hideProgress();


    showToast(
      `PDF with ${students.length} page(s) saved!`,
      'success'
    );


  } catch (err) {

    console.error(
      'PDF export failed:',
      err
    );


    showToast(
      'PDF export failed. See console for details.',
      'danger'
    );


    hideProgress();


  } finally {

    document.body.removeChild(
      wrap
    );


    btnExport.disabled =
      false;


    btnGenerate.disabled =
      false;

  }

}


// ─────────────────────────────────────────────
//  Export all as separate PDFs in ZIP
// ─────────────────────────────────────────────

async function exportAllAsZIP() {

  if (
    !state.generatedReady
  ) {

    showToast(
      'Click "Generate All Topsheets" first.',
      'warning'
    );

    return;

  }


  const students =
    state.students;


  if (!students.length) {

    showToast(
      'No students to export.',
      'warning'
    );

    return;

  }


  const btnExportPdf =
    document.getElementById(
      'btn-export-pdf'
    );


  const btnExportZip =
    document.getElementById(
      'btn-export-zip'
    );


  const btnGenerate =
    document.getElementById(
      'btn-generate'
    );


  btnExportPdf.disabled =
    true;


  btnExportZip.disabled =
    true;


  btnGenerate.disabled =
    true;


  const zip =
    new JSZip();


  const wrap =
    document.createElement(
      'div'
    );


  wrap.style.cssText = [

    'position:fixed',

    'left:-9999px',

    'top:0',

    'width:794px',

    'height:1123px',

    'overflow:hidden',

    'background:#fff',

    'z-index:-9999',

  ].join(';');


  document.body.appendChild(
    wrap
  );


  try {

    for (
      let i = 0;
      i < students.length;
      i++
    ) {

      const s =
        students[i];


      const pct =
        Math.round(
          (i / students.length) *
          100
        );


      setProgress(
        `Exporting PDF ${i + 1} / ${students.length}…`,
        pct
      );


      wrap.innerHTML =
        buildTopsheetHTML(
          state.common,
          s
        );


      await waitForImages(
        wrap
      );


      await sleep(
        60
      );


      const canvas =
        await html2canvas(
          wrap.firstElementChild,
          {

            scale:
              2,

            useCORS:
              true,

            allowTaint:
              true,

            backgroundColor:
              '#ffffff',

            width:
              794,

            height:
              1123,

            scrollX:
              0,

            scrollY:
              0,

            logging:
              false,

          }
        );


      const {
        jsPDF
      } =
        window.jspdf;


      const pdf =
        new jsPDF({
          orientation:
            'portrait',

          unit:
            'mm',

          format:
            'a4'
        });


      pdf.addImage(
        canvas.toDataURL(
          'image/jpeg',
          0.92
        ),

        'JPEG',

        0,

        0,

        210,

        297
      );


      const pdfArrayBuffer =
        pdf.output(
          'arraybuffer'
        );


      const rollClean =
        normalizeStr(
          s.roll ||
          `student_${i + 1}`
        );


      const nameClean =
        normalizeStr(
          s.name || ''
        );


      const filename =
        `${rollClean}_${nameClean}.pdf`
          .replace(
            /^_+|_+$/g,
            ''
          );


      zip.file(
        filename,
        pdfArrayBuffer
      );


      await sleep(
        30
      );

    }


    setProgress(
      'Zipping files…',
      100
    );


    await sleep(
      200
    );


    const content =
      await zip.generateAsync({
        type:
          'blob'
      });


    const url =
      URL.createObjectURL(
        content
      );


    const a =
      document.createElement(
        'a'
      );


    a.href =
      url;


    a.download =
      `topsheets_${Date.now()}.zip`;


    document.body.appendChild(
      a
    );


    a.click();


    document.body.removeChild(
      a
    );


    URL.revokeObjectURL(
      url
    );


    hideProgress();


    showToast(
      `ZIP file with ${students.length} PDF(s) downloaded!`,
      'success'
    );


  } catch (err) {

    console.error(
      'ZIP export failed:',
      err
    );


    showToast(
      'ZIP export failed. See console for details.',
      'danger'
    );


    hideProgress();


  } finally {

    document.body.removeChild(
      wrap
    );


    btnExportPdf.disabled =
      false;


    btnExportZip.disabled =
      false;


    btnGenerate.disabled =
      false;

  }

}


// ─────────────────────────────────────────────
//  Bind sidebar events
// ─────────────────────────────────────────────

function bindSidebarEvents() {


  // ── Teacher signature ──

  document
    .getElementById(
      'inp-teacher-sig'
    )
    .addEventListener(
      'change',
      e => {

        const file =
          e.target.files[0];


        if (!file) {
          return;
        }


        handleImageUpload(
          file,
          {

            stateKey:
              'processedTeacherSig',

            previewId:
              'prev-teacher-sig',

            statusId:
              'stat-teacher-sig',

            transparent:
              true,

            threshold:
              225,

            maxWidth:
              600,

            maxHeight:
              200,

          }
        );

      }
    );


  // ── College seal ──

  document
    .getElementById(
      'inp-college-seal'
    )
    .addEventListener(
      'change',
      e => {

        const file =
          e.target.files[0];


        if (!file) {
          return;
        }


        handleImageUpload(
          file,
          {

            stateKey:
              'processedCollegeSeal',

            previewId:
              'prev-college-seal',

            statusId:
              'stat-college-seal',

            transparent:
              true,

            threshold:
              240,

            maxWidth:
              300,

            maxHeight:
              300,

          }
        );

      }
    );


  // ── Step navigation ──

  document
    .getElementById(
      'btn-go-s2'
    )
    .addEventListener(
      'click',
      goToStep2
    );


  document
    .getElementById(
      'btn-back-s1'
    )
    .addEventListener(
      'click',
      goToStep1
    );


  // ── Marks row actions ──

  document
    .getElementById(
      'btn-remove-mark-row'
    )
    .addEventListener(
      'click',
      removeSelectedMarkRow
    );


  document
    .getElementById(
      'btn-add-mark-row-above'
    )
    .addEventListener(
      'click',
      addMarkRowAbove
    );


  document
    .getElementById(
      'btn-add-mark-row-below'
    )
    .addEventListener(
      'click',
      addMarkRowBelow
    );


  // ── CSV ──

  document
    .getElementById(
      'inp-csv'
    )
    .addEventListener(
      'change',
      e => {

        const file =
          e.target.files[0];


        if (!file) {
          return;
        }


        const reader =
          new FileReader();


        reader.onload =
          ev => {

            try {

              const rows =
                parseCSV(
                  ev.target.result
                );


              state.students =
                rows.map(
                  r => ({

                    name:
                      r.name,

                    roll:
                      r.roll,

                    sigFile:
                      null,

                    processedSig:
                      null,

                    matched:
                      false,

                    matchType:
                      'none',

                  })
                );


              document.getElementById(
                'stat-csv'
              ).textContent =
                `✅ ${rows.length} student(s) loaded.`;


              document.getElementById(
                'btn-export-pdf'
              ).disabled =
                true;


              document.getElementById(
                'btn-export-zip'
              ).disabled =
                true;


              state.generatedReady =
                false;


              tryMatch();


            } catch (err) {

              document.getElementById(
                'stat-csv'
              ).textContent =
                `❌ ${err.message}`;


              showToast(
                err.message,
                'danger'
              );

            }

          };


        reader.readAsText(
          file
        );

      }
    );


  // ── Signature folder ──

  document
    .getElementById(
      'inp-sig-folder'
    )
    .addEventListener(
      'change',
      e => {

        const files =
          e.target.files;


        if (!files.length) {
          return;
        }


        state.sigFileMap =
          buildSigFileMap(
            files
          );


        document.getElementById(
          'stat-folder'
        ).textContent =
          `✅ ${state.sigFileMap.size} image file(s) found.`;


        document.getElementById(
          'btn-export-pdf'
        ).disabled =
          true;


        document.getElementById(
          'btn-export-zip'
        ).disabled =
          true;


        state.generatedReady =
          false;


        tryMatch();

      }
    );


  // ── Student preview selector ──

  document
    .getElementById(
      'sel-student'
    )
    .addEventListener(
      'change',
      e => {

        previewStudent(
          parseInt(
            e.target.value,
            10
          )
        );

      }
    );


  // ── Generate ──

  document
    .getElementById(
      'btn-generate'
    )
    .addEventListener(
      'click',
      generateAllTopsheets
    );


  // ── Export PDF ──

  document
    .getElementById(
      'btn-export-pdf'
    )
    .addEventListener(
      'click',
      exportAllAsPDF
    );


  // ── Export ZIP ──

  document
    .getElementById(
      'btn-export-zip'
    )
    .addEventListener(
      'click',
      exportAllAsZIP
    );

}


// ─────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────

function init() {

  renderNavbar(
    '../',
    'topsheet'
  );


  /*
    Normalize all marks rows so even
    older row objects receive the
    new editable fields.
  */
  state.common.markRows =
    state.common.markRows.map(
      row => ({

        qno:
          row.qno || '',

        allotted:
          row.allotted || '',

        awarded:
          row.awarded || '',

        co:
          row.co || '',

        bloom:
          row.bloom || '',

        remarks:
          row.remarks || '',

      })
    );


  renderRubrics();

  renderMarkRows();

  bindInlineEditing();

  bindSidebarEvents();

}


init();