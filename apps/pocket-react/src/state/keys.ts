// Global keyboard shortcuts. Typing in a field never triggers them, and Space never steals a
// focused button's own Space.
import { useEffect, useEffectEvent } from "react";
import { playerStore, setLooping, stop } from "../audio/player.ts";
import type { ChannelIndex } from "../model/types.ts";
import {
  redo,
  say,
  setShortcutsOpen,
  togglePlay,
  undo,
  updateEditor,
  useStudio,
} from "./studio.ts";

/** What Space does on the current page (the studio plays its song; the SFX page plays a sound). */
let spaceAction: (() => void) | undefined;

/** Space runs `action` while the calling page is mounted, instead of playing the studio's song. */
export function useSpaceAction(action: () => void): void {
  const run = useEffectEvent(action);
  useEffect(() => {
    spaceAction = run;
    return () => {
      spaceAction = undefined;
    };
  }, []);
}

/** Keys the grid handles itself while focused (arrows, Enter, Delete…). */
let gridFocused = false;
export function setGridFocused(on: boolean): void {
  gridFocused = on;
}

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function onKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || typing(event.target)) return;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key;
  const { nowPlaying, looping } = playerStore.getState();
  if (mod && key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if (mod || event.altKey) return;
  if (key === " ") {
    const target = event.target as HTMLElement | null;
    if (target && !gridFocused && ["BUTTON", "A", "SUMMARY"].includes(target.tagName)) return;
    event.preventDefault();
    if (nowPlaying && nowPlaying !== "editor") stop();
    else (spaceAction ?? togglePlay)();
    return;
  }
  if (key === "?") {
    setShortcutsOpen(!useStudio.getState().shortcutsOpen);
    return;
  }
  if (key === "Escape" && nowPlaying) {
    stop();
    return;
  }
  if (key.toLowerCase() === "l") {
    setLooping(!looping);
    say(looping ? "Loop off: the song plays once" : "Loop on");
    return;
  }
  if (!gridFocused && ["1", "2", "3", "4"].includes(key)) {
    updateEditor((editor) => {
      editor.channel = (Number(key) - 1) as ChannelIndex;
    });
  }
}
