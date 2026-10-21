import { defineConfig, devices } from "@playwright/test";

// The GitHub Pages site (tests/site.spec.ts): `pnpm build:site` builds every app with its base and
// assembles them, and `pnpm preview:site` serves the result below /dotmatrix/ the way Pages does.
// Each app's own suite lives in its folder (apps/<app>/playwright.config.ts).
const PORT = 5210;

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  webServer: {
    command: `pnpm build:site && pnpm preview:site --port ${PORT}`,
    port: PORT,
    timeout: 300_000,
  },
  projects: [
    {
      name: "site",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Headless Chromium has no audio device: let the AudioContext start without a gesture prompt.
        launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
        baseURL: `http://localhost:${PORT}`,
      },
    },
  ],
});
