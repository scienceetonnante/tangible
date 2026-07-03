import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/prepare.mjs",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5178",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium", launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } } },
    // WebKit == Safari's engine; guards the Safari audio/Range path.
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "node e2e/serve.mjs",
    port: 5178,
    reuseExistingServer: !process.env.CI,
  },
});
