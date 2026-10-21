// The keyboard shortcuts sheet, opened with "?".
import { useEffect, useRef } from "react";
import { setShortcutsOpen, useStudio } from "../state/studio.ts";
import styles from "./Shortcuts.module.css";

const ROWS: [string, string][] = [
  ["Space", "Play or stop"],
  ["Ctrl/⌘ Z", "Undo"],
  ["Ctrl/⌘ Shift Z, Ctrl Y", "Redo"],
  ["1 – 4", "Pick a channel"],
  ["L", "Loop on or off"],
  ["Esc", "Stop"],
  ["Arrows", "Move the grid cursor (when the grid has focus)"],
  ["Enter", "Add or remove a note at the cursor"],
  ["Shift ← →", "Shorten or lengthen the note at the cursor"],
  ["Delete", "Remove the note at the cursor"],
  ["?", "Show or hide this sheet"],
];

export function Shortcuts() {
  const open = useStudio((s) => s.shortcutsOpen);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.sheet}
      aria-labelledby="shortcuts-title"
      onClose={() => setShortcutsOpen(false)}
    >
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
      <dl>
        {ROWS.map(([keys, what]) => (
          <div key={keys} className={styles.row}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="btn primary" onClick={() => setShortcutsOpen(false)}>
        Got it
      </button>
    </dialog>
  );
}
