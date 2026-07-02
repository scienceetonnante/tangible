import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e specs run under Playwright, not Vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
