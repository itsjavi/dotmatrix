/// <reference types="vitest/config" />
import mdx from "@mdx-js/rollup";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

// A client-rendered SPA: index.html loads the app, React Router renders the route. Audio renders
// offline in a module Web Worker (the gbaudio engine), so no cross-origin isolation is needed.
export default defineConfig({
  // Served below a path when LUMIOSE_BASE is set: the workspace's site build (scripts/site.ts) sets
  // it for every app, /dotmatrix/react/ for this one on GitHub Pages.
  base: process.env["LUMIOSE_BASE"] ?? "/",
  plugins: [
    // The composing guide (docs/composing.md) compiles to a React component at build time.
    { enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] }) },
    react({ include: /\.(md|tsx?)$/ }),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  // Class names stay kebab-case in CSS and read as camelCase in TSX: `.picked-bar` is `styles.pickedBar`.
  css: { modules: { localsConvention: "camelCaseOnly" } },
  worker: { format: "es" },
  // Unit tests run the driver and the engine in Node; browser specs run with Playwright instead.
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
