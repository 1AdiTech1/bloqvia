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
 */
import { chat, extractJson, fetchSignature, signatureMatches, type AiConfig } from "./ai.js";
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
/** The two lines as they stand now (the day's average ± band), the numbers the shop prints. */
export interface TraderLines { sellAbove: bigint; buyBelow: bigint }
export interface TraderState { accountId: string | null; on: boolean; mind: "ai" | "rules"; last: TraderMove | null; lastThought: Thought | null; lastTick: number | null; note: string; lines: TraderLines | null }

const state: TraderState = { accountId: null, on: false, mind: "rules", last: null, lastThought: null, lastTick: null, note: "off: TRADER_ACCOUNT_ID / TRADER_PRIVATE_KEY not set", lines: null };
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

type Prices = { shop_open: boolean; buy: Record<Item, bigint>; sell: Record<Item, bigint>; stock: Record<Item, bigint> };
type Mine = { gold: bigint; items: Record<Item, bigint> };
export type Allowed = { kind: "sell" | "buy"; token_id: Item; price: bigint };

/** Every move the rules allow right now (the agent may pick one of these, or hold). Pure, tested. */
export function allowedMoves(p: Prices, mine: Mine, l: TraderLines): Allowed[] {
  if (!p.shop_open) return [];
  const out: Allowed[] = [];
  for (const i of ITEMS) {
    if (mine.items[i] > RULES.keepItems && p.buy[i] >= l.sellAbove) out.push({ kind: "sell", token_id: i, price: p.buy[i] });
    if (p.sell[i] <= l.buyBelow && mine.gold - p.sell[i] >= RULES.keepGold && p.stock[i] >= 1n) out.push({ kind: "buy", token_id: i, price: p.sell[i] });
  }
  return out;
}
const label = (a: Allowed) => `${a.kind} ${a.token_id}`;

export const THOUGHT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["move", "item", "reason"],
  properties: {
    move: { type: "string", enum: ["sell", "buy", "hold"] },
    item: { type: "string", enum: [...ITEMS, "none"] },
    reason: { type: "string", description: "One sentence, max 140 characters, in the first person, naming the number that decided it" },
  },
} as const;
export const MAX_REASON = 140;
/** The agent's rules, as the model reads them. The numbers are filled per tick. */
export const TRADER_PROMPT = `You are the NPC trader in Bloq's shop in Bloqvia, a game on NEAR testnet. You hold a little gold and a few items and you trade with Bloq, whose prices come from a rule in the contract: the more of an item he holds, the less he pays. You cannot set prices, mint anything, or touch anyone else's balance. You may only pick a move from the list you are given, or hold. Pick the move a careful trader would, and say why in one sentence, in the first person, naming the number that decided it (a price against the day's average, or what you hold). Never answer with just "I hold": a hold has a reason too. Never mention money, dollars, investing or that anything has value outside the game. Answer only with the JSON object.`;

/** The model's choice, checked against the rules: a move not in `allowed` is overruled and becomes a hold. Pure, tested. */
export function judge(raw: unknown, allowed: Allowed[]): { move: "sell" | "buy" | "hold"; token_id: Item | null; reason: string; overruled: boolean; pick: Allowed | null } {
  const o = (raw ?? {}) as { move?: unknown; item?: unknown; reason?: unknown };
  const reason = String(typeof o.reason === "string" ? o.reason : "").replace(/\s+/g, " ").trim().slice(0, MAX_REASON) || "No reason given.";
  const move = o.move === "sell" || o.move === "buy" ? o.move : "hold";
  const item = (ITEMS as readonly string[]).includes(String(o.item)) ? (o.item as Item) : null;
  if (move === "hold") return { move, token_id: null, reason, overruled: false, pick: null };
  const pick = allowed.find((a) => a.kind === move && a.token_id === item) ?? null;
  if (!pick) return { move: "hold", token_id: null, reason: `Wanted to ${move} ${item ?? "something"}; the rules did not allow it, so I hold. (${reason})`.slice(0, MAX_REASON + 60), overruled: true, pick: null };
  return { move, token_id: pick.token_id, reason, overruled: false, pick };
}

async function think(ai: AiConfig, model: string, p: Prices, me: Mine, l: TraderLines, fair: Record<string, bigint> | null, allowed: Allowed[], log: (s: string) => void): Promise<Thought> {
  const lines = ITEMS.map((i) => `${i}: Bloq pays ${p.buy[i]}, charges ${p.sell[i]}, holds ${p.stock[i]}; day average ${fair?.[i] ?? p.buy[i]}; I hold ${me.items[i]}`).join("\n");
  const user = `My lines today: sell when Bloq pays ${l.sellAbove} or more, buy when he charges ${l.buyBelow} or less. I keep ${RULES.keepGold} gold and never sell my last item. I have ${me.gold} gold.\n${lines}\nMoves the rules allow right now: ${allowed.length ? allowed.map(label).join(", ") : "none"}; "hold" is always allowed.\n${allowed.length ? "Choose, and say which number decided it." : "Only a hold is possible: say which item is closest to one of my lines and by how many gold, so a reader sees what you are waiting for."}`;
  const completion = await chat(ai, model, [{ role: "system", content: TRADER_PROMPT }, { role: "user", content: user }], { jsonSchema: { name: "bloqvia_trader", schema: THOUGHT_SCHEMA as unknown as Record<string, unknown> }, maxTokens: 400, temperature: 0.4, thinking: false });
  let raw: unknown = null;
  try { raw = JSON.parse(extractJson(completion.content)); } catch { raw = null; }
  const j = judge(raw, allowed);
  const sig = await fetchSignature(ai, completion).catch(() => null);
  const verified = sig ? signatureMatches(completion, sig) : false;
  log(`[trader] thought: ${j.move}${j.token_id ? ` ${j.token_id}` : ""}${j.overruled ? " (overruled)" : ""} — ${JSON.stringify(j.reason)} sig=${verified ? sig!.signature_kind : "none"}`);
  return { at: Date.now(), move: j.move, token_id: j.token_id, reason: j.reason, allowed: [...allowed.map(label), "hold"], overruled: j.overruled, generated_by: { provider: "NEAR AI Cloud", model: completion.model, chat_id: completion.id, signature_kind: verified ? sig!.signature_kind : null } };
}

export async function traderTick(ctx: NearContext, bot: Bot, log: (s: string) => void = console.log, ai: { cfg: AiConfig; model: string } | null = null): Promise<TraderMove | null> {
  state.lastTick = Date.now();
  const [p, me] = await Promise.all([prices(ctx), learner(ctx, bot.accountId)]);
  const fair = fairPrices();
  const l = lines(fair, p);
  state.lines = l;
  const allowed = allowedMoves(p, me, l);
  let d: Allowed | null = null, reason: string | undefined;
  if (ai && p.shop_open) {
    // the agent chooses among what the rules allow; a slip in the model (or the gateway) falls back to the rules
    try { const t = await think(ai.cfg, ai.model, p, me, l, fair, allowed, log); state.lastThought = t; d = judge({ move: t.move, item: t.token_id ?? "none", reason: t.reason }, allowed).pick; reason = t.reason; }
    catch (e) { log(`[trader] the agent did not answer (${(e as Error).message}); the rules decide`); d = decide(p, me, l); }
  } else {
    d = decide(p, me, l);
  }
  if (!d) { state.note = p.shop_open ? (reason ? `held: ${reason}` : `waiting: no price past the lines (${l.buyBelow} / ${l.sellAbove})`) : "waiting: the shop is closed"; return null; }
  const r = await call(ctx, bot, d.kind === "sell" ? "sell_to_bloq" : "buy_from_bloq", { token_id: d.token_id, amount: "1" });
  const move: TraderMove = { kind: d.kind, token_id: d.token_id, amount: 1, price: d.price.toString(), at: Date.now(), txHash: r.txHash, ...(reason ? { reason } : {}) };
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
  const ai = ctx.config.ai && env.TRADER_MIND !== "rules" ? { cfg: ctx.config.ai, model: env.TRADER_MODEL ?? ctx.config.ai.chatModel } : null;
  state.accountId = accountId; state.on = true; state.mind = ai ? "ai" : "rules"; state.note = "starting";
  const tick = () => traderTick(ctx, bot, console.log, ai).catch((e) => { state.note = `error: ${(e as Error).message}`; console.error(`[trader] ${(e as Error).message}`); });
  void tick();
  const id = setInterval(tick, RULES.intervalMin * 60 * 1000);
  return () => clearInterval(id);
}
