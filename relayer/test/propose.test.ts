import assert from "node:assert/strict";
import { test } from "node:test";
import { KeyPair, PublicKey } from "near-api-js";
import { PROPOSE, expectedMessage, parseMessage, toBountyInput, toYocto } from "../src/propose.js";

test("reward amounts: NEAR strings to yocto, with the tier caps", () => {
  assert.equal(toYocto("0.25"), 250_000_000_000_000_000_000_000n);
  assert.equal(toYocto("2"), 2_000_000_000_000_000_000_000_000n);
  assert.throws(() => toYocto("abc"), /reward_near/);
  const base = { title: "Teach gas", description: "Three lines for a newcomer", tier: "Small" as const, requirement: "Graduated" as const, reward_near: "0.1", max_claims: 5 };
  assert.equal(toBountyInput(base).reward, "100000000000000000000000");
  assert.throws(() => toBountyInput({ ...base, reward_near: "0.6" }), /at most 0.5 NEAR/); // Small: the board pays alone
  assert.throws(() => toBountyInput({ ...base, tier: "Large", reward_near: "11" }), /at most 10 NEAR/);
  assert.throws(() => toBountyInput({ ...base, title: "x".repeat(PROPOSE.title + 1) }), /title/);
  assert.throws(() => toBountyInput({ ...base, max_claims: 0 }), /max_claims/);
  assert.throws(() => toBountyInput({ ...base, requirement: { PassportLevel: { min: 9 } } }), /requirement/);
  assert.deepEqual(toBountyInput({ ...base, requirement: { QuestCompleted: { lesson_id: "daily-2026-11-10" } } }).requirement, { QuestCompleted: { lesson_id: "daily-2026-11-10" } });
});

test("the signed message names the account and the time, and a real key's signature verifies", () => {
  const at = Date.now(), msg = expectedMessage("learner-abc.bloqvia.testnet", at);
  assert.deepEqual(parseMessage(msg), { accountId: "learner-abc.bloqvia.testnet", at });
  assert.equal(parseMessage("bloqvia:propose:evil"), null);
  const key = KeyPair.fromRandom("ed25519");
  const sig = key.sign(Buffer.from(msg, "utf8")).signature;
  assert.equal(PublicKey.fromString(key.getPublicKey().toString()).verify(Buffer.from(msg, "utf8"), sig), true);
  assert.equal(PublicKey.fromString(key.getPublicKey().toString()).verify(Buffer.from(msg + "x", "utf8"), sig), false);
});
