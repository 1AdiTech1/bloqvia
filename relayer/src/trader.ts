/**
 * The NPC trader (Nov 10): a second customer at Bloq's shop, so the market moves when no human is around.
 *
 * It is a learner account like any other (`scripts/trader-create.ts` makes it and plays its three quests once; the
 * relayer holds its function-call key, limited to core). Every TRADER_INTERVAL_MIN minutes it looks at Bloq's prices
 * and makes at most one trade by the rules below. The rules are the whole strategy; read them, they are what the
 * shop's "Market · live" line explains. Prices are the contract's; the trader only decides whether to accept them.
 *
 * Its lines move with the market (Nov 11): it sells when Bloq pays RULES.band above the day's average price and buys
 * when he charges RULES.band under it. Fixed lines (55 / 40) left it waiting for a day once the prices settled between
 * them; a line relative to the average is crossed whenever the other players move the price, which is the point.
 */
import type { KeyPairString } from "near-api-js";
import { ITEMS, botFromKey, call, learner, prices, type Bot, type Item } from "./bots.js";
import { afterTrade, fairPrices } from "./market.js";
import type { NearContext } from "./near.js";

/** The rules. Gold amounts are BloqGold (the game's gold), not NEAR. */
export const RULES = {
  /** Sell one item when Bloq pays this much over the day's average price; buy one when he charges this much under it. */
  band: 3n,
  /** Never spend the last gold: keep at least this much after a buy. */
  keepGold: 30n,
  /** Never sell the last one of an item (so there is always something to sell when the price is right). */
  keepItems: 1n,
  /** At most one trade per tick. */
  intervalMin: Number(process.env.TRADER_INTERVAL_MIN ?? 20),
} as const;

export interface TraderMove { kind: "sell" | "buy"; token_id: Item; amount: number; price: string; at: number; txHash: string }
/** The two lines as they stand now (the day's average ± band), the numbers the shop prints. */
export interface TraderLines { sellAbove: bigint; buyBelow: bigint }
export interface TraderState { accountId: string | null; on: boolean; last: TraderMove | null; lastTick: number | null; note: string; lines: TraderLines | null }

const state: TraderState = { accountId: null, on: false, last: null, lastTick: null, note: "off: TRADER_ACCOUNT_ID / TRADER_PRIVATE_KEY not set", lines: null };
export function traderState(): TraderState { return state; }

/** The lines from a fair price: the average over the items of the day's average buy price. Pure, tested. */
export function lines(fair: Record<string, bigint> | null, p: { buy: Record<Item, bigint> }): TraderLines {
  const ref = fair && ITEMS.every((i) => fair[i] !== undefined) ? ITEMS.reduce((a, i) => a + fair[i]!, 0n) / BigInt(ITEMS.length) : ITEMS.reduce((a, i) => a + p.buy[i], 0n) / BigInt(ITEMS.length);
  return { sellAbove: ref + RULES.band, buyBelow: ref - RULES.band };
}

/** What the trader would do now, from prices, its lines and what it holds. Pure, so it is tested. */
export function decide(p: { shop_open: boolean; buy: Record<Item, bigint>; sell: Record<Item, bigint> }, mine: { gold: bigint; items: Record<Item, bigint> }, l: TraderLines): { kind: "sell" | "buy"; token_id: Item; price: bigint } | null {
  if (!p.shop_open) return null;
  // sell: the item Bloq pays most for, if above the line and we can spare one
  const sellable = ITEMS.filter((i) => mine.items[i] > RULES.keepItems && p.buy[i] >= l.sellAbove).sort((a, b) => Number(p.buy[b] - p.buy[a]));
  if (sellable[0]) return { kind: "sell", token_id: sellable[0], price: p.buy[sellable[0]] };
  // buy: the item Bloq charges least for, if below the line and we keep our floor
  const buyable = ITEMS.filter((i) => p.sell[i] <= l.buyBelow && mine.gold - p.sell[i] >= RULES.keepGold).sort((a, b) => Number(p.sell[a] - p.sell[b]));
  if (buyable[0]) return { kind: "buy", token_id: buyable[0], price: p.sell[buyable[0]] };
  return null;
}

export async function traderTick(ctx: NearContext, bot: Bot, log: (s: string) => void = console.log): Promise<TraderMove | null> {
  state.lastTick = Date.now();
  const [p, me] = await Promise.all([prices(ctx), learner(ctx, bot.accountId)]);
  const l = lines(fairPrices(), p);
  state.lines = l;
  const d = decide(p, me, l);
  if (!d) { state.note = p.shop_open ? `waiting: no price past the lines (${l.buyBelow} / ${l.sellAbove})` : "waiting: the shop is closed"; return null; }
  const r = await call(ctx, bot, d.kind === "sell" ? "sell_to_bloq" : "buy_from_bloq", { token_id: d.token_id, amount: "1" });
  const move: TraderMove = { kind: d.kind, token_id: d.token_id, amount: 1, price: d.price.toString(), at: Date.now(), txHash: r.txHash };
  state.last = move; state.note = "";
  afterTrade(ctx);
  log(`[trader] ${d.kind} 1 ${d.token_id} at ${d.price} gold tx=${r.txHash}`);
  return move;
}

/** Start the trader if its key is configured. One tick now, then every RULES.intervalMin minutes. */
export function startTrader(ctx: NearContext, env: NodeJS.ProcessEnv = process.env): (() => void) | null {
  const accountId = env.TRADER_ACCOUNT_ID, key = env.TRADER_PRIVATE_KEY as KeyPairString | undefined;
  if (!accountId || !key) return null;
  const bot = botFromKey(ctx, accountId, key);
  state.accountId = accountId; state.on = true; state.note = "starting";
  const tick = () => traderTick(ctx, bot).catch((e) => { state.note = `error: ${(e as Error).message}`; console.error(`[trader] ${(e as Error).message}`); });
  void tick();
  const id = setInterval(tick, RULES.intervalMin * 60 * 1000);
  return () => clearInterval(id);
}
