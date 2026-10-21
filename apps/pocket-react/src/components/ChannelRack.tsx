// The four channels as cartridge-like cards: pick one to edit, mute or solo it, pan it, and watch
// its scope while the song plays.
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { scope } from "../audio/player.ts";
import { presetName } from "../model/instruments.ts";
import { CHANNELS, type ChannelIndex, type Pan } from "../model/types.ts";
import { mix, updateEditor, useStudio } from "../state/studio.ts";
import { usePlayer } from "../state/usePlayer.ts";
import styles from "./ChannelRack.module.css";

const ICONS: Record<string, string> = {
  pulse: "M0 6h2V1h3v5h3V1h3v5h2",
  wave: "M0 4c2-5 4-5 6 0s4 5 6 0 2-3 3-2",
  noise: "M0 4h1V1h1v6h1V2h1v4h1V0h1v8h1V3h1v3h1V1h1v5h1V3h1v2h1",
};

const PANS = { L: "Left", C: "Center", R: "Right" } as const;

/** A dot-matrix trace of the channel: drawn while anything plays, and once more when it stops. */
function Scope({ ch }: { ch: ChannelIndex }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const playing = usePlayer((s) => s.nowPlaying !== null);
  const lcd = useStudio((s) => s.prefs.lcd);
  const theme = useStudio((s) => s.prefs.theme);

  useEffect(() => {
    const samples = new Float32Array(256);
    let frame = 0;
    function draw() {
      const c = canvas.current;
      if (!c) return;
      const g = c.getContext("2d")!;
      const style = getComputedStyle(c);
      const { width: w, height: h } = c;
      g.fillStyle = style.getPropertyValue("--l0");
      g.fillRect(0, 0, w, h);
      scope(ch, samples);
      g.fillStyle = style.getPropertyValue("--l3");
      // One 2×2 dot per column.
      for (let x = 0; x < w; x += 2) {
        const s = samples[Math.floor((x / w) * samples.length)]!;
        const y = Math.round(h / 2 - s * h * 2.6);
        g.fillRect(x, Math.min(h - 2, Math.max(0, y)), 2, 2);
      }
      if (playing) frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // The palette (lcd, theme) is read from computed styles: a change redraws.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [ch, playing, lcd, theme]);

  return <canvas ref={canvas} width="96" height="28" aria-hidden="true" />;
}

function ChannelCard({ ch }: { ch: ChannelIndex }) {
  const info = CHANNELS[ch];
  const track = useStudio((s) => s.song.tracks[ch]);
  const active = useStudio((s) => s.editor.channel === ch);

  return (
    <div
      className={clsx(
        styles.card,
        styles[`c${ch}`],
        active && styles.active,
        track.mute && styles.quiet,
      )}
    >
      <button
        type="button"
        className={styles.pick}
        role="radio"
        aria-checked={active}
        aria-label={`${info.name}: ${info.role}`}
        onClick={() =>
          updateEditor((editor) => {
            editor.channel = ch;
          })
        }
      >
        <span className={styles.tab} aria-hidden="true">
          <svg viewBox="0 0 16 8">
            <path d={ICONS[info.kind]} />
          </svg>
        </span>
        <span className={styles.names}>
          <span className={styles.name}>{info.name}</span>
          <span className={styles.role}>
            {info.role} · {presetName(info.kind, track.inst.preset)}
          </span>
        </span>
        <kbd aria-hidden="true">{ch + 1}</kbd>
      </button>
      <div className={styles.controls}>
        <Scope ch={ch} />
        <button
          type="button"
          className={clsx(styles.toggle, track.mute && styles.on)}
          aria-pressed={track.mute}
          aria-label={`Mute ${info.name}`}
          title="Mute"
          onClick={() =>
            mix((song) => {
              song.tracks[ch].mute = !song.tracks[ch].mute;
            })
          }
        >
          M
        </button>
        <button
          type="button"
          className={clsx(styles.toggle, styles.solo, track.solo && styles.on)}
          aria-pressed={track.solo}
          aria-label={`Solo ${info.name}`}
          title="Solo"
          onClick={() =>
            mix((song) => {
              song.tracks[ch].solo = !song.tracks[ch].solo;
            })
          }
        >
          S
        </button>
        <div className={styles.pan} role="group" aria-label={`${info.name} panning`}>
          {(["L", "C", "R"] as Pan[]).map((pan) => (
            <button
              key={pan}
              type="button"
              className={clsx(track.pan === pan && styles.on)}
              aria-pressed={track.pan === pan}
              aria-label={PANS[pan]}
              onClick={() =>
                mix((song) => {
                  song.tracks[ch].pan = pan;
                })
              }
            >
              {pan}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChannelRack() {
  return (
    <div className={styles.rack} role="radiogroup" aria-label="Channels">
      {([0, 1, 2, 3] as const).map((ch) => (
        <ChannelCard key={ch} ch={ch} />
      ))}
    </div>
  );
}
