/**
 * Sponsored quests (Nov 14): one slot a day on the map, sold per request over x402.
 *
 *   POST /sponsor/quest   0.5 wNEAR   { name, url?, quest: { title, topic, concept, question, options, answer, success,
 *                                      near_reveal, explanation } }
 *
 * A sponsor writes a quest about its subject; the relayer validates it exactly like the daily quest (lengths, three
 * distinct options, the answer among them, no "Bloq" in capitals), the payment settles on chain, and the quest is seeded
 * like any lesson: `add_lesson` with the answer's hash, `set_lesson_text` with the public text, the sponsor's name and
 * the slot's payment (who paid, how much, the transaction). The reward is the contract's (50 gold and one item, the
 * daily quest's rule) and never the sponsor's: a sponsor buys attention and a slot, nothing else.
 *
 * The id is `daily-<date>-sponsored`: the contract treats every `daily-` lesson as a bonus quest (no Passport level),
 * so the sponsored one rides the daily quest's rails on chain; the app's `useSponsoredQuest` tells the two apart.
 *
 * The house (Nov 14): on a day nobody bought the slot, Bloqvia's own purse buys it, over the same route and the same
 * payment, with one of the house quests below — so the slot is never empty, never fake, and the first outside sponsor
 * replaces the house line with their name.
 */
import { answerHash, validateQuest, questExists, DAILY_REWARD_GOLD, DAILY_REWARD_ITEM_AMOUNT, MAX_TEXT_BYTES, rewardItemFor, type GeneratedQuest } from "./quests.js";
import { GAS_30, ZERO, view, type NearContext } from "./near.js";
import { WNEAR, fmt, type Purse } from "./purse.js";

export const SPONSOR_PRICE = WNEAR / 2n; // 0.5 wNEAR for the day's slot
export const SPONSOR_SUFFIX = "-sponsored";
export const LIMITS = { name: 40, url: 120 } as const;

export function sponsoredLessonId(date: Date): string {
  return `daily-${date.toISOString().slice(0, 10)}${SPONSOR_SUFFIX}`;
}

export interface SponsorBody { name: string; url?: string; quest: GeneratedQuest; house?: boolean }

/** Reject what the card could not show. Pure, tested. */
export function validateSponsor(body: unknown): SponsorBody {
  const o = (body ?? {}) as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) throw new Error("sponsor.name missing");
  if (name.length > LIMITS.name) throw new Error(`sponsor.name too long (${name.length} > ${LIMITS.name})`);
  if (/bloq/i.test(name) && o.house !== true) throw new Error("sponsor.name must not use the name Bloq");
  let url: string | undefined;
  if (o.url !== undefined && o.url !== null && o.url !== "") {
    if (typeof o.url !== "string" || o.url.length > LIMITS.url) throw new Error("sponsor.url must be a short https address");
    let u: URL;
    try { u = new URL(o.url); } catch { throw new Error("sponsor.url must be a valid https address"); }
    if (u.protocol !== "https:") throw new Error("sponsor.url must be https");
    url = u.toString();
  }
  const quest = validateQuest(o.quest);
  return { name, url, quest, house: o.house === true };
}

/** The public blob stored on chain for a sponsored quest. The answer is NOT in it. */
export function sponsoredText(q: GeneratedQuest, sponsor: { name: string; url?: string; house: boolean }, slot: { paid_by: string | null; amount: string; asset: string; tx_hash: string | null; bought_at: string }): string {
  const text = JSON.stringify({
    title: q.title, topic: q.topic, concept: q.concept, question: q.question, options: q.options,
    success: q.success, near_reveal: q.near_reveal, explanation: q.explanation,
    sponsor: { name: sponsor.name, url: sponsor.url ?? null, house: sponsor.house },
    slot: { ...slot, price: fmt(BigInt(slot.amount)), route: "POST /sponsor/quest (x402)" },
    written_by: sponsor.house ? "Bloqvia (house quest)" : "the sponsor",
    checked_by: "Bloqvia's validator (relayer/src/quests.ts validateQuest); the answer's hash is on chain",
  });
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) throw new Error(`lesson text ${Buffer.byteLength(text, "utf8")} bytes > ${MAX_TEXT_BYTES}`);
  return text;
}

/** Seed the slot's quest: `add_lesson` now (the hash, the reward rule), the text after settlement (it carries the tx). */
export async function seedSponsored(ctx: NearContext, lessonId: string, body: SponsorBody, date: Date): Promise<void> {
  const lesson = { lesson_id: lessonId, title: body.quest.title, answer_hash: answerHash(lessonId, body.quest.answer), reward_gold: DAILY_REWARD_GOLD, reward_item: rewardItemFor(date), reward_item_amount: DAILY_REWARD_ITEM_AMOUNT };
  await ctx.relayer.callFunction({ contractId: ctx.config.coreContractId, methodName: "add_lesson", args: { lesson }, gas: GAS_30, deposit: ZERO });
}
export async function attachSponsoredText(ctx: NearContext, lessonId: string, text: string, log: (s: string) => void = console.log): Promise<void> {
  for (let i = 1; ; i++) {
    try { await ctx.relayer.callFunction({ contractId: ctx.config.coreContractId, methodName: "set_lesson_text", args: { lesson_id: lessonId, text }, gas: GAS_30, deposit: ZERO }); return; }
    catch (e) { if (i >= 3) { log(`[sponsor] ${lessonId} seeded WITHOUT its text after 3 tries: ${(e as Error).message}`); throw e; } await new Promise((r) => setTimeout(r, 2000 * i)); }
  }
}

/** Today's slot as the chain holds it (for /market and the house's check). `exists`: the lesson is on chain; `taken`: it
 * has its text too (a lesson without text is a payment that did not settle, and the slot is still open). */
export async function todaysSlot(ctx: NearContext, date = new Date()): Promise<{ lessonId: string; exists: boolean; taken: boolean; text: Record<string, unknown> | null }> {
  const lessonId = sponsoredLessonId(date);
  const exists = await questExists(ctx, lessonId);
  let text: Record<string, unknown> | null = null;
  if (exists) {
    const raw = await view<string | null>(ctx, ctx.config.coreContractId, "get_lesson_text", { lesson_id: lessonId }).catch(() => null);
    if (raw) { try { text = JSON.parse(raw) as Record<string, unknown>; } catch { text = null; } }
  }
  return { lessonId, exists, taken: text !== null, text };
}

/**
 * The house quests: what Bloqvia's own purse buys the slot with on a day nobody else did. Written by us, about the
 * thing the slot itself demonstrates. Rotated by day. Same validator, same limits, same reward rule.
 */
export const HOUSE_QUESTS: GeneratedQuest[] = [
  {
    title: "Paying per request",
    topic: "HTTP 402",
    concept: "A web server can answer a request with status 402, 'Payment Required'. With x402 that answer names a price and a token; the client pays with a signed token transfer, sends the proof, and gets the answer. No account, no API key: the request is the deal. On NEAR a facilitator pays the gas.",
    question: "What does a 402 answer tell the client?",
    options: ["The server is down for maintenance", "A price and how to pay it to get the answer", "The client must log in first"],
    answer: "A price and how to pay it to get the answer",
    success: "That is the whole handshake: ask, see the price, pay, get the answer.",
    near_reveal: "This slot was bought the same way: a purse paid 0.5 wNEAR to bloqvia.testnet over x402, and the quest was seeded on chain with the payment's transaction. The explorer link on the card is that payment.",
    explanation: "402 means 'pay to continue'. The price and the token are in the answer's headers, so a program can pay without a person filling in a form.",
  },
  {
    title: "A purse with a budget",
    topic: "Agents and money",
    concept: "An AI agent that can pay for things needs limits it cannot change. In Bloqvia each NPC trader has a purse: a small account with a day's budget in wrapped NEAR. The agent decides whether a signal is worth buying; the purse's rules decide whether the payment is allowed: one host, at most 0.01 a call, 0.2 a day.",
    question: "Who decides whether a trader's payment is allowed?",
    options: ["The AI model, when it thinks the price is fair", "The purse's rules, which the model cannot change", "The seller, by lowering the price"],
    answer: "The purse's rules, which the model cannot change",
    success: "Right: the model chooses, the rules allow or refuse, and the balance is the ceiling.",
    near_reveal: "Every signal a trader buys is a transaction on testnet; a refused one is shown on the shop as 'the purse refused the signal'. Both are in the shop's Market · live panel.",
    explanation: "Giving an agent money without giving it the keys to everything means putting the limits where the agent cannot reach them: in rules and in a balance, not in a prompt.",
  },
  {
    title: "Who paid for this quest",
    topic: "Sponsored quests",
    concept: "A quest on this map can be sponsored: someone writes it, pays 0.5 wNEAR for the day's slot over x402, and Bloqvia's validator checks it before it is seeded on chain. What the sponsor cannot do is set the reward: 50 gold and one item come from the contract's own rule, the same as the daily quest.",
    question: "What does a sponsor get for the 0.5 wNEAR?",
    options: ["The right to choose the reward players receive", "A day's slot on the map for a quest the validator passed", "A copy of every player's answers"],
    answer: "A day's slot on the map for a quest the validator passed",
    success: "Exactly: a slot and attention, never the reward and never the player's data.",
    near_reveal: "The slot's payment is on the explorer; the reward is in the contract: complete_lesson pays 50 gold and one item for any daily quest, sponsored or not.",
    explanation: "Separating who pays for attention from who decides rewards is what keeps a sponsored quest honest: the sponsor's money buys the slot, the contract's rule pays the player.",
  },
];
export function houseQuestFor(date: Date): GeneratedQuest {
  const day = Math.floor(date.getTime() / 86_400_000);
  return HOUSE_QUESTS[day % HOUSE_QUESTS.length]!;
}

/**
 * The house buys the slot when nobody else has, through the public route with Bloqvia's own purse — the same x402
 * handshake an outside sponsor uses. Runs at start and every `everyMs`; idempotent (the slot is checked on chain first).
 */
export function startHouseSponsor(ctx: NearContext, purse: Purse, publicUrl: string, everyMs = 15 * 60 * 1000, log: (s: string) => void = console.log): () => void {
  const tick = async () => {
    const date = new Date();
    const slot = await todaysSlot(ctx, date);
    if (slot.taken) return;
    const quest = houseQuestFor(date);
    log(`[sponsor] nobody bought today's slot; the house purse ${purse.accountId} buys it with "${quest.title}"`);
    const { body, purchase } = await purse.buy<{ lessonId: string }>(`${publicUrl}/sponsor/quest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Bloqvia", url: "https://bloqvia.app", house: true, quest }) });
    log(`[sponsor] house slot ${body.lessonId} bought for ${fmt(BigInt(purchase.amount))} tx=${purchase.txHash}`);
  };
  const run = () => tick().catch((e) => log(`[sponsor] house: ${(e as Error).message}`));
  void run();
  const id = setInterval(run, everyMs);
  return () => clearInterval(id);
}
