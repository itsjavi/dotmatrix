// Driver-code errors, listed by line; clicking one selects that line in the editor.
import type { CodeError } from "../model/code.ts";

export function CodeErrors(props: {
  id: string;
  className?: string;
  errors: CodeError[];
  onPick: (line: number) => void;
}) {
  return (
    <ol id={props.id} className={props.className} aria-live="polite">
      {props.errors.map((e) => (
        <li key={`${e.line}:${e.message}`}>
          <button type="button" onClick={() => props.onPick(e.line)}>
            Line {e.line}: {e.message}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Focuses a textarea and selects one line (1-based) of its text. */
export function selectLine(area: HTMLTextAreaElement | null, text: string, line: number): void {
  if (!area) return;
  const lines = text.split("\n");
  const start = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
  area.focus();
  area.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
}
