import { defineConfig } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * No `webServer`: both the dashboard and the Python API have to be running
 * already, and starting the API from here would hide which of the two broke.
 * One worker, because the tests write to a shared clinic and a parallel run
 * would have them cancelling each other's appointments.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    // A failing write is the interesting case, so keep the evidence.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
