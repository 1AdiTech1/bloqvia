import type { Game } from "./types";
import { useMockGame } from "./mockGame";
import { useBloqvia } from "../near";

/**
 * The game plays on NEAR testnet through src/near by default (relayer URL in
 * src/near/config.ts, overridable with VITE_RELAYER_URL). VITE_GAME_MODE=mock
 * keeps the in-memory mock for design work without the chain. Decided once
 * per build, so no conditional hooks.
 */
const useMock = import.meta.env.VITE_GAME_MODE === "mock";

export const useGame: () => Game = useMock ? useMockGame : useBloqvia;
