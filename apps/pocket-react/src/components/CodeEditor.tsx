// The driver-code view of the SFX and Creatures makers. Built-in sounds show their code read-only
// (a learning view) with a button to copy them into My sounds / My voices. Saved sounds can be
// edited, replaced by pasted code or by a .txt/.asm file: code that parses plays at once and saves
// over the saved sound; errors are listed by line, and clicking one selects that line.
import { useRef, useState, type ChangeEvent } from "react";
import { sfxData } from "../audio/driver.ts";
import { playPcm } from "../audio/player.ts";
import { copyCode, exportCode } from "../files.ts";
import { parseCode, type CodeError } from "../model/code.ts";
import { sfxToSheet } from "../model/sheet.ts";
import type { Sfx, SoundSheet } from "../model/types.ts";
import { renderSound, updateSound } from "../state/sounds.ts";
import { say } from "../state/studio.ts";
import { CodeErrors, selectLine } from "./CodeErrors.tsx";
import styles from "./CodeEditor.module.css";

export function CodeEditor(props: {
  /** The current sound as code, or null when it has none (studio-only features). */
  code: string | null;
  note: string;
  kind: SoundSheet["kind"];
  title: string;
  /** A parsed sound was rendered: show its waveform. */
  onPcm: (pcm: Float32Array) => void;
  /** The saved sound being shown (editable), or undefined for a built-in one (read-only). */
  customId?: string;
  /** Copies the built-in sound into My sounds / My voices (it becomes editable there). */
  onCopy: () => void;
  /** The saved sound was updated from code. */
  onSaved: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<CodeError[]>([]);
  const [parsed, setParsed] = useState<Sfx | null>(null);
  const [name, setName] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const shelf = props.kind === "voice" ? "My voices" : "My sounds";

  function edit(text = props.code ?? "", title = props.title) {
    setDraft(text);
    setErrors([]);
    setParsed(null);
    setName(title);
    setEditing(true);
  }

  /** Parses the code; plays it when it is valid. */
  async function run(text = draft, title = name): Promise<Sfx | null> {
    const result = parseCode(text, title || "My sound");
    if ("errors" in result) {
      setErrors(result.errors);
      setParsed(null);
      say(
        `The code has ${result.errors.length === 1 ? "an error" : `${result.errors.length} errors`}`,
      );
      return null;
    }
    setErrors([]);
    setParsed(result.sfx);
    try {
      const pcm = await renderSound(sfxData(result.sfx));
      props.onPcm(pcm);
      await playPcm(pcm);
    } catch (error) {
      say(`Audio failed: ${String(error)}`);
    }
    return result.sfx;
  }

  async function save() {
    const id = props.customId;
    if (!id) return;
    const sfx = parsed ?? (await run());
    if (!sfx) return;
    const sheet = sfxToSheet({ ...sfx, name: name || sfx.name }, props.kind);
    if ("reasons" in sheet) return say(`Cannot save: ${sheet.reasons.join(", ")}`);
    if (!updateSound(id, sheet.song)) return;
    say(`Saved “${sheet.song.sheet!.name}” in ${shelf}`);
    setEditing(false);
    props.onSaved(id);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const picked = input.files?.[0];
    input.value = "";
    if (!picked) return;
    if (picked.size > 200_000) return say(`${picked.name} is too large for driver code`);
    const text = await picked.text();
    const title = picked.name.replace(/\.(txt|asm|s|inc)$/i, "");
    edit(text, title);
    await run(text, title);
  }

  async function copy() {
    if (props.code === null) return;
    say(
      (await copyCode(props.code))
        ? "Code copied"
        : "Could not copy: the browser refused the clipboard",
    );
  }

  return (
    <div className={styles.code}>
      <p className={styles.note}>{props.note}</p>
      {editing ? (
        <div className={styles.editor}>
          <label className="sr-only" htmlFor="code-draft">
            Driver code
          </label>
          <textarea
            id="code-draft"
            ref={area}
            spellCheck={false}
            rows={14}
            aria-invalid={errors.length > 0}
            aria-describedby="code-errors"
            value={draft}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setParsed(null);
            }}
          />
          <CodeErrors
            id="code-errors"
            className={styles.errors}
            errors={errors}
            onPick={(line) => selectLine(area.current, draft, line)}
          />
          <div className={styles.row}>
            <label className={styles.name}>
              <span className="label">Name</span>
              <input
                type="text"
                maxLength={40}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <button type="button" className="btn" onClick={() => void run()}>
              Play code
            </button>
            <button type="button" className="btn primary" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {props.code === null ? (
            <p className={styles.none}>
              This sound uses studio-only features, so it has no driver code. Paste or import code
              to replace it.
            </p>
          ) : (
            <>
              <pre>{props.code}</pre>
              <div className={styles.row}>
                <button type="button" className="btn" onClick={() => void copy()}>
                  Copy code
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => say(`Saved ${exportCode(props.code!, props.title)}`)}
                >
                  Export code
                </button>
              </div>
            </>
          )}
          {props.customId ? (
            <div className={styles.row}>
              <button type="button" className="btn" onClick={() => edit()}>
                {props.code === null ? "Write code" : "Edit code"}
              </button>
              <button type="button" className="btn" onClick={() => edit("")}>
                Paste code
              </button>
              <button type="button" className="btn" onClick={() => file.current?.click()}>
                Import file…
              </button>
              <input
                ref={file}
                type="file"
                accept=".txt,.asm,.s,.inc,text/plain"
                hidden
                aria-label="Import driver code"
                onChange={(event) => void importFile(event)}
              />
            </div>
          ) : (
            <div className={styles.row}>
              <p className={styles.none}>
                Built-in sounds are read-only. Copy this one to {shelf} to edit its code, paste code
                or import a file.
              </p>
              <button type="button" className="btn" onClick={props.onCopy}>
                Copy to {shelf}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
