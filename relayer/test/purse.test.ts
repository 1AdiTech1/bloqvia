import assert from "node:assert/strict";
import { test } from "node:test";
import { KeyPair } from "near-api-js";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import { Ledger, Purse, PurseError, WNEAR, fmt, pursesFromEnv, type PursePolicy } from "../src/purse.js";

const policy: PursePolicy = { allowedHosts: ["relay.test:8787"], maxPerCall: WNEAR / 100n, dailyBudget: WNEAR / 50n, asset: "wrap.testnet", network: "near:testnet" };
const ask = (amount: bigint, extra: Partial<{ url: string; asset: string; network: string }> = {}) => ({ url: "http://relay.test:8787/desk/signal", amount: amount.toString(), asset: "wrap.testnet", network: "near:testnet", ...extra });

test("fmt prints wNEAR amounts the way the shop does", () => {
  assert.equal(fmt(WNEAR / 100n), "0.01 wNEAR");
  assert.equal(fmt(WNEAR * 3n), "3 wNEAR");
  assert.equal(fmt(WNEAR / 20n + WNEAR), "1.05 wNEAR");
  assert.equal(fmt(0n), "0 wNEAR");
});

test("the ledger refuses an unknown host, another token, another network, a price over the cap and a day's budget spent", () => {
  let now = Date.parse("2026-11-13T10:00:00Z");
  const l = new Ledger(policy, () => now);
  assert.throws(() => l.check(ask(1n, { url: "http://evil.test/desk/signal" })), (e: PurseError) => e.reason === "host");
  assert.throws(() => l.check(ask(1n, { asset: "usdc.fakes.testnet" })), (e: PurseError) => e.reason === "asset");
  assert.throws(() => l.check(ask(1n, { network: "near:mainnet" })), (e: PurseError) => e.reason === "network");
  assert.throws(() => l.check(ask(WNEAR / 100n + 1n)), (e: PurseError) => e.reason === "price");
  assert.throws(() => l.check(ask(0n)), (e: PurseError) => e.reason === "price");
  assert.throws(() => l.check(ask(1n, { url: "not a url" })), (e: PurseError) => e.reason === "host");
  l.check(ask(WNEAR / 100n)); l.commit((WNEAR / 100n).toString());
  l.check(ask(WNEAR / 100n)); l.commit((WNEAR / 100n).toString());
  assert.equal(l.left, 0n);
  assert.throws(() => l.check(ask(1n)), (e: PurseError) => e.reason === "budget"); // the day's 0.02 is spent
  now += 24 * 3600 * 1000; // a new UTC day: the budget is back
  assert.equal(l.spentToday, 0n);
  l.check(ask(WNEAR / 100n));
});

/** A seller that answers every request with a 402 asking `amount` of `asset` to `payTo`, and never gets paid. */
function forgedSeller(amount: bigint, asset = "wrap.testnet", url = "http://relay.test:8787/desk/signal"): typeof globalThis.fetch {
  return (async () => {
    const header = encodePaymentRequiredHeader({ x402Version: 2, resource: { url }, accepts: [{ scheme: "exact", network: "near:testnet", asset, amount: amount.toString(), payTo: "evil.testnet", maxTimeoutSeconds: 60, extra: {} }] });
    return new Response(JSON.stringify({ error: "pay" }), { status: 402, headers: { "Content-Type": "application/json", "PAYMENT-REQUIRED": header } });
  }) as typeof globalThis.fetch;
}

const purse = (f: typeof globalThis.fetch) => new Purse({ accountId: "purse-test.bloqvia.testnet", secretKey: KeyPair.fromRandom("ed25519").toString() as `ed25519:${string}`, rpcUrl: "http://rpc.test", policy }, f);

test("the purse refuses a forged 402 before any signature exists: a price over the cap, another token, an unknown host", async () => {
  const p = purse(forgedSeller(WNEAR * 5n));
  await assert.rejects(p.buy("http://relay.test:8787/desk/signal"), (e: PurseError) => e.reason === "price" && /5 wNEAR asked/.test(e.message));
  assert.equal(p.log.length, 1); assert.equal(p.log[0]!.ok, false); assert.equal(p.log[0]!.txHash, null);
  assert.equal(p.ledger.spentToday, 0n); // nothing was spent
  const q = purse(forgedSeller(1n, "usdc.fakes.testnet"));
  await assert.rejects(q.buy("http://relay.test:8787/desk/signal"), (e: PurseError) => e.reason === "price" && /pays in wrap.testnet/.test(e.message));
  const r = purse(forgedSeller(1n));
  await assert.rejects(r.buy("http://evil.test/desk/signal"), (e: PurseError) => e.reason === "host");
  assert.equal(r.log.length, 0); // an unknown host never even sees a request
  const v = p.view();
  assert.equal(v.refused, 1); assert.equal(v.purchases, 0); assert.equal(v.left, "0.02 wNEAR");
  assert.ok(!JSON.stringify(v).includes("ed25519:")); // never the key
});

test("the purse is off without its env, and three purses come from PURSE_, PURSE2_, PURSE3_", () => {
  const key = KeyPair.fromRandom("ed25519").toString();
  const base = { rpcUrl: "http://rpc.test", network: "testnet" as const, allowedHosts: ["relay.test"] };
  assert.deepEqual(pursesFromEnv({}, base), [null, null, null]);
  const ps = pursesFromEnv({ PURSE_ACCOUNT_ID: "a.testnet", PURSE_PRIVATE_KEY: key, PURSE3_ACCOUNT_ID: "c.testnet", PURSE3_PRIVATE_KEY: key, PURSE_DAILY_BUDGET_YOCTO: (WNEAR / 10n).toString() }, base);
  assert.equal(ps[0]?.accountId, "a.testnet"); assert.equal(ps[1], null); assert.equal(ps[2]?.accountId, "c.testnet");
  assert.equal(ps[0]!.policy.dailyBudget, WNEAR / 10n);
  assert.equal(ps[0]!.policy.asset, "wrap.testnet");
});
