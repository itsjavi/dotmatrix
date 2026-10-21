// Sounds shared by the SFX and Creatures pages and the studio: rendering a sound for its
// waveform, opening it in the studio as a sound sheet, and the "My sounds" shelf.
import type { EngineAudioData } from "gbaudio";
import { create } from "zustand";
import { songData } from "../audio/driver.ts";
import { monoWav } from "../audio/player.ts";
import { renderPcm } from "../audio/renderer.ts";
import { download, slug } from "../files.ts";
import { loadSounds, newId, saveSounds, type SavedSound } from "../model/library.ts";
import { sfxToSheet } from "../model/sheet.ts";
import type { ChannelIndex, Sfx, Song, SoundSheet } from "../model/types.ts";
import { openSong, say, updateEditor } from "./studio.ts";

/** The "My sounds" shelf, read from browser storage when the app starts. */
export const useMySounds = create<{ sounds: SavedSound[] }>()(() => ({ sounds: loadSounds() }));

export const renderSound = (data: EngineAudioData): Promise<Float32Array> =>
  renderPcm(data, { mono: true });

/** A sound sheet as engine data: every channel, played once. */
export const sheetData = (song: Song): EngineAudioData => songData(song, [0, 1, 2, 3]);

export async function saveWav(pcm: Float32Array, name: string): Promise<void> {
  try {
    download(await monoWav(pcm), `${slug(name)}.wav`);
    say(`Saved ${slug(name)}.wav`);
  } catch (error) {
    say(`WAV export failed: ${String(error)}`);
  }
}

/** Opens a sound in the studio, on a frame grid; false when it cannot open there. */
export function openInStudio(sfx: Sfx, kind: SoundSheet["kind"]): boolean {
  const result = sfxToSheet(sfx, kind);
  if ("reasons" in result) {
    say(`“${sfx.name}” cannot open in the studio: ${result.reasons.join("; ")}`);
    return false;
  }
  openInStudioSheet(result.song, `Open ${sfx.name} in the studio`);
  return true;
}

export function openInStudioSheet(song: Song, label: string): void {
  openSong(song, label);
  const first = song.tracks.findIndex((t) => t.notes.length > 0);
  updateEditor((editor) => {
    editor.channel = (first < 0 ? 0 : first) as ChannelIndex;
    editor.bar = 0;
    // Show each pitched channel's notes: the grid starts at its lowest note.
    song.tracks.forEach((t, c) => {
      if (c < 3 && t.notes.length)
        editor.low[c] = Math.max(24, Math.min(...t.notes.map((n) => n.p)) - 1);
    });
  });
  say(
    `${song.title}: one step is one frame. Notes with a notch keep their own settings. Undo brings your song back.`,
  );
}

function store(next: SavedSound[]): boolean {
  if (!saveSounds(next)) {
    say("Could not save: browser storage is unavailable");
    return false;
  }
  useMySounds.setState({ sounds: next });
  return true;
}

/** Saves a sound sheet to My sounds and returns its id. */
export function keepSound(song: Song): string | undefined {
  if (!song.sheet) return undefined;
  const entry: SavedSound = {
    id: newId(),
    kind: song.sheet.kind,
    name: song.sheet.name,
    updated: Date.now(),
    song,
  };
  return store([entry, ...useMySounds.getState().sounds].slice(0, 60)) ? entry.id : undefined;
}

/** Replaces a saved sound's content (code edited in the maker), keeping its id. */
export function updateSound(id: string, song: Song): boolean {
  const sheet = song.sheet;
  if (!sheet) return false;
  return store(
    useMySounds
      .getState()
      .sounds.map((s) => (s.id === id ? { ...s, name: sheet.name, updated: Date.now(), song } : s)),
  );
}

export function forgetSound(id: string): void {
  const next = useMySounds.getState().sounds.filter((s) => s.id !== id);
  if (saveSounds(next)) useMySounds.setState({ sounds: next });
}
