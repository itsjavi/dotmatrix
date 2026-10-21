// scripts/site.ts: the assembly of the Pages site and the root 404 page's hand-off to each app
// (`node --test scripts/site.test.ts`; tests/site.spec.ts checks the real site in a browser).
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { runInNewContext } from "node:vm";
import { APPS, assemble, handOffScript, normalizeBase, presentApps, type Scope } from "./site.ts";

const temp = mkdtempSync(join(tmpdir(), "dotmatrix-site-"));
after(() => rmSync(temp, { recursive: true, force: true }));

/** A fake repository with the given files, relative to it. */
function repoWith(name: string, files: Record<string, string>): string {
  const repo = join(temp, name);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  }
  return repo;
}

const page = (name: string) => `<!doctype html><html><head><title>${name}</title></head></html>`;

test("normalizeBase", () => {
  for (const base of ["/", "", "//"]) assert.equal(normalizeBase(base), "/");
  for (const base of ["dotmatrix", "/dotmatrix", "/dotmatrix/", "dotmatrix//"]) {
    assert.equal(normalizeBase(base), "/dotmatrix/");
  }
});

test("pocket is the root app, and an app without a folder is skipped", () => {
  assert.equal(APPS[0]?.path, "");
  const repo = repoWith("present", {
    "apps/pocket/package.json": "{}",
    "apps/advanced/package.json": "{}",
  });
  assert.deepEqual(
    presentApps(repo).map((app) => app.folder),
    ["pocket", "advanced"],
  );
});

describe("assemble", () => {
  const repo = repoWith("assemble", {
    "apps/pocket/dist/client/index.html": page("pocket"),
    "apps/pocket/dist/client/404.html": page("pocket 404"),
    "apps/pocket/dist/client/songs/index.html": page("pocket songs"),
    "apps/pocket/dist/client/assets/app.js": "pocket();",
    "apps/pocket/dist/client/assets/app.js.br": "",
    "apps/pocket/dist/client/assets/app.js.gz": "",
    "apps/pocket/dist/client/_headers": "",
    "apps/advanced/dist/client/index.html": page("advanced"),
    "apps/advanced/dist/client/404.html": page("advanced 404"),
    "apps/advanced/dist/client/coi-sw.js": "sw();",
    "apps/advanced/dist/client/_headers": "",
    // A plain Vite app: dist/ and no 404 page.
    "apps/pocket-react/dist/index.html": page("react"),
  });
  const out = join(repo, "dist/site");
  assemble(repo, "/dotmatrix/", out, APPS);

  test("puts the root app at the top and the others in their folders", () => {
    for (const [path, title] of [
      ["index.html", "pocket"],
      ["songs/index.html", "pocket songs"],
      ["advanced/index.html", "advanced"],
      ["advanced/404.html", "advanced 404"],
      ["react/index.html", "react"],
    ]) {
      assert.match(readFileSync(join(out, path!), "utf8"), new RegExp(`<title>${title}</title>`));
    }
    assert.ok(existsSync(join(out, "assets/app.js")));
    assert.ok(existsSync(join(out, "advanced/coi-sw.js")));
  });

  test("leaves out the precompressed twins and _headers", () => {
    for (const path of ["assets/app.js.br", "assets/app.js.gz", "_headers", "advanced/_headers"]) {
      assert.ok(!existsSync(join(out, path)), path);
    }
  });

  test("the root 404 page starts with the hand-off to the other apps", () => {
    const scopes: Scope[] = [
      { path: "advanced/", page: "404.html" },
      { path: "react/", page: "index.html" },
    ];
    assert.equal(
      readFileSync(join(out, "404.html"), "utf8"),
      `<!doctype html><html><head><script>${handOffScript("/dotmatrix/", scopes)}</script><title>pocket 404</title></head></html>`,
    );
  });

  test("refuses an app path that the root app's build already uses", () => {
    const clash = repoWith("clash", {
      "apps/pocket/dist/client/index.html": page("pocket"),
      "apps/pocket/dist/client/404.html": page("pocket 404"),
      "apps/pocket/dist/client/advanced/index.html": page("a pocket route"),
      "apps/advanced/dist/client/index.html": page("advanced"),
    });
    assert.throws(
      () => assemble(clash, "/dotmatrix/", join(clash, "dist/site"), APPS.slice(0, 2)),
      /already has advanced\//,
    );
  });
});

describe("the hand-off script", () => {
  const scopes: Scope[] = [
    { path: "advanced/", page: "404.html" },
    { path: "react/", page: "index.html" },
  ];

  /** Runs the script at `pathname`; returns what it fetched and what it wrote to the document. */
  async function run(pathname: string) {
    const fetched: string[] = [];
    const written: string[] = [];
    const document = {
      open: () => written.push("open"),
      write: (html: string) => written.push(html),
      close: () => written.push("close"),
    };
    const fetch = (url: string) => {
      fetched.push(url);
      return Promise.resolve({ text: () => Promise.resolve(`<html>${url}</html>`) });
    };
    runInNewContext(handOffScript("/dotmatrix/", scopes), {
      location: { pathname },
      document,
      fetch,
    });
    await new Promise((resolve) => setTimeout(resolve));
    return { fetched, written };
  }

  test("renders an app's own page for the paths below it", async () => {
    for (const [pathname, appPage] of [
      ["/dotmatrix/advanced/songs/k3x9", "/dotmatrix/advanced/404.html"],
      ["/dotmatrix/advanced/no-such-page", "/dotmatrix/advanced/404.html"],
      ["/dotmatrix/react/songs", "/dotmatrix/react/index.html"],
    ]) {
      assert.deepEqual(await run(pathname!), {
        fetched: [appPage],
        written: ['<plaintext style="display:none">', "open", `<html>${appPage}</html>`, "close"],
      });
    }
  });

  test("leaves the root app's paths to the root 404 page", async () => {
    for (const pathname of ["/dotmatrix/no-such-cartridge", "/dotmatrix/advancedx", "/advanced/"]) {
      assert.deepEqual(await run(pathname), { fetched: [], written: [] });
    }
  });
});
