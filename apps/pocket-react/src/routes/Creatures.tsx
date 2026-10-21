// Creature voices: twenty original creatures, each on its own base voice with its own pitch
// and length, the way handheld RPGs gave every creature a cry. Pick one, change its base voice,
// pitch and length (or roll a new creature), export it, or open it in the studio.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { FPS, sfxData, sfxFrames, songSeconds } from "../audio/driver.ts";
import { playPcm } from "../audio/player.ts";
import { Maker, type Slider } from "../components/Maker.tsx";
import { MySounds } from "../components/MySounds.tsx";
import { Sprite } from "../components/Sprite.tsx";
import {
  BASES,
  CREATURES,
  baseById,
  creatureById,
  cryHeader,
  voiceSfx,
} from "../model/creatures.ts";
import type { SavedSound } from "../model/library.ts";
import { listing } from "../model/sfx.ts";
import { sfxToSheet, sheetToSfx } from "../model/sheet.ts";
import type { Sfx } from "../model/types.ts";
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
import styles from "./Creatures.module.css";

const ms = (frames: number) => `${Math.round((frames / FPS) * 1000)} ms`;
const rand = (lo: number, hi: number) => lo + Math.round(Math.random() * (hi - lo));
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** A sprite for creatures rolled with "Surprise me": a blob with eyes. */
const MYSTERY = [
  "............",
  "....cccc....",
  "..ccaaaacc..",
  ".caaaaaaaac.",
  ".caccaaccac.",
  ".caaaaaaaac.",
  ".caaabbaaac.",
  ".caaaaaaaac.",
  "..caaaaaac..",
  "...cccccc...",
  "..cc....cc..",
  "............",
];

type Picked = { custom: boolean; id: string };
type Voice = { base: string; pitch: number; length: number };

const FIRST = CREATURES[0]!;

/**
 * The voice on show. Changing a creature's voice makes a remix of it (it keeps its sprite); a saved
 * voice plays as it was saved (the base, pitch and length sliders apply to creatures).
 */
function voiceOf(picked: Picked, voice: Voice, mine: SavedSound[]) {
  const creature = picked.custom ? undefined : creatureById(picked.id);
  const entry = picked.custom ? mine.find((s) => s.id === picked.id) : undefined;
  const remixed =
    !!creature &&
    (creature.base !== voice.base ||
      creature.pitch !== voice.pitch ||
      creature.length !== voice.length);
  const name = creature
    ? remixed
      ? `${creature.name} (remix)`
      : creature.name
    : (entry?.name ?? "Mystery creature");
  const saved = entry ? sheetToSfx(entry.song, entry.id) : undefined;
  const current: Sfx | null = entry
    ? saved && "sfx" in saved
      ? saved.sfx
      : null
    : {
        ...voiceSfx(baseById(voice.base), voice.pitch, voice.length, name),
        id: creature?.id ?? "mystery",
      };
  const data = current ? sfxData(current) : entry ? sheetData(entry.song) : null;
  return { creature, entry, name, saved, current, data };
}

export function Component() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mine = useMySounds((s) => s.sounds);
  const [picked, setPicked] = useState<Picked>(() => {
    const id = params.get("sound");
    return id && mine.some((s) => s.id === id)
      ? { custom: true, id }
      : { custom: false, id: FIRST.id };
  });
  const [voice, setVoice] = useState<Voice>({
    base: FIRST.base,
    pitch: FIRST.pitch,
    length: FIRST.length,
  });
  const [pcm, setPcm] = useState<Float32Array | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { creature, entry, name, saved, current, data } = voiceOf(picked, voice, mine);

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
  function show(nextPicked: Picked, nextVoice = voice, play = true) {
    setPicked(nextPicked);
    setVoice(nextVoice);
    void fire(voiceOf(nextPicked, nextVoice, useMySounds.getState().sounds).data, play);
  }

  function choose(id: string) {
    const c = creatureById(id)!;
    show({ custom: false, id }, { base: c.base, pitch: c.pitch, length: c.length });
  }

  function change(next: Partial<Voice>, delay = 140) {
    // A remix keeps the creature it started from.
    const nextPicked = picked.custom ? { custom: false, id: "mystery" } : picked;
    const nextVoice = { ...voice, ...next };
    setPicked(nextPicked);
    setVoice(nextVoice);
    clearTimeout(timer.current);
    const sound = voiceOf(nextPicked, nextVoice, mine).data;
    timer.current = setTimeout(() => void fire(sound), delay);
  }

  function surprise() {
    show(
      { custom: false, id: "mystery" },
      {
        base: BASES[rand(0, BASES.length - 1)]!.id,
        pitch: rand(-12, 12) * 16,
        length: [0.6, 0.8, 1, 1.2, 1.5, 1.8][rand(0, 5)]!,
      },
    );
  }

  function copyToMine() {
    if (!current) return;
    const sheet = sfxToSheet({ ...current, name: `${name} copy` }, "voice");
    if ("reasons" in sheet) return say(`Cannot copy: ${sheet.reasons.join(", ")}`);
    const id = keepSound(sheet.song);
    if (id) show({ custom: true, id }, voice, false);
  }

  function openStudio() {
    if (current) {
      if (!openInStudio(current, "voice")) return;
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

  const tunable = !picked.custom;
  const sliders: Slider[] = [
    {
      label: "Pitch",
      value: voice.pitch,
      min: -256,
      max: 256,
      step: 8,
      shown: signed(voice.pitch),
      enabled: tunable,
      onChange: (v) => change({ pitch: v }),
    },
    {
      label: "Length",
      value: voice.length,
      min: 0.5,
      max: 2,
      step: 0.05,
      shown: `${Math.round(voice.length * 100)}%`,
      enabled: tunable,
      onChange: (v) => change({ length: v }),
    },
  ];

  const studioSheet = current ? sfxToSheet(current, "voice") : null;
  const studioLimit =
    studioSheet && "reasons" in studioSheet
      ? `Cannot open in the studio: ${studioSheet.reasons.join(", ")}`
      : "";
  const notice = picked.custom
    ? `Your voice from the studio: it plays as you saved it, so the base voice, pitch and length are off.${
        saved && "reasons" in saved
          ? ` Some of it only the studio can play (${saved.reasons.join(", ")}).`
          : ""
      }`
    : undefined;

  return (
    <div className={styles.creatures}>
      <header className={styles.intro}>
        <h1>Creature voices</h1>
        <p>
          A cry is one short gesture: square notes that glide in tiny frequency steps, duty patterns
          that rasp every frame, fading envelopes and a layer of noise. Games reused base voices
          with a new pitch and length for each creature. These {CREATURES.length} are all originals,
          each on its own base voice: meet them, then remix them.
        </p>
      </header>
      <div className={styles.layout}>
        <div className={styles.side}>
          <ul className={styles.roster} aria-label="Creatures">
            {CREATURES.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={styles.critter}
                  aria-pressed={!picked.custom && picked.id === c.id}
                  onClick={() => choose(c.id)}
                >
                  <span className={styles.frame}>
                    <Sprite rows={c.sprite} label="" className={styles.mini} />
                  </span>
                  <span className={styles.name}>{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <section className={styles.bases} aria-labelledby="bases-title">
            <h2 id="bases-title">Base voice</h2>
            <div className={styles.chips} role="radiogroup" aria-label="Base voice">
              {BASES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={!picked.custom && voice.base === b.id}
                  onClick={() => change({ base: b.id }, 0)}
                >
                  <span className={styles.bname}>{b.name}</span>
                  <span className={styles.bhint}>{b.hint}</span>
                </button>
              ))}
            </div>
          </section>
          <MySounds
            kind="voice"
            selected={picked.custom ? picked.id : null}
            onPick={(sound) => show({ custom: true, id: sound.id })}
          />
        </div>
        <Maker
          title={name}
          blurb={
            creature?.blurb ??
            (picked.custom
              ? "Your own voice, made in the studio."
              : "A creature nobody has met yet.")
          }
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
          notice={notice}
          code={
            current && !picked.custom
              ? `${cryHeader(baseById(voice.base), voice.pitch, voice.length)}\n${listing(current)}`
              : current
                ? listing(current)
                : null
          }
          kind="voice"
          onPcm={setPcm}
          customId={picked.custom ? picked.id : undefined}
          onCopy={copyToMine}
          onSaved={(id) => show({ custom: true, id }, voice, false)}
          codeNote="A cry is a base voice plus two numbers: pitch is added to every square note's frequency register, and length scales the square notes like a tempo ($0100 is as written). Noise keeps its own timing."
          actions={[
            { label: "Surprise me", onClick: surprise },
            {
              label: "Open in studio",
              onClick: openStudio,
              disabled: studioLimit !== "",
              title: studioLimit || "Edit this voice on the studio's note grid",
            },
            {
              label: "Export WAV",
              primary: true,
              onClick: () =>
                void (async () => {
                  const rendered = pcm ?? (data ? await renderSound(data) : null);
                  if (rendered) await saveWav(rendered, name);
                })(),
            },
          ]}
        >
          <span className={styles.portrait}>
            <Sprite rows={creature?.sprite ?? MYSTERY} label={name} className={styles.big} />
          </span>
        </Maker>
      </div>
    </div>
  );
}
