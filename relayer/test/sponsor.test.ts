import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUSE_QUESTS, LIMITS, SPONSOR_PRICE, houseQuestFor, sponsoredLessonId, sponsoredText, validateSponsor } from "../src/sponsor.js";
import { validateQuest, MAX_TEXT_BYTES } from "../src/quests.js";
import { WNEAR } from "../src/purse.js";

const quest = { title: "One intent, two chains", topic: "Bridges and intents", concept: "You say what you want and solvers compete to do it.", question: "Who holds your money while an intent is being filled?", options: ["The solver, until it delivers", "A contract, until the proof arrives", "Nobody, it is already gone"], answer: "A contract, until the proof arrives", success: "Right.", near_reveal: "The intent is a signed message; settlement is a transaction.", explanation: "An intent names the outcome; the contract releases funds against proof." };

test("the sponsored slot: one id a day, 0.5 wNEAR, the house quests pass the validator and rotate by day", () => {
  assert.equal(sponsoredLessonId(new Date("2026-11-16T15:00:00Z")), "daily-2026-11-16-sponsored"); // a daily- id: a bonus quest for the contract
  assert.equal(SPONSOR_PRICE, WNEAR / 2n);
  for (const q of HOUSE_QUESTS) assert.deepEqual(validateQuest(q), q);
  const a = houseQuestFor(new Date("2026-11-16T12:00:00Z")), b = houseQuestFor(new Date("2026-11-17T12:00:00Z")), c = houseQuestFor(new Date("2026-11-19T12:00:00Z"));
  assert.notEqual(a.title, b.title);
  assert.equal(a.title, c.title); // three quests, three days
});

test("a sponsor's body is checked: a name, an https address, a quest that passes the same validator as the daily quest", () => {
  const ok = validateSponsor({ name: "Beacon Bridge", url: "https://beacon.example", quest });
  assert.equal(ok.name, "Beacon Bridge"); assert.equal(ok.url, "https://beacon.example/"); assert.equal(ok.house, false);
  assert.throws(() => validateSponsor({ quest }), /sponsor.name missing/);
  assert.throws(() => validateSponsor({ name: "x".repeat(LIMITS.name + 1), quest }), /too long/);
  assert.throws(() => validateSponsor({ name: "Bloq Capital", quest }), /must not use the name Bloq/); // the house alone may say Bloqvia
  assert.equal(validateSponsor({ name: "Bloqvia", house: true, quest }).house, true);
  assert.throws(() => validateSponsor({ name: "A", url: "http://insecure.example", quest }), /https/);
  assert.throws(() => validateSponsor({ name: "A", quest: { ...quest, options: ["a", "a", "b"] } }), /distinct/);
  assert.throws(() => validateSponsor({ name: "A", quest: { ...quest, answer: "not an option" } }), /one of the options/);
  assert.throws(() => validateSponsor({ name: "A", quest: { ...quest, title: "Bloq's quest" } }), /capitals/);
});

test("the public text names the sponsor, the slot's payment and who checked it, never the answer, and fits the contract", () => {
  const text = sponsoredText(quest, { name: "Beacon Bridge", url: "https://beacon.example/", house: false }, { paid_by: "purse-x.testnet", amount: SPONSOR_PRICE.toString(), asset: "wrap.testnet", tx_hash: "abc", bought_at: "2026-11-16T00:03:00.000Z" });
  const t = JSON.parse(text);
  assert.equal(t.sponsor.name, "Beacon Bridge"); assert.equal(t.slot.price, "0.5 wNEAR"); assert.equal(t.slot.tx_hash, "abc"); assert.equal(t.written_by, "the sponsor");
  assert.equal(t.answer, undefined); assert.ok(!text.includes(quest.answer) || quest.options.includes(quest.answer)); // the answer is only in the options list
  assert.ok(Buffer.byteLength(text) < MAX_TEXT_BYTES);
  for (const q of HOUSE_QUESTS) assert.ok(Buffer.byteLength(sponsoredText(q, { name: "Bloqvia", url: "https://bloqvia.app", house: true }, { paid_by: "purse-house.bloqvia.testnet", amount: SPONSOR_PRICE.toString(), asset: "wrap.testnet", tx_hash: "x".repeat(44), bought_at: new Date().toISOString() })) < MAX_TEXT_BYTES);
});
