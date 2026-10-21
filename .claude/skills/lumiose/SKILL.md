---
name: lumiose
description: Build, change and fix Lumiose apps (.stsx components with TSX and raw-CSS <style> blocks, signals, file routes in src/routes, islands, form actions). Use for any edit to .stsx/.tsx components, routes, endpoints or lumiose() options in vite.config.ts, and whenever lumiose check reports LUMxxxx diagnostics.
---

# Lumiose

Follow the Lumiose section of `AGENTS.md`. This skill is the workflow.

## 1. Look it up

- Index: `node_modules/lumiose/docs/llms.txt` (version-matched docs). Read the concept page for the
  task: components, signals, jsx, styles, async, islands, routing, data-and-actions, server,
  rendering-modes, head.
- Or from the terminal: `npx lumiose docs <topic or words>`, and `npx lumiose explain LUMxxxx`.
- Or, when the Lumiose MCP server (`npx lumiose mcp`) is registered, its `docs_search` and
  `docs_get` tools; its `check`, `render` and `dev_logs` tools serve step 3.

## 2. Make the change

- Page: `src/routes/<path>/page.stsx` exporting a default component (may be `async`) taking
  `PageProps<"/blog/[slug]">`; params come from `[name]` segments, links from `href()`.
- Endpoint: `src/routes/<path>/route.ts` exporting `GET`/`POST`/… typed `Endpoint<"/api/x">`.
- Form: export `actions = { name(ctx: ActionContext<"/path">) {…} }` from the page, post to
  `?/name`, read the result with `actionData<typeof actions>()`; return `fail(status, data)`
  or call `redirect()`.
- Interactivity in a `static`/`server` page: an exported component in `src/components`, used
  with `client:load` or `client:visible` and plain-data props.
- Styles: one `<style>` block at the end of the file, shared by its components (scoped to the
  file); a block nested in an element only to scope its subtree or read a component `const`;
  `<style global>` for globals, `$constant` for top-level values,
  `style={{ "--x": value() }}` for runtime values.
- Mode: `export const mode = "server"` for request data (cookies, sessions, per-request HTML).

## 3. Verify

1. `npx lumiose check --format json`: fix each diagnostic until `"ok": true`
   (`npx lumiose explain <code>` for the fix).
2. `npx lumiose routes` when routes changed: patterns, modes and layouts as intended.
3. `npx lumiose lint` and `npx lumiose fmt`.
4. Behaviour: `npx lumiose dev --format json` prints `{ "url": … }` once listening; fetch the page.
   `npx lumiose build` prerenders static routes and fails on route errors.
