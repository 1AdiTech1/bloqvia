/**
 * Offline replica of the on-chain economy, used to tune parameters in seconds
 * and to produce the fast-forward numbers judges can read. The price rule is
 * a line-for-line port of contracts/bloqvia-core/src/pricing.rs; a unit test
 * pins it to the same expected values as the Rust tests.
 */
export interface Pricing {
  base_price: bigint;
  stock_halving: bigint;
  spread_bps: bigint;
  treasury_floor: bigint;
}

export const ITEMS = ["key-fragment", "fuel-cell", "contract-seal"] as const;
export type Item = (typeof ITEMS)[number];

export function buyPrice(p: Pricing, stock: bigint): bigint {
  const halving = p.stock_halving > 0n ? p.stock_halving : 1n;
  return (p.base_price * halving) / (halving + stock);
}
export function sellPrice(p: Pricing, stock: bigint): bigint {
  return (buyPrice(p, stock) * (10_000n + p.spread_bps)) / 10_000n;
}
export function buyTotal(p: Pricing, stock: bigint, amount: bigint): bigint {
  let t = 0n;
  for (let i = 0n; i < amount; i += 1n) t += buyPrice(p, stock + i);
  return t;
}
export function sellTotal(p: Pricing, stock: bigint, amount: bigint): bigint {
  let t = 0n;
  for (let i = 0n; i < amount; i += 1n) t += sellPrice(p, stock - (i + 1n));
  return t;
}

export interface LessonReward {
  lesson_id: string;
  reward_gold: bigint;
  reward_item: Item;
  reward_item_amount: bigint;
}

export type Strategy = "seller" | "hoarder" | "trader";

export interface Player {
  id: string;
  strategy: Strategy;
  joinsAtRound: number;
  gold: bigint;
  items: Record<Item, bigint>;
  completed: number;
  graduated: boolean;
}

export interface World {
  pricing: Pricing;
  lessons: LessonReward[];
  bloqGold: bigint;
  bloqStock: Record<Item, bigint>;
  players: Player[];
  graduates: number;
  log: string[];
}

export function newWorld(pricing: Pricing, lessons: LessonReward[], bloqGold: bigint, bloqItemSeed: bigint, players: Player[]): World {
  return {
    pricing,
    lessons,
    bloqGold,
    bloqStock: { "key-fragment": bloqItemSeed, "fuel-cell": bloqItemSeed, "contract-seal": bloqItemSeed },
    players,
    graduates: 0,
    log: [],
  };
}

export function newPlayer(id: string, strategy: Strategy, joinsAtRound: number): Player {
  return { id, strategy, joinsAtRound, gold: 0n, items: { "key-fragment": 0n, "fuel-cell": 0n, "contract-seal": 0n }, completed: 0, graduated: false };
}

export function shopOpen(w: World): boolean {
  return w.bloqGold >= w.pricing.treasury_floor;
}

export function graduationFee(w: World): bigint {
  return ITEMS.reduce((acc, item) => acc + sellPrice(w.pricing, w.bloqStock[item]), 0n);
}

function completeNext(w: World, p: Player): void {
  const lesson = w.lessons[p.completed];
  if (!lesson) return;
  p.gold += lesson.reward_gold;
  p.items[lesson.reward_item] += lesson.reward_item_amount;
  p.completed += 1;
}

function sell(w: World, p: Player, item: Item, amount: bigint): boolean {
  if (amount <= 0n || !shopOpen(w)) return false;
  const total = buyTotal(w.pricing, w.bloqStock[item], amount);
  if (w.bloqGold < total) return false;
  p.items[item] -= amount;
  w.bloqStock[item] += amount;
  w.bloqGold -= total;
  p.gold += total;
  return true;
}

function buy(w: World, p: Player, item: Item, amount: bigint): boolean {
  if (amount <= 0n || w.bloqStock[item] < amount) return false;
  const total = sellTotal(w.pricing, w.bloqStock[item], amount);
  if (p.gold < total) return false;
  p.gold -= total;
  w.bloqGold += total;
  w.bloqStock[item] -= amount;
  p.items[item] += amount;
  return true;
}

function tryGraduate(w: World, p: Player): boolean {
  if (p.graduated || p.completed < w.lessons.length) return false;
  if (ITEMS.some((i) => p.items[i] < 1n)) return false;
  const fee = graduationFee(w);
  if (p.gold < fee) return false;
  for (const i of ITEMS) {
    p.items[i] -= 1n;
    w.bloqStock[i] += 1n;
  }
  p.gold -= fee;
  w.bloqGold += fee;
  p.graduated = true;
  w.graduates += 1;
  return true;
}

/** One round: every active player makes its move. */
export function step(w: World, round: number): void {
  for (const p of w.players) {
    if (p.joinsAtRound > round || p.graduated) continue;
    completeNext(w, p);
    switch (p.strategy) {
      case "seller":
        for (const i of ITEMS) sell(w, p, i, p.items[i] > 1n ? p.items[i] - 1n : 0n);
        break;
      case "hoarder":
        break;
      case "trader": {
        // Sell surplus of whichever item Bloq pays most for right now.
        const best = [...ITEMS].sort((a, b) => Number(buyPrice(w.pricing, w.bloqStock[b]) - buyPrice(w.pricing, w.bloqStock[a])))[0];
        sell(w, p, best, p.items[best] > 1n ? p.items[best] - 1n : 0n);
        // Buy one unit of anything Bloq is dumping (below 40% of base).
        for (const i of ITEMS) {
          if (sellPrice(w.pricing, w.bloqStock[i]) * 10n < w.pricing.base_price * 4n) buy(w, p, i, 1n);
        }
        break;
      }
    }
    tryGraduate(w, p);
  }
}

export interface Snapshot {
  round: number;
  prices: Record<Item, bigint>;
  stock: Record<Item, bigint>;
  bloqGold: bigint;
  shopOpen: boolean;
  graduates: number;
  active: number;
}

export function snapshot(w: World, round: number): Snapshot {
  return {
    round,
    prices: { "key-fragment": buyPrice(w.pricing, w.bloqStock["key-fragment"]), "fuel-cell": buyPrice(w.pricing, w.bloqStock["fuel-cell"]), "contract-seal": buyPrice(w.pricing, w.bloqStock["contract-seal"]) },
    stock: { ...w.bloqStock },
    bloqGold: w.bloqGold,
    shopOpen: shopOpen(w),
    graduates: w.graduates,
    active: w.players.filter((p) => p.joinsAtRound <= round && !p.graduated).length,
  };
}
