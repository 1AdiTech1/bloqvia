import assert from "node:assert/strict";
import { test } from "node:test";
import { DailyCap, KNOWLEDGE, MAX_ANSWER_CHARS, SYSTEM_PROMPT, buildMessages, cleanAnswer, validateQuestion } from "../src/ask.js";

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
  const cap = new DailyCap(2);
  const d1 = new Date("2026-11-05T10:00:00Z");
  cap.take(d1);
  cap.take(d1);
  assert.throws(() => cap.take(d1), /enough for today/);
  cap.take(new Date("2026-11-06T00:00:01Z"));
  assert.equal(cap.remaining, 1);
});
