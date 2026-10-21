// The studio's state: the open song (immutable, edited through Immer drafts), its undo history,
// editor and view preferences, and the status line. Every song edit goes through `edit`, which
// records undo, autosaves and tells the player to re-render what changed.
import { produce, type Draft } from "immer";
import { create } from "zustand";
import * as player from "../audio/player.ts";
import { createHistory } from "../model/history.ts";
import { loadCurrent, saveCurrent } from "../model/library.ts";
import { firstSteps } from "../model/songs/first-steps.ts";
import { clone } from "../model/song.ts";
import type { ChannelIndex, Song } from "../model/types.ts";

export interface Prefs {
  theme: "system" | "light" | "dark";
  lcd: "pea" | "pocket" | "dusk" | "ice";
  /** Length of new notes, in steps. */
  noteLength: number;
}

export interface Editor {
  channel: ChannelIndex;
  /** Keyboard cursor on the grid: step and pitch (or drum index). */
  cursor: { step: number; pitch: number };
  /** The selected bar, for the bar tools. */
  bar: number;
  /** Lowest visible pitch per channel (the view spans two octaves and a bit). */
  low: number[];
  /** The screen shows the note grid or the driver code. */
  view: "grid" | "code";
}

interface StudioState {
  song: Song;
  editor: Editor;
  prefs: Prefs;
  message: string;
  canUndo: boolean;
  canRedo: boolean;
  shortcutsOpen: boolean;
}

const PREFS_KEY = "dotmatrix.prefs";
const DEFAULT_PREFS: Prefs = { theme: "system", lcd: "pea", noteLength: 2 };

function readPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...saved };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

// A client-rendered app: what this browser saved is read once, when the store is created.
export const useStudio = create<StudioState>()(() => ({
  song: loadCurrent() ?? firstSteps(),
  editor: {
    channel: 0,
    cursor: { step: 0, pitch: 72 },
    bar: 0,
    low: [64, 55, 33, 0],
    view: "grid",
  },
  prefs: readPrefs(),
  message: "",
  canUndo: false,
  canRedo: false,
  shortcutsOpen: false,
}));

const { getState: get, setState: set } = useStudio;

useStudio.subscribe((state, prev) => {
  if (state.prefs === prev.prefs) return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
  } catch {
    // Private mode or full storage: preferences just do not persist.
  }
});

/** The open song, for the worker, saving and the e2e tests. */
export const currentSong = (): Song => get().song;

// --- Status line, editor and preferences ---

let messageTimer: ReturnType<typeof setTimeout> | undefined;
export function say(text: string): void {
  set({ message: text });
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => set({ message: "" }), 4000);
}

export function updateEditor(recipe: (editor: Draft<Editor>) => void): void {
  set((state) => ({ editor: produce(state.editor, recipe) }));
}

export function setPrefs(prefs: Partial<Prefs>): void {
  set((state) => ({ prefs: { ...state.prefs, ...prefs } }));
}

export const setShortcutsOpen = (open: boolean): void => set({ shortcutsOpen: open });

// --- Edits, history, autosave and audio ---

const history = createHistory<Song>(() =>
  set({ canUndo: history.canUndo(), canRedo: history.canRedo() }),
);

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let audioTimer: ReturnType<typeof setTimeout> | undefined;

function changed(song: Song): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!saveCurrent(song)) say("Could not autosave: browser storage is unavailable");
  }, 400);
  // Mix changes apply at once; note edits re-render after a short pause (dragging stays smooth).
  player.applyMix(song, "editor");
  clearTimeout(audioTimer);
  audioTimer = setTimeout(() => void player.update(song, "editor"), 60);
}

/** An undoable song edit. `key` merges quick repeats (slider drags) into one undo step. */
export function edit(label: string, recipe: (song: Draft<Song>) => void, key?: string): void {
  const before = get().song;
  const song = produce(before, recipe);
  if (song === before) return;
  history.push(before, label, key);
  set({ song });
  changed(song);
}

/** Mixer moves (mute, solo, pan) are saved but not undoable: they are performance controls. */
export function mix(recipe: (song: Draft<Song>) => void): void {
  const song = produce(get().song, recipe);
  set({ song });
  changed(song);
}

function restore(entry: { state: Song; label: string } | undefined, verb: string): void {
  if (!entry) return;
  set({ song: entry.state });
  say(`${verb}: ${entry.label}`);
  changed(entry.state);
}

export const undo = (): void => restore(history.undo(get().song), "Undo");
export const redo = (): void => restore(history.redo(get().song), "Redo");

/** Replaces the open song (a demo, a shared link, a saved song); undo brings the old one back. */
export function openSong(next: Song, label: string): void {
  const before = get().song;
  const wasPlaying = player.playerStore.getState().nowPlaying === "editor";
  const song = clone(next);
  history.push(before, label);
  set((state) => ({ song, editor: { ...state.editor, bar: 0 } }));
  changed(song);
  if (wasPlaying) void player.play(song, "editor");
}

// --- Transport ---

export function togglePlay(): void {
  if (player.playerStore.getState().nowPlaying === "editor") player.stop();
  else
    void player
      .play(get().song, "editor")
      .catch((error: unknown) => say(`Audio failed: ${String(error)}`));
}
