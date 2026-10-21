// "My sounds": sound sheets saved from the studio, for one gallery (SFX or creature voices).
import clsx from "clsx";
import type { SavedSound } from "../model/library.ts";
import { forgetSound, useMySounds } from "../state/sounds.ts";
import styles from "./MySounds.module.css";

export function MySounds(props: {
  kind: "sfx" | "voice";
  selected: string | null;
  onPick: (entry: SavedSound) => void;
}) {
  const all = useMySounds((s) => s.sounds);
  const list = all.filter((s) => s.kind === props.kind);
  return (
    <section className={styles.mine} aria-labelledby={`mine-${props.kind}`}>
      <h2 id={`mine-${props.kind}`}>{props.kind === "sfx" ? "My sounds" : "My voices"}</h2>
      {list.length === 0 ? (
        <p className={styles.empty}>
          Open a sound in the studio, change it on the note grid, then press “Save to My sounds”
          there. It comes back here.
        </p>
      ) : (
        <ul>
          {list.map((entry) => (
            <li key={entry.id} className={clsx(props.selected === entry.id && styles.on)}>
              <button
                type="button"
                className={styles.pick}
                aria-pressed={props.selected === entry.id}
                onClick={() => props.onPick(entry)}
              >
                {entry.name}
              </button>
              <button
                type="button"
                className={styles.x}
                aria-label={`Delete ${entry.name}`}
                onClick={() => forgetSound(entry.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
