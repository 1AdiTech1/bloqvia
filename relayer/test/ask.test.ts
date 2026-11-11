import assert from "node:assert/strict";
import { test } from "node:test";
import { DailyCap, KNOWLEDGE, MAX_ANSWER_CHARS, SYSTEM_PROMPT, QUEST_RULE, buildMessages, cleanAnswer, questContextFor, validateQuestion } from "../src/ask.js";

test("cleanAnswer drops leaked thinking, unwraps JSON and caps at a sentence end", () => {
  assert.equal(cleanAnswer("<think>hmm</think>  Gas is the fee.  It pays the computers. "), "Gas is the fee. It pays the computers.");
  assert.equal(cleanAnswer('{"answer":"A public key is an address."}'), "A public key is an address.");
  const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
  const out = cleanAnswer(long);
  assert.ok(out.length <= MAX_ANSWER_CHARS);
  assert.ok(out.endsWith("."));
});

test("questions are bounded and the quest context never carries an answer field", () => {
  assert.throws(() => validateQuestion(""), /Ask a question/);
  assert.throws(() => validateQuestion("x".repeat(301)), /under 300/);
  const msgs = buildMessages("What is gas?", "Title: Linking Blocks\nConcept: …\nQuestion: Why?\nOptions: a / b / c");
  assert.equal(msgs[0]!.role, "system");
  assert.match(msgs[1]!.content, /Linking Blocks/);
  assert.match(msgs[1]!.content, /answer is not available/);
});

test("the knowledge and the prompt keep money out and the quest answers in", () => {
  assert.doesNotMatch(KNOWLEDGE, /\$|USD|invest/i);
  assert.match(SYSTEM_PROMPT, /Never give the answer to any quest/);
  assert.match(SYSTEM_PROMPT, /Never talk about money/);
});

test("the daily cap resets at UTC midnight", () => {
  const cap = new DailyCap(2, "Bloq has answered enough for today; try again tomorrow");
  const d1 = new Date("2026-11-05T10:00:00Z");
  cap.take(d1);
  cap.take(d1);
  assert.throws(() => cap.take(d1), /enough for today/);
  cap.take(new Date("2026-11-06T00:00:01Z"));
  assert.equal(cap.remaining, 1);
});

test("quest context: daily quests and Season 2 chapters from chain, never founding or unknown ids", async () => {
  const text = JSON.stringify({ title: "Transactions", concept: "A signed instruction.", question: "Who signed it?", options: ["The relayer", "Your key"] });
  // fresh cache, so no RPC call is made
  const cache = {
    at: Date.now(),
    items: [
      { lesson: { lesson_id: "chapter-transactions", title: "Transactions" }, bonus: true, text },
      { lesson: { lesson_id: "daily-2026-11-07", title: "Daily" }, bonus: true, text },
    ],
  };
  const ctx = {} as Parameters<typeof questContextFor>[0];
  const ch = await questContextFor(ctx, "chapter-transactions", cache);
  assert.ok(ch?.includes("Question: Who signed it?") && ch.includes("Options: The relayer / Your key"), String(ch));
  assert.ok(await questContextFor(ctx, "daily-2026-11-07", cache));
  assert.equal(await questContextFor(ctx, "the-vault", cache), null);
  assert.equal(await questContextFor(ctx, "chapter-defi", cache), null);
  assert.ok(KNOWLEDGE.includes("Season 2"));
});

test("asking from inside a quest adds the rule: no option named, an outside example, a question back", () => {
  const inQuest = buildMessages("Explain this another way", "Title: Transactions\nQuestion: Who signed it?\nOptions: The relayer / Your key");
  assert.ok(inQuest[1]!.content.includes(QUEST_RULE));
  assert.match(QUEST_RULE, /don't repeat or reword any option/);
  assert.ok(inQuest[1]!.content.indexOf(QUEST_RULE) < inQuest[1]!.content.indexOf("Question: Explain"), "the rule comes before the learner's question");
  const outside = buildMessages("What is gas?", null);
  assert.ok(!outside[1]!.content.includes(QUEST_RULE), "general questions are unchanged");
});
