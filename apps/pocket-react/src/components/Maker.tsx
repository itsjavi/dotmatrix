// The maker panel shared by the SFX and Creatures pages: title, play button, waveform, sliders,
// actions and the driver-code view.
import clsx from "clsx";
import { useState, type ReactNode } from "react";
import type { SoundSheet } from "../model/types.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import styles from "./Maker.module.css";
import { Waveform } from "./Waveform.tsx";

export interface Slider {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  enabled?: boolean;
  onChange: (value: number) => void;
}

export interface Action {
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}

export function Maker(props: {
  title: string;
  blurb: string;
  caption: string;
  pcm: Float32Array | null;
  onFire: () => void;
  sliders: Slider[];
  actions: Action[];
  /** Shown above the sliders, e.g. why they are off. */
  notice?: string;
  code: string | null;
  codeNote: string;
  /** Which shelf code saved from the code view goes to. */
  kind: SoundSheet["kind"];
  /** Code from the code view was played: show its waveform. */
  onPcm: (pcm: Float32Array) => void;
  /** The saved sound on show (its code is editable), or undefined for a built-in one. */
  customId?: string;
  /** Copies the built-in sound into My sounds / My voices. */
  onCopy: () => void;
  /** Code from the code view was saved over this My sounds id. */
  onSaved: (id: string) => void;
  children?: ReactNode;
}) {
  const [showCode, setShowCode] = useState(false);
  return (
    <section className={clsx("panel", styles.maker)} aria-labelledby="maker-title">
      <div className={styles.head}>
        {props.children}
        <div className={styles.titles}>
          <h2 id="maker-title">{props.title}</h2>
          <p className={styles.blurb}>{props.blurb}</p>
        </div>
        <button
          type="button"
          className={styles.fire}
          aria-label={`Play ${props.title}`}
          onClick={props.onFire}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M3 1.5v7l5.5-3.5z" />
          </svg>
        </button>
      </div>
      <Waveform pcm={props.pcm} label={`Waveform of ${props.title}`} caption={props.caption} />
      {props.notice ? (
        <p className={styles.notice} role="note">
          {props.notice}
        </p>
      ) : null}
      <div className={styles.sliders}>
        {props.sliders.map((s) => (
          <label key={s.label} className={clsx(styles.field, s.enabled === false && styles.off)}>
            <span className="label">{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.value}
              disabled={s.enabled === false}
              onChange={(event) => s.onChange(event.currentTarget.valueAsNumber)}
            />
            <output>{s.shown}</output>
          </label>
        ))}
      </div>
      <div className={styles.actions}>
        {props.actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={clsx("btn", a.primary && "primary")}
            disabled={a.disabled}
            title={a.title}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          aria-expanded={showCode}
          onClick={() => setShowCode(!showCode)}
        >
          {showCode ? "Hide code" : "Show code"}
        </button>
      </div>
      {showCode ? (
        <CodeEditor
          code={props.code}
          note={props.codeNote}
          kind={props.kind}
          title={props.title}
          onPcm={props.onPcm}
          customId={props.customId}
          onCopy={props.onCopy}
          onSaved={props.onSaved}
        />
      ) : null}
    </section>
  );
}
