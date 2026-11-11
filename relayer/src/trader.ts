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
 *
 * The trader thinks (Nov 11): with a NEAR AI key, an agent on NEAR AI Cloud picks the move, with a one-line reason, but
 * only among the moves the rules allow right now (`allowedMoves`); a move outside that list is overruled and the trader
 * holds. The model never sets a price, never mints, never touches another account: it plays, like a person, inside caps
 * it cannot change. The reason and the model's signature are shown on the shop. Without a key the rules decide alone.
 *
 * The restock rule (Nov 11, evening): a trader that has no spare of an item buys it back on a RESTOCK_BAND dip, and a
 * trader too short of gold to buy anything sells on a RESTOCK_BAND rise. Without it the bear sold down to its last
 * item and the bull spent down to its floor within a day, and both then held forever; with it they keep trading, still
 * only inside their lines, still only accepting or refusing Bloq's prices.
 */
import { chat, extractJson, fetchSignature, signatureMatches, type AiConfig } from "./ai.js";
import type { KeyPairString } from "near-api-js";
import { ITEMS, botFromKey, call, learner, prices, type Bot, type Item } from "./bots.js";
import { afterTrade, fairPrices } from "./market.js";
import type { NearContext } from "./near.js";

/** The rules. Gold amounts are BloqGold (the game's gold), not NEAR. */
export const RULES = {
  /** The patient trader's band: sell one item when Bloq pays this much over the day's average price; buy one when he charges this much under it. */
  band: 3n,
  /** Never spend the last gold: keep at least this much after a buy. */
  keepGold: 30n,
  /** Never sell the last one of an item (so there is always something to sell when the price is right). */
  keepItems: 1n,
  /** At most one trade per tick. */
  intervalMin: Number(process.env.TRADER_INTERVAL_MIN ?? 5),
} as const;

export interface TraderMove { kind: "sell" | "buy"; token_id: Item; amount: number; price: string; at: number; txHash: string; reason?: string }
/** What the agent said at its last look, acted on or not. */
export interface Thought {
  at: number;
  /** what it chose; "hold" when it chose nothing or was overruled */
  move: "sell" | "buy" | "hold";
  token_id: Item | null;
  reason: string;
  /** the moves the rules allowed at that moment, e.g. ["buy fuel-cell", "hold"] */
  allowed: string[];
  /** true when the model asked for a move the rules did not allow (the trader held instead) */
  overruled: boolean;
  generated_by: { provider: "NEAR AI Cloud"; model: string; chat_id: string; signature_kind: string | null };
}
/** The two lines as they stand now (the day's average ± band), the numbers the shop prints, and the average they hang on. */
export interface TraderLines { sellAbove: bigint; buyBelow: bigint; ref: bigint }
/** The restock rule's band: with no spare of an item, buy it back this close to the average; short of gold, sell this close. */
export const RESTOCK_BAND = 1n;
/**
 * Three temperaments (Nov 11), so the traders disagree on the same prices: the patient one waits for a 3-gold move
 * either way; the bull buys on a 1-gold dip and sells only 3 up; the bear sells on a 1-gold rise and buys only 3 down.
 * Bull and bear push against each other, the patient one is the reference. Same rules otherwise, same cage.
 */
export interface Temper { name: "patient" | "bull" | "bear"; sellBand: bigint; buyBand: bigint; line: string }
export const TEMPERS: Temper[] = [
  { name: "patient", sellBand: 3n, buyBand: 3n, line: "waits for a 3-gold move either way" },
  { name: "bull", sellBand: 3n, buyBand: 1n, line: "buys on a 1-gold dip, sells only 3 up" },
  { name: "bear", sellBand: 1n, buyBand: 3n, line: "sells on a 1-gold rise, buys only 3 down" },
];
export interface TraderState { accountId: string | null; on: boolean; mind: "ai" | "rules"; temper: Temper["name"]; temperLine: string; last: TraderMove | null; lastThought: Thought | null; lastTick: number | null; note: string; lines: TraderLines | null }

function fresh(temper: Temper): TraderState {
  return { accountId: null, on: false, mind: "rules", temper: temper.name, temperLine: temper.line, last: null, lastThought: null, lastTick: null, note: "off: TRADER_ACCOUNT_ID / TRADER_PRIVATE_KEY not set", lines: null };
}
const states: TraderState[] = [fresh(TEMPERS[0]!)];
/** Every trader that is configured. */
export function tradersState(): TraderState[] { return states; }
/** The trader with the most recent thought or move (what the shop's one line shows); the patient one when none has looked yet. */
export function traderState(): TraderState {
  const at = (t: TraderState) => Math.max(t.lastThought?.at ?? 0, t.last?.at ?? 0, t.lastTick ?? 0);
  return [...states].sort((a, b) => at(b) - at(a))[0] ?? states[0]!;
}

/** The lines from a fair price (the average over the items of the day's average buy price) and a temperament. Pure, tested. */
export function lines(fair: Record<string, bigint> | null, p: { buy: Record<Item, bigint> }, temper: Temper = TEMPERS[0]!): TraderLines {
  const ref = fair && ITEMS.every((i) => fair[i] !== undefined) ? ITEMS.reduce((a, i) => a + fair[i]!, 0n) / BigInt(ITEMS.length) : ITEMS.reduce((a, i) => a + p.buy[i], 0n) / BigInt(ITEMS.length);
  return { sellAbove: ref + temper.sellBand, buyBelow: ref - temper.buyBand, ref };
}

/** Short of gold: no buy would keep the floor, so the trader sells on a RESTOCK_BAND rise instead of its own band. */
export function shortOfGold(p: { sell: Record<Item, bigint> }, mine: { gold: bigint }): boolean {
  return !ITEMS.some((i) => mine.gold - p.sell[i] >= RULES.keepGold);
}
/** The lines that apply to one item now: the temper's, tightened to RESTOCK_BAND where the restock rule applies. */
export function linesFor(item: Item, p: { sell: Record<Item, bigint> }, mine: { gold: bigint; items: Record<Item, bigint> }, l: TraderLines): { sellAbove: bigint; buyBelow: bigint; restock: boolean; refill: boolean } {
  const restock = mine.items[item] <= RULES.keepItems, refill = shortOfGold(p, mine);
  const min = (a: bigint, b: bigint) => (a < b ? a : b), max = (a: bigint, b: bigint) => (a > b ? a : b);
  return { sellAbove: refill ? min(l.sellAbove, l.ref + RESTOCK_BAND) : l.sellAbove, buyBelow: restock ? max(l.buyBelow, l.ref - RESTOCK_BAND) : l.buyBelow, restock, refill };
}

/** What the trader would do now, from prices, its lines and what it holds. Pure, so it is tested. */
export function decide(p: { shop_open: boolean; buy: Record<Item, bigint>; sell: Record<Item, bigint>; stock?: Record<Item, bigint> }, mine: { gold: bigint; items: Record<Item, bigint> }, l: TraderLines): { kind: "sell" | "buy"; token_id: Item; price: bigint } | null {
  const allowed = allowedMoves({ ...p, stock: p.stock ?? items(99n) }, mine, l);
  // sell: the item Bloq pays most for; else buy: the item he charges least for
  const sells = allowed.filter((a) => a.kind === "sell").sort((a, b) => Number(b.price - a.price));
  if (sells[0]) return sells[0];
  const buys = allowed.filter((a) => a.kind === "buy").sort((a, b) => Number(a.price - b.price));
  return buys[0] ?? null;
}
const items = (n: bigint): Record<Item, bigint> => ({ "key-fragment": n, "fuel-cell": n, "contract-seal": n });

type Prices = { shop_open: boolean; buy: Record<Item, bigint>; sell: Record<Item, bigint>; stock: Record<Item, bigint> };
type Mine = { gold: bigint; items: Record<Item, bigint> };
export type Allowed = { kind: "sell" | "buy"; token_id: Item; price: bigint };

/** Every move the rules allow right now (the agent may pick one of these, or hold). Pure, tested. */
export function allowedMoves(p: Prices, mine: Mine, l: TraderLines): Allowed[] {
  if (!p.shop_open) return [];
  const out: Allowed[] = [];
  for (const i of ITEMS) {
    const li = linesFor(i, p, mine, l);
    if (mine.items[i] > RULES.keepItems && p.buy[i] >= li.sellAbove) out.push({ kind: "sell", token_id: i, price: p.buy[i] });
    if (p.sell[i] <= li.buyBelow && mine.gold - p.sell[i] >= RULES.keepGold && p.stock[i] >= 1n) out.push({ kind: "buy", token_id: i, price: p.sell[i] });
  }
  return out;
}
const label = (a: Allowed) => `${a.kind} ${a.token_id}`;

export const THOUGHT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["move", "item", "reason"],
  properties: {
    move: { type: "string", enum: ["sell", "buy", "hold"] },
    item: { type: "string", enum: [...ITEMS, "none"] },
    reason: { type: "string", description: "One or two short sentences, under 180 characters, in the first person, naming the number that decided it" },
  },
} as const;
export const MAX_REASON = 200;
/** Cut a long reason at a word boundary, never mid-word. */
export function trimReason(s: string, max = MAX_REASON): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","), cut.lastIndexOf(";"));
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,;—-]+$/, "")}…`;
}
/** The agent's rules, as the model reads them. The numbers are filled per tick. */
export const TRADER_PROMPT = `You are one of the NPC traders in Bloq's shop in Bloqvia, a game on NEAR testnet. You hold a little gold and a few items and you trade with Bloq, whose prices come from a rule in the contract: the more of an item he holds, the less he pays. You cannot set prices, mint anything, or touch anyone else's balance. You may only pick a move from the list you are given, or hold. Pick the move a careful trader would, and say why in one sentence, in the first person, naming the number that decided it (a price against the day's average, or what you hold). Never answer with just "I hold": a hold has a reason too. Decide before you write: the sentence states the decision and its number, with no second thoughts, no "wait" and no corrections in it. Never mention money, dollars, investing or that anything has value outside the game. Answer only with the JSON object.`;

/** The model's choice, checked against the rules: a move not in `allowed` is overruled and becomes a hold. Pure, tested. */
export function judge(raw: unknown, allowed: Allowed[]): { move: "sell" | "buy" | "hold"; token_id: Item | null; reason: string; overruled: boolean; pick: Allowed | null } {
  const o = (raw ?? {}) as { move?: unknown; item?: unknown; reason?: unknown };
  const reason = trimReason(String(typeof o.reason === "string" ? o.reason : "")) || "No reason given.";
  const move = o.move === "sell" || o.move === "buy" ? o.move : "hold";
  const item = (ITEMS as readonly string[]).includes(String(o.item)) ? (o.item as Item) : null;
  if (move === "hold") return { move, token_id: null, reason, overruled: false, pick: null };
  const pick = allowed.find((a) => a.kind === move && a.token_id === item) ?? null;
  if (!pick) return { move: "hold", token_id: null, reason: trimReason(`Wanted to ${move} ${item ?? "something"}; the rules did not allow it, so I hold. (${reason})`, MAX_REASON + 60), overruled: true, pick: null };
  return { move, token_id: pick.token_id, reason, overruled: false, pick };
}

async function think(ai: AiConfig, model: string, p: Prices, me: Mine, l: TraderLines, fair: Record<string, bigint> | null, allowed: Allowed[], log: (s: string) => void, temper: Temper = TEMPERS[0]!): Promise<Thought> {
  const lines = ITEMS.map((i) => `${i}: Bloq pays ${p.buy[i]}, charges ${p.sell[i]}, holds ${p.stock[i]}; day average ${fair?.[i] ?? p.buy[i]}; I hold ${me.items[i]}`).join("\n");
  const restocking = ITEMS.filter((i) => linesFor(i, p, me, l).restock);
  const refill = shortOfGold(p, me);
  const restockLine = restocking.length ? ` I have no spare ${restocking.join(" or ")}, so I buy it back when Bloq charges ${l.ref - RESTOCK_BAND} or less.` : "";
  const refillLine = refill ? ` I am short of gold, so I sell when Bloq pays ${l.ref + RESTOCK_BAND} or more.` : "";
  const user = `I am the ${temper.name} trader: I ${temper.line}. My lines today: sell when Bloq pays ${l.sellAbove} or more, buy when he charges ${l.buyBelow} or less.${restockLine}${refillLine} I keep ${RULES.keepGold} gold and never sell my last item. I have ${me.gold} gold.\n${lines}\n${allowed.length ? `Moves the rules allow right now: ${allowed.map(label).join(", ")}; "hold" is always allowed.\nChoose, and say which number decided it.` : `No move is allowed right now; only a hold. Say which item is closest to one of my lines and by how many gold, so a reader sees what you are waiting for.`}`;
  const completion = await chat(ai, model, [{ role: "system", content: TRADER_PROMPT }, { role: "user", content: user }], { jsonSchema: { name: "bloqvia_trader", schema: THOUGHT_SCHEMA as unknown as Record<string, unknown> }, maxTokens: 400, temperature: 0.4, thinking: false });
  let raw: unknown = null;
  try { raw = JSON.parse(extractJson(completion.content)); } catch { raw = null; }
  const j = judge(raw, allowed);
  const sig = await fetchSignature(ai, completion).catch(() => null);
  const verified = sig ? signatureMatches(completion, sig) : false;
  log(`[trader:${temper.name}] thought: ${j.move}${j.token_id ? ` ${j.token_id}` : ""}${j.overruled ? " (overruled)" : ""} — ${JSON.stringify(j.reason)} sig=${verified ? sig!.signature_kind : "none"}`);
  return { at: Date.now(), move: j.move, token_id: j.token_id, reason: j.reason, allowed: [...allowed.map(label), "hold"], overruled: j.overruled, generated_by: { provider: "NEAR AI Cloud", model: completion.model, chat_id: completion.id, signature_kind: verified ? sig!.signature_kind : null } };
}

export async function traderTick(ctx: NearContext, bot: Bot, log: (s: string) => void = console.log, ai: { cfg: AiConfig; model: string } | null = null, state: TraderState = states[0]!, temper: Temper = TEMPERS[0]!): Promise<TraderMove | null> {
  state.lastTick = Date.now();
  const [p, me] = await Promise.all([prices(ctx), learner(ctx, bot.accountId)]);
  const fair = fairPrices();
  const l = lines(fair, p, temper);
  state.lines = l;
  const allowed = allowedMoves(p, me, l);
  let d: Allowed | null = null, reason: string | undefined;
  if (ai && p.shop_open) {
    // the agent chooses among what the rules allow; a slip in the model (or the gateway) falls back to the rules
    try { const t = await think(ai.cfg, ai.model, p, me, l, fair, allowed, log, temper); state.lastThought = t; d = judge({ move: t.move, item: t.token_id ?? "none", reason: t.reason }, allowed).pick; reason = t.reason; }
    catch (e) { log(`[trader:${temper.name}] the agent did not answer (${(e as Error).message}); the rules decide`); d = decide(p, me, l); }
  } else {
    d = decide(p, me, l);
  }
  if (!d) { state.note = p.shop_open ? (reason ? `held: ${reason}` : `waiting: no price past the lines (${l.buyBelow} / ${l.sellAbove})`) : "waiting: the shop is closed"; return null; }
  const r = await call(ctx, bot, d.kind === "sell" ? "sell_to_bloq" : "buy_from_bloq", { token_id: d.token_id, amount: "1" });
  const move: TraderMove = { kind: d.kind, token_id: d.token_id, amount: 1, price: d.price.toString(), at: Date.now(), txHash: r.txHash, ...(reason ? { reason } : {}) };
  state.last = move; state.note = "";
  afterTrade(ctx);
  log(`[trader:${temper.name}] ${d.kind} 1 ${d.token_id} at ${d.price} gold tx=${r.txHash}`);
  return move;
}

/**
 * Start every trader whose key is configured: TRADER_ACCOUNT_ID/TRADER_PRIVATE_KEY is the patient one, TRADER2_* the
 * bull, TRADER3_* the bear. One tick now, then every RULES.intervalMin minutes; the traders look in turn, never at
 * once, so the relayer's one key never races itself. Returns null when no trader is configured.
 */
export function startTrader(ctx: NearContext, env: NodeJS.ProcessEnv = process.env): (() => void) | null {
  const ai = ctx.config.ai && env.TRADER_MIND !== "rules" ? { cfg: ctx.config.ai, model: env.TRADER_MODEL ?? ctx.config.ai.chatModel } : null;
  const traders: { bot: Bot; state: TraderState; temper: Temper }[] = [];
  states.length = 0;
  TEMPERS.forEach((temper, i) => {
    const prefix = i === 0 ? "TRADER" : `TRADER${i + 1}`;
    const accountId = env[`${prefix}_ACCOUNT_ID`], key = env[`${prefix}_PRIVATE_KEY`] as KeyPairString | undefined;
    if (!accountId || !key) return;
    const state = fresh(temper);
    state.accountId = accountId; state.on = true; state.mind = ai ? "ai" : "rules"; state.note = "starting";
    states.push(state);
    traders.push({ bot: botFromKey(ctx, accountId, key), state, temper });
  });
  if (!traders.length) { states.push(fresh(TEMPERS[0]!)); return null; }
  const tick = async () => {
    for (const t of traders) {
      await traderTick(ctx, t.bot, console.log, ai, t.state, t.temper).catch((e) => { t.state.note = `error: ${(e as Error).message}`; console.error(`[trader:${t.temper.name}] ${(e as Error).message}`); });
    }
  };
  void tick();
  const id = setInterval(() => void tick(), RULES.intervalMin * 60 * 1000);
  return () => clearInterval(id);
}
