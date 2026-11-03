import { useSyncExternalStore } from "react";
import type { BloqView, Game, LearnerView, LessonPublic, PassportView, RelayResult } from "./types";
import { ITEM_IDS, LESSON_CONTENT } from "./content";

// ---- Pricing rule (mirrors the contract) ----
export const BASE = 100;
export const HALVING = 40;
export const SPREAD_BPS = 250;
export const TREASURY_FLOOR = 500;

export function buyPrice(stock: number): number {
  return Math.floor((BASE * HALVING) / (HALVING + stock));
}
export function sellPrice(stock: number): number {
  return Math.floor((buyPrice(stock) * (10000 + SPREAD_BPS)) / 10000);
}
/** Gold Bloq pays for `amount` units, one at a time as his stock grows. */
export function quoteSell(stock: number, amount: number): number {
  let total = 0;
  for (let i = 0; i < amount; i++) total += buyPrice(stock + i);
  return total;
}
/** Gold Bloq charges for `amount` units, one at a time as his stock shrinks. */
export function quoteBuy(stock: number, amount: number): number {
  let total = 0;
  for (let i = 0; i < amount; i++) total += sellPrice(stock - i);
  return total;
}

// ---- Internal state ----
interface Raw {
  accountId: string | null;
  learnerGold: number;
  learnerItems: Record<string, number>;
  completed: string[];
  graduated: boolean;
  bloqGold: number;
  bloqStock: Record<string, number>;
  lastTx: (RelayResult & { url: string }) | null;
  history: { label: string; txHash: string; url: string }[];
  busy: boolean;
  error: string | null;
}

const BLOQ_ID = "bloq.bloqvia.testnet";
const ACCOUNT = "learner-7f3a9c2b1d4e.bloqvia.testnet";
const NEARBLOCKS = "https://testnet.nearblocks.io";

const initial = (): Raw => ({
  accountId: null,
  learnerGold: 0,
  learnerItems: {},
  completed: [],
  graduated: false,
  bloqGold: 10000,
  bloqStock: Object.fromEntries(ITEM_IDS.map((id) => [id, 5])),
  lastTx: null,
  history: [],
  busy: false,
  error: null,
});

let raw: Raw = initial();
let snapshot: Game;
const listeners = new Set<() => void>();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fakeHash = () => {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  return Array.from({ length: 44 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};
const txUrl = (h: string) => `${NEARBLOCKS}/txns/${h}`;

function set(patch: Partial<Raw>) {
  raw = { ...raw, ...patch };
  snapshot = build();
  listeners.forEach((l) => l());
}

function record(label: string, methods: string[]): RelayResult {
  const txHash = fakeHash();
  const result: RelayResult = { txHash, senderId: raw.accountId ?? ACCOUNT, methods };
  set({
    lastTx: { ...result, url: txUrl(txHash) },
    history: [...raw.history, { label, txHash, url: txUrl(txHash) }],
  });
  return result;
}

async function run<T>(ms: number, fn: () => T): Promise<T> {
  set({ busy: true, error: null });
  await wait(ms);
  try {
    const out = fn();
    set({ busy: false });
    return out;
  } catch (e) {
    set({ busy: false, error: (e as Error).message });
    throw e;
  }
}

const lessons: LessonPublic[] = LESSON_CONTENT.map((l) => ({
  lesson_id: l.lesson_id,
  title: l.title,
  answer_hash: `mock-${l.lesson_id}`,
  reward_gold: l.reward_gold,
  reward_item: l.reward_item,
  reward_item_amount: l.reward_item_amount,
}));

function bloqView(): BloqView {
  const prices = ITEM_IDS.map((id) => {
    const s = raw.bloqStock[id] ?? 0;
    return {
      token_id: id,
      bloq_stock: String(s),
      buy_price: String(buyPrice(s)),
      sell_price: String(sellPrice(s)),
    };
  });
  return {
    account_id: BLOQ_ID,
    gold: String(raw.bloqGold),
    shop_open: raw.bloqGold >= TREASURY_FLOOR,
    treasury_floor: String(TREASURY_FLOOR),
    prices,
    graduation_fee: String(prices.reduce((a, p) => a + Number(p.sell_price), 0)),
  };
}

const actions = {
  start: () =>
    run(1200, () => {
      set({ ...initial(), accountId: ACCOUNT, busy: true });
      record("Signed in and your account was created", ["create_account", "register"]);
      return ACCOUNT;
    }),
  refresh: async () => {
    set({});
  },
  completeLesson: async (lessonId: string, answer: string) => {
    const content = LESSON_CONTENT.find((l) => l.lesson_id === lessonId);
    if (!content || answer.trim().toLowerCase() !== content.answer.trim().toLowerCase()) {
      set({ error: "Wrong answer" });
      throw new Error("Wrong answer");
    }
    return run(1500, () => {
      if (raw.completed.includes(lessonId)) throw new Error("Quest already completed");
      const item = content.reward_item;
      set({
        learnerGold: raw.learnerGold + Number(content.reward_gold),
        learnerItems: {
          ...raw.learnerItems,
          [item]: (raw.learnerItems[item] ?? 0) + Number(content.reward_item_amount),
        },
        completed: [...raw.completed, lessonId],
      });
      return record(`Quest: ${content.title}`, ["complete_lesson"]);
    });
  },
  sellToBloq: (tokenId: string, amount = 1) =>
    run(1000, () => {
      if (!(raw.bloqGold >= TREASURY_FLOOR)) throw new Error("Bloq's shop is closed");
      const have = raw.learnerItems[tokenId] ?? 0;
      if (have < amount) throw new Error("You don't have enough of that item");
      const stock = raw.bloqStock[tokenId] ?? 0;
      const gold = quoteSell(stock, amount);
      if (raw.bloqGold < gold) throw new Error("Bloq does not have enough gold");
      set({
        learnerItems: { ...raw.learnerItems, [tokenId]: have - amount },
        bloqStock: { ...raw.bloqStock, [tokenId]: stock + amount },
        learnerGold: raw.learnerGold + gold,
        bloqGold: raw.bloqGold - gold,
      });
      return record(`Sold ${amount} to Bloq for ${gold} gold`, ["sell_to_bloq"]);
    }),
  buyFromBloq: (tokenId: string, amount = 1) =>
    run(1000, () => {
      if (!(raw.bloqGold >= TREASURY_FLOOR)) throw new Error("Bloq's shop is closed");
      const stock = raw.bloqStock[tokenId] ?? 0;
      if (stock < amount) throw new Error("Bloq does not have enough stock");
      const cost = quoteBuy(stock, amount);
      if (raw.learnerGold < cost) throw new Error("Not enough gold");
      set({
        learnerItems: { ...raw.learnerItems, [tokenId]: (raw.learnerItems[tokenId] ?? 0) + amount },
        bloqStock: { ...raw.bloqStock, [tokenId]: stock - amount },
        learnerGold: raw.learnerGold - cost,
        bloqGold: raw.bloqGold + cost,
      });
      return record(`Bought ${amount} from Bloq for ${cost} gold`, ["buy_from_bloq"]);
    }),
  graduate: () =>
    run(1500, () => {
      if (raw.completed.length < 3) throw new Error("Finish all three quests first");
      if (ITEM_IDS.some((id) => (raw.learnerItems[id] ?? 0) < 1))
        throw new Error("You need one of each item to graduate");
      const fee = Number(bloqView().graduation_fee);
      if (raw.learnerGold < fee) throw new Error("Not enough gold for the fee");
      const items = { ...raw.learnerItems };
      const stock = { ...raw.bloqStock };
      ITEM_IDS.forEach((id) => {
        items[id] = (items[id] ?? 0) - 1;
        stock[id] = (stock[id] ?? 0) + 1;
      });
      set({
        learnerItems: items,
        bloqStock: stock,
        learnerGold: raw.learnerGold - fee,
        bloqGold: raw.bloqGold + fee,
        graduated: true,
      });
      return record("Graduated and your Passport was sealed", ["graduate"]);
    }),
  signOut: () => set(initial()),
  exportSecretKey: () =>
    raw.accountId
      ? "ed25519:5KqX9vTn3bWcR8yHfL2mPzA7dE4sGjU6NkVoQx1rYtBi9MwCeZhJaFg3uDp8LsTnK2RvYbWx"
      : null,
  explorer: {
    tx: (h: string) => txUrl(h),
    account: (id: string) => `${NEARBLOCKS}/address/${id}`,
    passport: (id: string) => `${NEARBLOCKS}/nft-token/passport.bloqvia.testnet/${id}`,
  },
};

function build(): Game {
  const id = raw.accountId;
  const level = raw.completed.length;
  const learner: LearnerView | null = id
    ? {
        account_id: id,
        registered: true,
        completed: raw.completed,
        level,
        graduated: raw.graduated,
        gold: String(raw.learnerGold),
        items: ITEM_IDS.map((k) => [k, String(raw.learnerItems[k] ?? 0)] as [string, string]),
      }
    : null;
  const passport: PassportView | null = id
    ? { token_id: id, owner_id: id, level, graduated: raw.graduated }
    : null;
  return {
    accountId: id,
    learner,
    passport,
    bloq: id ? bloqView() : null,
    lessons,
    lastTx: raw.lastTx,
    busy: raw.busy,
    error: raw.error,
    ...actions,
  };
}

snapshot = build();

/** Mock-only extra: activity log used by the reveal timeline. */
export function getMockHistory() {
  return raw.history;
}
export function clearMockError() {
  set({ error: null });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useMockGame(): Game {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
