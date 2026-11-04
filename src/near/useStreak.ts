/**
 * Module A hook for the streak card. Chain-only: it reads `bloqvia-streak`
 * through core's `get_streak_contract`, so it renders nothing (`enabled:
 * false`) when the module is not deployed. Shares the learner signer with
 * `useBloqvia` through the same localStorage session.
 *
 *   const s = useStreak();
 *   if (!s.enabled) return null;
 *   s.streak.today_count / s.streak.today_target, s.streak.streak, s.streak.history
 *   s.member?.checked_in_today, s.member?.balance
 *   await s.checkIn()   // once per streak day; the contract refuses a second one
 */
import { useEffect, useSyncExternalStore } from "react";
import { game, views } from "./contracts";
import { explorer } from "./explorer";
import { createSigner, type LearnerSigner } from "./signer";
import type { MemberView, RelayResult, StreakView } from "./types";

export interface StreakState {
  /** false until core reports a streak contract; the card should hide. */
  enabled: boolean;
  streakId: string | null;
  streak: StreakView | null;
  member: MemberView | null;
  busy: boolean;
  error: string | null;
  lastTx: (RelayResult & { url: string }) | null;
}

export interface StreakStore extends StreakState {
  refresh: () => Promise<void>;
  checkIn: () => Promise<RelayResult>;
  clearError: () => void;
}

const SIGNER_KIND = (import.meta.env.VITE_SIGNER_KIND ?? "local-key") as LearnerSigner["kind"];

const INITIAL: StreakState = { enabled: false, streakId: null, streak: null, member: null, busy: false, error: null, lastTx: null };

let state: StreakState = INITIAL;
let signer: LearnerSigner | null = null;
let initialised = false;
const listeners = new Set<() => void>();

function set(patch: Partial<StreakState>): void {
  state = { ...state, ...patch };
  snapshot = build();
  listeners.forEach((l) => l());
}

function getSigner(): LearnerSigner {
  if (!signer) signer = createSigner(SIGNER_KIND);
  return signer;
}

async function refresh(): Promise<void> {
  try {
    const streakId = await views.streakContract();
    if (!streakId) {
      set({ enabled: false, streakId: null, streak: null, member: null });
      return;
    }
    const accountId = getSigner().accountId();
    const [streak, member] = await Promise.all([
      views.streak(streakId),
      accountId ? views.member(accountId, streakId) : Promise.resolve(null),
    ]);
    set({ enabled: true, streakId, streak, member });
  } catch (e) {
    set({ error: (e as Error).message });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const actions = {
  refresh,
  checkIn: async (): Promise<RelayResult> => {
    set({ busy: true, error: null });
    try {
      const result = await game.checkIn(getSigner());
      set({ lastTx: { ...result, url: explorer.tx(result.txHash) } });
      // Read-your-writes: wait until the chain shows today's check-in.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await refresh();
        if (state.member?.checked_in_today) break;
        await sleep(500);
      }
      return result;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ busy: false });
    }
  },
  clearError: (): void => set({ error: null }),
};

function build(): StreakStore {
  return { ...state, ...actions };
}

let snapshot: StreakStore = build();
const SERVER_SNAPSHOT: StreakStore = snapshot;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useStreak(): StreakStore {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    if (initialised) return;
    initialised = true;
    void refresh();
  }, []);
  return value;
}
