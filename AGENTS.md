# Dotmatrix

Guidance for coding agents.

## Workspace

A pnpm workspace of chiptune apps. Each app is a prerendered single-page app in its own folder,
deployed to GitHub Pages under `/dotmatrix/`:

| App                      | Folder              | Package               | Pages path             |
| ------------------------ | ------------------- | --------------------- | ---------------------- |
| Dotmatrix Pocket         | `apps/pocket`       | `@dotmatrix/pocket`   | `/dotmatrix/`          |
| Dotmatrix Pocket (React) | `apps/pocket-react` | (coming)              | `/dotmatrix/react/`    |
| Dotmatrix Advanced       | `apps/advanced`     | `@dotmatrix/advanced` | `/dotmatrix/advanced/` |

- `apps/pocket` and `apps/advanced` are built with Lumiose (the section below). The React port
  of Dotmatrix Pocket will be a React app: the Lumiose section does not apply to it.
- The apps share no code. Keep a change inside one app unless the task asks for more.
- Commands from the root run in every app: `pnpm typecheck`, `pnpm lint`, `pnpm fmt` (or
  `pnpm fmt:check`), `pnpm test` (Vitest), `pnpm build` and `pnpm test:e2e` (Playwright in
  Chromium, against the dev server and the production build). `pnpm check` runs typecheck,
  lint, fmt:check and test. For one app, run the script in its folder or with
  `pnpm --filter @dotmatrix/<app> <script>`.
- The Lumiose section and the lumiose skill (`.claude/skills/lumiose`) are written for a single
  app: run their `npx lumiose …` commands inside an app folder, where
  `node_modules/lumiose/docs` holds the docs of the installed version.
- `apps/pocket/vendor/gbaudio` is the vendored gbaudio sound engine, checked against its checksums
  by `src/audio/vendor.test.ts`. Do not edit it; the app moves to the `gbaudio` npm package once
  it is published.
- Each app's README explains how it works. Commits from before the extraction mention TASK ids
  of the [Lumiose backlog](https://github.com/itsjavi/lumiose/tree/main/backlog).

### Before you finish

Run `pnpm check` and fix what it reports; run `pnpm test:e2e` too when a change affects the UI
or the audio.

<!-- lumiose:start (managed by `lumiose agents init`; edit outside the markers) -->

## Lumiose

This project uses Lumiose, a web framework for everything from static sites and SPAs to full-stack apps:
TSX with scoped CSS built in, signals, and 0 kB of JavaScript until a page needs it. Components
live in `.stsx` files (TSX plus raw-CSS `<style>` blocks), are set up once and update through
signals; routes are file-based, with TypeScript 7. It is not React, Solid or Svelte: check the
docs instead of guessing.

### Read the local docs first

- The docs for the installed version are in `node_modules/lumiose/docs`. Start from the index,
  `node_modules/lumiose/docs/llms.txt`, and read the page for the task before writing code.
- `npx lumiose docs <topic>` prints or searches them (`npx lumiose docs signals`,
  `npx lumiose docs "form action"`); `npx lumiose explain <code>` explains a diagnostic such as
  `LUM2001`.
- With MCP support, use the Lumiose MCP server (`npx lumiose agents init --mcp` registers it for
  Claude Code and Codex; elsewhere run `npx lumiose mcp` over stdio): docs, `check` with fixes,
  routes, components, compiler output, rendered HTML and dev logs as tools.

### `.stsx` files

- `.stsx` is TSX plus raw-CSS `<style>` blocks. Read and edit everything outside `<style>` as
  TSX; the inside of a `<style>` block is plain CSS, not a string or CSS-in-JS.
- Convention: one top-level `<style>` at the end of the file, after the components. It styles
  every component in the file, so they share it. `$name` in CSS reads a top-level `const`
  declared above the block (`$theme.gap` for object members). `<style global>` is global.
- Nest a block inside an intrinsic element only to scope that element's subtree or to read a
  `const` declared in the component; never in `{…}`, conditionals or `.map` (`LUM3010`).
  When moving rules to the file-level block, check that no selector starts matching another
  component of the file. `.tsx` files cannot have `<style>` (`LUM1006`); `.ts` files hold
  non-UI code.
- Import with the extension: `import { Card } from "./Card.stsx";`.

### Key rules

- Components run once. Read a signal by calling it, `count()`, where the value is needed;
  `const n = count()` in the body is frozen (`LUM2001`). Derive with `() => …` or `computed`.
- No early returns on reactive state; put conditions in JSX (`LUM2003`). Write signals in
  handlers and effects, never in the component body (`LUM2002`).
- Use `class` and `for` (not `className`/`htmlFor`), `onClick`-style events,
  `style={{ "font-weight": 600 }}` and `bind:value={signal}`. Lists are plain `.map` with `key`.
- Routes are folders in `src/routes` with the Next.js App Router file names: `page.stsx`,
  `layout.stsx`, `not-found.stsx`, `error.stsx`, `route.ts` endpoints exporting `GET`/`POST`,
  and `[param]`, `[[param]]`, `[...rest]`, `[[...rest]]`, `(group)` folders. The project's default mode is `lumiose({ mode })` in `vite.config.ts`; a route or
  layout overrides it with `export const mode = "static" | "server" | "spa"`. Request APIs
  (`cookies()`, `request()`) need `server` (`LUM5001`). Load data in async page components;
  mutate with form `actions`.
- Route types take the route pattern literal: `PageProps<"/blog/[slug]">`,
  `LayoutProps<"/blog">`, `ActionContext<"/blog/[slug]">`, `Endpoint<"/api/posts">`. Never cast
  action results: `actionData<typeof actions>()` and `submit<typeof actions.save>(form)` infer them.
- Only islands ship JS in `static`/`server` pages: `<Counter client:load />` or
  `client:visible`, with exported components and serializable props (`LUM4001`, `LUM4002`).
- Server-only code lives in `*.server.ts` modules or `src/server/`; never import it into islands
  (`LUM4003`). Secrets come from `env("NAME")`, not `import.meta.env`.
- Any other file in `src/routes` is a colocated module, never a route, and `_name` folders are
  private. Modules shared across routes go in `src/lib` or `src/components`.

### Before you finish

Run `npx lumiose check` (types, routes and Lumiose diagnostics; `--format json` for a
`{ command, ok, diagnostics }` report) and fix every error, then `npx lumiose lint` and
`npx lumiose fmt`. `npx lumiose routes` lists the routes with their modes. Every CLI command takes
`--format json` and exits 0 on success, 1 when it finds problems, 2 when it cannot run.
<!-- lumiose:end -->
