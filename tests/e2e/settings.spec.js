import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { seedStorage, readStorage, STUDENT, TEACHER, USERS_KEY } from "./helpers.js";

const studentCard = (page) => page.locator("#people-sections > *").first();
const teacherCard = (page) => page.locator("#people-sections > *").nth(1);

test("adds a student through the modal and persists it", async ({ page }) => {
  await page.goto("/settings/index.html");

  await studentCard(page).getByRole("button", { name: /Add Student/ }).click();
  await page.fill('#add-person-form input[name="name"]', "Jane Doe");
  await page.fill('#add-person-form input[name="roll"]', "12");
  await page.click("#btn-save-new-person");

  await expect(page.locator(".toast", { hasText: "Student added." })).toBeVisible();
  const users = await readStorage(page, USERS_KEY);
  expect(users).toHaveLength(1);
  expect(users[0]).toMatchObject({ role: "student", name: "Jane Doe", roll: "12" });

  await page.reload();
  await expect(studentCard(page).locator(".person-checkbox")).toHaveCount(1);
});

test("refuses to add a person without a name", async ({ page }) => {
  await page.goto("/settings/index.html");
  await studentCard(page).getByRole("button", { name: /Add Student/ }).click();
  await page.click("#btn-save-new-person");

  await expect(page.locator(".toast", { hasText: "Name is required." })).toBeVisible();
  expect(await readStorage(page, USERS_KEY)).toBeNull();
});

test("adds a teacher into the teacher section", async ({ page }) => {
  await page.goto("/settings/index.html");
  await teacherCard(page).getByRole("button", { name: /Add Teacher/ }).click();
  await page.fill('#add-person-form input[name="name"]', "Prof Smith");
  await page.fill('#add-person-form input[name="mobile"]', "9999999999");
  await page.click("#btn-save-new-person");

  const users = await readStorage(page, USERS_KEY);
  expect(users[0]).toMatchObject({ role: "teacher", name: "Prof Smith", mobile: "9999999999" });
  await expect(teacherCard(page).locator(".person-checkbox")).toHaveCount(1);
  await expect(studentCard(page).locator(".person-checkbox")).toHaveCount(0);
});

test("deleting a person asks for confirmation and can be cancelled", async ({ page }) => {
  await seedStorage(page, { [USERS_KEY]: [STUDENT, TEACHER] });
  await page.goto("/settings/index.html");

  await page.locator(".btn-delete-single").first().click();
  await page.locator(".modal.show [data-action='cancel']").click();
  await expect(page.locator(".modal.show")).toHaveCount(0);
  expect(await readStorage(page, USERS_KEY)).toHaveLength(2);

  await page.locator(".btn-delete-single").first().click();
  await page.locator(".modal.show [data-action='confirm']").click();
  await expect(page.locator(".toast", { hasText: "Deleted 1 record(s)." })).toBeVisible();
  expect(await readStorage(page, USERS_KEY)).toEqual([TEACHER]);
});

test("editing a saved field updates storage", async ({ page }) => {
  await seedStorage(page, { [USERS_KEY]: [STUDENT] });
  await page.goto("/settings/index.html");

  const card = studentCard(page);
  await card.locator(".person-toggle").click();
  const nameInput = card.locator(".person-fields input").first();
  await nameInput.fill("Jane Q Doe");
  await nameInput.blur();

  expect((await readStorage(page, USERS_KEY))[0].name).toBe("Jane Q Doe");
});

test("exports people as JSON and imports them back", async ({ page }) => {
  await seedStorage(page, { [USERS_KEY]: [STUDENT] });
  await page.goto("/settings/index.html");

  const [download] = await Promise.all([page.waitForEvent("download"), studentCard(page).getByRole("button", { name: "Export" }).click()]);
  const path = await download.path();
  expect(await readFile(path, "utf8")).toContain("Jane Doe");

  await page.evaluate((k) => localStorage.removeItem(k), USERS_KEY);
  await page.reload();
  await studentCard(page).locator("input[type=file]").setInputFiles(path);
  await expect.poll(() => readStorage(page, USERS_KEY).then((u) => u?.length)).toBe(1);
});

test("blooms list: add a level", async ({ page }) => {
  await page.goto("/settings/index.html");
  const before = await page.locator("#bloom-list > *").count();

  await page.fill("#bloom-add-input", "IX - Custom Level");
  await page.press("#bloom-add-input", "Enter");
  await expect(page.locator("#bloom-list")).toContainText("IX - Custom Level");
  await expect(page.locator("#bloom-list > *")).toHaveCount(before + 1);
});
