// The Studio's Code view, on the screen in place of the grid: the open song (or sound sheet) as
// driver code. Edit it, paste or import code, then Apply: it replaces the song as one undoable
// step. Errors are listed by line; click one to select the line.
import { useRef, useState, type ChangeEvent } from "react";
import { copyCode, exportCode } from "../files.ts";
import type { CodeError } from "../model/code.ts";
import { readStudioCode, studioCode } from "../model/studiocode.ts";
import { currentSong, openSong, say, useStudio } from "../state/studio.ts";
import { CodeErrors, selectLine } from "./CodeErrors.tsx";
import styles from "./StudioCode.module.css";

export function StudioCode() {
  const song = useStudio((s) => s.song);
  const code = studioCode(song);
  const reasons = "reasons" in code ? code.reasons : null;
  /** The edited code; null while the view follows the song (undo, grid edits elsewhere). */
  const [draft, setDraft] = useState<string | null>(null);
  const [errors, setErrors] = useState<CodeError[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const text = draft ?? ("text" in code ? code.text : "");
  const dirty = draft !== null;

  /** Reads the code (a fresh import names a new sheet after its file) and opens the result. */
  function apply(source: string, fromFile?: string) {
    const result = readStudioCode(
      source,
      currentSong(),
      fromFile ? { name: fromFile, fresh: true } : {},
    );
    if ("errors" in result) {
      setDraft(source);
      setErrors(result.errors);
      say(
        `The code has ${result.errors.length === 1 ? "an error" : `${result.errors.length} errors`}`,
      );
      return;
    }
    setErrors([]);
    setDraft(null);
    const was = song.sheet ? "sheet" : "song";
    const now = result.song.sheet ? "sheet" : "song";
    openSong(result.song, fromFile ? `Import ${fromFile}` : "Edit code");
    say(
      was === now
        ? "Code applied. Undo brings back what was open."
        : now === "sheet"
          ? `Opened “${result.song.sheet!.name}” as a sound sheet (sound-effect code). Undo brings the song back.`
          : "Opened as a song (song code). Undo brings the sound sheet back.",
    );
  }

  function revert() {
    setDraft(null);
    setErrors([]);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const picked = input.files?.[0];
    input.value = "";
    if (!picked) return;
    if (picked.size > 400_000) return say(`${picked.name} is too large for driver code`);
    apply(await picked.text(), picked.name.replace(/\.(asm|txt|s|inc)$/i, ""));
  }

  async function copy() {
    say(
      (await copyCode(text)) ? "Code copied" : "Could not copy: the browser refused the clipboard",
    );
  }

  return (
    <div className={styles.studioCode}>
      {reasons && !dirty ? (
        <p className={styles.none}>
          This sound sheet uses studio-only features ({reasons.join(", ")}), which the sound-effect
          format cannot write. Paste or import code to replace it.
        </p>
      ) : null}
      <label className="sr-only" htmlFor="studio-code">
        {song.sheet ? "Sound code" : "Song code"}
      </label>
      <textarea
        id="studio-code"
        ref={area}
        spellCheck={false}
        aria-invalid={errors.length > 0}
        aria-describedby="studio-code-errors"
        value={text}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            apply(text);
          }
        }}
      />
      <CodeErrors
        id="studio-code-errors"
        className={styles.errors}
        errors={errors}
        onPick={(line) => selectLine(area.current, text, line)}
      />
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.key}
          disabled={!dirty}
          onClick={() => apply(text)}
          title="Apply the code (Ctrl/⌘ Enter)"
        >
          Apply
        </button>
        <button type="button" className={styles.key} disabled={!dirty} onClick={revert}>
          Revert
        </button>
        <button type="button" className={styles.key} onClick={() => file.current?.click()}>
          Import file…
        </button>
        <input
          ref={file}
          type="file"
          accept=".txt,.asm,.s,.inc,text/plain"
          hidden
          aria-label="Import code file"
          onChange={(event) => void importFile(event)}
        />
        <button type="button" className={styles.key} onClick={() => void copy()}>
          Copy code
        </button>
        <button
          type="button"
          className={styles.key}
          onClick={() => say(`Saved ${exportCode(text, song.title || song.sheet?.name || "song")}`)}
        >
          Export code
        </button>
        <span className={styles.hint}>
          {dirty ? "Edited: Apply to hear it" : "In sync with the grid"}
        </span>
      </div>
    </div>
  );
}
