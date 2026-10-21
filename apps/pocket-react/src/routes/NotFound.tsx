// Unknown URLs.
import clsx from "clsx";
import { Link } from "react-router";
import styles from "./NotFound.module.css";

export function Component() {
  return (
    <section className={clsx("panel", styles.lost)}>
      <h1>404 · No cartridge here</h1>
      <p>This page does not exist. The studio is a click away.</p>
      <Link className="btn primary" to="/">
        Back to the studio
      </Link>
    </section>
  );
}
