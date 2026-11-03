import type { Game } from "./types";
import { useMockGame } from "./mockGame";
import { useBloqvia } from "../near";

/**
 * VITE_GAME_MODE=near plays on NEAR testnet through src/near (needs the
 * relayer at VITE_RELAYER_URL). Anything else, including this preview, keeps
 * the in-memory mock. Decided once per build, so no conditional hooks.
 */
const useNear = import.meta.env.VITE_GAME_MODE === "near";

export const useGame: () => Game = useNear ? useBloqvia : useMockGame;
