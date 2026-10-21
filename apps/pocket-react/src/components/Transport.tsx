// The transport strip: the big play button, title, tempo, loop, undo/redo, share and export.
import clsx from "clsx";
import { useState } from "react";
import { setLooping, songWav } from "../audio/player.ts";
import { download, slug } from "../files.ts";
import { encodeSong } from "../model/share.ts";
import { usePlayer } from "../state/usePlayer.ts";
import { currentSong, edit, redo, say, togglePlay, undo, useStudio } from "../state/studio.ts";
import styles from "./Transport.module.css";

function setBpm(value: number) {
  if (!Number.isFinite(value)) return;
  const bpm = Math.min(240, Math.max(50, Math.round(value)));
  edit(
    "Change tempo",
    (song) => {
      song.bpm = bpm;
    },
    "bpm",
  );
}

export function Transport() {
  const title = useStudio((s) => s.song.title);
  const bpm = useStudio((s) => s.song.bpm);
  const sheet = useStudio((s) => s.song.sheet);
  const message = useStudio((s) => s.message);
  const canUndo = useStudio((s) => s.canUndo);
  const canRedo = useStudio((s) => s.canRedo);
  const playing = usePlayer((s) => s.nowPlaying === "editor");
  const rendering = usePlayer((s) => s.rendering);
  const looping = usePlayer((s) => s.looping);
  const [exporting, setExporting] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  /** The tempo being typed; it applies on Enter or when the field loses focus. */
  const [bpmDraft, setBpmDraft] = useState<string | null>(null);

  async function exportWav() {
    if (exporting) return;
    setExporting(true);
    say("Rendering WAV…");
    try {
      const song = currentSong();
      const blob = await songWav(song);
      download(blob, `${slug(song.title)}.wav`);
      say(
        `Saved ${slug(song.title)}.wav (${(blob.size / 1024 / 1024).toFixed(1)} MB, loop points included)`,
      );
    } catch (error) {
      say(`WAV export failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(false);
    }
  }

  async function share() {
    const url = new URL(import.meta.env.BASE_URL, location.href);
    url.search = `?song=${await encodeSong(currentSong())}`;
    setShareUrl(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      say("Share link copied: anyone who opens it gets this song");
    } catch {
      say("Share link ready: copy it from the box below");
    }
  }

  function commitBpm() {
    if (bpmDraft !== null) setBpm(Number(bpmDraft));
    setBpmDraft(null);
  }

  return (
    <section className={clsx("panel", styles.transport)} aria-label="Transport">
      <button
        type="button"
        className={clsx(styles.play, playing && styles.on)}
        aria-label={playing ? "Stop" : "Play song"}
        title="Play or stop (Space)"
        onClick={togglePlay}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          {playing ? <rect x="2" y="2" width="6" height="6" /> : <path d="M3 1.5v7l5.5-3.5z" />}
        </svg>
      </button>
      <div className={styles.title}>
        <label className="sr-only" htmlFor="song-title">
          Song title
        </label>
        <input
          id="song-title"
          type="text"
          maxLength={60}
          value={title}
          onChange={(event) => {
            const value = event.currentTarget.value.slice(0, 60);
            edit(
              "Rename song",
              (song) => {
                song.title = value;
              },
              "title",
            );
          }}
        />
        <span className={styles.state} aria-live="polite">
          {rendering ? "Rendering…" : playing ? "Playing" : "Ready"}
          {message ? ` · ${message}` : ""}
        </span>
      </div>
      {sheet ? (
        <div className={styles.tempo} role="radiogroup" aria-label="Frames per step">
          <span className="label">Frames per step</span>
          {[1, 2, 3, 4].map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              className={clsx(styles.step, sheet.ticks === t && styles.on)}
              aria-checked={sheet.ticks === t}
              onClick={() =>
                edit("Change frames per step", (song) => {
                  if (song.sheet) song.sheet.ticks = t;
                })
              }
            >
              {t}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.tempo}>
          <span className="label">Tempo</span>
          <button
            type="button"
            className={styles.step}
            aria-label="Slower"
            onClick={() => setBpm(bpm - 4)}
          >
            −
          </button>
          <input
            type="number"
            aria-label="Tempo in BPM"
            min={50}
            max={240}
            value={bpmDraft ?? bpm}
            onChange={(event) => setBpmDraft(event.currentTarget.value)}
            onBlur={commitBpm}
            onKeyDown={(event) => event.key === "Enter" && commitBpm()}
          />
          <button
            type="button"
            className={styles.step}
            aria-label="Faster"
            onClick={() => setBpm(bpm + 4)}
          >
            +
          </button>
        </div>
      )}
      <div className={styles.buttons}>
        <button
          type="button"
          className={clsx("btn", looping && !sheet && styles.lit)}
          aria-pressed={looping && !sheet}
          disabled={!!sheet}
          title={sheet ? "Sounds play once" : "Loop back to the loop bar (L)"}
          onClick={() => setLooping(!looping)}
        >
          Loop
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canUndo}
          onClick={undo}
          title="Undo (Ctrl/⌘ Z)"
        >
          Undo
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canRedo}
          onClick={redo}
          title="Redo (Ctrl/⌘ Shift Z)"
        >
          Redo
        </button>
        <button type="button" className="btn" onClick={() => void share()}>
          Share
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={exporting}
          onClick={() => void exportWav()}
        >
          {exporting ? "Rendering…" : "Export WAV"}
        </button>
      </div>
      {shareUrl ? (
        <div className={styles.share}>
          <label className="label" htmlFor="share-url">
            Share link
          </label>
          <input
            id="share-url"
            type="url"
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className="btn" onClick={() => setShareUrl("")}>
            Close
          </button>
        </div>
      ) : null}
    </section>
  );
}
