// The song gallery: original demo songs to listen to and open in the studio, and the songs saved
// in this browser ("My songs").
import clsx from "clsx";
import { useState } from "react";
import { useNavigate } from "react-router";
import { songSeconds } from "../audio/driver.ts";
import { play, playerStore, stop } from "../audio/player.ts";
import { vars } from "../css.ts";
import { loadShelf, newId, saveShelf, type SavedSong } from "../model/library.ts";
import { DEMOS, type Demo } from "../model/songs/index.ts";
import { STEPS_PER_BAR, type Song } from "../model/types.ts";
import { currentSong, openSong, say } from "../state/studio.ts";
import { usePlayer } from "../state/usePlayer.ts";
import styles from "./Songs.module.css";

const SONGS = new Map(DEMOS.map((d) => [d.id, d.song()]));
const BANDS = [
  [2, 20],
  [16, 34],
  [34, 50],
  [52, 58],
] as const;
const round = (v: number) => Math.round(v * 10) / 10;

/** A thumbnail of a song: each channel's notes in its own band of a tiny screen. */
function Thumb({ song }: { song: Song }) {
  const total = song.bars * STEPS_PER_BAR;
  const shapes = song.tracks.flatMap((track, ch) => {
    const [top, bottom] = BANDS[ch]!;
    const pitches = track.notes.map((n) => n.p);
    const lo = Math.min(...pitches);
    const hi = Math.max(...pitches, lo + 1);
    return track.notes.map((n) => ({
      key: `${ch}:${n.s}`,
      x: round((n.s / total) * 200),
      w: round(Math.max(1, (n.l / total) * 200 - 0.4)),
      y: round(ch === 3 ? top + (n.p % 3) * 2 : bottom - ((n.p - lo) / (hi - lo)) * (bottom - top)),
      c: ch,
    }));
  });
  return (
    <svg
      className={styles.thumb}
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="200" height="60" className={styles.bg} />
      {shapes.map((s) => (
        <rect key={s.key} x={s.x} y={s.y} width={s.w} height="1.6" className={styles[`n${s.c}`]} />
      ))}
    </svg>
  );
}

function length(song: Song): string {
  const s = Math.round(songSeconds(song));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function DemoCard({ demo, onOpen }: { demo: Demo; onOpen: () => void }) {
  const song = SONGS.get(demo.id)!;
  const tag = `demo:${demo.id}`;
  const live = usePlayer((s) => s.nowPlaying === tag);
  const progress = usePlayer((s) =>
    s.nowPlaying === tag ? Math.max(0, s.playStep) / (song.bars * STEPS_PER_BAR) : 0,
  );
  const rendering = usePlayer((s) => s.rendering);

  return (
    <li className={clsx(styles.cart, live && styles.live)}>
      <div className={clsx("label", styles.cartLabel)}>
        <span className={styles.mood}>{demo.mood}</span>
        <div className={styles.screen} style={vars({ p: progress })}>
          <Thumb song={song} />
        </div>
      </div>
      <h2>{demo.title}</h2>
      <p className={styles.facts}>
        {song.bpm} BPM · {song.bars} bars · {length(song)}
      </p>
      <p className={styles.blurb}>{demo.blurb}</p>
      <ul className={styles.tips}>
        {demo.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button
          type="button"
          className="btn"
          aria-label={`${live ? "Stop" : "Listen to"} ${demo.title}`}
          onClick={() => (live ? stop() : void play(song, tag))}
        >
          {live ? "■ Stop" : rendering ? "…" : "▶ Listen"}
        </button>
        <button
          type="button"
          className="btn primary"
          aria-label={`Open ${demo.title} in the studio`}
          onClick={onOpen}
        >
          Open in studio
        </button>
      </div>
    </li>
  );
}

export function Component() {
  const navigate = useNavigate();
  const [shelf, setShelf] = useState<SavedSong[]>(loadShelf);

  function open(song: Song, label: string) {
    if (playerStore.getState().nowPlaying?.startsWith("demo:")) stop();
    openSong(song, label);
    say(`Opened “${song.title}”. Undo brings back your previous song.`);
    void navigate("/");
  }

  function saveCurrent() {
    const song = currentSong();
    const next = [{ id: newId(), title: song.title, updated: Date.now(), song }, ...shelf].slice(
      0,
      50,
    );
    if (saveShelf(next)) {
      setShelf(next);
      say(`Saved “${song.title}” to My songs`);
    } else say("Could not save: browser storage is unavailable");
  }

  function remove(entry: SavedSong) {
    const next = shelf.filter((e) => e.id !== entry.id);
    if (saveShelf(next)) setShelf(next);
  }

  return (
    <div className={styles.songs}>
      <header className={styles.intro}>
        <h1>Song gallery</h1>
        <p>
          Original tunes in the style of a late-90s handheld RPG. Listen, then open one in the
          studio and change it: every note and sound is editable.
        </p>
      </header>
      <ul className={styles.grid} aria-label="Demo songs">
        {DEMOS.map((demo) => (
          <DemoCard
            key={demo.id}
            demo={demo}
            onOpen={() => open(demo.song(), `Open demo ${demo.title}`)}
          />
        ))}
      </ul>
      <section className={clsx("panel", styles.mine)} aria-labelledby="mine-title">
        <div className={styles.mineHead}>
          <h2 id="mine-title">My songs</h2>
          <button type="button" className="btn" onClick={saveCurrent}>
            Save the studio's song here
          </button>
        </div>
        {shelf.length === 0 ? (
          <p className={styles.empty}>
            Nothing saved yet. The studio autosaves the song you are working on; save copies here to
            keep them.
          </p>
        ) : (
          <ul className={styles.list}>
            {shelf.map((entry) => (
              <li key={entry.id}>
                <span className={styles.t}>{entry.title}</span>
                <span className={styles.when}>{new Date(entry.updated).toLocaleString()}</span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => open(entry.song, `Open ${entry.title}`)}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Delete ${entry.title}`}
                  onClick={() => remove(entry)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
