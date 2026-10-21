# Dotmatrix

Chiptune apps for the web: compose music and sound effects in the browser, from a beginner-friendly
Game Boy studio to a full tracker.

| App                      | Folder              | Web                                                                           |
| ------------------------ | ------------------- | ----------------------------------------------------------------------------- |
| **Dotmatrix Pocket**     | `apps/pocket`       | [itsjavi.com/dotmatrix/](https://itsjavi.com/dotmatrix/)                      |
| Dotmatrix Pocket (React) | `apps/pocket-react` | [itsjavi.com/dotmatrix/react/](https://itsjavi.com/dotmatrix/react/) (coming) |
| **Dotmatrix Advanced**   | `apps/advanced`     | [itsjavi.com/dotmatrix/advanced/](https://itsjavi.com/dotmatrix/advanced/)    |

- **Dotmatrix Pocket**: a pocket chiptune studio and SFX maker for the four channels of the Game
  Boy sound chip, with a piano roll and presets, rendered by the gbaudio APU engine in a Web Worker.
- **Dotmatrix Pocket (React)**: the same app ported to React, to compare both implementations.
- **Dotmatrix Advanced**: a chiptune tracker, composer and mixer with four NES-style voices
  synthesized in an AudioWorklet.

The apps are built with [Lumiose](https://itsjavi.com/lumiose/), as prerendered single-page apps.

## Develop

Requires Node 24 or later and pnpm.

```sh
pnpm install
pnpm dev:pocket     # or pnpm dev:advanced; pnpm dev starts both
pnpm build          # every app into its dist/client
```

Checks:

```sh
pnpm typecheck      # lumiose check in every app
pnpm lint           # lumiose lint (oxlint, also for .stsx files)
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

## History

The apps were extracted from the [Lumiose repository](https://github.com/itsjavi/lumiose), where
they started as examples (`examples/spa-dotmatrix` and `examples/spa-chiptune`), with their commit
history. TASK ids in those commits refer to the
[Lumiose backlog](https://github.com/itsjavi/lumiose/tree/main/backlog).

## License

[MIT](LICENSE)
