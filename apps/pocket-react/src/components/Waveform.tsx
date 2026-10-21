// A sound's waveform on a small dot-matrix screen; redrawn when the sound or the palette changes.
import { useEffect, useRef } from "react";
import { useStudio } from "../state/studio.ts";
import styles from "./Waveform.module.css";

function draw(c: HTMLCanvasElement, data: Float32Array | null) {
  const g = c.getContext("2d")!;
  const style = getComputedStyle(c);
  const { width: w, height: h } = c;
  g.fillStyle = style.getPropertyValue("--l0");
  g.fillRect(0, 0, w, h);
  g.fillStyle = style.getPropertyValue("--l1");
  for (let x = 0; x < w; x += 4) for (let y = 0; y < h; y += 4) g.fillRect(x, y, 1, 1);
  if (!data || data.length === 0) return;
  g.fillStyle = style.getPropertyValue("--l3");
  const per = Math.max(1, Math.floor(data.length / (w / 2)));
  for (let x = 0; x < w; x += 2) {
    let peak = 0;
    const from = Math.floor((x / w) * data.length);
    for (let i = from; i < from + per && i < data.length; i++)
      peak = Math.max(peak, Math.abs(data[i]!));
    const half = Math.max(1, Math.round(peak * h * 1.8));
    for (let y = h / 2 - half; y < h / 2 + half; y += 2) g.fillRect(x, Math.round(y), 2, 1.5);
  }
}

export function Waveform(props: { pcm: Float32Array | null; label: string; caption?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const lcd = useStudio((s) => s.prefs.lcd);
  const theme = useStudio((s) => s.prefs.theme);
  const { pcm } = props;

  useEffect(() => {
    // After the palette's custom properties apply (the theme effect runs in the layout).
    const frame = requestAnimationFrame(() => canvas.current && draw(canvas.current, pcm));
    return () => cancelAnimationFrame(frame);
    // The palette (lcd, theme) is read from computed styles: a change redraws.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [pcm, lcd, theme]);

  return (
    <div className={styles.wave}>
      <canvas ref={canvas} width="560" height="96" aria-label={props.label} role="img" />
      {props.caption ? <span className={styles.dur}>{props.caption}</span> : null}
    </div>
  );
}
