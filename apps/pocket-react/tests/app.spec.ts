// The user flows of apps/pocket's suite, against the React port. Locators use roles, labels and a
// few data attributes: CSS module class names are hashed.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

declare global {
  var dotmatrix: {
    position(): number;
    song(): { title: string; tracks: { notes: { s: number; l: number; p: number }[] }[] };
  };
}

const errors: string[] = [];
/** Page errors and console errors and warnings (React reports its own problems as both). */
function watch(page: Page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      errors.push(`console.${message.type()}: ${message.text()}`);
  });
}
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  watch(page);
  await page.goto("/learn");
  await page.evaluate(() => localStorage.clear());
});
test.afterEach(() => expect(errors).toEqual([]));

const lane = (page: Page) => page.getByRole("application");
const notes = (page: Page) => lane(page).locator("[data-step]");
const status = (page: Page) =>
  page.getByRole("region", { name: "Transport" }).locator("[aria-live]");
const title = (page: Page) => page.getByLabel("Song title");
const mySounds = (page: Page, name = "My sounds") => page.getByRole("region", { name });
const code = (page: Page) => page.locator("pre");

async function readDownload(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent("download");
  await click();
  const file = await download;
  return { name: file.suggestedFilename(), data: readFileSync((await file.path())!) };
}

test("plays the studio song with a moving playhead", async ({ page }) => {
  await page.goto("/");
  await expect(title(page)).toHaveValue("First Steps");
  await page.getByRole("button", { name: "Play song" }).click();
  await expect(status(page)).toContainText("Playing");
  await expect(page.getByTestId("playhead")).toBeVisible();
  await expect.poll(() => page.evaluate(() => dotmatrix.position())).toBeGreaterThan(0.5);
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Play song" })).toBeVisible();
});

test("adds, lengthens, removes and undoes notes on the grid", async ({ page }) => {
  await page.goto("/");
  const box = (await lane(page).boundingBox())!;
  const cell = (step: number, row: number) => ({
    x: box.x + step * 22 + 8,
    y: box.y + row * 18 + 8,
  });
  const before = await notes(page).count();
  // Drag from step 1 to step 3 on the top row: one note, three steps long.
  await page.mouse.move(cell(1, 0).x, cell(1, 0).y);
  await page.mouse.down();
  await page.mouse.move(cell(3, 0).x, cell(3, 0).y, { steps: 4 });
  await page.mouse.up();
  await expect(notes(page)).toHaveCount(before + 1);
  await expect(lane(page).locator('[data-step="1"]')).toHaveAttribute("style", /--l: ?3/);
  // Undo removes it in one step (create and drag merge); redo brings it back.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(notes(page)).toHaveCount(before);
  await expect(status(page)).toContainText("Undo: Add note");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(notes(page)).toHaveCount(before + 1);
  // Clicking a note removes it.
  await page.mouse.click(cell(2, 0).x, cell(2, 0).y);
  await expect(notes(page)).toHaveCount(before);
  // The edit is autosaved.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(notes(page)).toHaveCount(before);
});

test("edits with the keyboard and switches channels", async ({ page }) => {
  await page.goto("/");
  await lane(page).focus();
  // The cursor starts on C5, step 1. One row up is D5, which is empty there.
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+ArrowRight");
  const song = await page.evaluate(() => dotmatrix.song());
  // The new note cuts the C5 under it short: a channel plays one note at a time.
  expect(song.tracks[0]!.notes.slice(0, 2)).toEqual([
    { s: 0, l: 1, p: 72 },
    { s: 1, l: 3, p: 74 },
  ]);
  await expect(lane(page)).toBeFocused();
  // Channel 4 (noise) shows the drum kit rows.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("4");
  await expect(page.getByText("CR", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Noise/ })).toHaveAttribute("aria-checked", "true");
});

test("changes a preset and fine-tunes it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Music box" }).click();
  await expect(page.getByText("MUSIC BOX", { exact: true })).toBeVisible();
  await page.getByText("Fine-tune").click();
  await page.getByRole("radio", { name: "75%" }).click();
  const song = await page.evaluate(
    () => dotmatrix.song() as unknown as { tracks: { inst: { duty: number; preset: string } }[] },
  );
  expect(song.tracks[0]!.inst).toMatchObject({ duty: 3, preset: "bell" });
});

test("plays a demo from the gallery and opens it in the studio", async ({ page }) => {
  await page.goto("/songs");
  await expect(page.getByRole("list", { name: "Demo songs" }).locator(":scope > li")).toHaveCount(
    13,
  );
  await page.getByRole("button", { name: "Listen to Rival Clash" }).click();
  await expect(page.getByRole("button", { name: "Stop Rival Clash" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => dotmatrix.position())).toBeGreaterThan(0.5);
  await page.getByRole("button", { name: "Open Rival Clash in the studio" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(title(page)).toHaveValue("Rival Clash");
  await expect(page.getByText("LOOP", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play song" }).click();
  await expect.poll(() => page.evaluate(() => dotmatrix.position())).toBeGreaterThan(3.5);
  await page.getByRole("button", { name: "Stop" }).click();
  // Undo brings back the previous song.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(title(page)).toHaveValue("First Steps");
});

test("exports the studio song as a looping WAV file", async ({ page }) => {
  await page.goto("/");
  const { name, data } = await readDownload(page, () =>
    page.getByRole("button", { name: "Export WAV" }).click(),
  );
  expect(name).toBe("first-steps.wav");
  expect(data.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(data.subarray(8, 12).toString("ascii")).toBe("WAVE");
  expect(data.includes(Buffer.from("smpl"))).toBe(true);
  // 4 bars at 112 BPM, twice (intro plus loop), 48 kHz stereo 16-bit: about 3.3 MB.
  expect(data.length).toBeGreaterThan(3_000_000);
});

test("shares a song through its URL", async ({ page, browser }) => {
  await page.goto("/");
  await title(page).fill("Shared tune");
  await title(page).press("Enter");
  const box = (await lane(page).boundingBox())!;
  await page.mouse.click(box.x + 6 * 22 + 8, box.y + 1 * 18 + 8);
  await page.getByRole("button", { name: "Share" }).click();
  const url = await page.locator("#share-url").inputValue();
  expect(url).toMatch(/\/\?song=1\./);
  const expected = await page.evaluate(() => dotmatrix.song());

  // A fresh browser (no saved song) opens the link: the studio loads the shared song.
  const other = await browser.newContext();
  const fresh = await other.newPage();
  watch(fresh);
  await fresh.goto(url);
  await expect(fresh.getByLabel("Song title")).toHaveValue("Shared tune");
  await expect(fresh).toHaveURL(/\/$/);
  const opened = await fresh.evaluate(() => dotmatrix.song());
  expect(opened.tracks).toEqual(expected.tracks);
  await other.close();
});

/** Every route and a text it shows. */
const ROUTES = [
  { path: "/", text: "Pulse 1" },
  { path: "/songs", text: "Song gallery" },
  { path: "/sfx", text: "Sound effects" },
  { path: "/creatures", text: "Creature voices" },
  { path: "/learn", text: "How a pocket console makes music" },
  { path: "/learn/composing", text: "Composing for Dotmatrix Pocket" },
  { path: "/no-such-cartridge", text: "No cartridge here" },
];

test("every route renders inside the console's frame", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(page.getByRole("navigation", { name: "Views" }).getByRole("link")).toHaveCount(5);
    await expect(page.locator("main")).toContainText(route.text);
  }
  // Later navigation is client-side.
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await page
    .getByRole("navigation", { name: "Views" })
    .getByRole("link", { name: "Songs" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Song gallery");
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
});

test("what the browser saved comes back", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("dotmatrix.prefs", JSON.stringify({ theme: "dark", lcd: "ice" }));
    localStorage.setItem(
      "dotmatrix.current",
      JSON.stringify({ ...dotmatrix.song(), title: "Saved tune" }),
    );
  });
  await page.reload();
  await expect(title(page)).toHaveValue("Saved tune");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-lcd", "ice");
  await expect(page.getByRole("radio", { name: "Ice" })).toHaveAttribute("aria-checked", "true");
  // The saved theme and palette apply before the app runs: an inline script in the document head.
  const noApp = await page.context().newPage();
  await noApp.route("**/*", (route) =>
    route.request().resourceType() === "script" ? route.abort() : route.continue(),
  );
  await noApp.goto("/");
  await expect(noApp.locator("html")).toHaveAttribute("data-lcd", "ice");
  await expect(noApp.locator("html")).toHaveAttribute("data-theme", "dark");
  await noApp.close();
});

test("audio starts only after a user gesture", async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    (window as unknown as { contexts: number }).contexts = 0;
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        (window as unknown as { contexts: number }).contexts++;
      }
    };
  });
  const contexts = () => page.evaluate(() => (window as unknown as { contexts: number }).contexts);
  for (const path of ["/", "/sfx", "/creatures", "/songs"]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    expect(await contexts(), path).toBe(0);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Play song" }).click();
  await expect(status(page)).toContainText("Playing");
  expect(await contexts()).toBe(1);
});

test("SFX gallery: plays, bends, shows code and exports", async ({ page }) => {
  await page.goto("/sfx");
  await expect(page.getByRole("list", { name: "Sound effects" }).getByRole("button")).toHaveCount(
    20,
  );
  await page.getByRole("button", { name: /^Jump/ }).click();
  await expect(page.locator("#maker-title")).toHaveText("Jump");
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(code(page)).toContainText("pitch_sweep 2, 4");
  await page.getByRole("slider").first().fill("5");
  await expect(code(page)).toContainText("F5");
  const { name, data } = await readDownload(page, () =>
    page.getByRole("button", { name: "Export WAV" }).click(),
  );
  expect(name).toBe("jump.wav");
  expect(data.subarray(8, 12).toString("ascii")).toBe("WAVE");
  expect(data.length).toBeGreaterThan(20_000);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("fits the studio, gallery and SFX pages without sideways scrolling", async ({ page }) => {
    for (const path of ["/", "/songs", "/sfx"]) {
      await page.goto(path);
      await page.locator("main h1, main [aria-label='Transport']").first().waitFor();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test("dark theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("radio", { name: "Dusk" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-lcd", "dusk");
});

/** Elements that stick out of their panel or card, ignoring content of scroll areas (the grid). */
function overflowing(): string[] {
  const out: string[] = [];
  const cards = document.querySelectorAll(
    ".panel, [aria-label='Demo songs'] > li, [aria-label='Sound effects'] button",
  );
  for (const panel of cards) {
    const box = panel.getBoundingClientRect();
    for (const el of panel.querySelectorAll("*")) {
      let clipped = false;
      for (let a = el.parentElement; a && a !== panel; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== "visible") clipped = true;
      }
      const r = el.getBoundingClientRect();
      if (!clipped && r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)) {
        out.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute("class"))}`);
      }
    }
  }
  return out;
}

test("no control sticks out of its panel at desktop, tablet and phone widths", async ({ page }) => {
  for (const width of [1920, 1440, 1280, 1024, 820, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/songs", "/sfx", "/creatures", "/learn", "/learn/composing"]) {
      await page.goto(path);
      await page.locator("main .panel").first().waitFor();
      expect(await page.evaluate(overflowing), `${path} at ${width}px`).toEqual([]);
    }
  }
});

test("creature voices: pick, bend, read the code and export", async ({ page }) => {
  await page.goto("/creatures");
  await expect(page.getByRole("list", { name: "Creatures" }).getByRole("button")).toHaveCount(20);
  await page.getByRole("button", { name: "Wispet" }).click();
  await expect(page.locator("#maker-title")).toHaveText("Wispet");
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(code(page)).toContainText('base voice "Moan", pitch $0000, length $0100');
  await page.getByRole("slider").first().fill("64");
  await expect(code(page)).toContainText("pitch $0040");
  await page.getByRole("radio", { name: /Rumble/ }).click();
  await expect(code(page)).toContainText('base voice "Rumble"');
  await expect(page.locator("#maker-title")).toHaveText("Wispet (remix)");
  await page.getByRole("button", { name: "Surprise me" }).click();
  await expect(page.locator("#maker-title")).toHaveText("Mystery creature");
  await page.getByRole("button", { name: "Emberkit" }).click();
  await expect(code(page)).toContainText("duty_cycle_pattern");
  await page.getByRole("button", { name: "Boulderback" }).click();
  const { name, data } = await readDownload(page, () =>
    page.getByRole("button", { name: "Export WAV" }).click(),
  );
  expect(name).toBe("boulderback.wav");
  expect(data.subarray(8, 12).toString("ascii")).toBe("WAVE");
});

test("an SFX opens in the studio, is edited on the frame grid and comes back", async ({ page }) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: /^Hit/ }).click();
  await page.getByRole("button", { name: "Open in studio" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(title(page)).toHaveValue("Hit");
  await expect(page.getByText("1 F/STEP", { exact: true })).toBeVisible();
  await expect(page.getByText("0f", { exact: true })).toBeVisible();
  // The hardware sweep and the noise travel as per-note settings (the notch) and raw noise rows.
  await expect(lane(page).locator("[data-own]")).toHaveCount(1);
  const before = await page.evaluate(
    () => dotmatrix.song() as unknown as { tracks: { notes: { w?: number }[] }[] },
  );
  expect(before.tracks[0]!.notes[0]!.w).toBe(-6);
  await page.keyboard.press("4");
  await expect(page.getByText("$00", { exact: true })).toBeVisible();
  await page.keyboard.press("1");
  // Add a second, higher note after the first one.
  const box = (await lane(page).boundingBox())!;
  await page.mouse.click(box.x + 15 * 22 + 8, box.y + 2 * 18 + 8);
  await page.getByRole("button", { name: "Play song" }).click();
  await expect(page.getByRole("button", { name: "Play song" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Save to My sounds" }).click();
  await expect(page).toHaveURL(/\/sfx\?sound=\w+/);
  await expect(page.locator("#maker-title")).toHaveText("Hit");
  await expect(mySounds(page).getByRole("button", { pressed: true })).toHaveText(/Hit/);
  // It is a plain sound again: the sliders work and the code shows the new note.
  await expect(page.getByRole("slider").first()).toBeEnabled();
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(code(page)).toContainText("pitch_sweep 1, -2");
  const text = await code(page).textContent();
  expect(text!.match(/square_note/g)!.length).toBeGreaterThanOrEqual(2);
});

test("a sound with studio-only features stays a sheet and says why", async ({ page }) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: /^Jump/ }).click();
  await page.getByRole("button", { name: "Open in studio" }).click();
  await expect(title(page)).toHaveValue("Jump");
  await page.getByText("Fine-tune").click();
  await page.getByRole("slider", { name: "Vibrato depth" }).fill("4");
  await page.getByRole("button", { name: "Save to My sounds" }).click();
  await expect(page).toHaveURL(/\/sfx\?sound=/);
  await expect(page.getByRole("note")).toContainText("Pulse 1 has vibrato");
  await expect(page.getByRole("slider").first()).toBeDisabled();
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(page.getByText(/no driver code/)).toBeVisible();
  // It still plays and opens in the studio as it is.
  await page.getByRole("button", { name: "Play Jump" }).click();
  await page.getByRole("button", { name: "Open in studio" }).click();
  await expect(title(page)).toHaveValue("Jump");
  const song = await page.evaluate(
    () => dotmatrix.song() as unknown as { tracks: { inst: { vibrato: { depth: number } } }[] },
  );
  expect(song.tracks[0]!.inst.vibrato.depth).toBe(4);
});

test.describe("phone, creatures and sheets", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("creatures and a sound sheet fit a phone", async ({ page }) => {
    await page.goto("/creatures");
    await page.getByRole("list", { name: "Creatures" }).getByRole("button").first().waitFor();
    await page.getByRole("button", { name: "Open in studio" }).click();
    await expect(page.getByText(/F\/STEP/)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("the composing guide opens from Learn", async ({ page }) => {
  await page.goto("/learn");
  await page.getByRole("link", { name: "composing guide" }).click();
  await expect(page).toHaveURL(/\/learn\/composing$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Composing for Dotmatrix Pocket",
  );
  const guide = page.getByRole("article");
  await expect(guide.locator("table").first()).toBeVisible();
  await expect(guide.locator("pre").first()).toContainText("square_note");
});

const LASER = (typo: boolean) =>
  [
    "; pulse 1",
    "  duty_cycle_pattern 0, 0, 3, 3",
    `  ${typo ? "sqare_note" : "square_note"} 3, 15, 1, $7C6  ; slides -12/frame`,
    "  square_note 12, 12, 3, $7A0",
    "  sound_ret",
    "; noise",
    "  noise_note 4, 9, 2, $11",
    "  sound_ret",
  ].join("\n");

const codeErrors = (page: Page) => page.locator("#code-errors li");

test("built-in sounds show read-only code with a copy button", async ({ page }) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(code(page)).toContainText("square_note");
  await expect(page.getByRole("button", { name: "Edit code" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import file…" })).toHaveCount(0);
  await page.getByRole("button", { name: "Copy to My sounds" }).click();
  await expect(mySounds(page).getByRole("button", { pressed: true })).toHaveText(/Select copy/);
  await expect(page.getByRole("button", { name: "Edit code" })).toBeVisible();
});

test("pasted driver code shows line errors, then plays and saves", async ({ page }) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: "Show code" }).click();
  await page.getByRole("button", { name: "Copy to My sounds" }).click();
  await page.getByRole("button", { name: "Paste code" }).click();
  const draft = page.getByLabel("Driver code", { exact: true });
  await draft.fill(LASER(true));
  await page.getByRole("button", { name: "Play code" }).click();
  await expect(codeErrors(page)).toHaveText(["Line 3: Unknown command “sqare_note”"]);
  await expect(draft).toHaveAttribute("aria-invalid", "true");
  await codeErrors(page).getByRole("button").click();
  await expect(draft).toBeFocused();
  await draft.fill(LASER(false));
  await page.getByRole("button", { name: "Play code" }).click();
  await expect(codeErrors(page)).toHaveCount(0);
  await page.getByLabel("Name", { exact: true }).fill("Laser beam");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(mySounds(page).getByRole("listitem")).toHaveCount(1);
  await expect(mySounds(page).getByRole("button", { pressed: true })).toHaveText(/Laser beam/);
  await expect(page.locator("#maker-title")).toHaveText("Laser beam");
  await expect(code(page)).toContainText("duty_cycle_pattern 0, 0, 3, 3");
  await expect(code(page)).toContainText("slides -12/frame");
});

test("a creature's voice is copied, its code edited and saved", async ({ page }) => {
  await page.goto("/creatures");
  await page.getByRole("button", { name: "Chirrup" }).click();
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(code(page)).toContainText('; base voice "Warble"');
  await page.getByRole("button", { name: "Copy to My voices" }).click();
  await expect(mySounds(page, "My voices").getByRole("button", { pressed: true })).toHaveText(
    /Chirrup copy/,
  );
  await page.getByRole("button", { name: "Edit code" }).click();
  const draft = page.getByLabel("Driver code", { exact: true });
  const text = await draft.inputValue();
  // Make every pulse 1 note of the trill louder.
  await draft.fill(text.replace(/square_note 1, 12, 0,/g, "square_note 1, 15, 0,"));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(code(page)).toContainText("square_note 1, 15, 0,");
});

test("driver code imports from a file into a saved sound", async ({ page }) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: "Show code" }).click();
  await page.getByRole("button", { name: "Copy to My sounds" }).click();
  await page.getByLabel("Import driver code").setInputFiles({
    name: "zap-trap.asm",
    mimeType: "text/plain",
    buffer: Buffer.from(LASER(false)),
  });
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("zap-trap");
  await expect(codeErrors(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(mySounds(page).getByRole("button", { pressed: true })).toHaveText(/zap-trap/);
});

const studioErrors = (page: Page) => page.locator("#studio-code-errors li");

test("the studio shows the song as code, applies edits and reports errors", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Code" }).click();
  const area = page.getByLabel("Song code", { exact: true });
  await expect(area).toHaveValue(/song_title "First Steps"/);
  const text = await area.inputValue();
  await area.fill(
    text
      .replace("tempo 112", "tempo 100")
      .replace('song_title "First Steps"', 'song_title "Second Steps"'),
  );
  await area.press("ControlOrMeta+Enter");
  await expect(title(page)).toHaveValue("Second Steps");
  await expect(page.getByLabel("Tempo in BPM")).toHaveValue("100");
  // A typo: the error names its line; Revert restores the song's code.
  await area.fill(text.replace("note C_, 4", "note H_, 4"));
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(studioErrors(page).first()).toContainText("is not a note name");
  await page.getByRole("button", { name: "Revert" }).click();
  await expect(studioErrors(page)).toHaveCount(0);
  // Undo goes back to before the applied code.
  await page.getByRole("radio", { name: "Grid" }).click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(title(page)).toHaveValue("First Steps");
  await expect(notes(page).first()).toBeVisible();
});

test("the studio imports a song from a code file", async ({ page }) => {
  await page.goto("/songs");
  await page.getByRole("button", { name: "Open Maple Hollow in the studio" }).click();
  await page.getByRole("radio", { name: "Code" }).click();
  const text = await page.getByLabel("Song code", { exact: true }).inputValue();
  await page.goto("/");
  await page.getByRole("radio", { name: "Code" }).click();
  await page.getByLabel("Import code file").setInputFiles({
    name: "maple.asm",
    mimeType: "text/plain",
    buffer: Buffer.from(
      text.replace('song_title "Maple Hollow"', 'song_title "Maple Hollow (imported)"'),
    ),
  });
  await expect(title(page)).toHaveValue("Maple Hollow (imported)");
});

test("a sound sheet shows its SFX code in the studio and applies edits", async ({ page }) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: /^Jump/ }).click();
  await page.getByRole("button", { name: "Open in studio" }).click();
  await page.getByRole("radio", { name: "Code" }).click();
  const area = page.getByLabel("Sound code", { exact: true });
  await expect(area).toHaveValue(/pitch_sweep 2, 4/);
  await area.fill((await area.inputValue()).replace("square_note 16, 12,", "square_note 16, 9,"));
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(studioErrors(page)).toHaveCount(0);
  const song = await page.evaluate(
    () =>
      dotmatrix.song() as unknown as {
        sheet?: { name: string };
        tracks: { inst: { volume: number } }[];
      },
  );
  expect(song.sheet?.name).toBe("Jump");
  expect(song.tracks[0]!.inst.volume).toBe(9);
});

test("the song card holds settings; bar tools sit under the screen", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("region", { name: "Song", exact: true });
  // Only settings: the bar stepper's two buttons and the four new-note lengths.
  await expect(card.getByRole("button")).toHaveCount(2);
  await expect(card.getByRole("radio")).toHaveCount(4);
  const tools = page.getByRole("toolbar", { name: "Bar and channel tools" });
  await page.locator("[data-bar='1']").click();
  await tools.getByRole("button", { name: "Copy" }).click();
  await page.locator("[data-bar='2']").click();
  await tools.getByRole("button", { name: "Paste" }).click();
  const pitches = (from: number) =>
    page.evaluate(
      (f) =>
        dotmatrix
          .song()
          .tracks[0]!.notes.filter((n) => n.s >= f && n.s < f + 16)
          .map((n) => n.p),
      from,
    );
  expect(await pitches(32)).toEqual(await pitches(16));
  await card.getByLabel("Loop from").selectOption("1");
  await expect(page.getByText("LOOP", { exact: true })).toBeVisible();
});

test("the creature and base-voice grids fill complete rows", async ({ page }) => {
  await page.goto("/creatures");
  const columns = (name: string, role: "list" | "radiogroup") =>
    page
      .getByRole(role, { name })
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  await expect(page.getByRole("list", { name: "Creatures" }).getByRole("button")).toHaveCount(20);
  expect(await columns("Creatures", "list")).toBe(5);
  await expect(page.getByRole("radiogroup", { name: "Base voice" }).getByRole("radio")).toHaveCount(
    20,
  );
  expect(20 % (await columns("Base voice", "radiogroup"))).toBe(0);
});

test("the studio exports its song as code that imports back identically", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/songs");
  await page.getByRole("button", { name: "Open Echo Cave in the studio" }).click();
  const original = await page.evaluate(() => JSON.stringify(dotmatrix.song()));
  await page.getByRole("radio", { name: "Code" }).click();
  const { name, data } = await readDownload(page, () =>
    page.getByRole("button", { name: "Export code" }).click(),
  );
  expect(name).toBe("echo-cave.asm");
  const text = data.toString("utf8");
  expect(text).toContain('song_title "Echo Cave"');
  await page.getByRole("button", { name: "Copy code" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  // Start over, then import the file: the same song comes back.
  await page.getByRole("button", { name: "New song" }).click();
  await expect(title(page)).toHaveValue("New song");
  await page
    .getByLabel("Import code file")
    .setInputFiles({ name, mimeType: "text/plain", buffer: data });
  await expect(title(page)).toHaveValue("Echo Cave");
  expect(await page.evaluate(() => JSON.stringify(dotmatrix.song()))).toBe(original);
});

test("a built-in sound exports code that a saved sound imports back identically", async ({
  page,
}) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: /^Jump/ }).click();
  await page.getByRole("button", { name: "Show code" }).click();
  const shown = await code(page).textContent();
  const { name, data } = await readDownload(page, () =>
    page.getByRole("button", { name: "Export code" }).click(),
  );
  expect(name).toBe("jump.asm");
  expect(data.toString("utf8")).toBe(`${shown}\n`);
  await page.getByRole("button", { name: "Copy to My sounds" }).click();
  await page
    .getByLabel("Import driver code")
    .setInputFiles({ name, mimeType: "text/plain", buffer: data });
  await expect(codeErrors(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(mySounds(page).getByRole("button", { pressed: true })).toHaveText(/jump/);
  await expect(code(page)).toHaveText(shown!);
});

test("the studio opens cry and SFX files as sound sheets and song files as songs", async ({
  page,
}) => {
  // Export a creature voice and a sound effect from their makers.
  await page.goto("/creatures");
  await page.getByRole("button", { name: "Wispet" }).click();
  await page.getByRole("button", { name: "Show code" }).click();
  const cry = await readDownload(page, () =>
    page.getByRole("button", { name: "Export code" }).click(),
  );
  expect(cry.name).toBe("wispet.asm");
  await page.goto("/sfx");
  await page.getByRole("button", { name: /^Laser/ }).click();
  await page.getByRole("button", { name: "Show code" }).click();
  const sfx = await readDownload(page, () =>
    page.getByRole("button", { name: "Export code" }).click(),
  );

  // With a song open, the cry opens as a voice sheet (undoable), the SFX as a sound-effect sheet.
  await page.goto("/");
  await page.getByRole("radio", { name: "Code" }).click();
  const songCode = await page.getByLabel("Song code", { exact: true }).inputValue();
  const importFile = page.getByLabel("Import code file");
  await importFile.setInputFiles({ name: cry.name, mimeType: "text/plain", buffer: cry.data });
  await expect(studioErrors(page)).toHaveCount(0);
  await expect(page.getByText(/F\/STEP/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save to My voices" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(title(page)).toHaveValue("First Steps");
  await importFile.setInputFiles({ name: "laser.asm", mimeType: "text/plain", buffer: sfx.data });
  await expect(page.getByRole("button", { name: "Save to My sounds" })).toBeVisible();
  await expect(title(page)).toHaveValue("laser");

  // With that sound sheet open, a song file opens as a song again.
  await importFile.setInputFiles({
    name: "first-steps.asm",
    mimeType: "text/plain",
    buffer: Buffer.from(songCode),
  });
  await expect(title(page)).toHaveValue("First Steps");
  await expect(page.getByText(/\d+ BPM/)).toBeVisible();

  // A file mixing both kinds is one clear error.
  await importFile.setInputFiles({
    name: "mixed.asm",
    mimeType: "text/plain",
    buffer: Buffer.from(`${songCode}\n; pulse 2\n  square_note 4, 12, 1, $700\n`),
  });
  await expect(studioErrors(page)).toHaveCount(1);
  await expect(studioErrors(page)).toContainText("mixes song commands (note");
});
