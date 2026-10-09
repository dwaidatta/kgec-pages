import { test, expect } from "@playwright/test";
import { seedStorage, readStorage, STUDENT } from "./helpers.js";

const preview = (page) => page.frameLocator("#preview-frame");

test("loads the default layout into the editor and preview", async ({ page }) => {
  await page.goto("/front-page-generator/index.html");
  const input = page.locator("#title-lines .title-line-text").first();
  await expect(input).toBeVisible();

  const firstTitle = await input.inputValue();
  await expect(preview(page).locator("#group-title")).toContainText(firstTitle);
});

test("editing a title line updates the live preview", async ({ page }) => {
  await page.goto("/front-page-generator/index.html");
  await page.locator("#title-lines .title-line-text").first().fill("My Custom Title");
  await expect(preview(page).locator("#group-title p").first()).toHaveText("My Custom Title");
});

test("adding and removing a title line changes the preview", async ({ page }) => {
  await page.goto("/front-page-generator/index.html");
  const lines = preview(page).locator("#group-title p");
  await expect(lines.first()).toBeVisible();
  const count = await lines.count();

  await page.click("#btn-add-title-line");
  await expect(lines).toHaveCount(count + 1);

  await page.locator(".remove-title-line").last().click();
  await expect(lines).toHaveCount(count);
});

test("emblem style switches the emblem shown in the preview", async ({ page }) => {
  await page.goto("/front-page-generator/index.html");
  await page.check("#emblem-curved");
  await expect(preview(page).locator("#emblem-curved")).toBeVisible();
  await expect(preview(page).locator("#emblem-straight")).toBeHidden();

  await page.check("#emblem-straight");
  await expect(preview(page).locator("#emblem-straight")).toBeVisible();
});

test("with no students the make-for list points to Settings", async ({ page }) => {
  await page.goto("/front-page-generator/index.html");
  await expect(page.locator("#make-for-list a[href*='settings']")).toBeVisible();
});

test("selecting a student fills the linked detail rows in the preview", async ({ page }) => {
  await seedStorage(page, { kgec_pages_users: [STUDENT] });
  await page.goto("/front-page-generator/index.html");

  await page.locator(`#mf-${STUDENT.id}`).check();
  await expect(preview(page).locator("#group-details")).toContainText(STUDENT.name);
});

test("saving a layout as new lists it and survives a reload", async ({ page }) => {
  await page.goto("/front-page-generator/index.html");
  await page.locator("#title-lines .title-line-text").first().fill("Saved Title");

  await page.click("#btn-save-layout");
  await page.locator(".modal.show input[type=text]").fill("My Layout");
  await page.locator(".modal.show [data-action='confirm']").click();

  await expect.poll(async () => Object.values((await readStorage(page, "kgec_pages_student_frontpage_layouts")) || {}).map((l) => l.label)).toContain("My Layout");
  await expect(page.locator("#layout-select option", { hasText: "My Layout" })).toHaveCount(1);

  await page.reload();
  await expect(page.locator("#layout-select option", { hasText: "My Layout" })).toHaveCount(1);
});

test("margin input updates the preview CSS variable", async ({ page }) => {
  await page.goto("/front-page-generator/index.html");
  await page.fill("#margin-left", "17");
  await expect
    .poll(() => preview(page).locator(".inner-frame").evaluate((el) => el.style.getPropertyValue("--margin-left")))
    .toBe("17mm");
});
