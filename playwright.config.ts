import { defineConfig, devices } from "@playwright/test";

// Dummy Firebase project: the tests intercept every Google endpoint, so no real project or key is used.
const DUMMY = JSON.stringify({ apiKey: "e2e-dummy-key", projectId: "e2e-dummy", appId: "1:000000000000:web:e2e", authDomain: "e2e-dummy.firebaseapp.com" });

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:5192", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: undefined } },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /a11y|states/ },
  ],
  webServer: {
    command: "npx vite --port 5192 --strictPort",
    url: "http://127.0.0.1:5192",
    reuseExistingServer: false,
    env: { VITE_FIREBASE_CONFIG: DUMMY, VITE_APPCHECK_DEBUG_TOKEN: "00000000-0000-4000-8000-000000000000" },
  },
});
