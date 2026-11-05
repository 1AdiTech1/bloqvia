/**
 * Ask Bloq — grounded answers from a model on NEAR AI Cloud.
 *
 * The model answers only from KNOWLEDGE (Bloqvia's own rules, the three
 * founding lessons) and today's quests read from the contract. It writes
 * text and nothing else: it cannot see balances, cannot touch rewards or
 * prices, and is told to refuse quest answers and money talk. Every reply
 * keeps the model's chat id and signature kind so the player can verify it
 * in NEAR AI's Verification Center, like the daily quest.
 *
 * Cost control: a per-asker hourly limit and a global daily cap, both in
 * memory (one relayer instance).
 */
import { chat, extractJson, fetchSignature, signatureMatches, type AiConfig, type ChatMessage } from "./ai.js";
import { PolicyError, RateLimiter } from "./policy.js";
import { DAILY_PREFIX } from "./quests.js";
import { view, type NearContext } from "./near.js";

export const MAX_QUESTION_CHARS = 300;
export const MAX_ANSWER_CHARS = 700;
export const PER_ASKER_PER_HOUR = 12;

/** What Bloq knows. Keep it factual and short: the model may only use this. */
export const KNOWLEDGE = `BLOQVIA
- Bloqvia is a game that teaches Web3 by letting the player play it on NEAR testnet. Everything the player does is a real transaction on NEAR testnet; testnet tokens have no value.
- Start creates a NEAR account for the player (learner-xxxx.bloqvia.testnet) with a key that can only call the game contract. The player never sees a seed phrase. At the end (the reveal) the app hands over the key and explorer links.
- Nobody pays gas: the player signs, Bloqvia's relayer pays (NEAR meta-transactions, NEP-366).
- Three founding quests: The Vault (keys), The Fuel System (gas), Smart Agreements (smart contracts). Each pays 100 gold and 3 items and raises the Passport one level.
- Items: Key Fragment, Fuel Cell, Contract Seal. Gold is game gold ("BloqGold"), minted by the contract, not money.
- The Passport is an NFT (NEP-171) minted at sign-in. Its level is set on chain per quest. It cannot be transferred or sold: the contract refuses transfers.
- Bloq the merchant is a smart contract. His price rule: the more of an item he holds, the less he pays for it (buy_price = base_price * stock_halving / (stock_halving + stock); he sells at that price plus a 2.5% spread). Players selling an item lower its price for everyone. The shop closes when Bloq's gold falls below a floor. Nobody at Bloqvia can change a price by hand.
- Graduation needs Passport level 3, one of each item, and a fee equal to Bloq's current price; it seals the Passport.
- Community streak: one check-in per account per 'day' (10 minutes on testnet); if the community reaches the day's target (2 check-ins) everyone who checked in is minted 10 STREAK tokens (NEP-141); if it misses, 100 STREAK are burned from the treasury and the streak resets. The rule is the contract's, with no admin key.
- Daily quest: once a day an AI agent on NEAR AI Cloud writes one bonus quest. The relayer validates it, stores its text and the model's signature on the contract, and stores only a hash of the answer. A daily quest pays 50 gold and 1 item and does not change the Passport level. The chain checks the answer, not the AI.
- A wrong quiz answer is rejected by the contract itself ("Wrong answer"); the app only shows the contract's message.
- The cohort board (Cohort tab): a Sputnik DAO on testnet (bloqvia-dao.sputnik-v2.testnet, council of Bloqvia's founders) owns a bounty board. A bounty is a small task with a reward in testnet NEAR and a requirement the chain checks against the game contract: Passport level, a quest completed, or graduated. Small bounties are paid at once by the board from an allowance the DAO funded; medium ones become a DAO proposal that one council vote approves; large ones are only certified by the board and go through the DAO's normal proposal. Claiming is free (the relayer pays gas). If the requirement is not met, the claim is refused by the contract and can be tried again later. Nobody moves money by hand; the board holds no key to the DAO.

THE VAULT (keys)
Your public key is like your home mailbox: anyone can see it and drop a letter inside. Your private key is like your actual mailbox key: only you hold it, and if you lose it, you can never unlock your mail again. Share your public key to receive things; never share a private key or a seed phrase.

THE FUEL SYSTEM (gas)
Every action on a decentralized network needs computer power. Gas is the small fee paid to the computers that keep the system running. When the network is busy, fees go up, not down. In Bloqvia the relayer pays the gas for the player.

SMART AGREEMENTS (smart contracts)
A smart contract is a vending machine made of code. Put in exactly what it asks for and it hands out the product by itself. No shopkeeper, no one to argue with, and the rules are printed on the machine for everyone to read. Bloq's prices come from one rule in the contract.

NEAR BASICS
- NEAR is a proof-of-stake blockchain with named accounts (alice.near, learner-xxxx.bloqvia.testnet) and sub-accounts. Blocks are final in about a second.
- An account can hold several access keys: full-access keys, and function-call keys limited to one contract and some methods. Bloqvia gives the player a function-call key.
- Each block carries a hash of the previous block, so changing an old block breaks the chain after it.
- Standards: NEP-141 fungible tokens, NEP-171 non-fungible tokens, NEP-245 multi-tokens (Bloqvia's items and gold), NEP-366 meta-transactions.
- Explorer: testnet.nearblocks.io shows accounts, transactions and receipts.`;

export const SYSTEM_PROMPT = `You are Bloq, the merchant in Bloqvia, answering a learner's question in the game. Calm, concrete, adult; plain words; one everyday analogy is welcome. Answer in at most four short sentences, plain text, no lists, no markdown.
Use only the FACTS below. If the question is not covered by them, say in one sentence that you do not know that one yet and name two things you can explain (keys, gas, smart contracts, Bloq's prices, the Passport, the streak, today's quest, the cohort board).
Never give the answer to any quest, founding or daily: explain the idea behind it instead and let the learner choose.
Never talk about money, investing, token prices, or what anything is worth; gold and items here are game pieces on a test network. Never invent balances, prices or transactions: you cannot see the player's account.

FACTS
${KNOWLEDGE}`;

export interface AskRequest {
  question: string;
  /** The quest the player is looking at, if any (founding id or daily-YYYY-MM-DD). */
  lessonId?: string;
}

export interface AskResult {
  answer: string;
  generated_by: { provider: "NEAR AI Cloud"; model: string; chat_id: string; signature_kind: string | null };
}

/** Plain text only: drop any thinking the model leaked, cap the length at a sentence end. */
export function cleanAnswer(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\s+/g, " ").trim();
  if (text.startsWith("{")) {
    // Some models wrap plain answers in JSON when they have seen a schema recently.
    try {
      const o = JSON.parse(extractJson(text)) as Record<string, unknown>;
      const v = o.answer ?? o.text ?? o.reply;
      if (typeof v === "string") text = v.trim();
    } catch {
      /* keep the text as is */
    }
  }
  if (text.length > MAX_ANSWER_CHARS) {
    const cut = text.slice(0, MAX_ANSWER_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    text = end > MAX_ANSWER_CHARS / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
  }
  return text;
}

export function validateQuestion(q: unknown): string {
  if (typeof q !== "string") throw new PolicyError("Send { question: string }");
  const text = q.replace(/\s+/g, " ").trim();
  if (text.length < 2) throw new PolicyError("Ask a question");
  if (text.length > MAX_QUESTION_CHARS) throw new PolicyError(`Keep the question under ${MAX_QUESTION_CHARS} characters`);
  return text;
}

/** The messages for one question. `questContext` is the public text of the quest the player is on (never its answer). */
export function buildMessages(question: string, questContext: string | null): ChatMessage[] {
  const user = questContext
    ? `The learner is looking at this quest (its answer is not available to you):\n${questContext}\n\nQuestion: ${question}`
    : `Question: ${question}`;
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

/** Daily cap on model calls, reset at UTC midnight. */
export class DailyCap {
  private day = "";
  private used = 0;
  constructor(private readonly max: number) {}
  take(now = new Date()): void {
    const d = now.toISOString().slice(0, 10);
    if (d !== this.day) {
      this.day = d;
      this.used = 0;
    }
    if (this.used >= this.max) throw new PolicyError("Bloq has answered enough for today; try again tomorrow", 429);
    this.used += 1;
  }
  get remaining(): number {
    return Math.max(0, this.max - this.used);
  }
}

interface LessonWithText {
  lesson: { lesson_id: string; title: string };
  bonus: boolean;
  text: string | null;
}

/** Public text of a daily quest from chain, cached briefly; founding lessons are already in KNOWLEDGE. */
export async function questContextFor(ctx: NearContext, lessonId: string | undefined, cache: { at: number; items: LessonWithText[] }): Promise<string | null> {
  if (!lessonId || !lessonId.startsWith(DAILY_PREFIX)) return null;
  if (Date.now() - cache.at > 5 * 60_000) {
    cache.items = await view<LessonWithText[]>(ctx, ctx.config.coreContractId, "get_lessons_with_text");
    cache.at = Date.now();
  }
  const found = cache.items.find((l) => l.lesson.lesson_id === lessonId && l.bonus && l.text);
  if (!found?.text) return null;
  try {
    const t = JSON.parse(found.text) as { title?: string; concept?: string; question?: string; options?: string[] };
    return [`Title: ${t.title ?? ""}`, `Concept: ${t.concept ?? ""}`, `Question: ${t.question ?? ""}`, `Options: ${(t.options ?? []).join(" / ")}`].join("\n");
  } catch {
    return null;
  }
}

export interface AskBloq {
  ask(req: AskRequest, askerKey: string): Promise<AskResult>;
}

export function createAskBloq(ctx: NearContext, ai: AiConfig, model: string, opts: { dailyCap?: number; log?: (s: string) => void } = {}): AskBloq {
  const perAsker = new RateLimiter(PER_ASKER_PER_HOUR, 60 * 60_000);
  const cap = new DailyCap(opts.dailyCap ?? 400);
  const cache = { at: 0, items: [] as LessonWithText[] };
  const log = opts.log ?? console.log;

  return {
    async ask(req, askerKey) {
      const question = validateQuestion(req.question);
      perAsker.check(askerKey);
      cap.take();
      const started = Date.now();
      const context = await questContextFor(ctx, req.lessonId, cache);
      const completion = await chat(ai, model, buildMessages(question, context), {
        maxTokens: 700,
        temperature: 0.4,
        // GLM-5.3 Flash reasons by default; "low" keeps it to a few tokens (NEAR AI docs: reasoning-models).
        reasoningEffort: "low",
      });
      const answer = cleanAnswer(completion.content);
      if (!answer) throw new PolicyError("Bloq had nothing to say; ask again", 502);
      const sig = await fetchSignature(ai, completion);
      const verified = sig ? signatureMatches(completion, sig) : false;
      log(`[ask] ${askerKey} ${Date.now() - started}ms tokens=${completion.usage?.total_tokens ?? "?"} left=${cap.remaining} sig=${verified ? sig!.signature_kind : "none"} q=${JSON.stringify(question.slice(0, 80))}`);
      return {
        answer,
        generated_by: { provider: "NEAR AI Cloud", model: completion.model, chat_id: completion.id, signature_kind: verified ? sig!.signature_kind : null },
      };
    },
  };
}
