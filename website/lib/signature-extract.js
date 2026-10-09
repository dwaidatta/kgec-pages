const MAX_WORKING_SIDE = 2000;

export const INK_COLORS = {
  black: "#000000",
  blue: "#1a237e",
};

// Settings of the ink detection (see lib/signature-worker.js for what they do).
export const DEFAULT_EXTRACTION_PARAMS = {
  sensitivity: 9,
  speckSize: 2,
  keepEdge: false,
  keepThin: false,
};

// Steps of an extraction in order; extractSignature reports them through
// `onProgress(key)` so a UI can show a timeline.
export const EXTRACTION_STAGES = [
  { key: "decode", label: "Reading image" },
  { key: "engine", label: "Starting image engine" },
  { key: "lighting", label: "Evening out the lighting" },
  { key: "ink", label: "Finding ink" },
  { key: "noise", label: "Removing noise and texture" },
  { key: "main", label: "Picking the main signature" },
  { key: "finish", label: "Preparing the result" },
];

let worker = null;
let nextJobId = 1;
const jobs = new Map();

function getWorker() {
  if (worker) return worker;

  worker = new Worker(new URL("./signature-worker.js", import.meta.url));
  worker.onmessage = ({ data }) => {
    const job = jobs.get(data.id);
    if (!job) return;
    if (data.type === "progress") {
      job.onProgress?.(data.stage);
      return;
    }
    jobs.delete(data.id);
    if (data.type === "error") job.reject(new Error(data.message));
    else job.resolve(data.result);
  };
  worker.onerror = (e) => {
    const error = new Error(e.message || "Signature worker failed.");
    for (const job of jobs.values()) job.reject(error);
    jobs.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

function runJob(message, { onProgress, transfer = [] } = {}) {
  return new Promise((resolve, reject) => {
    const id = nextJobId++;
    jobs.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, ...message }, transfer);
  });
}

// Starts the worker and downloads OpenCV (~8 MB) ahead of time so the first
// extraction doesn't have to wait for it.
export function preloadSignatureEngine() {
  return runJob({ warmup: true });
}

// Decodes the file onto a canvas, scaled down so its longest side is at most
// MAX_WORKING_SIDE. This keeps processing fast and the kernel sizes consistent.
async function fileToImageData(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image load failed"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_WORKING_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Finds the ink in a signature photo/scan. The heavy work runs in a Web Worker,
// so the page stays responsive.
// Resolves null when no ink is found, otherwise:
//   canvas  - RGBA canvas cropped to all detected ink; ink keeps its original
//             colour, everything else is transparent
//   mainBox - {x, y, width, height} of the main signature inside `canvas`
//   origin  - {x, y} of `canvas` inside the (downscaled) photo
export async function extractSignature(file, { onProgress, params = DEFAULT_EXTRACTION_PARAMS } = {}) {
  onProgress?.("decode");
  const image = await fileToImageData(file);

  const result = await runJob(
    { width: image.width, height: image.height, pixels: image.data.buffer, params },
    { onProgress, transfer: [image.data.buffer] }
  );
  return resultToCanvas(result);
}

// Re-runs the ink detection on the image of the last extractSignature call with
// new settings. Same result shape as extractSignature.
export async function refineSignature(params) {
  return resultToCanvas(await runJob({ params }));
}

// Frees the image the worker keeps for refineSignature.
export function releaseSignature() {
  return runJob({ release: true });
}

function resultToCanvas(result) {
  if (!result) return null;

  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  canvas.getContext("2d").putImageData(
    new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height),
    0,
    0
  );
  return { canvas, mainBox: result.mainBox, origin: result.origin };
}

function hexToRgb(hex) {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Crops `box` out of an extracted canvas, paints every ink pixel in `color`
// (alpha kept, so the background stays transparent) and returns a PNG data URL.
// Only ever downscales to fit maxWidth x maxHeight.
export function renderSignature(
  canvas,
  box,
  color = INK_COLORS.black,
  { maxWidth = 600, maxHeight = 200 } = {}
) {
  const crop = document.createElement("canvas");
  crop.width = Math.max(1, Math.round(box.width));
  crop.height = Math.max(1, Math.round(box.height));
  const cropCtx = crop.getContext("2d");
  cropCtx.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, crop.width, crop.height);

  const pixels = cropCtx.getImageData(0, 0, crop.width, crop.height);
  const [r, g, b] = hexToRgb(color);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i] = r;
    pixels.data[i + 1] = g;
    pixels.data[i + 2] = b;
  }
  cropCtx.putImageData(pixels, 0, 0);

  const scale = Math.min(maxWidth / crop.width, maxHeight / crop.height, 1);
  if (scale === 1) return crop.toDataURL("image/png");

  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(crop.width * scale));
  out.height = Math.max(1, Math.round(crop.height * scale));
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingQuality = "high";
  outCtx.drawImage(crop, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

// One-shot helper for non-interactive callers: extract, take the
// auto-detected main signature and render it in a single ink colour.
export async function extractMainSignature(file, { color = INK_COLORS.black, ...size } = {}) {
  const result = await extractSignature(file);
  return result ? renderSignature(result.canvas, result.mainBox, color, size) : null;
}
