import { useStore } from "zustand";
import { playerStore, type PlayerState } from "../audio/player.ts";

/** Reads a slice of the player's state; the component re-renders when that slice changes. */
export const usePlayer = <T>(selector: (state: PlayerState) => T): T =>
  useStore(playerStore, selector);
