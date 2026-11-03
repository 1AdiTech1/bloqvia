/**
 * The ONE React hook the UI talks to. Lovable screens call these functions
 * and render these fields; they never touch RPC, keys or the relayer.
 *
 *   const b = useBloqvia();
 *   b.start()                       // sign-in/registration (no wallet UI)
 *   b.completeLesson(id, answer)    // -> { txHash }
 *   b.sellToBloq(item, 1) / b.buyFromBloq(item, 1) / b.graduate()
 *   b.learner, b.bloq, b.lessons, b.passport, b.lastTx, b.busy, b.error
 *
 * It is ONE store shared by every component (useSyncExternalStore), the same
 * shape as src/game/mockGame.ts, so RequireAccount, the map, the quiz sheet
 * and the chrome all see the same state. It is also SSR-safe: the server
 * snapshot has no account and `busy: true` ("restoring session"); the first
 * client effect reads the session from localStorage and flips busy off.
 */
import { useEffect, useSyncExternalStore } from "react";
import { game, views } from "./contracts";
import { explorer } from "./explorer";
import { createSigner, type LearnerSigner } from "./signer";
import type { BloqView, LearnerView, LessonPublic, PassportView, RelayResult } from "./types";

export interface BloqviaState {
  accountId: string | null;
  learner: LearnerView | null;
  passport: PassportView | null;
  bloq: BloqView | null;
  lessons: LessonPublic[];
  lastTx: (RelayResult & { url: string }) | null;
  busy: boolean;
  error: string | null;
}

export interface Bloqvia extends BloqviaState {
  start: () => Promise<string>;
  refresh: () => Promise<void>;
  completeLesson: (lessonId: string, answer: string) => Promise<RelayResult>;
  sellToBloq: (tokenId: string, amount?: number) => Promise<RelayResult>;
  buyFromBloq: (tokenId: string, amount?: number) => Promise<RelayResult>;
  graduate: () => Promise<RelayResult>;
  signOut: () => void;
  exportSecretKey: () => string | null;
  clearError: () => void;
  explorer: typeof explorer;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const SIGNER_KIND = (import.meta.env.VITE_SIGNER_KIND ?? "local-key") as LearnerSigner["kind"];

const INITIAL: BloqviaState = {
  accountId: null,
  learner: null,
  passport: null,
  bloq: null,
  lessons: [],
  lastTx: null,
  busy: true, // until the session is restored on the client
  error: null,
};

let state: BloqviaState = INITIAL;
let signer: LearnerSigner | null = null;
let initialised = false;
const listeners = new Set<() => void>();

function set(patch: Partial<BloqviaState>): void {
  state = { ...state, ...patch };
  snapshot = build();
  listeners.forEach((l) => l());
}

function getSigner(): LearnerSigner {
  if (!signer) signer = createSigner(SIGNER_KIND);
  return signer;
}

async function load(accountId: string | null) {
  const [lessons, bloq, learner, passport] = await Promise.all([
    views.lessons(),
    views.bloq(),
    accountId ? views.learner(accountId) : Promise.resolve(null),
    accountId ? views.passport(accountId) : Promise.resolve(null),
  ]);
  return { accountId, lessons, bloq, learner, passport };
}

async function refresh(): Promise<void> {
  const accountId = signer?.accountId() ?? null;
  try {
    set(await load(accountId));
  } catch (e) {
    set({ accountId, error: (e as Error).message });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read-your-writes. The relayer answers once the transaction has executed
 * optimistically; an RPC node one block behind can still serve the old state.
 * Re-read until `expect` is true (max ~4 s), then keep whatever we got.
 */
async function refreshUntil(expect: (l: LearnerView | null) => boolean): Promise<void> {
  const accountId = signer?.accountId() ?? null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const next = await load(accountId);
      if (expect(next.learner) || attempt === 7) {
        set(next);
        return;
      }
    } catch (e) {
      if (attempt === 7) set({ accountId, error: (e as Error).message });
    }
    await sleep(500);
  }
}

/** Client only, once: restore the session synchronously, then load views. */
function init(): void {
  if (initialised) return;
  initialised = true;
  const s = getSigner();
  set({ accountId: s.accountId(), busy: false });
  void refresh();
}

async function run(
  fn: (s: LearnerSigner) => Promise<RelayResult>,
  expect: (l: LearnerView | null) => boolean,
): Promise<RelayResult> {
  set({ busy: true, error: null });
  try {
    const result = await fn(getSigner());
    set({ lastTx: { ...result, url: explorer.tx(result.txHash) } });
    await refreshUntil(expect);
    return result;
  } catch (e) {
    set({ error: (e as Error).message });
    throw e;
  } finally {
    set({ busy: false });
  }
}

const actions = {
  start: async (): Promise<string> => {
    set({ busy: true, error: null });
    try {
      const accountId = await getSigner().ensureAccount();
      set({ accountId });
      await refresh();
      return accountId;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ busy: false });
    }
  },
  refresh,
  completeLesson: (lessonId: string, answer: string) =>
    run(
      (s) => game.completeLesson(s, lessonId, answer),
      (l) => !!l && l.completed.includes(lessonId),
    ),
  sellToBloq: (tokenId: string, amount = 1) => {
    const before = state.learner?.gold;
    return run(
      (s) => game.sellToBloq(s, tokenId, amount),
      (l) => !!l && l.gold !== before,
    );
  },
  buyFromBloq: (tokenId: string, amount = 1) => {
    const before = state.learner?.gold;
    return run(
      (s) => game.buyFromBloq(s, tokenId, amount),
      (l) => !!l && l.gold !== before,
    );
  },
  graduate: () =>
    run(
      (s) => game.graduate(s),
      (l) => !!l && l.graduated,
    ),
  signOut: (): void => {
    signer?.signOut();
    set({ accountId: null, learner: null, passport: null, lastTx: null, error: null });
  },
  exportSecretKey: (): string | null => signer?.exportSecretKey() ?? null,
  clearError: (): void => set({ error: null }),
  explorer,
};

function build(): Bloqvia {
  return { ...state, ...actions };
}

let snapshot: Bloqvia = build();
const SERVER_SNAPSHOT: Bloqvia = snapshot;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBloqvia(): Bloqvia {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    init();
  }, []);
  return value;
}
