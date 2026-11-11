/**
 * The daily quest: an agent on NEAR AI Cloud writes one short quest a day in
 * the game's lesson format; this module validates it, hashes the answer, and
 * seeds it on chain exactly like the founding three (`add_lesson`), then
 * attaches the public text and the model's signature (`set_lesson_text`).
 *
 * The contract verifies answers and pays rewards; the model only writes.
 * Lesson ids are `daily-YYYY-MM-DD` (UTC), which core treats as bonus quests
 * (gold + one item, no Passport level), so the game's rules are untouched.
 */
import { createHash } from "node:crypto";
import { chat, extractJson, fetchSignature, signatureMatches, type AiConfig, type ChatMessage, type Completion } from "./ai.js";
import { GAS_30, ZERO, view, type NearContext } from "./near.js";

export const ITEMS = ["key-fragment", "fuel-cell", "contract-seal"] as const;
export const DAILY_PREFIX = "daily-";
/** Season 2 chapters (seeded by scripts/seed-lessons.ts, not by the agent); Ask Bloq reads their text too. */
export const CHAPTER_PREFIX = "chapter-";
export const DAILY_REWARD_GOLD = "50";
export const DAILY_REWARD_ITEM_AMOUNT = "1";
export const MAX_TEXT_BYTES = 4096; // must match core::MAX_LESSON_TEXT_BYTES
const EPOCH = Date.UTC(2026, 10, 5); // Nov 5 2026: day 0 of the rotation

/** Beginner topics the agent rotates through. Order matters: it is the schedule. */
export const TOPICS: { topic: string; angle: string }[] = [
  { topic: "Blocks and the chain", angle: "why blocks are linked and what that protects" },
  { topic: "Accounts on NEAR", angle: "human-readable names like alice.near versus long hex addresses" },
  { topic: "Transactions", angle: "what a transaction contains and why it cannot be edited afterwards" },
  { topic: "Finality", angle: "why an app waits a second or two before saying 'saved'" },
  { topic: "Seed phrases", angle: "what the 12 words are and why no support agent ever needs them" },
  { topic: "Meta-transactions", angle: "how one party can sign and another can pay the fee" },
  { topic: "Fungible tokens", angle: "why 100 gold coins are interchangeable and what a token contract tracks" },
  { topic: "Non-fungible tokens", angle: "why a Passport is one of a kind and what 'non-transferable' means" },
  { topic: "Smart contract state", angle: "where a contract keeps its data and who pays for storage" },
  { topic: "Explorers", angle: "what a block explorer shows and how to check a transaction yourself" },
  { topic: "Testnet versus mainnet", angle: "why test networks exist and why their coins are worth nothing" },
  { topic: "Private keys and signing", angle: "what signing proves without revealing the key" },
  { topic: "Access keys on NEAR", angle: "full-access keys versus keys limited to one contract and some methods" },
  { topic: "Supply and burning", angle: "how a token's supply can grow or shrink by rules anyone can read" },
  { topic: "Automated market rules", angle: "how a price can move with stock without anyone setting it" },
  { topic: "DAOs", angle: "how a group holds money together and decides by votes on chain" },
  { topic: "Phishing and scams", angle: "the signs of a fake site or message asking for your key" },
  { topic: "Gas limits", angle: "why a call needs a gas budget and what happens when it runs out" },
  { topic: "Cross-contract calls", angle: "how one contract asks another to do something and waits for the result" },
  { topic: "Open source contracts", angle: "why reading the code is possible and why it matters" },
  { topic: "Trusted execution environments", angle: "how a computer can prove which program it ran" },
  { topic: "Verifiable AI", angle: "what it means for an AI reply to carry a signature you can check" },
  { topic: "Stablecoins", angle: "what keeps a token near one dollar and what can break it" },
  { topic: "Bridges and intents", angle: "moving value between chains and why 'intent' means saying what, not how" },
  { topic: "Wallet recovery", angle: "what can and cannot be recovered when a key is lost" },
  { topic: "Public ledgers and privacy", angle: "what everyone can see on chain and what they cannot" },
  { topic: "Validators", angle: "who runs the network and what they stake" },
  { topic: "Sharding", angle: "why NEAR splits work across shards and what that changes for users" },
  { topic: "Rate limits and spam", angle: "why free accounts still need limits" },
  { topic: "Reading a contract's view", angle: "calls that cost nothing and change nothing" },
];

export interface GeneratedQuest {
  title: string;
  topic: string;
  concept: string;
  question: string;
  options: string[];
  answer: string;
  success: string;
  near_reveal: string;
  explanation: string;
}

export const QUEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "topic", "concept", "question", "options", "answer", "success", "near_reveal", "explanation"],
  properties: {
    title: { type: "string", description: "2-4 words, title case, no punctuation, without the words Bloq or Bloqvia" },
    topic: { type: "string", description: "Without the words Bloq or Bloqvia" },
    concept: { type: "string", description: "One short paragraph, max 320 characters, one concrete analogy" },
    question: { type: "string", description: "One question, max 160 characters" },
    options: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", description: "max 60 characters" } },
    answer: { type: "string", description: "Exactly one of the options, copied verbatim" },
    success: { type: "string", description: "One line shown on success, max 120 characters" },
    near_reveal: { type: "string", description: "One or two sentences on what just happened on NEAR for this quest, max 220 characters" },
    explanation: { type: "string", description: "Shown after a wrong answer: why, in 1-2 sentences, ending with 'Try again.' Max 240 characters" },
  },
} as const;

/** Character caps the validator enforces; the prompt states them so the model plans for them. */
export const LIMITS = { title: 40, topic: 60, concept: 320, question: 160, option: 60, success: 120, near_reveal: 220, explanation: 240 } as const;

export const MAX_ATTEMPTS = 4;

/** What the model is told after the validator rejects a draft. */
export function repairPrompt(error: string): string {
  return `Rejected by the validator: ${error}. Keep the same quest, fix only that (shorten, do not add), and return the whole JSON object again.`;
}

export const SYSTEM_PROMPT = `You write one short quest for Bloqvia, a game that teaches Web3 newcomers by letting them play on the NEAR blockchain. Tone: calm, concrete, adult, no hype, no jargon without an everyday analogy. Facts must be correct for NEAR Protocol: NEAR is proof-of-stake with validators and fast finality; never describe mining, "redoing work" or waiting for many confirmations. One concept, one question with three options, exactly one correct option. Options must be plausible and distinct; never 'all of the above'. Do not mention prices, investing, or that anything has monetary value.
The teaching lives in "concept"; "question" is a single short sentence that tests it. A phone screen shows this, so hard character limits apply and are checked by a program: title ${LIMITS.title}, topic ${LIMITS.topic}, concept ${LIMITS.concept}, question ${LIMITS.question}, each option ${LIMITS.option}, success ${LIMITS.success}, near_reveal ${LIMITS.near_reveal}, explanation ${LIMITS.explanation}. "explanation" is shown after a wrong answer and ends with the words "Try again." Count before you answer. Answer only with the JSON object requested.`;

export function lessonIdFor(date: Date): string {
  return `${DAILY_PREFIX}${date.toISOString().slice(0, 10)}`;
}

export function dayIndex(date: Date): number {
  return Math.max(0, Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EPOCH) / 86_400_000));
}

export function topicFor(date: Date) {
  return TOPICS[dayIndex(date) % TOPICS.length]!;
}

export function rewardItemFor(date: Date): (typeof ITEMS)[number] {
  return ITEMS[dayIndex(date) % ITEMS.length]!;
}

/** hex(sha256("{lesson_id}|{answer.trim().toLowerCase()}")) — same as the contract and scripts/lessons.ts. */
export function answerHash(lessonId: string, answer: string): string {
  return createHash("sha256").update(`${lessonId}|${answer.trim().toLowerCase()}`).digest("hex");
}

/** Reject anything the game could not render or the contract could not verify. */
export function validateQuest(q: unknown): GeneratedQuest {
  const o = q as Record<string, unknown>;
  const str = (k: string, max: number): string => {
    const v = o[k];
    if (typeof v !== "string" || v.trim().length === 0) throw new Error(`quest.${k} missing`);
    if (v.length > max) throw new Error(`quest.${k} too long (${v.length} > ${max})`);
    return v.trim();
  };
  const title = str("title", LIMITS.title);
  const topic = str("topic", LIMITS.topic);
  // Titles and topics are shown in capitals; the name is always written "Bloq" / "Bloqvia", so it stays out of them.
  if (/bloq/i.test(title)) throw new Error("quest.title must not use the name Bloq (titles are shown in capitals)");
  if (/bloq/i.test(topic)) throw new Error("quest.topic must not use the name Bloq (topics are shown in capitals)");
  const concept = str("concept", LIMITS.concept);
  const question = str("question", LIMITS.question);
  const success = str("success", LIMITS.success);
  const near_reveal = str("near_reveal", LIMITS.near_reveal);
  const explanation = str("explanation", LIMITS.explanation);
  const options = o.options;
  if (!Array.isArray(options) || options.length !== 3) throw new Error("quest.options must have 3 entries");
  const opts = options.map((x) => {
    if (typeof x !== "string" || x.trim().length === 0 || x.length > LIMITS.option) throw new Error(`quest.options entries must be non-empty strings of at most ${LIMITS.option} characters`);
    return x.trim();
  });
  if (new Set(opts.map((x) => x.toLowerCase())).size !== 3) throw new Error("quest.options must be distinct");
  const answer = str("answer", LIMITS.option);
  if (!opts.some((x) => x.toLowerCase() === answer.toLowerCase())) throw new Error("quest.answer must be one of the options");
  return { title, topic, concept, question, options: opts, answer, success, near_reveal, explanation };
}

/** The public blob stored on chain. The answer is NOT in it. */
export function publicText(q: GeneratedQuest, completion: Completion, generatedAt: Date): string {
  const text = JSON.stringify({
    title: q.title,
    topic: q.topic,
    concept: q.concept,
    question: q.question,
    options: q.options,
    success: q.success,
    near_reveal: q.near_reveal,
    explanation: q.explanation,
    generated_by: {
      provider: "NEAR AI Cloud",
      model: completion.model,
      chat_id: completion.id,
      request_sha256: completion.requestSha256,
      response_sha256: completion.responseSha256,
      signature: completion.signature,
      generated_at: generatedAt.toISOString(),
    },
  });
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) throw new Error(`lesson text ${Buffer.byteLength(text, "utf8")} bytes > ${MAX_TEXT_BYTES}`);
  return text;
}

interface OnChainLesson { lesson_id: string }

export async function questExists(ctx: NearContext, lessonId: string): Promise<boolean> {
  const lessons = await view<OnChainLesson[]>(ctx, ctx.config.coreContractId, "get_lessons");
  return lessons.some((l) => l.lesson_id === lessonId);
}

export interface QuestResult {
  lessonId: string;
  quest: Omit<GeneratedQuest, "answer">;
  model: string;
  chatId: string;
  signatureKind: string | null;
  seeded: boolean;
}

/**
 * Generate and seed the quest for `date` (UTC). Idempotent: if the lesson is
 * already on chain, nothing is generated and `seeded` is false.
 */
export async function generateDailyQuest(ctx: NearContext, ai: AiConfig, model: string, date = new Date(), log: (s: string) => void = console.log): Promise<QuestResult> {
  const lessonId = lessonIdFor(date);
  if (await questExists(ctx, lessonId)) {
    log(`[quest] ${lessonId} already on chain`);
    return { lessonId, quest: { title: "", topic: "", concept: "", question: "", options: [], success: "", near_reveal: "", explanation: "" }, model, chatId: "", signatureKind: null, seeded: false };
  }

  const t = topicFor(date);
  const user = `Write today's quest.\nTopic: ${t.topic}\nAngle: ${t.angle}\nThe player has already learned: keys (public vs private), gas, and smart contracts. Build on that. Return only the JSON object.`;

  // The conversation grows on each rejection: the model sees its own draft and
  // the exact validator message, and fixes that instead of starting over.
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user }];
  let completion: Completion | null = null;
  let quest: GeneratedQuest | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !quest; attempt += 1) {
    completion = null;
    try {
      completion = await chat(ai, model, messages, {
        jsonSchema: { name: "bloqvia_quest", schema: QUEST_SCHEMA as unknown as Record<string, unknown> },
        maxTokens: 4096,
        temperature: attempt === 0 ? 0.6 : 0.3,
        // Qwen3.6 reasons by default and the reasoning eats the budget; the quest needs none.
        thinking: false,
      });
      quest = validateQuest(JSON.parse(extractJson(completion.content)));
    } catch (e) {
      lastError = (e as Error).message;
      const c = completion;
      const peek = (s: string) => JSON.stringify(s.length > 160 ? `${s.slice(0, 80)}…${s.slice(-80)}` : s);
      log(
        `[quest] attempt ${attempt + 1} rejected: ${lastError}` +
          (c ? ` (finish=${c.finishReason ?? "?"}, completion_tokens=${c.usage?.completion_tokens ?? "?"}, reasoning=${c.reasoningChars} chars, content=${peek(c.content)})` : ""),
      );
      if (c) messages.push({ role: "assistant", content: c.content }, { role: "user", content: repairPrompt(lastError) });
    }
  }
  if (!quest || !completion) throw new Error(`quest generation failed: ${lastError}`);

  const sig = await fetchSignature(ai, completion);
  if (sig && !signatureMatches(completion, sig)) {
    log(`[quest] signature text did not match our hashes; storing without it`);
    completion.signature = null;
  } else {
    completion.signature = sig;
  }

  const item = rewardItemFor(date);
  const lesson = {
    lesson_id: lessonId,
    title: quest.title,
    answer_hash: answerHash(lessonId, quest.answer),
    reward_gold: DAILY_REWARD_GOLD,
    reward_item: item,
    reward_item_amount: DAILY_REWARD_ITEM_AMOUNT,
  };
  await ctx.relayer.callFunction({ contractId: ctx.config.coreContractId, methodName: "add_lesson", args: { lesson }, gas: GAS_30, deposit: ZERO });
  const text = publicText(quest, completion, new Date());
  // the lesson exists from here on, so its text must land: three tries, loudly if all fail (the quest is lost otherwise)
  for (let i = 1; ; i++) {
    try { await ctx.relayer.callFunction({ contractId: ctx.config.coreContractId, methodName: "set_lesson_text", args: { lesson_id: lessonId, text }, gas: GAS_30, deposit: ZERO }); break; }
    catch (e) { if (i >= 3) { log(`[quest] ${lessonId} seeded WITHOUT its text after 3 tries: ${(e as Error).message}`); throw e; } await new Promise((r) => setTimeout(r, 2000 * i)); }
  }
  log(`[quest] ${lessonId} "${quest.title}" seeded (model ${completion.model}, signature ${sig ? sig.signature_kind : "none"})`);

  const { answer: _answer, ...pub } = quest;
  return { lessonId, quest: pub, model: completion.model, chatId: completion.id, signatureKind: sig?.signature_kind ?? null, seeded: true };
}

/**
 * Run once at start and then every `everyMs`: seed today's quest if missing.
 * Safe to run on several instances; the contract refuses a duplicate id.
 */
export function startQuestScheduler(ctx: NearContext, ai: AiConfig, model: string, everyMs = 15 * 60 * 1000, after: () => Promise<unknown> = async () => undefined): () => void {
  // the quest first, then `after` (index.ts: the board's bounty for it, bounties.ts); both idempotent
  const tick = () =>
    generateDailyQuest(ctx, ai, model)
      .then(() => after())
      .catch((e) => console.error(`[quest] scheduler: ${(e as Error).message}`));
  void tick();
  const id = setInterval(tick, everyMs);
  return () => clearInterval(id);
}
