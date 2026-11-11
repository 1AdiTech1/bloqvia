/**
 * The price call (Nov 11): "in ten minutes, will Bloq pay more, the same or less for Key Fragments?"
 *
 *   const c = useCalls();
 *   c.round                      // { round, secondsLeft, open }  (the clock, same for every item)
 *   c.rounds["key-fragment"]     // CallRound | undefined: the current round's calls, both sides' stakes
 *   c.mine                       // MyCall[]: the account's open calls and the last settled ones (with `paid`)
 *   c.mineFor("key-fragment")    // the account's call in the current round, if any
 *   c.lastResultFor("key-fragment") // the most recent settled call on that item, to show "You called it: +18 gold"
 *   await c.place("key-fragment", "More", 20)   // "More" | "Same" | "Less"; relayed; throws with the chain's message
 *   c.busy, c.error, c.clearError()
 *
 * Everything is read from core; the outcome is the contract's (`contracts/bloqvia-core/src/calls.rs`). The store
 * polls every 15 s while a card is mounted and the tab is visible, and keeps the last settled call per item in
 * memory so the result is shown once after settlement (the chain forgets a learner's settled calls on purpose).
 */
import { useEffect, useSyncExternalStore } from "react";
import { ITEMS, type ItemId } from "./config";
import { game, views } from "./contracts";
import { explorer } from "./explorer";
import { createSigner, type LearnerSigner } from "./signer";
import type { CallRound, CallSide, MyCall, RelayResult } from "./types";
import { humanError } from "./errors";

export const CALL_STAKE = { min: 10, max: 50, default: 20 } as const;

export interface CallsState {
  loaded: boolean;
  /** false when core has no `get_call_round` (an older deployment): the cards hide the feature */
  enabled: boolean;
  round: { round: number; secondsLeft: number; open: boolean } | null;
  rounds: Partial<Record<ItemId, CallRound>>;
  mine: MyCall[];
  busy: boolean;
  error: string | null;
  lastTx: (RelayResult & { url: string }) | null;
}

export interface CallsStore extends CallsState {
  refresh(): Promise<void>;
  place(tokenId: ItemId, side: CallSide, stake: number): Promise<RelayResult>;
  mineFor(tokenId: ItemId): MyCall | null;
  lastResultFor(tokenId: ItemId): MyCall | null;
  clearError(): void;
}

const SIGNER_KIND = (import.meta.env.VITE_SIGNER_KIND ?? "local-key") as LearnerSigner["kind"];
const INITIAL: CallsState = { loaded: false, enabled: true, round: null, rounds: {}, mine: [], busy: false, error: null, lastTx: null };

let state: CallsState = INITIAL;
let signer: LearnerSigner | null = null;
let initialised = false;
const listeners = new Set<() => void>();
/** settled calls the chain no longer lists for the account, kept so the result shows once */
const remembered = new Map<string, MyCall>();

function set(patch: Partial<CallsState>): void {
  state = { ...state, ...patch };
  snapshot = build();
  listeners.forEach((l) => l());
}
function getSigner(): LearnerSigner {
  if (!signer) signer = createSigner(SIGNER_KIND);
  return signer;
}
const key = (c: { token_id: string; round: number }) => `${c.token_id}|${c.round}`;

async function refresh(): Promise<void> {
  try {
    const [round, secondsLeft, open] = await views.callRound();
    const accountId = getSigner().accountId();
    // my calls: the open ones from the chain, plus the ones we remember from before settlement
    const refs = [...remembered.values()].filter((c) => !c.settled).map((c) => ({ token_id: c.token_id, round: c.round }));
    const [list, mine] = await Promise.all([
      Promise.all(ITEMS.map((it) => views.priceCalls(it))),
      accountId ? views.myCalls(accountId, refs.length ? refs : undefined) : Promise.resolve([]),
    ]);
    for (const c of mine) remembered.set(key(c), c);
    const rounds: Partial<Record<ItemId, CallRound>> = {};
    ITEMS.forEach((it, i) => { const r = list[i]; if (r) rounds[it] = r; });
    set({ loaded: true, enabled: true, round: { round, secondsLeft, open }, rounds, mine: [...remembered.values()] });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/MethodNotFound|get_call_round/.test(msg)) { set({ loaded: true, enabled: false }); return; }
    set({ loaded: true, error: humanError(e) });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const actions = {
  refresh,
  place: async (tokenId: ItemId, side: CallSide, stake: number): Promise<RelayResult> => {
    set({ busy: true, error: null });
    try {
      const result = await game.placeCall(getSigner(), tokenId, side, stake);
      set({ lastTx: { ...result, url: explorer.tx(result.txHash) } });
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await refresh();
        if (state.mine.some((c) => c.token_id === tokenId && c.round === state.round?.round)) break;
        await sleep(500);
      }
      return result;
    } catch (e) {
      set({ error: humanError(e) });
      throw e;
    } finally {
      set({ busy: false });
    }
  },
  mineFor: (tokenId: ItemId): MyCall | null => state.mine.find((c) => c.token_id === tokenId && c.round === state.round?.round) ?? null,
  lastResultFor: (tokenId: ItemId): MyCall | null =>
    state.mine.filter((c) => c.token_id === tokenId && c.settled).sort((a, b) => b.round - a.round)[0] ?? null,
  clearError: (): void => set({ error: null }),
};

function build(): CallsStore {
  return { ...state, ...actions };
}
let snapshot: CallsStore = build();
const SERVER_SNAPSHOT: CallsStore = snapshot;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const POLL_MS = 15_000;
let mounted = 0;
let poll: ReturnType<typeof setInterval> | null = null;
function startPolling(): void {
  if (poll) return;
  poll = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (state.busy) return;
    void refresh();
  }, POLL_MS);
}
function stopPolling(): void { if (poll) clearInterval(poll); poll = null; }

export function useCalls(): CallsStore {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    if (!initialised) { initialised = true; void refresh(); }
    mounted += 1;
    startPolling();
    return () => { mounted -= 1; if (mounted === 0) stopPolling(); };
  }, []);
  return value;
}

/** The crowd's split of the gold in play, in percent per side; null when nobody called yet. */
export function crowd(r: CallRound | undefined): { more: number; same: number; less: number; gold: number; calls: number } | null {
  if (!r) return null;
  const more = Number(r.more_stake), same = Number(r.same_stake), less = Number(r.less_stake), gold = more + same + less;
  if (gold === 0) return null;
  const pct = (n: number) => Math.round((100 * n) / gold);
  return { more: pct(more), same: pct(same), less: pct(less), gold, calls: r.calls.length };
}
/** The side the crowd leans to, for the one-line summary ("62 % of the gold says more"). */
export function crowdLeans(c: ReturnType<typeof crowd>): { side: CallSide; pct: number } | null {
  if (!c) return null;
  const best = ([["More", c.more], ["Same", c.same], ["Less", c.less]] as [CallSide, number][]).sort((a, b) => b[1] - a[1])[0]!;
  return { side: best[0], pct: best[1] };
}
