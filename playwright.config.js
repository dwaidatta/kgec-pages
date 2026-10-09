import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.js",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/e2e/server.js",
    url: "http://localhost:4173/index.html",
    reuseExistingServer: !process.env.CI,
  },
});
