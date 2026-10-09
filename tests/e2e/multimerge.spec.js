import { test, expect } from "@playwright/test";
import { makePdf, readDownloadedPageCount } from "./helpers.js";

async function addGroupWithFiles(page, files) {
  await page.click("#btn-add-group");
  const chooser = page.waitForEvent("filechooser");
  await page.locator(".merge-file-add-tile").last().click();
  await (await chooser).setFiles(files);
}

test("starts empty with merge and delete disabled", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  await expect(page.locator("#empty-state")).toBeVisible();
  await expect(page.locator("#btn-merge-save")).toBeDisabled();
  await expect(page.locator("#btn-delete-groups")).toBeDisabled();
});

test("adds a group, attaches PDFs and shows a tile per file", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  const a = await makePdf(page, "a.pdf");
  const b = await makePdf(page, "b.pdf", 2);
  await addGroupWithFiles(page, [a, b]);

  await expect(page.locator("#empty-state")).toBeHidden();
  await expect(page.locator(".merge-file-name")).toHaveText(["a.pdf", "b.pdf"]);
});

test("removing a file drops its tile", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  await addGroupWithFiles(page, [await makePdf(page, "a.pdf"), await makePdf(page, "b.pdf")]);
  await expect(page.locator(".merge-file-tile")).toHaveCount(2);

  await page.locator('[data-action="remove-file"]').first().click();
  await expect(page.locator(".merge-file-name")).toHaveText(["b.pdf"]);
});

test("merges the selected group into one PDF named after the label", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  await addGroupWithFiles(page, [await makePdf(page, "a.pdf", 1), await makePdf(page, "b.pdf", 2)]);
  await page.fill(".merge-group-label-input", "Assignment 1");
  await page.check(".group-checkbox");
  await expect(page.locator("#btn-merge-save")).toBeEnabled();

  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btn-merge-save")]);
  expect(download.suggestedFilename()).toBe("Assignment 1.pdf");
  expect(await readDownloadedPageCount(page, download)).toBe(3);
  await expect(page.locator(".toast", { hasText: "Merged and downloaded 1 PDF(s)." })).toBeVisible();
});

test("an unlabelled group is named after its first file", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  await addGroupWithFiles(page, [await makePdf(page, "notes.pdf")]);
  await page.check(".group-checkbox");

  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btn-merge-save")]);
  expect(download.suggestedFilename()).toBe("notes.pdf");
});

test("merging a selected empty group warns instead of downloading", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  await page.click("#btn-add-group");
  await page.check(".group-checkbox");
  await page.click("#btn-merge-save");
  await expect(page.locator(".toast", { hasText: "no PDFs to merge" })).toBeVisible();
});

test("deleting selected groups requires confirmation", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  await page.click("#btn-add-group");
  await page.click("#btn-add-group");
  await expect(page.locator(".merge-group")).toHaveCount(2);

  await page.check("#select-all-groups");
  await page.click("#btn-delete-groups");
  await page.locator(".modal.show [data-action='cancel']").click();
  await expect(page.locator(".modal.show")).toHaveCount(0);
  await expect(page.locator(".merge-group")).toHaveCount(2);

  await page.click("#btn-delete-groups");
  await page.locator(".modal.show [data-action='confirm']").click();
  await expect(page.locator(".merge-group")).toHaveCount(0);
  await expect(page.locator("#empty-state")).toBeVisible();
});

test("select-all is indeterminate when only some groups are selected", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  await page.click("#btn-add-group");
  await page.click("#btn-add-group");
  await page.locator(".group-checkbox").first().check();
  expect(await page.locator("#select-all-groups").evaluate((el) => el.indeterminate)).toBe(true);
});
