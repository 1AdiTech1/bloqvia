import assert from "node:assert/strict";
import { test } from "node:test";
import { answerHash, dayIndex, lessonIdFor, publicText, repairPrompt, rewardItemFor, topicFor, validateQuest, LIMITS, SYSTEM_PROMPT, TOPICS } from "../src/quests.js";
import { extractJson, type Completion } from "../src/ai.js";

const good = {
  title: "Finality",
  topic: "Finality",
  concept: "When you drop a letter in the box, it is sent; when the postman stamps it, it is final. NEAR works the same: a transaction is included first, then final a moment later.",
  question: "Why does the app wait a second before saying 'saved'?",
  options: ["It is waiting for the block to be final", "It is charging you a fee", "It is asking a human to approve"],
  answer: "It is waiting for the block to be final",
  success: "Final. Nobody can rewind that block now.",
  near_reveal: "Your reward was minted in the block the app waited for; the explorer shows the same block height.",
  explanation: "No fee is charged for waiting and no human is involved: the app waits for finality. Try again.",
};

test("ids and rotation are deterministic per UTC day", () => {
  const d = new Date("2026-11-06T09:30:00Z");
  assert.equal(lessonIdFor(d), "daily-2026-11-06");
  assert.equal(dayIndex(d), 1);
  assert.equal(topicFor(d), TOPICS[1]);
  assert.equal(rewardItemFor(d), "fuel-cell");
  assert.equal(dayIndex(new Date("2026-11-05T23:59:59Z")), 0);
});

test("answer hash matches the contract rule", () => {
  // sha256("daily-2026-11-06|it is waiting for the block to be final")
  assert.equal(answerHash("daily-2026-11-06", "  It Is Waiting For The Block To Be Final "), answerHash("daily-2026-11-06", "it is waiting for the block to be final"));
  assert.equal(answerHash("x", "a").length, 64);
});

test("a well-formed quest passes validation and is trimmed", () => {
  const q = validateQuest({ ...good, title: "  Finality " });
  assert.equal(q.title, "Finality");
  assert.equal(q.options.length, 3);
});

test("bad quests are rejected", () => {
  assert.throws(() => validateQuest({ ...good, answer: "Something else" }), /answer must be one of the options/);
  assert.throws(() => validateQuest({ ...good, options: ["A", "a", "B"] }), /distinct/);
  assert.throws(() => validateQuest({ ...good, options: ["A", "B"] }), /3 entries/);
  assert.throws(() => validateQuest({ ...good, concept: "x".repeat(400) }), /too long/);
  assert.throws(() => validateQuest({ ...good, question: "" }), /missing/);
});

test("titles and topics never carry the name, because the app shows them in capitals", () => {
  assert.throws(() => validateQuest({ ...good, title: "Bloq's Price Rule" }), /quest\.title must not use the name Bloq/);
  assert.throws(() => validateQuest({ ...good, title: "Inside Bloqvia" }), /quest\.title must not use the name Bloq/);
  assert.throws(() => validateQuest({ ...good, topic: "How Bloq sets prices" }), /quest\.topic must not use the name Bloq/);
  assert.match(repairPrompt("quest.title must not use the name Bloq (titles are shown in capitals)"), /fix only that/);
});

test("the public text never contains the answer and fits the on-chain cap", () => {
  const completion: Completion = {
    id: "chat-1", model: "Qwen/Qwen3.6-35B-A3B-FP8", content: "{}", requestSha256: "a".repeat(64), responseSha256: "b".repeat(64), reasoningChars: 0,
    signature: { text: "Qwen/Qwen3.6-35B-A3B-FP8:" + "a".repeat(64) + ":" + "b".repeat(64), signature: "0x00", signing_address: "0x11", signing_algo: "ecdsa", signature_kind: "provider_tee" },
  };
  const text = publicText(validateQuest(good), completion, new Date("2026-11-06T00:05:00Z"));
  const parsed = JSON.parse(text);
  assert.equal(parsed.answer, undefined);
  assert.equal(parsed.question, good.question);
  assert.equal(parsed.generated_by.signature.signature_kind, "provider_tee");
  assert.ok(Buffer.byteLength(text, "utf8") < 4096);
});

test("extractJson drops a <think> block and prose around the object", () => {
  const reply = `<think>\nThe player knows gas already…\n</think>\nHere is the quest:\n${JSON.stringify(good)}\nDone.`;
  assert.deepEqual(JSON.parse(extractJson(reply)), good);
  assert.equal(extractJson(JSON.stringify(good)), JSON.stringify(good));
});

test("extractJson leaves a truncated reply alone so JSON.parse reports it", () => {
  const cut = JSON.stringify(good).slice(0, 40);
  assert.equal(extractJson(`<think>…</think>${cut}`), cut);
  assert.throws(() => JSON.parse(extractJson(cut)), /JSON/);
});

test("the prompt states every cap the validator enforces, and repair quotes the error", () => {
  for (const [field, cap] of Object.entries(LIMITS)) assert.match(SYSTEM_PROMPT, new RegExp(`${field === "option" ? "each option" : field} ${cap}\\b`), field);
  assert.throws(() => validateQuest({ ...good, question: "x".repeat(LIMITS.question + 1) }), /question too long/);
  assert.match(repairPrompt("quest.question too long (166 > 160)"), /166 > 160/);
});
