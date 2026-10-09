import { test, expect } from "@playwright/test";

test("home page lists every tool and each card opens its page", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("h1")).toHaveText("KGEC Pages");

  const cards = [
    ["Generate Front Page", /front-page-generator/],
    ["MultiMerge", /multimerge/],
    ["Topsheet", /topsheet/],
    ["Signature Extractor", /signature/],
  ];
  for (const [title, url] of cards) {
    await page.goto("/index.html");
    await page.locator(".feature-card", { hasText: title }).click();
    await expect(page).toHaveURL(url);
  }
});

test("home page shows version info loaded from version.json", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#home-meta .topbar-chip-primary")).toContainText(/\d/);
});

test("bottom navbar links to the main pages and highlights the current one", async ({ page }) => {
  await page.goto("/multimerge/index.html");
  await expect(page.locator('.bottom-nav-link[data-page="multimerge"]')).toHaveClass(/active/);

  await page.locator('.bottom-nav-link[data-page="generator"]').click();
  await expect(page).toHaveURL(/front-page-generator/);

  await page.locator(".bottom-nav-more button").click();
  await page.locator('.dropdown-item[data-page="settings"]').click();
  await expect(page).toHaveURL(/settings/);
});

test("subjects modal filters the subject list as you type", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator('button[data-bs-target="#subjectsModal"]').click();
  const rows = page.locator("#nav-subjects-list > *");
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();

  await page.fill("#nav-subjects-search", "zzzz-no-such-subject");
  await expect.poll(() => rows.count()).toBeLessThan(before);
});

test("every page loads without script errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));

  const pages = ["index", "front-page-generator/index", "multimerge/index", "settings/index", "signature/index", "topsheet/index", "readymade/index"];
  for (const path of pages) {
    await page.goto(`/${path}.html`);
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});
