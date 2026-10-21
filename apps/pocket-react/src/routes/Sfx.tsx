// SFX gallery and maker: original sound effects as pads; pick one, bend it with a few sliders, see
// its waveform and the driver code it becomes, save it as a WAV file, or open it in the studio to
// edit it note by note. Sounds saved from the studio come back under "My sounds".
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { FPS, sfxData, sfxFrames, songSeconds } from "../audio/driver.ts";
import { playPcm } from "../audio/player.ts";
import { Maker, type Slider } from "../components/Maker.tsx";
import { MySounds } from "../components/MySounds.tsx";
import { DUTY_NAMES } from "../model/instruments.ts";
import type { SavedSound } from "../model/library.ts";
import { NO_MODS, SFX, applyMods, listing, sfxById, type SfxMods } from "../model/sfx.ts";
import { sfxToSheet, sheetToSfx } from "../model/sheet.ts";
import { useSpaceAction } from "../state/keys.ts";
import {
  keepSound,
  openInStudio,
  openInStudioSheet,
  renderSound,
  saveWav,
  sheetData,
  useMySounds,
} from "../state/sounds.ts";
import { say } from "../state/studio.ts";
import styles from "./Sfx.module.css";

const ms = (frames: number) => `${Math.round((frames / FPS) * 1000)} ms`;
const rand = (lo: number, hi: number) => lo + Math.round(Math.random() * (hi - lo));
const signedLabel = (n: number, up: string, down: string) =>
  n === 0 ? "Preset" : n > 0 ? `${up} ${n}` : `${down} ${-n}`;

type Choice = { custom: boolean; id: string };

/** The sound on show: a preset or a saved sound, with the sliders applied when the maker can. */
function soundOf(choice: Choice, mods: SfxMods, mine: SavedSound[]) {
  const entry = choice.custom ? mine.find((s) => s.id === choice.id) : undefined;
  const base = !choice.custom
    ? { sfx: sfxById(choice.id)! }
    : entry
      ? sheetToSfx(entry.song, entry.id)
      : { reasons: ["it was deleted"] };
  const current = "sfx" in base ? applyMods(base.sfx, mods) : null;
  const data = current ? sfxData(current) : entry ? sheetData(entry.song) : null;
  return { entry, base, current, data };
}

export function Component() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mine = useMySounds((s) => s.sounds);
  const [selected, setSelected] = useState<Choice>(() => {
    const id = params.get("sound");
    return id && mine.some((s) => s.id === id)
      ? { custom: true, id }
      : { custom: false, id: SFX[0]!.id };
  });
  const [mods, setMods] = useState<SfxMods>(NO_MODS);
  const [pcm, setPcm] = useState<Float32Array | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { entry, base, current, data } = soundOf(selected, mods, mine);
  const title = current?.name ?? entry?.name ?? "Sound";
  const sheet = current ? sfxToSheet(current, "sfx") : null;
  const editable = current !== null;
  const has = (test: (channel: number) => boolean) =>
    current !== null && current.voices.some((v) => test(v.channel));

  /** Renders a sound for its waveform and, unless `play` is false, plays it. */
  async function fire(sound = data, play = true) {
    if (!sound) return;
    try {
      const rendered = await renderSound(sound);
      setPcm(rendered);
      if (play) await playPcm(rendered);
    } catch (error) {
      say(`Audio failed: ${String(error)}`);
    }
  }

  // Handlers compute the next sound themselves: state set here only shows on the next render.
  function pick(next: Choice) {
    setSelected(next);
    setMods(NO_MODS);
    void fire(soundOf(next, NO_MODS, useMySounds.getState().sounds).data);
  }

  function remix(next: SfxMods, delay = 0) {
    setMods(next);
    clearTimeout(timer.current);
    const sound = soundOf(selected, next, mine).data;
    timer.current = setTimeout(() => void fire(sound), delay);
  }

  function surprise() {
    remix({
      pitch: rand(-7, 7),
      length: [0.6, 0.8, 1, 1.25, 1.5][rand(0, 4)]!,
      sweep: rand(-1, 1) === 0 ? 0 : rand(-6, 6),
      duty: rand(-1, 3),
      tone: rand(-2, 2),
      volume: 1,
    });
  }

  /** Copies the shown built-in sound (with the sliders applied) into My sounds. */
  function copyToMine() {
    if (!current) return;
    const copy = sfxToSheet({ ...current, name: `${current.name} copy` }, "sfx");
    if ("reasons" in copy) return say(`Cannot copy: ${copy.reasons.join(", ")}`);
    const id = keepSound(copy.song);
    if (id) pick({ custom: true, id });
  }

  function openStudio() {
    if (current) {
      if (!openInStudio(current, "sfx")) return;
    } else if (entry) openInStudioSheet(entry.song, `Open ${entry.name} in the studio`);
    void navigate("/");
  }

  useSpaceAction(() => void fire());
  useEffect(() => () => clearTimeout(timer.current), [timer]);

  // The first sound's waveform shows without playing it (audio starts on a click or key press).
  const [first] = useState(data);
  useEffect(() => {
    let stale = false;
    if (first) void renderSound(first).then((rendered) => stale || setPcm(rendered));
    return () => {
      stale = true;
    };
  }, [first]);

  const tweak = (field: keyof SfxMods) => (value: number) =>
    remix({ ...mods, [field]: value }, 140);
  const sliders: Slider[] = [
    {
      label: "Pitch",
      value: mods.pitch,
      min: -12,
      max: 12,
      step: 1,
      shown: mods.pitch > 0 ? `+${mods.pitch}` : String(mods.pitch),
      enabled: has((c) => c !== 3),
      onChange: tweak("pitch"),
    },
    {
      label: "Length",
      value: mods.length,
      min: 0.5,
      max: 2,
      step: 0.05,
      shown: `${Math.round(mods.length * 100)}%`,
      enabled: editable,
      onChange: tweak("length"),
    },
    {
      label: "Sweep",
      value: mods.sweep,
      min: -7,
      max: 7,
      step: 1,
      shown: signedLabel(mods.sweep, "Up", "Down"),
      enabled: has((c) => c === 0),
      onChange: tweak("sweep"),
    },
    {
      label: "Duty",
      value: mods.duty,
      min: -1,
      max: 3,
      step: 1,
      shown: mods.duty < 0 ? "Preset" : DUTY_NAMES[mods.duty]!,
      enabled: has((c) => c !== 3),
      onChange: tweak("duty"),
    },
    {
      label: "Noise tone",
      value: mods.tone,
      min: -3,
      max: 3,
      step: 1,
      shown: signedLabel(mods.tone, "Bright", "Dark"),
      enabled: has((c) => c === 3),
      onChange: tweak("tone"),
    },
    {
      label: "Volume",
      value: mods.volume,
      min: 0.25,
      max: 1,
      step: 0.05,
      shown: `${Math.round(mods.volume * 100)}%`,
      enabled: editable,
      onChange: tweak("volume"),
    },
  ];

  const studioLimit =
    sheet && "reasons" in sheet ? `Cannot open in the studio: ${sheet.reasons.join(", ")}` : "";

  return (
    <div className={styles.sfx}>
      <header className={styles.intro}>
        <h1>Sound effects</h1>
        <p>
          Each sound is a few square or noise notes, a handful of frames long, exactly how handheld
          RPGs wrote them. Tap a pad, bend it, or open it in the studio to change it note by note.
        </p>
      </header>
      <div className={styles.layout}>
        <div className={styles.side}>
          <ul className={styles.pads} aria-label="Sound effects">
            {SFX.map((sfx) => (
              <li key={sfx.id}>
                <button
                  type="button"
                  className={styles.pad}
                  aria-pressed={!selected.custom && selected.id === sfx.id}
                  onClick={() => pick({ custom: false, id: sfx.id })}
                >
                  <span className={styles.name}>{sfx.name}</span>
                  <span className={styles.len}>{ms(sfxFrames(sfx))}</span>
                </button>
              </li>
            ))}
          </ul>
          <MySounds
            kind="sfx"
            selected={selected.custom ? selected.id : null}
            onPick={(saved) => pick({ custom: true, id: saved.id })}
          />
        </div>
        <Maker
          title={title}
          blurb={current?.blurb ?? "Your own sound, made in the studio."}
          caption={
            current
              ? ms(sfxFrames(current))
              : entry
                ? `${Math.round(songSeconds(entry.song) * 1000)} ms`
                : ""
          }
          pcm={pcm}
          onFire={() => void fire()}
          sliders={sliders}
          notice={
            "reasons" in base
              ? `The sliders are off for this sound because ${base.reasons.join(", ")}. It still plays, exports and opens in the studio.`
              : undefined
          }
          code={current ? listing(current) : null}
          kind="sfx"
          onPcm={setPcm}
          customId={selected.custom ? selected.id : undefined}
          onCopy={copyToMine}
          onSaved={(id) => pick({ custom: true, id })}
          codeNote="The same sound as sound-driver macros: square_note frames, volume, fade, frequency. Fade 1–7 fades out (1 fastest), 9–15 fades in (9 fastest)."
          actions={[
            { label: "Surprise me", onClick: surprise, disabled: !editable },
            { label: "Reset", onClick: () => remix(NO_MODS), disabled: !editable },
            {
              label: "Open in studio",
              onClick: openStudio,
              disabled: studioLimit !== "",
              title: studioLimit || "Edit this sound on the studio's note grid",
            },
            {
              label: "Export WAV",
              primary: true,
              onClick: () =>
                void (async () => {
                  const rendered = pcm ?? (data ? await renderSound(data) : null);
                  if (rendered) await saveWav(rendered, title);
                })(),
            },
          ]}
        />
      </div>
    </div>
  );
}
