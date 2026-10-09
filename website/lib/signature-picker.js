import {
  extractSignature,
  refineSignature,
  releaseSignature,
  renderSignature,
  INK_COLORS,
  EXTRACTION_STAGES,
  DEFAULT_EXTRACTION_PARAMS,
} from "./signature-extract.js";
import { populateStudentSelect } from "./student-link.js";
import { showToast } from "./ui.js";

const MIN_BOX_SIZE = 10;
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const VARIANTS = [
  { key: "black", label: "Black ink", color: INK_COLORS.black },
  { key: "blue", label: "Blue ink", color: INK_COLORS.blue },
];

const REFINE_DELAY_MS = 120;

// Sliders for the ink detection; `format` shows the current value next to the label.
const ADJUST_SLIDERS = [
  {
    key: "sensitivity",
    label: "Ink sensitivity",
    hint: "Raise it if light or thin strokes are missing.",
    min: 1,
    max: 15,
    format: (v) => v,
  },
  {
    key: "speckSize",
    label: "Remove specks",
    hint: "Raise it to clean up dust and paper texture.",
    min: 0,
    max: 10,
    format: (v) => (v === 0 ? "off" : v),
  },
];

const FLOW_HTML = `
  <div data-step="file">
    <p class="text-muted" data-role="file-help">Choose a photo or scan of the signature on paper.</p>
    <input type="file" class="form-control" accept="image/*" data-role="file">
  </div>
  <div data-step="choice" class="d-none">
    <p class="text-muted small mb-2">What should be done with this image?</p>
    <div class="text-center bg-light border rounded p-2 mb-3">
      <img alt="Chosen image" data-role="choice-preview" style="max-width:100%;max-height:200px;">
    </div>
    <div class="d-flex flex-column flex-sm-row gap-2">
      <button type="button" class="btn btn-outline-primary flex-fill" data-role="use-as-is">
        <i class="bi bi-image"></i> Use as it is
      </button>
      <button type="button" class="btn btn-primary flex-fill" data-role="extract">
        <i class="bi bi-pen"></i> Extract signature
      </button>
    </div>
  </div>
  <div data-step="busy" class="d-none py-3">
    <ol class="list-unstyled mb-0 mx-auto" style="max-width:360px;" data-role="timeline"></ol>
    <div class="text-danger text-center mt-3" data-role="busy-error"></div>
    <div class="text-center mt-2">
      <button type="button" class="btn btn-outline-secondary btn-sm d-none" data-role="retry">Try another image</button>
    </div>
  </div>
  <div data-step="crop" class="d-none">
    <p class="text-muted small mb-2">The main part of the signature is selected. Drag the box or its handles to crop only what you need.</p>
    <div class="text-center bg-light border rounded p-2 position-relative">
      <div data-role="stage" style="position:relative;display:inline-block;max-width:100%;line-height:0;touch-action:none;"></div>
    </div>
    <div class="sig-adjust border rounded p-3 mt-2" data-role="adjust">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div class="fw-semibold small">Parts missing or too much noise? Adjust:</div>
        <div class="small d-flex align-items-center gap-2" data-role="refine-status" role="status" aria-live="polite"></div>
      </div>
      <div class="row g-3">
        ${ADJUST_SLIDERS.map(
          (s) => `
        <div class="col-md-6">
          <label class="form-label mb-0 d-flex justify-content-between">
            <span>${s.label}</span><span class="text-muted" data-value="${s.key}"></span>
          </label>
          <input type="range" class="form-range" min="${s.min}" max="${s.max}" step="1" data-param="${s.key}">
          <div class="form-text mt-0">${s.hint}</div>
        </div>`
        ).join("")}
        <div class="col-md-6">
          <div class="form-check"><input class="form-check-input" type="checkbox" id="sig-keep-thin" data-param="keepThin"><label class="form-check-label" for="sig-keep-thin">Keep very thin strokes</label></div>
          <div class="form-check"><input class="form-check-input" type="checkbox" id="sig-keep-edge" data-param="keepEdge"><label class="form-check-label" for="sig-keep-edge">Keep strokes touching the photo edge</label></div>
        </div>
        <div class="col-md-6 text-md-end">
          <button type="button" class="btn btn-outline-secondary" data-role="adjust-reset">Reset adjustments</button>
        </div>
      </div>
    </div>
  </div>
  <div data-step="variant" class="d-none">
    <p class="text-muted small mb-2" data-role="variant-help"></p>
    <div class="d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2">
      <div class="text-center" style="flex:1 1 0;min-width:0;" data-role="original"></div>
      <div data-role="arrows">
        <i class="bi bi-arrow-right fs-4 text-muted d-none d-md-block"></i>
        <i class="bi bi-arrow-down fs-4 text-muted text-center d-md-none"></i>
      </div>
      <div class="d-flex flex-column flex-sm-row gap-2" style="flex:2 1 0;min-width:0;" data-role="variants"></div>
    </div>
    <div class="d-none mt-3" data-role="save-wrap">
      <div data-role="link-wrap">
        <label class="form-label small text-muted mb-1" for="sig-link-student" data-role="link-label"></label>
        <select class="form-select form-select-sm" id="sig-link-student" data-role="link"></select>
        <div class="form-text d-none" data-role="link-hint"></div>
      </div>
      <div class="d-none" data-role="stamp-wrap">
        <label class="form-label small text-muted mb-1" for="sig-stamp-label">Saved on this device for next time. Name it so you can find it later:</label>
        <input type="text" class="form-control form-control-sm" id="sig-stamp-label" data-role="stamp-label" maxlength="60">
      </div>
    </div>
  </div>
  <div class="d-flex gap-2 justify-content-end mt-3">
    <button type="button" class="btn btn-outline-secondary me-auto d-none" data-role="back">Back</button>
    <button type="button" class="btn btn-secondary d-none" data-role="cancel">Cancel</button>
    <button type="button" class="btn btn-primary d-none" data-role="next"></button>
  </div>
`;

const MODAL_HTML = `
  <div class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-pen"></i> <span data-role="title"></span></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" data-role="mount"></div>
      </div>
    </div>
  </div>
`;

const STAGE_ICONS = {
  pending: '<i class="bi bi-circle text-muted"></i>',
  active: '<span class="spinner-border spinner-border-sm text-primary" role="status"></span>',
  done: '<i class="bi bi-check-circle-fill text-success"></i>',
  failed: '<i class="bi bi-x-circle-fill text-danger"></i>',
};

// Renders the processing timeline and returns controls that move it to a
// stage: earlier stages are marked done, the given one active, later ones pending.
function createTimeline(list) {
  list.replaceChildren(
    ...EXTRACTION_STAGES.map((stage) => {
      const li = document.createElement("li");
      li.className = "d-flex align-items-center gap-2 py-1";
      li.innerHTML = `<span data-icon style="width:20px;text-align:center;"></span><span>${stage.label}</span>`;
      return li;
    })
  );

  const setState = (index, state) => {
    list.children[index].querySelector("[data-icon]").innerHTML = STAGE_ICONS[state];
    list.children[index].classList.toggle("text-muted", state === "pending");
  };
  const reset = () => EXTRACTION_STAGES.forEach((_, i) => setState(i, "pending"));
  reset();

  let current = -1;
  return {
    reset() {
      current = -1;
      reset();
    },
    advance(key) {
      const index = EXTRACTION_STAGES.findIndex((s) => s.key === key);
      if (index < 0) return;
      current = index;
      EXTRACTION_STAGES.forEach((_, i) => setState(i, i < index ? "done" : i === index ? "active" : "pending"));
    },
    fail() {
      if (current >= 0) setState(current, "failed");
    },
  };
}

// Reads an image file as-is, shrunk to a size that is cheap to store.
function readImageAsIs(file, maxWidth = 600, maxHeight = 300) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image."));
    };
    img.src = url;
  });
}

function createCropper(stage, canvas, initialBox) {
  const display = document.createElement("canvas");
  display.style.cssText = "max-width:100%;max-height:55vh;background:#fff;";
  const ctx = display.getContext("2d");
  const drawImage = (source) => {
    display.width = source.width;
    display.height = source.height;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, display.width, display.height);
    ctx.drawImage(source, 0, 0);
  };
  drawImage(canvas);
  stage.replaceChildren(display);

  // The dimming lives in an overlay clipped to the image, so it can't spill
  // over the rest of the page.
  const dimmer = document.createElement("div");
  dimmer.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;";
  const hole = document.createElement("div");
  hole.style.cssText = "position:absolute;box-shadow:0 0 0 9999px rgba(0,0,0,.35);";
  dimmer.appendChild(hole);
  stage.appendChild(dimmer);

  const boxEl = document.createElement("div");
  boxEl.style.cssText = "position:absolute;border:2px dashed #047857;cursor:move;";
  stage.appendChild(boxEl);

  const box = { ...initialBox };

  const handleStyle = {
    nw: "left:-6px;top:-6px;cursor:nwse-resize",
    n: "left:calc(50% - 6px);top:-6px;cursor:ns-resize",
    ne: "right:-6px;top:-6px;cursor:nesw-resize",
    e: "right:-6px;top:calc(50% - 6px);cursor:ew-resize",
    se: "right:-6px;bottom:-6px;cursor:nwse-resize",
    s: "left:calc(50% - 6px);bottom:-6px;cursor:ns-resize",
    sw: "left:-6px;bottom:-6px;cursor:nesw-resize",
    w: "left:-6px;top:calc(50% - 6px);cursor:ew-resize",
  };
  for (const name of HANDLES) {
    const handle = document.createElement("div");
    handle.dataset.handle = name;
    handle.style.cssText = `position:absolute;width:12px;height:12px;background:#047857;border:1px solid #fff;border-radius:2px;${handleStyle[name]}`;
    boxEl.appendChild(handle);
  }

  const scale = () => display.getBoundingClientRect().width / display.width;

  function paint() {
    const s = scale();
    for (const el of [boxEl, hole]) {
      el.style.left = `${box.x * s}px`;
      el.style.top = `${box.y * s}px`;
      el.style.width = `${box.width * s}px`;
      el.style.height = `${box.height * s}px`;
    }
  }

  function clampBox(next, mode) {
    const maxW = display.width;
    const maxH = display.height;
    let { x, y, width, height } = next;
    if (mode === "move") {
      x = Math.min(Math.max(0, x), maxW - width);
      y = Math.min(Math.max(0, y), maxH - height);
    } else {
      x = Math.max(0, x);
      y = Math.max(0, y);
      width = Math.min(Math.max(MIN_BOX_SIZE, width), maxW - x);
      height = Math.min(Math.max(MIN_BOX_SIZE, height), maxH - y);
    }
    Object.assign(box, { x, y, width, height });
  }

  boxEl.addEventListener("pointerdown", (e) => {
    const mode = e.target.dataset.handle ?? "move";
    const start = { px: e.clientX, py: e.clientY, ...box };
    boxEl.setPointerCapture(e.pointerId);
    e.preventDefault();

    const onMove = (ev) => {
      const s = scale();
      const dx = (ev.clientX - start.px) / s;
      const dy = (ev.clientY - start.py) / s;
      let { x, y, width, height } = start;

      if (mode === "move") {
        x += dx;
        y += dy;
      } else {
        if (mode.includes("w")) {
          const right = start.x + start.width;
          x = Math.min(start.x + dx, right - MIN_BOX_SIZE);
          width = right - x;
        }
        if (mode.includes("e")) width = start.width + dx;
        if (mode.includes("n")) {
          const bottom = start.y + start.height;
          y = Math.min(start.y + dy, bottom - MIN_BOX_SIZE);
          height = bottom - y;
        }
        if (mode.includes("s")) height = start.height + dy;
      }
      clampBox({ x, y, width, height }, mode);
      paint();
    };
    const onUp = () => {
      boxEl.removeEventListener("pointermove", onMove);
      boxEl.removeEventListener("pointerup", onUp);
      boxEl.removeEventListener("pointercancel", onUp);
    };
    boxEl.addEventListener("pointermove", onMove);
    boxEl.addEventListener("pointerup", onUp);
    boxEl.addEventListener("pointercancel", onUp);
  });

  requestAnimationFrame(paint);
  window.addEventListener("resize", paint);

  return {
    getBox: () => ({ ...box }),
    // Shows a new extraction result without touching the user's crop box: the
    // box stays on the same part of the photo (shifted by how far the new
    // image's origin moved) and is only clamped to the new image.
    update(nextCanvas, shiftX, shiftY) {
      drawImage(nextCanvas);
      const x = Math.min(Math.max(0, box.x + shiftX), nextCanvas.width - MIN_BOX_SIZE);
      const y = Math.min(Math.max(0, box.y + shiftY), nextCanvas.height - MIN_BOX_SIZE);
      const right = Math.min(nextCanvas.width, Math.max(box.x + shiftX + box.width, x + MIN_BOX_SIZE));
      const bottom = Math.min(nextCanvas.height, Math.max(box.y + shiftY + box.height, y + MIN_BOX_SIZE));
      Object.assign(box, { x, y, width: right - x, height: bottom - y });
      paint();
    },
    destroy: () => window.removeEventListener("resize", paint),
  };
}

// Mounts the whole signature flow into `container`:
//   file -> extract -> crop to the main signature -> pick black and/or blue ink
// `onDone` receives every variant produced (black and blue ink, each a transparent
// PNG): [{ key, label, dataUrl }], and { userId, label }: the person to link
// to (null for unlinked), the name typed for a stamp.
// Passing `onCancel` adds a Cancel button. `allowAsIs` adds an option to skip the
// extraction and use the image unchanged. `offerSave` shows the save choice: for
// kind "signature" a link to a student or teacher (`role`), for kind "stamp" a name.
// Returns { reset, destroy }.
export function mountSignatureFlow(
  container,
  {
    onDone,
    onCancel = null,
    doneLabel = "Use signature",
    allowAsIs = false,
    offerSave = false,
    role = "student",
    kind = "signature",
  } = {}
) {
  container.innerHTML = FLOW_HTML;

  const $ = (sel) => container.querySelector(sel);
  const steps = {
    file: $('[data-step="file"]'),
    choice: $('[data-step="choice"]'),
    busy: $('[data-step="busy"]'),
    crop: $('[data-step="crop"]'),
    variant: $('[data-step="variant"]'),
  };
  const fileInput = $('[data-role="file"]');
  const nextBtn = $('[data-role="next"]');
  const backBtn = $('[data-role="back"]');
  const cancelBtn = $('[data-role="cancel"]');
  const retryBtn = $('[data-role="retry"]');
  const busyError = $('[data-role="busy-error"]');
  const saveWrap = $('[data-role="save-wrap"]');
  const linkSelect = $('[data-role="link"]');
  const linkHint = $('[data-role="link-hint"]');
  const stampLabel = $('[data-role="stamp-label"]');
  let pickedFile = null;

  const isStamp = kind === "stamp";
  const who = role === "teacher" ? "teacher" : "student";
  if (isStamp) $('[data-role="file-help"]').textContent = "Choose a photo or scan of the stamp or seal.";
  $('[data-role="link-label"]').textContent = `Saved on this device for next time (both ink colours). Link to a ${who}?`;
  linkHint.textContent = `No ${who} records yet. Add one in Settings to link signatures to it.`;
  $('[data-role="link-wrap"]').classList.toggle("d-none", isStamp);
  $('[data-role="stamp-wrap"]').classList.toggle("d-none", !isStamp);

  const timeline = createTimeline($('[data-role="timeline"]'));
  let extracted = null;
  let originalUrl = null;
  let cropper = null;
  let options = [];
  let asIsMode = false;

  const show = (name) => {
    for (const [key, el] of Object.entries(steps)) el.classList.toggle("d-none", key !== name);
    backBtn.classList.toggle("d-none", name !== "variant" && name !== "choice");
    cancelBtn.classList.toggle("d-none", !onCancel);
    nextBtn.classList.toggle("d-none", name !== "crop" && name !== "variant");
    nextBtn.textContent = name === "variant" ? doneLabel : "Next";
    const showSave = offerSave && name === "variant";
    saveWrap.classList.toggle("d-none", !showSave);
    if (showSave && !isStamp) {
      const users = populateStudentSelect(linkSelect, { role });
      linkHint.classList.toggle("d-none", users.length > 0);
    }
  };

  // Adjustment sliders: every change re-runs the ink detection on the image the
  // worker already holds. Only one run at a time; the latest settings win.
  let params = { ...DEFAULT_EXTRACTION_PARAMS };
  let refineTimer = null;
  let refining = false;
  let refineQueued = false;
  let engineHolds = false;
  let generation = 0; // bumped whenever the loaded image is dropped
  const refineStatusEl = $('[data-role="refine-status"]');
  const stageEl = $('[data-role="stage"]');

  // Tells whether the preview above matches the current settings.
  function setRefineStatus(state) {
    const busy = state === "working";
    refineStatusEl.className = `small d-flex align-items-center gap-2 ${busy ? "text-primary" : "text-success"}`;
    refineStatusEl.innerHTML = busy
      ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Applying your changes to the preview…</span>'
      : '<i class="bi bi-check-circle-fill" aria-hidden="true"></i><span>Preview is up to date</span>';
    stageEl.style.opacity = busy ? "0.5" : "";
  }
  setRefineStatus("ready");

  const controlFor = (key) => $(`[data-param="${key}"]`);

  function syncControls() {
    for (const s of ADJUST_SLIDERS) {
      controlFor(s.key).value = params[s.key];
      $(`[data-value="${s.key}"]`).textContent = s.format(params[s.key]);
    }
    controlFor("keepThin").checked = params.keepThin;
    controlFor("keepEdge").checked = params.keepEdge;
  }

  async function runRefine() {
    if (refining) {
      refineQueued = true;
      return;
    }
    refining = true;
    const startedIn = generation;
    try {
      do {
        refineQueued = false;
        const result = await refineSignature({ ...params });
        if (generation !== startedIn) return; // flow was reset or restarted meanwhile
        if (result) {
          const shiftX = extracted.origin.x - result.origin.x;
          const shiftY = extracted.origin.y - result.origin.y;
          extracted = result;
          cropper?.update(result.canvas, shiftX, shiftY);
        }
      } while (refineQueued);
    } catch (err) {
      showToast("Could not apply the adjustment.", "warning");
    } finally {
      refining = false;
      if (generation === startedIn && !refineQueued && refineTimer === null) setRefineStatus("ready");
    }
  }

  function scheduleRefine() {
    clearTimeout(refineTimer);
    setRefineStatus("working");
    refineTimer = setTimeout(() => {
      refineTimer = null;
      runRefine();
    }, REFINE_DELAY_MS);
  }

  for (const s of ADJUST_SLIDERS) {
    controlFor(s.key).addEventListener("input", (e) => {
      params[s.key] = Number(e.target.value);
      $(`[data-value="${s.key}"]`).textContent = s.format(params[s.key]);
      scheduleRefine();
    });
  }
  for (const key of ["keepThin", "keepEdge"]) {
    controlFor(key).addEventListener("change", (e) => {
      params[key] = e.target.checked;
      scheduleRefine();
    });
  }
  $('[data-role="adjust-reset"]').addEventListener("click", () => {
    params = { ...DEFAULT_EXTRACTION_PARAMS };
    syncControls();
    scheduleRefine();
  });
  syncControls();

  const release = () => {
    clearTimeout(refineTimer);
    refineTimer = null;
    setRefineStatus("ready");
    generation++;
    refineQueued = false;
    if (engineHolds) {
      engineHolds = false;
      releaseSignature().catch(() => {});
    }
    cropper?.destroy();
    cropper = null;
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = null;
  };

  const reset = () => {
    release();
    extracted = null;
    asIsMode = false;
    fileInput.value = "";
    retryBtn.classList.add("d-none");
    show("file");
  };

  const fail = (message) => {
    timeline.fail();
    busyError.textContent = message;
    retryBtn.classList.remove("d-none");
  };

  async function startExtraction() {
    show("busy");
    timeline.reset();
    busyError.textContent = "";
    retryBtn.classList.add("d-none");
    try {
      params = { ...DEFAULT_EXTRACTION_PARAMS };
      syncControls();
      engineHolds = true;
      extracted = await extractSignature(pickedFile, { onProgress: timeline.advance, params });
    } catch (err) {
      fail(err.message);
      return;
    }
    if (!extracted) {
      fail("No signature found in this image.");
      return;
    }

    show("crop");
    cropper = createCropper($('[data-role="stage"]'), extracted.canvas, extracted.mainBox);
  }

  async function useAsIs() {
    try {
      const dataUrl = await readImageAsIs(pickedFile);
      asIsMode = true;
      showVariants([{ key: "original", label: "Original image", dataUrl, selected: true }], false);
    } catch (err) {
      showToast("Could not read this image.", "warning");
      show("busy");
      timeline.reset();
      fail(err.message);
    }
  }

  fileInput.addEventListener("change", () => {
    pickedFile = fileInput.files[0];
    if (!pickedFile) return;

    release();
    originalUrl = URL.createObjectURL(pickedFile);

    if (!allowAsIs) {
      startExtraction();
      return;
    }
    $('[data-role="choice-preview"]').src = originalUrl;
    show("choice");
  });

  $('[data-role="extract"]').addEventListener("click", startExtraction);
  $('[data-role="use-as-is"]').addEventListener("click", useAsIs);

  function showVariants(list, withOriginal) {
    options = list;
    const variants = $('[data-role="variants"]');
    variants.replaceChildren();

    $('[data-role="variant-help"]').textContent = withOriginal
      ? "Both ink colours will be saved."
      : "The image will be used as it is, without extracting the signature.";

    const original = $('[data-role="original"]');
    original.classList.toggle("d-none", !withOriginal);
    $('[data-role="arrows"]').classList.toggle("d-none", !withOriginal);
    if (withOriginal) {
      original.innerHTML = `
        <div class="border rounded p-2">
          <div class="bg-white border rounded d-flex align-items-center justify-content-center mb-2" style="height:140px;">
            <img alt="Original" style="max-width:100%;max-height:130px;">
          </div>
          <span class="small text-muted">Original</span>
        </div>
      `;
      original.querySelector("img").src = originalUrl;
    }

    for (const option of list) {
      const col = document.createElement("div");
      col.style.cssText = "flex:1 1 0;min-width:0;";
      col.innerHTML = `
        <div class="border rounded w-100 p-2 text-center">
          <div class="bg-white border rounded d-flex align-items-center justify-content-center mb-2" style="height:140px;">
            <img alt="${option.label}" style="max-width:100%;max-height:130px;">
          </div>
          <span>${option.label}</span>
        </div>
      `;
      col.querySelector("img").src = option.dataUrl;
      variants.appendChild(col);
    }
    show("variant");
  }

  nextBtn.addEventListener("click", () => {
    if (!steps.variant.classList.contains("d-none")) {
      onDone?.(
        options.map((o) => ({ key: o.key, label: o.label, dataUrl: o.dataUrl })),
        { userId: linkSelect.value || null, label: stampLabel.value.trim() }
      );
      return;
    }

    const box = cropper.getBox();
    showVariants(
      VARIANTS.map((v) => ({ key: v.key, label: v.label, dataUrl: renderSignature(extracted.canvas, box, v.color) })),
      true
    );
  });

  backBtn.addEventListener("click", () => {
    if (!steps.choice.classList.contains("d-none")) reset();
    else if (asIsMode) {
      asIsMode = false;
      show("choice");
    } else show("crop");
  });
  retryBtn.addEventListener("click", reset);
  cancelBtn.addEventListener("click", () => onCancel?.());

  show("file");
  return { reset, destroy: release };
}

// Popup version of the flow. Resolves with
// { variants, userId, label } (see above) or null if the user cancels.
export function openSignaturePicker({
  title = "Add signature",
  allowAsIs = false,
  offerSave = false,
  role = "student",
  kind = "signature",
} = {}) {
  return new Promise((resolve) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = MODAL_HTML;
    const modalEl = wrapper.firstElementChild;
    document.body.appendChild(modalEl);
    modalEl.querySelector('[data-role="title"]').textContent = title;

    const modal = new bootstrap.Modal(modalEl);
    let result = null;

    const flow = mountSignatureFlow(modalEl.querySelector('[data-role="mount"]'), {
      allowAsIs,
      offerSave,
      role,
      kind,
      onDone: (variants, { userId, label }) => {
        result = { variants, userId, label };
        modal.hide();
      },
      onCancel: () => modal.hide(),
    });

    modalEl.addEventListener("hidden.bs.modal", () => {
      flow.destroy();
      modalEl.remove();
      resolve(result);
    });
    modal.show();
  });
}
