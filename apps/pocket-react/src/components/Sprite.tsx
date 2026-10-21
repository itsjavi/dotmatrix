// A 12×12 creature sprite in the screen's four shades.
import clsx from "clsx";
import styles from "./Sprite.module.css";

export function Sprite(props: { rows: readonly string[]; label: string; className?: string }) {
  const pixels = props.rows.flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === "." ? [] : [{ x, y, shade: c }])),
  );
  return (
    <svg
      className={clsx(styles.sprite, props.className)}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      role="img"
      aria-label={props.label}
    >
      {pixels.map((p) => (
        <rect
          key={`${p.x},${p.y}`}
          x={p.x}
          y={p.y}
          width="1"
          height="1"
          className={styles[`s${p.shade}`]}
        />
      ))}
    </svg>
  );
}
