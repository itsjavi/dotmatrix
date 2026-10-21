// The screen: a dot-matrix piano roll for the selected channel. Rows are the song's scale (or the
// drum kit on the noise channel), columns are 16th-note steps. Click an empty cell to add a note
// (drag to make it longer), click a note to remove it, drag a note's row to resize it. With focus,
// the arrow keys move a cursor and Enter adds or removes a note.
import clsx from "clsx";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { noteData } from "../audio/driver.ts";
import { playOnce, playerStore } from "../audio/player.ts";
import { vars } from "../css.ts";
import { DRUMS, presetName } from "../model/instruments.ts";
import { noteName, scaleRows } from "../model/music.ts";
import { noteAt, placeNote, removeNote } from "../model/song.ts";
import {
  CHANNELS,
  NOTE_OVERRIDES,
  STEPS_PER_BAR,
  type ChannelIndex,
  type Note,
  type Song,
} from "../model/types.ts";
import { setGridFocused } from "../state/keys.ts";
import { currentSong, edit, updateEditor, useStudio } from "../state/studio.ts";
import { usePlayer } from "../state/usePlayer.ts";
import styles from "./PianoRoll.module.css";
import { StudioCode } from "./StudioCode.tsx";

const SPAN = 24;
const CELL_H = 18;
const KEYS_W = 52;

/** Noise settings offered as rows on a sound sheet (NR43: clock shift, width, divisor), bright to dark. */
const NOISE_ROWS = [
  0x00, 0x01, 0x02, 0x11, 0x12, 0x21, 0x22, 0x23, 0x31, 0x33, 0x41, 0x45, 0x51, 0x55, 0x61, 0x66,
  0x71, 0x77,
];
const hex2 = (n: number) => `$${n.toString(16).toUpperCase().padStart(2, "0")}`;
const hasOwn = (n: Note) => NOTE_OVERRIDES.some((k) => n[k] !== undefined);
const pad = (n: number, width: number) => String(n).padStart(width, "0");
let gesture = 0;

/** Plays a note of a channel with its instrument. */
export function audition(ch: ChannelIndex, pitch: number, steps: number): void {
  const song = currentSong();
  void playOnce(noteData(song.tracks[ch], ch, pitch, Math.min(steps, 8), song)).catch(() => {});
}

/** The grid rows of a channel: drums, raw noise settings, or the pitches of the song's scale. */
function gridRows(song: Song, ch: ChannelIndex, low: number): number[] {
  const kind = CHANNELS[ch].kind;
  const notes = song.tracks[ch].notes;
  if (kind === "noise" && !song.sheet) return DRUMS.map((_, i) => i);
  if (kind === "noise") {
    const set = new Set([...NOISE_ROWS, ...notes.map((n) => n.p)]);
    return [...set].toSorted((a, b) => (a >> 4) - (b >> 4) || (a & 15) - (b & 15));
  }
  const used = notes.map((n) => n.p);
  return scaleRows(
    Math.min(low, ...used),
    Math.max(low + SPAN, ...used),
    song.key,
    song.scale,
    used,
  );
}

function scrollToStep(roll: HTMLElement, step: number, cellW: number, lead: boolean) {
  const x = step * cellW;
  const view = roll.clientWidth - KEYS_W;
  const left = roll.scrollLeft;
  if (x < left || x > left + view - cellW * 2) {
    roll.scrollTo({ left: Math.max(0, lead ? x - view / 4 : x - view / 2), behavior: "auto" });
  }
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
  );
}

const pickBar = (bar: number) =>
  updateEditor((e) => {
    e.bar = bar;
  });

/** The studio song is playing (the playhead is on the grid). */
const usePlaying = () => usePlayer((s) => s.nowPlaying === "editor" && s.playStep >= 0);

type Drag =
  | { mode: "resize"; note: Note; key: string }
  | { mode: "maybe-remove"; note: Note; step: number; key: string }
  | { mode: "paint"; key: string; row: number; last: number };

export function PianoRoll() {
  const song = useStudio((s) => s.song);
  const editor = useStudio((s) => s.editor);
  const noteLength = useStudio((s) => s.prefs.noteLength);
  const playing = usePlaying();
  const narrow = useMediaQuery("(width < 720px)");
  const [focused, setFocused] = useState(false);
  const [live, setLive] = useState("");
  const lane = useRef<HTMLDivElement>(null);
  const roll = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | undefined>(undefined);

  const ch = editor.channel;
  const kind = CHANNELS[ch].kind;
  const track = song.tracks[ch];
  /** The noise channel plays the drum kit in songs, and raw noise settings on sound sheets. */
  const drums = kind === "noise" && !song.sheet;
  const total = song.bars * STEPS_PER_BAR;
  const ticks = song.sheet?.ticks ?? 0;
  const cellW = narrow ? 26 : 22;
  const rows = gridRows(song, ch, editor.low[ch]!);
  const rowOf = new Map(rows.map((p, i) => [p, i]));
  // The cursor stays on a visible row when the channel or the rows change.
  const cursor = rowOf.has(editor.cursor.pitch)
    ? editor.cursor
    : { step: Math.min(editor.cursor.step, total - 1), pitch: rows[Math.floor(rows.length / 2)]! };

  /** Notes of the other pitched channels, drawn faintly on this channel's rows. */
  const ghosts =
    kind === "noise"
      ? []
      : song.tracks.flatMap((t, c) =>
          c === ch || c === 3
            ? []
            : t.notes.filter((n) => rowOf.has(n.p)).map((n) => ({ n, c, row: rowOf.get(n.p)! })),
        );

  const rowLabel = (p: number) =>
    drums ? DRUMS[p]!.short : kind === "noise" ? hex2(p) : noteName(p);
  const isRoot = (p: number) => kind !== "noise" && (((p - song.key) % 12) + 12) % 12 === 0;

  // Follow the playhead while the studio song plays.
  useEffect(
    () =>
      playerStore.subscribe((s, prev) => {
        if (s.nowPlaying !== "editor" || s.playStep < 0 || s.playStep === prev.playStep) return;
        if (roll.current) scrollToStep(roll.current, s.playStep, cellW, true);
      }),
    [cellW],
  );

  useEffect(() => () => setGridFocused(false), []);

  // --- Editing: handlers read the store, so quick pointer moves never see a stale song ---

  const notesNow = () => useStudio.getState().song.tracks[ch].notes;
  const hitAt = (step: number, pitch: number): Note | undefined =>
    notesNow().find((n) => n.p === pitch && n.s <= step && step < n.s + n.l);

  function setNotes(label: string, notes: Note[], key?: string) {
    edit(
      label,
      (draft) => {
        draft.tracks[ch].notes = notes;
      },
      key,
    );
  }

  function addNote(step: number, pitch: number, len: number, key?: string): Note {
    const note = { s: step, l: drums ? 1 : Math.min(len, total - step), p: pitch };
    setNotes(
      drums ? `Add ${DRUMS[pitch]!.name.toLowerCase()}` : "Add note",
      placeNote(notesNow(), note, total),
      key,
    );
    audition(ch, pitch, note.l);
    return note;
  }

  function resize(note: Note, len: number, key: string) {
    const l = Math.max(1, Math.min(len, total - note.s));
    const without = removeNote(notesNow(), note);
    setNotes("Change note length", placeNote(without, { ...note, l }, total), key);
  }

  function cellAt(event: PointerEvent): { step: number; row: number } {
    const rect = lane.current!.getBoundingClientRect();
    const w = rect.width / total;
    return {
      step: Math.min(total - 1, Math.max(0, Math.floor((event.clientX - rect.left) / w))),
      row: Math.min(rows.length - 1, Math.max(0, Math.floor((event.clientY - rect.top) / CELL_H))),
    };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const el = event.currentTarget;
    el.focus({ preventScroll: true });
    el.setPointerCapture(event.pointerId);
    const { step, row } = cellAt(event);
    const pitch = rows[row]!;
    const key = `pen:${++gesture}`;
    updateEditor((e) => {
      e.cursor = { step, pitch };
    });
    const hit = hitAt(step, pitch);
    if (drums) {
      if (hit)
        setNotes(`Remove ${DRUMS[pitch]!.name.toLowerCase()}`, removeNote(notesNow(), hit), key);
      else addNote(step, pitch, 1, key);
      drag.current = hit ? undefined : { mode: "paint", key, row, last: step };
      return;
    }
    drag.current = hit
      ? { mode: "maybe-remove", note: hit, step, key }
      : { mode: "resize", note: addNote(step, pitch, noteLength, key), key };
  }

  function onPointerMove(event: PointerEvent) {
    let d = drag.current;
    if (!d) return;
    const { step } = cellAt(event);
    if (d.mode === "paint") {
      if (step === d.last) return;
      d.last = step;
      const pitch = rows[d.row]!;
      if (!hitAt(step, pitch)) addNote(step, pitch, 1, d.key);
      return;
    }
    if (d.mode === "maybe-remove") {
      if (step === d.step) return;
      d = drag.current = { mode: "resize", note: d.note, key: d.key };
    }
    const len = step - d.note.s + 1;
    if (len === d.note.l || len < 1) return;
    resize(d.note, len, d.key);
    d.note = { ...d.note, l: Math.max(1, Math.min(len, total - d.note.s)) };
  }

  function onPointerUp() {
    const d = drag.current;
    if (d?.mode === "maybe-remove") setNotes("Remove note", removeNote(notesNow(), d.note), d.key);
    drag.current = undefined;
  }

  // --- Keyboard ---

  function describe(at = cursor) {
    const { step, pitch } = at;
    const hit =
      hitAt(step, pitch) ??
      noteAt(
        notesNow().filter((n) => n.p === pitch),
        step,
      );
    const bar = Math.floor(step / STEPS_PER_BAR) + 1;
    setLive(
      `Bar ${bar}, step ${(step % STEPS_PER_BAR) + 1}, ${rowLabel(pitch)}${hit ? `, note of ${hit.l} steps` : ""}`,
    );
  }

  function moveCursor(dStep: number, dRow: number) {
    const at = rowOf.get(cursor.pitch) ?? 0;
    const row = Math.min(rows.length - 1, Math.max(0, at + dRow));
    const next = {
      step: Math.min(total - 1, Math.max(0, cursor.step + dStep)),
      pitch: rows[row]!,
    };
    updateEditor((e) => {
      e.cursor = next;
    });
    describe(next);
    if (roll.current) scrollToStep(roll.current, next.step, cellW, false);
  }

  function onKeyDown(event: KeyboardEvent) {
    const { step, pitch } = cursor;
    const hit = hitAt(step, pitch);
    const key = event.key;
    const bar = event.ctrlKey || event.metaKey;
    let handled = true;
    if (key === "ArrowLeft" && event.shiftKey) {
      if (hit && !drums) resize(hit, hit.l - 1, `key:${hit.s}:${hit.p}`);
    } else if (key === "ArrowRight" && event.shiftKey) {
      if (hit && !drums) resize(hit, hit.l + 1, `key:${hit.s}:${hit.p}`);
    } else if (key === "ArrowLeft") moveCursor(bar ? -STEPS_PER_BAR : -1, 0);
    else if (key === "ArrowRight") moveCursor(bar ? STEPS_PER_BAR : 1, 0);
    else if (key === "ArrowUp") moveCursor(0, -1);
    else if (key === "ArrowDown") moveCursor(0, 1);
    else if (key === "Home") moveCursor(-step, 0);
    else if (key === "End") moveCursor(total - 1 - step, 0);
    else if (key === "Enter") {
      if (hit) setNotes("Remove note", removeNote(notesNow(), hit));
      else addNote(step, pitch, noteLength);
      describe();
    } else if (key === "Delete" || key === "Backspace") {
      if (hit) setNotes("Remove note", removeNote(notesNow(), hit));
      describe();
    } else handled = false;
    if (handled) event.preventDefault();
  }

  return (
    <section className={styles.screen} aria-label="Piano roll">
      <div className={styles.bezel}>
        <div className={styles.lcd}>
          <div className={styles.top}>
            <Status song={song} ch={ch} cursorStep={cursor.step} />
            <div className={styles.views} role="radiogroup" aria-label="Screen view">
              {(["grid", "code"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  className={styles.view}
                  aria-checked={editor.view === v}
                  onClick={() =>
                    updateEditor((e) => {
                      e.view = v;
                    })
                  }
                >
                  {v === "grid" ? "Grid" : "Code"}
                </button>
              ))}
            </div>
          </div>
          {editor.view === "code" ? (
            <StudioCode />
          ) : (
            <div
              ref={roll}
              className={styles.roll}
              style={vars({ cw: `${cellW}px`, chh: `${CELL_H}px` })}
            >
              <div className={styles.sheet} style={vars({ steps: total, rows: rows.length })}>
                <div className={styles.corner} />
                <div className={styles.ruler} aria-hidden="true">
                  {Array.from({ length: song.bars }, (_, bar) => (
                    <span
                      key={bar}
                      className={clsx(styles.barno, bar === editor.bar && styles.picked)}
                      data-bar={bar}
                      style={vars({ b: bar })}
                      onClick={() => pickBar(bar)}
                    >
                      {song.sheet ? `${bar * STEPS_PER_BAR * ticks}f` : bar + 1}
                      {bar === song.loop && song.loop > 0 ? (
                        <span className={styles.flag}>LOOP</span>
                      ) : null}
                    </span>
                  ))}
                </div>
                <div className={styles.keys} aria-hidden="true">
                  {rows.map((p) => (
                    <span key={p} className={clsx(styles.key, isRoot(p) && styles.root)}>
                      {rowLabel(p)}
                    </span>
                  ))}
                </div>
                <div
                  ref={lane}
                  className={styles.lane}
                  tabIndex={0}
                  role="application"
                  aria-roledescription="piano roll"
                  aria-label={`${CHANNELS[ch].name} notes. Arrow keys move, Enter adds or removes a note, Shift with arrows changes its length.`}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={onKeyDown}
                  onFocus={() => {
                    setFocused(true);
                    setGridFocused(true);
                    describe();
                  }}
                  onBlur={() => {
                    setFocused(false);
                    setGridFocused(false);
                  }}
                >
                  {rows.map((p, i) => (
                    <div
                      key={p}
                      className={clsx(styles.row, isRoot(p) && styles.root)}
                      style={vars({ r: i })}
                    />
                  ))}
                  {song.loop > 0 ? (
                    <div className={styles.intro} style={vars({ w: song.loop * STEPS_PER_BAR })}>
                      <span>INTRO</span>
                    </div>
                  ) : null}
                  <div className={styles.pickedBar} style={vars({ b: editor.bar })} />
                  {ghosts.map((g) => (
                    <div
                      key={`${g.c}:${g.n.s}`}
                      className={clsx(styles.ghost, styles[`c${g.c}`])}
                      style={vars({ s: g.n.s, l: g.n.l, r: g.row })}
                    />
                  ))}
                  <Notes notes={track.notes} rowOf={rowOf} drums={drums} />
                  {focused ? (
                    <div
                      className={styles.cursor}
                      style={vars({ s: cursor.step, r: rowOf.get(cursor.pitch) ?? 0 })}
                    />
                  ) : null}
                  <Playhead />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className={styles.ledRow} aria-hidden="true">
          <span className={clsx(styles.led, playing && styles.on)} />
          <span>{playing ? "PLAYING" : "POWER"}</span>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </section>
  );
}

/** The status line: channel, preset, frame or bar under the playhead (or the cursor), tempo. */
function Status({ song, ch, cursorStep }: { song: Song; ch: ChannelIndex; cursorStep: number }) {
  const playing = usePlaying();
  const playStep = usePlayer((s) => s.playStep);
  const step = Math.max(0, playing ? playStep : cursorStep);
  const ticks = song.sheet?.ticks ?? 0;
  return (
    <div className={styles.status} aria-hidden="true">
      <span className={styles.chan}>{CHANNELS[ch].short}</span>
      <span>{presetName(CHANNELS[ch].kind, song.tracks[ch].inst.preset).toUpperCase()}</span>
      <span className={styles.grow} />
      {song.sheet ? <span>FRAME {pad(step * ticks, 3)}</span> : null}
      <span className={clsx(song.sheet && styles.hidden)}>
        BAR {pad(Math.floor(step / STEPS_PER_BAR) + 1, 2)}/{pad(song.bars, 2)}
      </span>
      <span>{song.sheet ? `${ticks} F/STEP` : `${song.bpm} BPM`}</span>
    </div>
  );
}

/** The channel's notes; the ones under the playhead light up. */
function Notes({
  notes,
  rowOf,
  drums,
}: {
  notes: readonly Note[];
  rowOf: Map<number, number>;
  drums: boolean;
}) {
  const playing = usePlaying();
  const playStep = usePlayer((s) => s.playStep);
  return notes.map((n) => (
    <div
      key={n.s}
      className={clsx(
        styles.note,
        drums && styles.drum,
        hasOwn(n) && styles.own,
        playing && n.s <= playStep && playStep < n.s + n.l && styles.lit,
      )}
      data-step={n.s}
      data-pitch={n.p}
      data-own={hasOwn(n) || undefined}
      style={vars({ s: n.s, l: n.l, r: rowOf.get(n.p) ?? 0 })}
    />
  ));
}

function Playhead() {
  const playing = usePlaying();
  const playStep = usePlayer((s) => s.playStep);
  return playing ? (
    <div className={styles.playhead} data-testid="playhead" style={vars({ s: playStep })} />
  ) : null;
}
