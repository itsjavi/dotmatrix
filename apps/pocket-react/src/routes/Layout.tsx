// The root layout: the console's header (logo, views, screen palette, theme) around every page.
// Audio, the open song and its history live outside React, so playback carries on across views.
import clsx from "clsx";
import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { Shortcuts } from "../components/Shortcuts.tsx";
import { onKeyDown } from "../state/keys.ts";
import { setPrefs, useStudio, type Prefs } from "../state/studio.ts";
import styles from "./Layout.module.css";

const VIEWS = [
  { to: "/", label: "Studio" },
  { to: "/songs", label: "Songs" },
  { to: "/sfx", label: "SFX" },
  { to: "/creatures", label: "Creatures" },
  { to: "/learn", label: "Learn" },
];

const PALETTES: { id: Prefs["lcd"]; name: string }[] = [
  { id: "pea", name: "Pea soup" },
  { id: "pocket", name: "Pocket" },
  { id: "dusk", name: "Dusk" },
  { id: "ice", name: "Ice" },
];

function nextTheme(theme: Prefs["theme"]): Prefs["theme"] {
  const dark =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  return dark ? "light" : "dark";
}

export function Layout() {
  const theme = useStudio((s) => s.prefs.theme);
  const lcd = useStudio((s) => s.prefs.lcd);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.dataset.lcd = lcd;
  }, [theme, lcd]);

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link to="/" className={styles.brand} aria-label="Dotmatrix Pocket studio">
          <span className={styles.badge} aria-hidden="true">
            <span className={styles.dots} />
          </span>
          <span className={styles.word}>
            Dotmatrix Pocket
            <small>chiptune studio</small>
          </span>
        </Link>
        <nav className={styles.views} aria-label="Views">
          {VIEWS.map((view) => (
            <NavLink key={view.to} to={view.to} end className={styles.view}>
              {view.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.tools}>
          <div className={styles.palettes} role="radiogroup" aria-label="Screen palette">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                className={clsx(styles.swatch, styles[p.id])}
                aria-checked={lcd === p.id}
                aria-label={p.name}
                title={`Screen: ${p.name}`}
                onClick={() => setPrefs({ lcd: p.id })}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.theme}
            aria-label="Switch light or dark theme"
            title="Light or dark"
            onClick={() => setPrefs({ theme: nextTheme(theme) })}
          >
            <svg viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
              <path d="M3 0h2v1H3zM1 1h1v1H1zM6 1h1v1H6zM2 2h4v4H2zM0 3h1v2H0zM7 3h1v2H7zM1 6h1v1H1zM6 6h1v1H6zM3 7h2v1H3z" />
            </svg>
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.foot}>
        <span>
          Built with React. Sound by the gbaudio Game Boy APU engine (see{" "}
          <Link to="/learn">Learn</Link> for credits).
        </span>
        <span className={styles.keys}>
          Press <kbd>?</kbd> for shortcuts
        </span>
      </footer>
      <Shortcuts />
    </div>
  );
}
