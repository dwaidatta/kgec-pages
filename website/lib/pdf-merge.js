const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export function sanitizeFilename(name) {
  return String(name || "")
    .replace(ILLEGAL_FILENAME_CHARS, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function stripExtension(name) {
  return String(name || "").replace(/\.[^./\\]+$/, "");
}

export function buildMergedFilename(label, files = []) {
  const cleanLabel = sanitizeFilename(label);
  if (cleanLabel) return `${cleanLabel}.pdf`;

  const firstFileName = files[0]?.name;
  const base = firstFileName ? sanitizeFilename(stripExtension(firstFileName)) : "";
  return `${base || "merged"}.pdf`;
}

export async function mergeGroupFiles(PDFLib, files) {
  const merged = await PDFLib.PDFDocument.create();

  for (const file of files) {
    const bytes = await file.blob.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}

export async function renderFirstPageThumbnail(pdfjsLib, blob, maxWidth = 200) {
  const bytes = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);

  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: maxWidth / baseViewport.width });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/png");
}
