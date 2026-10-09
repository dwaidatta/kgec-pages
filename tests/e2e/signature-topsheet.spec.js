import { test, expect } from "@playwright/test";
import { seedStorage, TEACHER, STUDENT, USERS_KEY } from "./helpers.js";

test("signature page switches between student and teacher owners", async ({ page }) => {
  await seedStorage(page, { [USERS_KEY]: [STUDENT, TEACHER] });
  await page.goto("/signature/index.html");

  await expect(page.locator("#sig-role-student")).toBeChecked();
  await expect(page.locator("#flow")).not.toBeEmpty();
  await page.locator('label[for="sig-role-teacher"]').click();
  await expect(page.locator("#sig-role-teacher")).toBeChecked();
  await expect(page.locator("#flow")).not.toBeEmpty();
  await expect(page.locator("#results-section")).toBeHidden();
});

test("topsheet role chooser opens the teacher flow", async ({ page }) => {
  await page.goto("/topsheet/index.html");
  await expect(page.locator("#role-chooser")).toBeVisible();

  await page.locator('.feature-card[data-role="teacher"]').click();
  await expect(page.locator("#flow-teacher")).toBeVisible();
  await expect(page.locator("#role-chooser")).toBeHidden();
});

test("topsheet role chooser opens the student flow", async ({ page }) => {
  await page.goto("/topsheet/index.html");
  await page.locator('.feature-card[data-role="student"]').click();
  await expect(page.locator("#flow-student")).toBeVisible();
  await expect(page.locator("#st-empty")).toBeVisible();
});

test("teacher topsheet editor offers the saved teacher", async ({ page }) => {
  await seedStorage(page, { [USERS_KEY]: [TEACHER] });
  await page.goto("/topsheet/index.html#teacher");
  await expect(page.locator("#flow-teacher")).toBeVisible();
  await expect(page.locator("#ts-teacher-select")).toContainText("Prof Smith");
});

test("choosing an image on the signature page starts extracting it", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto("/signature/index.html");

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('#flow [data-role="file"]').setInputFiles({ name: "sig.png", mimeType: "image/png", buffer: png });

  await expect(page.locator('#flow [data-step="busy"]')).toBeVisible();
  await expect(page.locator('#flow [data-role="timeline"] li').first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});
