// The toolbar under the screen: actions on the picked bar and channel, a new song, and, for a sound
// sheet, saving it back to its gallery. Click a bar number above the grid to pick a bar.
import clsx from "clsx";
import { useState } from "react";
import { useNavigate } from "react-router";
import { clearBars, copyBars, emptySong } from "../model/song.ts";
import { CHANNELS, MAX_BARS, STEPS_PER_BAR } from "../model/types.ts";
import { keepSound } from "../state/sounds.ts";
import { currentSong, edit, openSong, say, updateEditor, useStudio } from "../state/studio.ts";
import styles from "./GridTools.module.css";

function duplicate(b: number) {
  edit(`Duplicate bar ${b + 1}`, (song) => {
    const start = (b + 1) * STEPS_PER_BAR;
    song.bars += 1;
    for (const track of song.tracks) {
      track.notes = track.notes.map((n) => (n.s >= start ? { ...n, s: n.s + STEPS_PER_BAR } : n));
    }
    song.tracks = copyBars(song, b, 1, b + 1);
    if (song.loop > b) song.loop += 1;
  });
  updateEditor((e) => {
    e.bar = b + 1;
  });
}

export function GridTools() {
  const sheet = useStudio((s) => s.song.sheet);
  const bars = useStudio((s) => s.song.bars);
  const bar = useStudio((s) => s.editor.bar);
  const channel = useStudio((s) => s.editor.channel);
  const [clipboard, setClipboard] = useState<number | null>(null);
  const navigate = useNavigate();
  const info = CHANNELS[channel];
  const gallery = sheet?.kind === "voice" ? "/creatures" : "/sfx";

  /** Keeps the studio's sound sheet in My sounds and shows it in its gallery. */
  function saveBack() {
    const song = currentSong();
    const name = song.title || song.sheet!.name;
    const id = keepSound({ ...song, sheet: { ...song.sheet!, name } });
    if (!id) return;
    say(`Saved “${name}”`);
    void navigate(`${gallery}?sound=${id}`);
  }

  return (
    <div className={styles.gridtools}>
      {sheet ? (
        <div className={styles.sheet} role="note">
          <p>
            <b>{sheet.kind === "voice" ? "Creature voice" : "Sound effect"}</b> “{sheet.name}”: one
            step is {sheet.ticks === 1 ? "one frame" : `${sheet.ticks} frames`}; notes with a notch
            keep their own settings.
          </p>
          <button type="button" className="btn primary" onClick={saveBack}>
            Save to {sheet.kind === "voice" ? "My voices" : "My sounds"}
          </button>
          <button type="button" className="btn" onClick={() => void navigate(gallery)}>
            Back to {sheet.kind === "voice" ? "Creatures" : "SFX"}
          </button>
        </div>
      ) : null}
      <div className={styles.toolbar} role="toolbar" aria-label="Bar and channel tools">
        <span className={styles.group} role="group" aria-label={`Bar ${bar + 1}`}>
          <span className={styles.tag} aria-hidden="true">
            Bar {bar + 1}
          </span>
          <button
            type="button"
            className={styles.tool}
            onClick={() => {
              setClipboard(bar);
              say(`Copied bar ${bar + 1}: pick another bar and paste`);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className={styles.tool}
            disabled={clipboard === null || clipboard === bar}
            onClick={() =>
              edit(`Paste bar ${clipboard! + 1} onto bar ${bar + 1}`, (song) => {
                song.tracks = copyBars(song, clipboard!, 1, bar);
              })
            }
          >
            Paste
          </button>
          <button
            type="button"
            className={styles.tool}
            disabled={bars >= MAX_BARS}
            onClick={() => duplicate(bar)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label={`Clear bar ${bar + 1} on ${info.name}`}
            onClick={() =>
              edit(`Clear bar ${bar + 1}`, (song) => {
                song.tracks = clearBars(song, bar, 1, [channel]);
              })
            }
          >
            Clear bar
          </button>
        </span>
        <span className={styles.group} role="group" aria-label={info.name}>
          <span className={styles.tag} aria-hidden="true">
            {info.short}
          </span>
          <button
            type="button"
            className={styles.tool}
            aria-label={`Clear ${info.name}`}
            onClick={() =>
              edit(`Clear ${info.name}`, (song) => {
                song.tracks[channel].notes = [];
              })
            }
          >
            Clear channel
          </button>
        </span>
        <button
          type="button"
          className={clsx(styles.tool, styles.new)}
          onClick={() => {
            openSong(emptySong(), "New song");
            say("New empty song. Undo brings the old one back.");
          }}
        >
          New song
        </button>
      </div>
    </div>
  );
}
