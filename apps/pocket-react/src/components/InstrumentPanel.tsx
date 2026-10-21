// The sound of the selected channel: friendly presets first, then a "Fine-tune" drawer with the
// Game Boy's own controls (duty cycle, envelope, vibrato, glide, arpeggio, wave shape).
import clsx from "clsx";
import { WAVES } from "../audio/tables.ts";
import { DUTY_NAMES, PRESETS, instrument } from "../model/instruments.ts";
import { CHANNELS, type ArpId, type Instrument, type WaveShape } from "../model/types.ts";
import { edit, useStudio } from "../state/studio.ts";
import { audition } from "./PianoRoll.tsx";
import styles from "./InstrumentPanel.module.css";

const ARPS: { id: ArpId; name: string }[] = [
  { id: "off", name: "Off" },
  { id: "major", name: "Major" },
  { id: "minor", name: "Minor" },
  { id: "fifth", name: "Fifth" },
  { id: "octave", name: "Octave" },
];

const GATES = ["Legato", "Normal", "Short"] as const;

/** A tiny SVG of one duty cycle period. */
function dutyPath(duty: number): string {
  const high = [2, 4, 8, 12][duty]!;
  return `M0 14H2V2H${2 + high}V14H18`;
}

function wavePath(shape: WaveShape): string {
  return WAVES[shape].samples.map((s, i) => `${i === 0 ? "M" : "L"}${i * 0.6} ${15 - s}`).join("");
}

function envLabel(env: number): string {
  if (env === 0) return "Hold";
  return env > 0 ? `Fade ${env}` : `Swell ${-env}`;
}

function toneLabel(tone: number): string {
  if (tone === 0) return "Normal";
  return tone > 0 ? `Bright ${tone}` : `Dark ${-tone}`;
}

const waveLevel = (volume: number) =>
  ["Mute", "100%", "50%", "25%"][volume >= 12 ? 1 : volume >= 6 ? 2 : volume >= 1 ? 3 : 0]!;

function Range(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  shown?: string;
}) {
  return (
    <label className={styles.field}>
      <span className="label">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.valueAsNumber)}
      />
      <output>{props.shown ?? String(props.value)}</output>
    </label>
  );
}

export function InstrumentPanel() {
  const ch = useStudio((s) => s.editor.channel);
  const inst = useStudio((s) => s.song.tracks[s.editor.channel].inst);
  const sheet = useStudio((s) => !!s.song.sheet);
  const kind = CHANNELS[ch].kind;
  const rawNoise = kind === "noise" && sheet;

  function set<K extends keyof Instrument>(field: K, value: Instrument[K], label: string) {
    edit(
      label,
      (song) => {
        song.tracks[ch].inst[field] = value;
      },
      `inst:${ch}:${String(field)}`,
    );
  }

  function setVibrato(field: "delay" | "depth" | "rate", value: number) {
    edit(
      "Change vibrato",
      (song) => {
        song.tracks[ch].inst.vibrato[field] = value;
      },
      `inst:${ch}:vib:${field}`,
    );
  }

  function pick(id: string) {
    const next = instrument(kind, id);
    edit(`Preset: ${PRESETS[kind].find((p) => p.id === id)?.name ?? id}`, (song) => {
      song.tracks[ch].inst = next;
    });
    audition(ch, kind === "noise" ? 6 : kind === "wave" ? 45 : 72, 4);
  }

  return (
    <section className={clsx("panel", styles.sound)} aria-labelledby="sound-title">
      <header className={styles.head}>
        <h2 id="sound-title">
          Sound <span className={styles.for}>· {CHANNELS[ch].name}</span>
        </h2>
        <p className={styles.hint}>
          {rawNoise
            ? "On a sound sheet each noise row is a raw noise setting. Volume and envelope below are for new notes."
            : sheet
              ? "Notes with a notch keep their own settings from the sound; new notes use this sound."
              : "Pick a preset, then press a note to hear it."}
        </p>
      </header>
      <div
        className={clsx(styles.presets, rawNoise && styles.hidden)}
        role="radiogroup"
        aria-label="Presets"
      >
        {PRESETS[kind].map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            className={styles.preset}
            aria-checked={inst.preset === p.id}
            onClick={() => pick(p.id)}
          >
            <span className={styles.pname}>{p.name}</span>
            <span className={styles.phint}>{p.hint}</span>
          </button>
        ))}
      </div>
      <details className={styles.fine}>
        <summary>Fine-tune</summary>
        <div className={styles.grid}>
          {kind === "pulse" ? (
            <div className={clsx(styles.field, styles.wide)}>
              <span className="label">Duty cycle</span>
              <div className={styles.seg} role="radiogroup" aria-label="Duty cycle">
                {[0, 1, 2, 3].map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={inst.duty === d}
                    aria-label={DUTY_NAMES[d]}
                    onClick={() => set("duty", d, "Change duty cycle")}
                  >
                    <svg viewBox="0 0 18 16" aria-hidden="true">
                      <path d={dutyPath(d)} />
                    </svg>
                    {DUTY_NAMES[d]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {kind === "wave" ? (
            <div className={clsx(styles.field, styles.wide)}>
              <span className="label">Wave shape</span>
              <div className={styles.seg} role="radiogroup" aria-label="Wave shape">
                {(Object.keys(WAVES) as WaveShape[]).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    role="radio"
                    aria-checked={inst.shape === shape}
                    aria-label={WAVES[shape].name}
                    title={WAVES[shape].name}
                    onClick={() => set("shape", shape, "Change wave shape")}
                  >
                    <svg viewBox="-1 -1 21 18" aria-hidden="true">
                      <path d={wavePath(shape)} />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Range
            label="Volume"
            value={inst.volume}
            min={0}
            max={15}
            onChange={(v) => set("volume", v, "Change volume")}
            shown={kind === "wave" ? waveLevel(inst.volume) : undefined}
          />
          {kind === "noise" && !rawNoise ? (
            <Range
              label="Drum tone"
              value={inst.tone}
              min={-3}
              max={3}
              onChange={(v) => set("tone", v, "Change drum tone")}
              shown={toneLabel(inst.tone)}
            />
          ) : (
            <Range
              label="Envelope"
              value={inst.env}
              min={-7}
              max={7}
              onChange={(v) => set("env", v, "Change envelope")}
              shown={envLabel(inst.env)}
            />
          )}
          {kind !== "noise" ? (
            <>
              <Range
                label="Vibrato depth"
                value={inst.vibrato.depth}
                min={0}
                max={8}
                onChange={(v) => setVibrato("depth", v)}
              />
              <Range
                label="Vibrato delay"
                value={inst.vibrato.delay}
                min={0}
                max={40}
                onChange={(v) => setVibrato("delay", v)}
                shown={`${inst.vibrato.delay} frames`}
              />
              <Range
                label="Vibrato speed"
                value={9 - inst.vibrato.rate}
                min={1}
                max={8}
                onChange={(v) => setVibrato("rate", 9 - v)}
              />
              <Range
                label="Glide"
                value={inst.glide}
                min={0}
                max={16}
                onChange={(v) => set("glide", v, "Change glide")}
                shown={inst.glide === 0 ? "Off" : `${inst.glide} frames`}
              />
              <label className={styles.field}>
                <span className="label">Arpeggio</span>
                <select
                  value={inst.arp}
                  onChange={(event) =>
                    set("arp", event.currentTarget.value as ArpId, "Change arpeggio")
                  }
                >
                  {ARPS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.field}>
                <span className="label">Note length</span>
                <div
                  className={clsx(styles.seg, styles.small)}
                  role="radiogroup"
                  aria-label="Note length feel"
                >
                  {GATES.map((name, g) => (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={inst.gate === g}
                      onClick={() =>
                        set("gate", g as Instrument["gate"], "Change note length feel")
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              {kind === "pulse" ? (
                <label className={clsx(styles.field, styles.check)}>
                  <input
                    type="checkbox"
                    checked={inst.shimmer}
                    onChange={(event) =>
                      set("shimmer", event.currentTarget.checked, "Toggle shimmer")
                    }
                  />
                  <span>Shimmer (duty cycle pattern)</span>
                </label>
              ) : null}
            </>
          ) : null}
        </div>
      </details>
    </section>
  );
}
