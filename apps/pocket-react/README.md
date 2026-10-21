# Dotmatrix Pocket (React)

[Dotmatrix Pocket](../pocket) ported to React, to compare the two stacks on the same app: the same
studio, galleries and guides, the same look and the same sound. It is written the way a React app is
written today rather than translated line by line: React 19 with the React Compiler, React Router in
data mode, Zustand and Immer for state, CSS modules, MDX and Vite. It is a client-rendered SPA,
deployed at [itsjavi.com/dotmatrix/react/](https://itsjavi.com/dotmatrix/react/).

The scorecard against the Lumiose app is in the [repository README](../../README.md#lumiose-vs-react).

## Run it

From the repository root, once:

```sh
pnpm install
```

Then:

```sh
cd apps/pocket-react
pnpm dev        # vite; open the printed URL and press Play (or Space)
pnpm build      # vite build into dist
pnpm preview    # vite preview: serves dist
```

Checks:

```sh
pnpm typecheck  # tsc
pnpm lint       # oxlint with its React rules
pnpm test       # Vitest: the driver, the demo songs on the real engine
pnpm test:e2e   # Playwright against `vite` and against `vite build` + `vite preview`
```

The build is served below `LUMIOSE_BASE` when it is set, as the workspace's site build does for
every app (`/dotmatrix/react/` on GitHub Pages).

## What it shares with apps/pocket

Nothing at runtime except the [gbaudio](https://github.com/itsjavi/gbaudio) package from npm. The
framework-free TypeScript is copied unchanged, so both apps make the same sound: the sound driver
(`src/audio/driver.ts`, `tables.ts`), the render worker and its protocol, the song and sound model
(`src/model`), the demo songs, `src/files.ts`, and the composing guide (`docs/composing.md`). The
styles are the pocket's CSS, moved into CSS modules. The usage guide in
[apps/pocket's README](../pocket/README.md#using-it) applies here word for word.

## How it works

- `src/main.tsx` renders a data router (`src/router.tsx`): the root layout (`routes/Layout.tsx`)
  around one lazy route module per view (`routes/Studio.tsx`, `Songs.tsx`, `Sfx.tsx`,
  `Creatures.tsx`, `Learn.tsx`, `Composing.tsx`, `NotFound.tsx`), each exporting `Component`.
  The studio's `loader` opens a share link (`/?song=…`) and redirects to `/`.
- `src/state/studio.ts` is a Zustand store with the open song, the editor, the preferences and the
  status line. Songs are immutable: `edit(label, recipe, key?)` applies an Immer recipe, so the
  undo history keeps the previous song as it is, with no copy. Every edit autosaves and tells the
  player what changed. What the browser saved is read when the store is created.
- `src/audio/player.ts` plays the four stems with Web Audio, as in apps/pocket; its state
  (playing, playhead step, loop) is a framework-free `zustand/vanilla` store that components read
  with `usePlayer`. Only the small components that show the playhead subscribe to its step.
- `src/state/sounds.ts` holds "My sounds" and opens sounds in the studio; `src/state/keys.ts` holds
  the keyboard shortcuts, with `useSpaceAction` for the pages where Space plays a sound.
- `src/global.css` has the design tokens as custom properties (one set per theme and screen palette),
  the base styles and the few shared classes (`.btn`, `.panel`, `.label`, `.sr-only`). Every component
  has its own `.module.css`.
- `docs/composing.md` compiles to a component with MDX (GitHub tables, heading ids).

## Differences from apps/pocket

- Client-rendered: the pages are not prerendered, so nothing shows before the JavaScript runs (the
  saved theme and palette still apply before the first paint, from a script in `index.html`).
- The footer and the credits say "Built with React".

## License

The app code is [MIT](../../LICENSE), and so is gbaudio.
