// The assembled GitHub Pages site (scripts/site.ts), served below /dotmatrix/ by `pnpm preview:site`
// as Pages serves it: no custom headers, and the root 404.html for every missing path. Each app loads
// at its path, deep links survive a reload (the root 404 page hands them to their app), and Pocket's
// share link opens its song in another browser.
import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const BASE = "/dotmatrix/";

declare global {
  var dotmatrix: { song(): { title: string; tracks: unknown[] } };
}

/** Pocket has hydrated: its root layout's onMount sets the `dotmatrix` handle. */
const hydrated = (page: Page) => page.waitForFunction(() => "dotmatrix" in globalThis);

/** Page errors and console errors, except Chromium's report of a document served with a 404. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("404 (Not Found)"))
      errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

/**
 * Advanced is cross-origin isolated: Pages sends no COOP/COEP, so its service worker
 * (apps/advanced/public/coi-sw.js) adds them, and the first visit reloads the page once.
 */
async function isolated(page: Page) {
  await expect
    .poll(() => page.evaluate(() => globalThis.crossOriginIsolated).catch(() => false), {
      timeout: 15_000,
    })
    .toBe(true);
}

/** The document is the React port's: its scripts load from below /dotmatrix/react/. */
const isReact = (page: Page) =>
  expect(page.locator(`script[src^="${BASE}react/"]`).first()).toBeAttached();

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = watch(page);
});
test.afterEach(() => expect(errors).toEqual([]));

test.describe("Pocket at /dotmatrix/", () => {
  test("loads, and redirects the base without its trailing slash", async ({ page }) => {
    await page.goto("/dotmatrix");
    await expect(page).toHaveURL(BASE);
    await hydrated(page);
    await expect(page.getByRole("button", { name: "Play song" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lumiose" })).toHaveAttribute(
      "href",
      "https://itsjavi.com/lumiose/",
    );
  });

  test("deep links reload, and an unknown path is Pocket's 404 page", async ({ page }) => {
    await page.goto(`${BASE}learn/composing`);
    await page.reload();
    await hydrated(page);
    await expect(
      page.getByRole("heading", { name: "Composing for Dotmatrix Pocket" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Views" })
      .getByRole("link", { name: "Songs" })
      .click();
    await expect(page).toHaveURL(`${BASE}songs`);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Song gallery" })).toBeVisible();

    const response = await page.goto(`${BASE}no-such-cartridge`);
    expect(response!.status()).toBe(404);
    await hydrated(page);
    await expect(page.getByText("No cartridge here")).toBeVisible();
  });

  test("a share link opens its song in another browser, also after a reload", async ({
    page,
    browser,
  }) => {
    await page.goto(BASE);
    await hydrated(page);
    await page.locator("#song-title").fill("Shared tune");
    await page.locator("#song-title").press("Enter");
    const box = (await page.locator(".lane").boundingBox())!;
    await page.mouse.click(box.x + 6 * 22 + 8, box.y + 1 * 18 + 8);
    await page.getByRole("button", { name: "Share" }).click();
    const url = await page.locator("#share-url").inputValue();
    expect(url).toMatch(/^http:\/\/localhost:\d+\/dotmatrix\/\?song=1\./);
    const expected = await page.evaluate(() => dotmatrix.song());

    const other = await browser.newContext();
    const fresh = await other.newPage();
    const freshErrors = watch(fresh);
    await fresh.goto(url);
    await hydrated(fresh);
    await expect(fresh.locator("#song-title")).toHaveValue("Shared tune");
    await expect(fresh).toHaveURL(BASE);
    expect((await fresh.evaluate(() => dotmatrix.song())).tracks).toEqual(expected.tracks);
    // The studio autosaves the opened song after a short pause.
    await expect
      .poll(() => fresh.evaluate(() => localStorage.getItem("dotmatrix.current")))
      .toContain('"title":"Shared tune"');
    await fresh.reload();
    await hydrated(fresh);
    await expect(fresh.locator("#song-title")).toHaveValue("Shared tune");
    expect(freshErrors).toEqual([]);
    await other.close();
  });
});

test.describe("Advanced at /dotmatrix/advanced/", () => {
  test("loads the tracker, cross-origin isolated by its service worker", async ({ page }) => {
    await page.goto(`${BASE}advanced/`);
    await isolated(page);
    // The reload asks for the prerendered /songs/demo, which Pages redirects to its folder's slash.
    await expect(page).toHaveURL(new RegExp(`^http://localhost:\\d+${BASE}advanced/songs/\\w+/?$`));
    await expect(page.locator(".row").first()).toBeVisible();
    await expect(page.locator(".header .title")).toHaveText("Lumiose Quest");
  });

  test("a song only this browser knows reloads at its URL, through the root 404 page", async ({
    page,
  }) => {
    await page.goto(`${BASE}advanced/songs`);
    await isolated(page);
    await page.getByRole("button", { name: "New song" }).click();
    await page.getByRole("link", { name: "Tracker" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}advanced/songs/(?!demo)\\w+$`));
    const url = page.url();

    // Pages has no file for it: the root 404.html renders Advanced's 404.html in place, and the
    // router opens the song from the library.
    const response = await page.reload();
    expect(response!.status()).toBe(404);
    await expect(page.locator(".header .title")).toHaveText("Untitled");
    await expect(page.locator(".row").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "404 · Not here" })).toHaveCount(0);
    expect(page.url()).toBe(url);
    await isolated(page);

    // Client-side navigation still works in the handed-off document.
    await page.getByRole("link", { name: "Instruments" }).click();
    await expect(page).toHaveURL(`${BASE}advanced/instruments`);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Instrument 00" })).toBeVisible();
  });

  test("an unknown path below it is Advanced's 404 page, not Pocket's", async ({ page }) => {
    const response = await page.goto(`${BASE}advanced/songs/nope?from=test#here`);
    expect(response!.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404 · Not here" })).toBeVisible();
    await expect(page.getByText("No cartridge here")).toHaveCount(0);
    expect(page.url()).toMatch(/\/advanced\/songs\/nope\?from=test#here$/);
  });
});

test.describe("Pocket (React) at /dotmatrix/react/", () => {
  test.beforeEach(() => {
    test.skip(!existsSync("dist/site/react"), "apps/pocket-react is not in this checkout yet");
  });

  test("loads", async ({ page }) => {
    const response = await page.goto(`${BASE}react/`);
    expect(response!.status()).toBe(200);
    await isReact(page);
  });

  test("a deep link reloads into the React app, not Pocket's 404 page", async ({ page }) => {
    await page.goto(`${BASE}react/songs`);
    await page.reload();
    await isReact(page);
    await expect(page.getByText("No cartridge here")).toHaveCount(0);
  });
});
