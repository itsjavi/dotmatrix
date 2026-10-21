// The composing guide (docs/composing.md), compiled to a component by MDX at build time.
import clsx from "clsx";
import { Link } from "react-router";
import Guide from "../../docs/composing.md";
import styles from "./Composing.module.css";

export function Component() {
  return (
    <div className={styles.composing}>
      <Link className={styles.back} to="/learn">
        ← Learn
      </Link>
      <article className={clsx("panel", styles.guide)}>
        <Guide />
      </article>
    </div>
  );
}
