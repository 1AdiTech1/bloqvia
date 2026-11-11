/**
 * Fast-forward (Nov 10): "watch a day of trading" in about two minutes. Six scripted learners sign up, play the founding
 * quests and trade with Bloq for six rounds while the shop page polls GET /market and watches the curves move.
 *
 * It is the live simulation (`scripts/simulate.ts`) inside the relayer, capped so a public button cannot drain the
 * relayer: one run at a time, one run per FF_EVERY_MIN minutes, FF_DAILY_CAP runs per UTC day. Each run creates
 * FF_PLAYERS learner accounts (0.01 NEAR each, like any player). The strategies are scripted, not a model, so a run
 * is reproducible; prices are the contract's.
 */
import { ITEMS, call, learner, newBot, playQuests, prices, type Bot, type Item, type Prices } from "./bots.js";
import { pause } from "./near.js";
import { fairPrices, takeSnapshot } from "./market.js";
import type { NearContext } from "./near.js";

export const FF = {
  players: Number(process.env.FF_PLAYERS ?? 4),
  rounds: 6,
  everyMin: Number(process.env.FF_EVERY_MIN ?? 10),
  dailyCap: Number(process.env.FF_DAILY_CAP ?? 24),
} as const;

type Strategy = "seller" | "trader" | "hoarder";
const STRATEGIES: Strategy[] = ["seller", "trader", "hoarder", "seller", "trader", "hoarder"];
const LABEL: Record<Item, string> = { "key-fragment": "Key Fragment", "fuel-cell": "Fuel Cell", "contract-seal": "Contract Seal" };
/**
 * The players react to Bloq's prices like people do, each with their own idea of a fair price (Nov 11): the fair
 * price is the day's average (market.ts), and player i accepts `slack(i)` gold less than it when selling, or more
 * when buying. A seller sells near the average, a hoarder buys near it, a trader waits for the price to leave it.
 * Fixed lines (cheap 40 / dear 50) left all six waiting once the prices settled between them.
 */
export const LINES = { maxSlack: 4n, keepGold: 20n, maxBuy: 4n } as const;
export const slack = (i: number) => 1n + BigInt(i % Number(LINES.maxSlack));

export interface FFLine { at: number; who: string; text: string; txHash?: string }
export interface FFState { running: boolean; round: number; rounds: number; startedAt: number | null; finishedAt: number | null; nextAt: number; runsToday: number; dailyCap: number; log: FFLine[]; error: string | null }

const state: FFState = { running: false, round: 0, rounds: FF.rounds, startedAt: null, finishedAt: null, nextAt: 0, runsToday: 0, dailyCap: FF.dailyCap, log: [], error: null };
let day = new Date().toISOString().slice(0, 10);
export function ffState(): FFState { return state; }

const short = (id: string) => `${id.split(".")[0]?.slice(0, 12) ?? id}…`;
const plural = (n: bigint | number, s: string) => `${n} ${s}${Number(n) === 1 ? "" : "s"}`;

/** Can a run start now? Returns the reason it cannot, or null. Pure, so it is tested. */
export function gate(s: FFState, now = Date.now()): string | null {
  if (s.running) return "A run is in progress";
  if (now < s.nextAt) return `Next run in ${Math.ceil((s.nextAt - now) / 60000)} min`;
  if (s.runsToday >= s.dailyCap) return "Today's runs are used up; tomorrow again";
  return null;
}

type Move = { kind: "sell" | "buy"; token_id: Item; amount: bigint; price: bigint } | null;

/**
 * One trade for a player this round, from the prices, the fair prices and what it holds. `fair` is the day's average
 * buy price per item (the current price when there is no history yet); `s` is this player's slack. Pure, so it is tested.
 */
export function plan(strategy: Strategy, p: Prices, me: { gold: bigint; items: Record<Item, bigint> }, fair: Record<string, bigint> | null = null, s: bigint = 2n): Move {
  if (!p.shop_open) return null;
  const ref = (it: Item) => fair?.[it] ?? p.buy[it];
  const canBuy = (it: Item) => { const n = (me.gold - LINES.keepGold) / p.sell[it]; return n < p.stock[it] ? n : p.stock[it]; };
  const spare = (it: Item) => (me.items[it] > 1n ? me.items[it] - 1n : 0n);
  // among what it can spare, the item Bloq pays best for relative to its average; among what it can afford, the one he charges least for
  const dearest = ITEMS.filter((it) => spare(it) > 0n).sort((a, b) => Number((p.buy[b] - ref(b)) - (p.buy[a] - ref(a))))[0];
  const cheapest = ITEMS.filter((it) => canBuy(it) >= 1n).sort((a, b) => Number((p.sell[a] - ref(a)) - (p.sell[b] - ref(b))))[0];
  if (strategy === "seller") {
    // sells what it can spare as long as Bloq pays no more than `s` under the average
    if (dearest && p.buy[dearest] >= ref(dearest) - s) return { kind: "sell", token_id: dearest, amount: spare(dearest), price: p.buy[dearest] };
    return null;
  }
  if (strategy === "hoarder") {
    // buys the relatively cheapest item as long as Bloq charges no more than `s` over the average, while the gold lasts
    if (cheapest && p.sell[cheapest] <= ref(cheapest) + s) return { kind: "buy", token_id: cheapest, amount: canBuy(cheapest) < LINES.maxBuy ? canBuy(cheapest) : LINES.maxBuy, price: p.sell[cheapest] };
    return null;
  }
  // trader: one unit at a time; sells when Bloq pays `s` over the average, else buys when he charges `s` under it
  if (dearest && p.buy[dearest] >= ref(dearest) + s) return { kind: "sell", token_id: dearest, amount: 1n, price: p.buy[dearest] };
  if (cheapest && p.sell[cheapest] <= ref(cheapest) - s) return { kind: "buy", token_id: cheapest, amount: 1n, price: p.sell[cheapest] };
  return null;
}

async function playerRound(ctx: NearContext, bot: Bot, strategy: Strategy, i: number, r: number, p: Prices, say: (text: string, tx?: string) => void): Promise<void> {
  if (r <= 3) {
    const n = await playQuests(ctx, bot, r);
    if (n) say(`finished quest ${r}: +100 gold and 3 ${LABEL[ITEMS[r - 1]!]}s`);
    if (r < 3) return;
  }
  const me = await learner(ctx, bot.accountId);
  const m = plan(strategy, p, me, fairPrices(), slack(i));
  if (!m) { say(p.shop_open ? "waited for a better price" : "found the shop closed"); return; }
  const res = await call(ctx, bot, m.kind === "sell" ? "sell_to_bloq" : "buy_from_bloq", { token_id: m.token_id, amount: m.amount.toString() });
  say(`${m.kind === "sell" ? "sold" : "bought"} ${plural(m.amount, LABEL[m.token_id])} ${m.kind === "sell" ? "to" : "from"} Bloq at ${m.price} gold`, res.txHash);
}

async function run(ctx: NearContext, log: (s: string) => void): Promise<void> {
  const bots: { bot: Bot; strategy: Strategy }[] = [];
  const say = (who: string) => (text: string, txHash?: string) => { state.log.push({ at: Date.now(), who, text, ...(txHash ? { txHash } : {}) }); if (state.log.length > 60) state.log.shift(); };
  const snap = () => takeSnapshot(ctx).catch((e) => log(`[fastforward] snapshot skipped: ${(e as Error).message}`));
  for (let i = 0; i < FF.players; i++) {
    const bot = await newBot(ctx);
    bots.push({ bot, strategy: STRATEGIES[i % STRATEGIES.length]! });
    say(short(bot.accountId))("signed up: a new NEAR account, the relayer paid");
    await pause(300);
  }
  await snap();
  for (let r = 1; r <= FF.rounds; r++) {
    state.round = r;
    const p = await prices(ctx); // one read per round, shared by the players (the public RPC rate-limits bursts)
    for (let i = 0; i < bots.length; i += 2) { // two at a time: under the public RPC's burst limit, with the retry behind it
      await Promise.all(bots.slice(i, i + 2).map(({ bot, strategy }, j) => playerRound(ctx, bot, strategy, i + j, r, p, say(short(bot.accountId))).catch((e) => say(short(bot.accountId))(`hit an error: ${(e as Error).message}`))));
      await pause(200);
    }
    await snap();
    log(`[fastforward] round ${r}/${FF.rounds} done`);
  }
}

/** Start a run in the background. Throws with a reason when the gate is closed. */
export function startFastForward(ctx: NearContext, log: (s: string) => void = console.log): FFState {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; state.runsToday = 0; }
  const why = gate(state);
  if (why) throw new Error(why);
  state.running = true; state.round = 0; state.startedAt = Date.now(); state.finishedAt = null; state.log = []; state.error = null; state.runsToday += 1;
  state.nextAt = Date.now() + FF.everyMin * 60 * 1000;
  run(ctx, log)
    .catch((e) => { state.error = (e as Error).message; console.error(`[fastforward] ${(e as Error).message}`); })
    .finally(() => { state.running = false; state.finishedAt = Date.now(); log(`[fastforward] finished in ${Math.round((Date.now() - (state.startedAt ?? Date.now())) / 1000)} s`); });
  return state;
}

/**
 * The market never sleeps (Nov 11): a run by itself every FF_AUTO_HOURS hours (0 turns it off), inside the same gate
 * and daily cap as the button, so the curves move overnight too. Six accounts at 0.01 NEAR each per run: ~0.4 NEAR a
 * day at the default of every four hours.
 */
export const FF_AUTO_HOURS = Number(process.env.FF_AUTO_HOURS ?? 2);
export function scheduleFastForward(ctx: NearContext, hours = FF_AUTO_HOURS, log: (s: string) => void = console.log): (() => void) | null {
  if (!(hours > 0)) return null;
  const tick = () => { try { startFastForward(ctx, log); log("[fastforward] scheduled run started"); } catch (e) { log(`[fastforward] scheduled run skipped: ${(e as Error).message}`); } };
  const id = setInterval(tick, hours * 60 * 60 * 1000);
  return () => clearInterval(id);
}
