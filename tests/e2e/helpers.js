import { readFile } from "node:fs/promises";

// Seeds localStorage before any page script runs. Seeds once per tab, so a reload
// inside a test keeps whatever the app saved in the meantime.
export async function seedStorage(page, entries) {
  await page.addInitScript((data) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value));
  }, entries);
}

export const STUDENT = { id: "id-s1", role: "student", name: "Jane Doe", roll: "12", reg: "R-99", dept: "CSE", course: "BTech", year: "3", sem: "5" };
export const TEACHER = { id: "id-t1", role: "teacher", name: "Prof Smith", mobile: "9999999999" };

export const USERS_KEY = "kgec_pages_users";

export async function readStorage(page, key) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
}

// Builds a tiny valid PDF with `pageCount` pages using the pdf-lib already loaded by the page.
export async function makePdf(page, name, pageCount = 1) {
  const bytes = await page.evaluate(async (n) => {
    const doc = await window.PDFLib.PDFDocument.create();
    for (let i = 0; i < n; i++) doc.addPage([200, 200]);
    return Array.from(await doc.save());
  }, pageCount);
  return { name, mimeType: "application/pdf", buffer: Buffer.from(bytes) };
}

export async function readDownloadedPageCount(page, download) {
  const bytes = [...(await readFile(await download.path()))];
  return page.evaluate(async (arr) => {
    const doc = await window.PDFLib.PDFDocument.load(new Uint8Array(arr));
    return doc.getPageCount();
  }, bytes);
}
