// Song settings: length, key and scale (which decide the grid rows), the length of new notes and
// the loop point. Bar and channel actions live in the toolbar under the screen (GridTools).
import clsx from "clsx";
import { KEYS, SCALES } from "../model/music.ts";
import { tidy } from "../model/song.ts";
import { MAX_BARS, STEPS_PER_BAR, type ScaleId } from "../model/types.ts";
import { edit, setPrefs, updateEditor, useStudio } from "../state/studio.ts";
import styles from "./SongPanel.module.css";

const LENGTHS = [
  { steps: 1, name: "1/16" },
  { steps: 2, name: "1/8" },
  { steps: 4, name: "1/4" },
  { steps: 8, name: "1/2" },
];

function setBars(current: number, bars: number) {
  const next = Math.min(MAX_BARS, Math.max(1, bars));
  if (next === current) return;
  edit(next > current ? "Add a bar" : "Remove the last bar", (song) => {
    song.bars = next;
    song.loop = Math.min(song.loop, next - 1);
    for (const track of song.tracks) track.notes = tidy(track.notes, next * STEPS_PER_BAR);
  });
  updateEditor((e) => {
    e.bar = Math.min(e.bar, next - 1);
  });
}

export function SongPanel() {
  const { bars, key, scale, loop, sheet } = useStudio((s) => s.song);
  const noteLength = useStudio((s) => s.prefs.noteLength);

  return (
    <section className={clsx("panel", styles.song)} aria-labelledby="song-title-h">
      <h2 id="song-title-h">{sheet ? "Sound sheet" : "Song"}</h2>
      <div className={styles.rows}>
        <div className={styles.field}>
          <span className="label">Bars</span>
          <div className={styles.stepper}>
            <button
              type="button"
              aria-label="Remove the last bar"
              onClick={() => setBars(bars, bars - 1)}
            >
              −
            </button>
            <output aria-live="polite">{bars}</output>
            <button type="button" aria-label="Add a bar" onClick={() => setBars(bars, bars + 1)}>
              +
            </button>
          </div>
        </div>
        <label className={styles.field}>
          <span className="label">Key</span>
          <select
            value={key}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              edit("Change key", (song) => {
                song.key = value;
              });
            }}
          >
            {KEYS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className="label">Scale</span>
          <select
            value={scale}
            onChange={(event) => {
              const value = event.currentTarget.value as ScaleId;
              edit("Change scale", (song) => {
                song.scale = value;
              });
            }}
          >
            {(Object.keys(SCALES) as ScaleId[]).map((id) => (
              <option key={id} value={id}>
                {SCALES[id].name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.field}>
          <span className="label">New notes</span>
          <div className={styles.seg} role="radiogroup" aria-label="Length of new notes">
            {LENGTHS.map((l) => (
              <button
                key={l.steps}
                type="button"
                role="radio"
                aria-checked={noteLength === l.steps}
                onClick={() => setPrefs({ noteLength: l.steps })}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        {sheet ? null : (
          <label className={styles.field}>
            <span className="label">Loop from</span>
            <select
              value={loop}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                edit(`Loop from bar ${value + 1}`, (song) => {
                  song.loop = value;
                });
              }}
            >
              {Array.from({ length: bars }, (_, b) => (
                <option key={b} value={b}>
                  {`Bar ${b + 1}${b === 0 ? " (no intro)" : ""}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}
