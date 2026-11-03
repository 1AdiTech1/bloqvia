import type { Game } from "./types";
import { useMockGame } from "./mockGame";

/** The single source of truth for game state. Swap the mock for the chain layer here. */
export function useGame(): Game {
  return useMockGame();
}
