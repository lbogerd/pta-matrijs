import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "capture.spec.ts",
  globalSetup: "./setup.ts",
  timeout: 240000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3818",
    viewport: { width: 1440, height: 1000 },
    locale: "nl-NL",
    timezoneId: "Europe/Amsterdam",
  },
});
