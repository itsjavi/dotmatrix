// Builds the apps into one static site, as GitHub Pages serves it at https://itsjavi.com/dotmatrix/
// (.github/workflows/pages.yml runs the same command):
//
//   pnpm build:site [--base /dotmatrix/] [--out dist/site]
//   pnpm preview:site [--base /dotmatrix/] [--out dist/site] [--port 5210]
//
// - Each app in APPS builds with its own URL as its base: the build sets LUMIOSE_BASE to
//   <base><path>, which the app's vite.config.ts passes to Vite's `base` (the React port reads it
//   too). Pocket lands at the root of the site, the other apps in their folders. An app whose folder
//   does not exist yet is skipped (pocket-react, until it lands).
// - LUMIOSE_BASE also turns on Advanced's cross-origin isolation service worker: GitHub Pages cannot
//   send COOP/COEP headers. The builds are copied without their precompressed .br/.gz twins and their
//   _headers file, which Pages does not use.
// - GitHub Pages answers every missing path below the base with the root 404.html, Pocket's 404 page.
//   A script at the top of that page hands the paths below another app to it: it hides the rest of
//   the page and renders that app's own 404.html in place (or its index.html, the SPA shell of an app
//   without one), so the app's router handles the URL with its query and hash. That is how deep links
//   such as /dotmatrix/advanced/songs/<id> survive a reload.
// - The base is the URL path the site is served below. A project page under a user site lives at
//   <user site>/<repo>/, so the default is /dotmatrix/; the workflow passes configure-pages' base_path.
//   The output holds the files themselves, not a <base> folder.
//
// `preview` serves the output below the base the way GitHub Pages does: no custom headers, directory
// index.html files, a redirect to a directory's trailing slash, and the root 404.html (with status 404)
// for anything missing.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export interface App {
  /** The folder below apps/. */
  folder: string;
  /** The URL path below the base, "" for the app at the root or "<name>/". */
  path: string;
}

/** The apps of the site; the first one is the root and owns the root 404.html. */
export const APPS: App[] = [
  { folder: "pocket", path: "" },
  { folder: "advanced", path: "advanced/" },
  { folder: "pocket-react", path: "react/" },
];

/** The Lumiose website, linked from the apps' "Built with Lumiose" credits. */
const LUMIOSE_SITE = "https://itsjavi.com/lumiose/";

/** "/", "dotmatrix", "/dotmatrix" and "/dotmatrix/" normalize to "/" and "/dotmatrix/". */
export function normalizeBase(base: string): string {
  const trimmed = base.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

/** The apps of `apps` whose folder exists in the repository. */
export function presentApps(repo: string, apps: App[] = APPS): App[] {
  return apps.filter((app) => existsSync(join(repo, "apps", app.folder, "package.json")));
}

/** An app's build output: dist/client for a Lumiose app, dist for a plain Vite app. */
export function buildOutput(appDir: string): string {
  for (const dir of ["dist/client", "dist"]) {
    if (existsSync(join(appDir, dir, "index.html"))) return join(appDir, dir);
  }
  throw new Error(`${appDir} has no build: neither dist/client/index.html nor dist/index.html.`);
}

/** Copies a build without the precompressed twins and the host config Pages does not use. */
function copyBuild(from: string, to: string): void {
  cpSync(from, to, {
    recursive: true,
    filter: (path) => !/\.(?:br|gz)$/.test(path) && !path.endsWith("_headers"),
  });
}

/** An app below the root, and the page the root 404.html renders for the paths below it. */
export interface Scope {
  path: string;
  page: "404.html" | "index.html";
}

/**
 * The root 404 page's script: below another app's path, it turns the rest of this page into hidden
 * text (a `<plaintext>` element, so none of the root app's scripts run) and renders that app's page
 * in place, so its router (or its own 404 page) handles the URL.
 */
export function handOffScript(base: string, scopes: Scope[]): string {
  return `(function(){var b=${JSON.stringify(base)},s=${JSON.stringify(scopes)},p=location.pathname;for(var i=0;i<s.length;i++){if(p.indexOf(b+s[i].path)===0){document.write('<plaintext style="display:none">');fetch(b+s[i].path+s[i].page).then(function(r){return r.text()}).then(function(h){document.open();document.write(h);document.close()});return}}})();`;
}

/** Copies the built apps into `out`, the root app at its top, and writes the root 404 hand-off. */
export function assemble(repo: string, base: string, out: string, apps: App[]): void {
  const [root, ...others] = apps;
  if (root?.path !== "") throw new Error("site: the first app must be served at the root.");
  rmSync(out, { recursive: true, force: true });
  copyBuild(buildOutput(join(repo, "apps", root.folder)), out);
  for (const app of others) {
    const target = join(out, app.path);
    if (existsSync(target)) {
      throw new Error(
        `site: ${root.folder}'s build already has ${app.path}, where ${app.folder} goes.`,
      );
    }
    copyBuild(buildOutput(join(repo, "apps", app.folder)), target);
  }

  const scopes: Scope[] = others.map(({ path }) => ({
    path,
    page: existsSync(join(out, path, "404.html")) ? "404.html" : "index.html",
  }));
  const notFound = join(out, "404.html");
  if (!existsSync(notFound)) throw new Error(`site: ${root.folder}'s build has no 404.html.`);
  const html = readFileSync(notFound, "utf8");
  if (!html.includes("<head>")) throw new Error(`site: ${root.folder}'s 404.html has no <head>.`);
  // A replacer function, so that `$` in the script is never read as a replacement pattern.
  const script = `<head><script>${handOffScript(base, scopes)}</script>`;
  writeFileSync(
    notFound,
    html.replace("<head>", () => script),
  );
}

const repo = fileURLToPath(new URL("..", import.meta.url));

function pnpm(args: string[], env: NodeJS.ProcessEnv): void {
  try {
    execFileSync("pnpm", args, { cwd: repo, stdio: "inherit", env: { ...process.env, ...env } });
  } catch {
    console.error(`site: pnpm ${args.join(" ")} failed (see its output above).`);
    process.exit(1);
  }
}

function build(base: string, out: string): void {
  const apps = presentApps(repo);
  for (const app of apps) {
    pnpm(["--dir", `apps/${app.folder}`, "run", "build"], {
      LUMIOSE_BASE: `${base}${app.path}`,
      PUBLIC_LUMIOSE_SITE: LUMIOSE_SITE,
    });
  }
  assemble(repo, base, out, apps);
  const paths = apps.map((app) => `${base}${app.path} (${app.folder})`).join(", ");
  console.log(`site: ${relative(repo, out)}: ${paths}`);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function preview(base: string, out: string, port: number): void {
  if (!existsSync(out)) throw new Error(`${out} does not exist: run pnpm build:site first.`);
  const file = (path: string): string | undefined => {
    const target = join(out, normalize(path));
    if (!target.startsWith(out) || !existsSync(target)) return undefined;
    if (statSync(target).isFile()) return target;
    const index = join(target, "index.html");
    return existsSync(index) ? index : undefined;
  };
  createServer((request, response) => {
    const requested = new URL(request.url ?? "/", "http://x");
    const pathname = decodeURIComponent(requested.pathname);
    if (base !== "/" && pathname === base.slice(0, -1)) {
      response.writeHead(301, { location: `${base}${requested.search}` }).end();
      return;
    }
    const rest = pathname.startsWith(base) ? pathname.slice(base.length) : undefined;
    const found = rest === undefined ? undefined : file(rest);
    // Like GitHub Pages, a directory without its trailing slash redirects to it, query included.
    if (found && found !== join(out, normalize(rest!)) && !pathname.endsWith("/")) {
      response.writeHead(301, { location: `${requested.pathname}/${requested.search}` }).end();
      return;
    }
    const path = found ?? join(out, "404.html");
    response.writeHead(found ? 200 : 404, {
      "content-type": TYPES[extname(path)] ?? "application/octet-stream",
    });
    response.end(readFileSync(path));
  }).listen(port, () => console.log(`site: http://localhost:${port}${base}`));
}

function main(): void {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: "string", default: "/dotmatrix/" },
      out: { type: "string", default: "dist/site" },
      port: { type: "string", default: "5210" },
    },
  });
  const base = normalizeBase(values.base);
  const out = resolve(repo, values.out);
  const command = positionals[0] ?? "build";
  if (command === "build") build(base, out);
  else if (command === "preview") preview(base, out, Number(values.port));
  else throw new Error(`Unknown command ${command}: use build or preview.`);
}

if (import.meta.main) main();
