# Dotmatrix

Chiptune apps for the web: compose music and sound effects in the browser, from a beginner-friendly
Game Boy studio to a full tracker.

| App                      | Folder              | Web                                                                        |
| ------------------------ | ------------------- | -------------------------------------------------------------------------- |
| **Dotmatrix Pocket**     | `apps/pocket`       | [itsjavi.com/dotmatrix/](https://itsjavi.com/dotmatrix/)                   |
| Dotmatrix Pocket (React) | `apps/pocket-react` | [itsjavi.com/dotmatrix/react/](https://itsjavi.com/dotmatrix/react/)       |
| **Dotmatrix Advanced**   | `apps/advanced`     | [itsjavi.com/dotmatrix/advanced/](https://itsjavi.com/dotmatrix/advanced/) |

- **Dotmatrix Pocket**: a pocket chiptune studio and SFX maker for the four channels of the Game
  Boy sound chip, with a piano roll and presets, rendered by the gbaudio APU engine in a Web Worker.
- **Dotmatrix Pocket (React)**: the same app ported to React, to compare both implementations
  ([the scorecard](#lumiose-vs-react)).
- **Dotmatrix Advanced**: a chiptune tracker, composer and mixer with four NES-style voices
  synthesized in an AudioWorklet.

Pocket and Advanced are built with [Lumiose](https://itsjavi.com/lumiose/), as prerendered
single-page apps; the React port is a client-rendered React SPA.

## Develop

Requires Node 24 or later and pnpm.

```sh
pnpm install
pnpm dev:pocket     # or pnpm dev:react, pnpm dev:advanced; pnpm dev starts all three
pnpm build          # every app into its dist folder
```

Checks:

```sh
pnpm typecheck      # lumiose check (tsc in the React port)
pnpm lint           # lumiose lint (oxlint, also for .stsx files; oxlint in the React port)
pnpm fmt:check      # oxfmt and lumiose fmt --check; pnpm fmt formats
pnpm test           # Vitest
pnpm test:e2e       # Playwright in Chromium: each app (dev server and production build), then the site
```

Each app's README has more details.

## Deploy

Every push to main deploys the apps to GitHub Pages as one site
([`.github/workflows/pages.yml`](.github/workflows/pages.yml)), at the URLs above. The same build
runs locally:

```sh
pnpm build:site     # every app with its base, assembled into dist/site
pnpm preview:site   # serves dist/site like GitHub Pages, at http://localhost:5210/dotmatrix/
pnpm test:site      # Playwright against it: each app, deep links after a reload, share links
```

GitHub Pages answers a path without a file (such as a song only your browser knows,
`/dotmatrix/advanced/songs/<id>`) with the site's root 404 page, which hands the paths below
`/dotmatrix/advanced/` and `/dotmatrix/react/` to that app, so its router opens them.

## Lumiose vs React

Dotmatrix Pocket exists twice, to compare the stacks on a real app: `apps/pocket` with
[Lumiose](https://itsjavi.com/lumiose/) and `apps/pocket-react`, an idiomatic React port with the
same features, routes, look and sound. Both use the same sound driver, model and demo songs (copied
unchanged), the same CSS (moved into CSS modules in React) and the same end-to-end flows.

- Lumiose: lumiose 0.5.0, a prerendered SPA (`mode: "spa", prerender: true`).
- React: React 19.3 with the React Compiler 1.0 (Babel), React Router 8.5 in data mode with lazy
  route modules, Zustand 5 and Immer 11, CSS modules, MDX 3 for the guide; a client-rendered SPA.
- Both on Vite 8.3 and gbaudio 1.0. Measured on 2026-10-21 on an Apple M1 Max (macOS 27, Node 26.8),
  from the production builds served as static files. Sizes are brotli (quality 11) of the files a
  fresh browser loads.

| Metric                                         | Lumiose                                 | React                            | Notes                                                                                                                                                                     |
| ---------------------------------------------- | --------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript, first load: studio / songs / learn | 50.8 / 36.8 / 32.6 kB                   | 125.7 / 107.9 / 103.2 kB         | React and React DOM are 56.8 kB, React Router 26.9 kB, Immer 3.3 kB, Zustand and clsx 0.5 kB; Lumiose's runtime is 17.7 kB. SFX, with the render worker: 51.1 vs 123.9 kB |
| CSS, first load: studio / songs / learn        | 10.1 / 7.1 / 7.1 kB                     | 10.5 / 8.1 / 7.6 kB              | Plus the same two fonts, 30.0 kB of woff2, on both                                                                                                                        |
| HTML: studio / songs / learn                   | 4.5 / 18.1 / 3.3 kB                     | 0.6 kB each                      | Lumiose prerenders every page; the React shell is empty until its JavaScript runs                                                                                         |
| Requests, first load: studio / songs / learn   | 13 / 11 / 11                            | 10 / 9 / 8                       |                                                                                                                                                                           |
| First load, slow 4G and a 4× slower CPU        | studio shows at 0.70 s, works at 1.50 s | shows and works at 3.01 s        | Songs: 0.68 s and 2.83 s, against 2.69 s; SFX: 0.57 s and 1.28 s, against 2.78 s. Median of 5. React shows its header at 2.28 s, then loads the lazy route                |
| Build time, cold / warm                        | 1.22 / 1.19 s                           | 1.59 / 1.60 s                    | Median of 5. The Babel React Compiler takes about 1.0 s of React's build (0.56 s without it). Lumiose's build also prerenders 7 pages and precompresses                   |
| Interactions                                   | see below                               | see below                        | No meaningful difference                                                                                                                                                  |
| Source lines (code + styles)                   | 3,630 + 2,039 = 5,669 (27 files)        | 3,806 + 2,061 = 5,867 (54 files) | Hand-written UI and state, without comments and blank lines. Both also hold the same 3,533 lines of driver and model, and 708 of demo songs                               |
| Tests (lines)                                  | 1,327                                   | 1,207                            | The same Vitest files. 31 Playwright flows in React, 33 in Lumiose: its three prerendering and hydration checks are one route check in the SPA                            |
| Runtime dependencies                           | 5 direct, 5 installed                   | 9 direct, 12 installed           | Lumiose: lumiose, gbaudio, two fonts and @lumiose/adapter-node (unused by the static build). React adds react, react-dom, react-router, zustand, immer, clsx              |

Interactions, from the input event to the first frame that shows the result, median of 15 with a
4× slower CPU (unthrottled in brackets):

| Interaction                                      | Lumiose         | React          |
| ------------------------------------------------ | --------------- | -------------- |
| Add or remove a note on the grid                 | 8.3 ms (1.8)    | 9.0 ms (2.0)   |
| Switch channel with the keyboard                 | 13.0 ms (13.4)  | 14.2 ms (13.7) |
| Pick a sound effect: the maker updates           | 16.6 ms (15.6)  | 16.9 ms (16.1) |
| Pick a sound effect: its sound starts            | 16.6 ms (15.6)  | 16.9 ms (16.1) |
| Navigate between Studio and Songs                | 103.5 ms (22.3) | 96.4 ms (36.2) |
| First Play in a fresh page, until the song plays | 128 ms (103)    | 126 ms (103)   |

**Easier in Lumiose:**

- First paint: every page is prerendered, so the studio shows in 0.7 s on a slow phone connection,
  against 3.0 s for the React SPA, which renders nothing until its 126 kB of JavaScript and its lazy
  route module have loaded.
- Reactivity: signals are read where they are used, so a handler sees the new state right after it
  writes it, and `effect()` tracks what it reads. In React, handlers that set state and then act on
  it (the SFX sliders' debounced render, a creature remix, importing code and playing it) compute
  the next value themselves; the piano roll's pointer handlers read the store with `getState()`, so
  quick drags never see a stale song; the effects that redraw a canvas when the palette changes list
  the theme as a dependency that the linter calls extra.
- Fine-grained updates: the playhead moves several times a second, and Lumiose updates only the
  bound attributes. In React, the status line, the notes and the playhead became small components
  that subscribe to the playhead's step, and the roll follows it through a store subscription
  outside React, so the whole grid does not re-render on every step.
- Forms: `onChange` is the DOM's change event. React's fires on every keystroke, so the tempo field
  keeps a draft until Enter or blur, and the title merges its keystrokes into one undo step.
- Scoped CSS: element selectors (`h2`, `select`, `kbd`) are scoped too. CSS modules scope only
  classes: about 30 element selectors moved under a class, a global class in a compound selector
  needs `:global(.btn).lit`, and Learn's element rules moved above its class rules to keep their
  precedence. The `$tokens` constants became custom properties.
- Size and speed of the build: less than half the JavaScript, and 1.2 s against 1.6 s.

**Harder in Lumiose:**

- Hydration: the prerendered page must match the first client render, so what the browser saved
  (the open song, preferences, My sounds) loads after mount; the React SPA reads it when its store
  is created. The song gallery's prerendered HTML is 18 kB, and hydrating it makes the page work at
  2.8 s on the slow profile, a little later than the React SPA (2.7 s).
- Share links: React Router's `loader` opens `/?song=…` before the studio renders and redirects with
  `replace("/")`; Lumiose reads the query in `onMount` and rewrites it.
- Undo: with Immer the song is immutable, so the history keeps the previous song as it is; the
  Lumiose store takes a snapshot of the song on every edit.
- Ecosystem: React had a ready answer for each need (MDX, Zustand, Immer, `useSyncExternalStore`,
  oxlint's React rules) and docs the author already knew. The friction was small: two lint false
  positives that took restructuring, a `HydrateFallback` that lazy routes require, and CSS module
  class names hashed in tests, so the React suite finds elements by role, label and three data
  attributes where the Lumiose suite uses classes.

Both apps share one origin on GitHub Pages and the same `localStorage` keys, so the songs, sounds
and preferences saved in one open in the other.

## History

The apps were extracted from the [Lumiose repository](https://github.com/itsjavi/lumiose), where
they started as examples (`examples/spa-dotmatrix` and `examples/spa-chiptune`), with their commit
history. TASK ids in those commits refer to the
[Lumiose backlog](https://github.com/itsjavi/lumiose/tree/main/backlog).

## License

[MIT](LICENSE)
