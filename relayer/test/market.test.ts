import assert from "node:assert/strict";
import { test } from "node:test";
import { prune, thin, KEEP_MS, MAX_POINTS, type Snapshot } from "../src/market.js";
import { decide, RULES } from "../src/trader.js";
import { gate, plan, LINES, type FFState } from "../src/fastforward.js";

const snap = (t: number): Snapshot => ({ t, gold: "1000", shop_open: true, prices: [] });

test("snapshots keep 48 h and at most MAX_POINTS, newest last", () => {
  const now = 10_000_000_000;
  const list = [snap(now - KEEP_MS - 1), snap(now - 1000), snap(now)];
  assert.deepEqual(prune(list, now).map((s) => s.t), [now - 1000, now]);
  const many = Array.from({ length: MAX_POINTS + 50 }, (_, i) => snap(now - (MAX_POINTS + 50 - i) * 1000));
  const kept = prune(many, now);
  assert.equal(kept.length, MAX_POINTS);
  assert.equal(kept[kept.length - 1]!.t, now - 1000);
  const thinned = thin(kept, 200);
  assert.equal(thinned.length, 200);
  assert.equal(thinned[0]!.t, kept[0]!.t);
  assert.equal(thinned[199]!.t, kept[kept.length - 1]!.t);
});

const items = (k: bigint, f: bigint, c: bigint) => ({ "key-fragment": k, "fuel-cell": f, "contract-seal": c });
const p = (buy: ReturnType<typeof items>, sell: ReturnType<typeof items>, open = true) => ({ shop_open: open, buy, sell });

test("the trader sells the item Bloq pays most for, only above the line and never its last one", () => {
  const mine = { gold: 100n, items: items(2n, 3n, 1n) };
  const d = decide(p(items(80n, 75n, 90n), items(82n, 77n, 92n)), mine);
  assert.deepEqual(d, { kind: "sell", token_id: "key-fragment", price: 80n }); // contract-seal pays more but it is the last one
  assert.equal(decide(p(items(50n, 50n, 50n), items(52n, 52n, 52n)), mine), null); // nothing past the lines
});

test("the trader buys the cheapest item below the line and keeps its gold floor; a closed shop means no trade", () => {
  const prices = p(items(30n, 35n, 32n), items(31n, 36n, 33n));
  assert.deepEqual(decide(prices, { gold: 100n, items: items(1n, 1n, 1n) }), { kind: "buy", token_id: "key-fragment", price: 31n });
  assert.equal(decide(prices, { gold: RULES.keepGold + 30n, items: items(1n, 1n, 1n) }), null); // would go under the floor
  assert.equal(decide({ ...prices, shop_open: false }, { gold: 100n, items: items(5n, 5n, 5n) }), null);
});

test("the fast-forward gate: one at a time, a pause between runs, a daily cap", () => {
  const base: FFState = { running: false, round: 0, rounds: 6, startedAt: null, finishedAt: null, nextAt: 0, runsToday: 0, dailyCap: 24, log: [], error: null };
  assert.equal(gate(base, 1000), null);
  assert.match(gate({ ...base, running: true }, 1000)!, /in progress/);
  assert.match(gate({ ...base, nextAt: 1000 + 5 * 60000 }, 1000)!, /Next run in 5 min/);
  assert.match(gate({ ...base, runsToday: 24 }, 1000)!, /used up/);
});

test("the fast-forward's players react to prices: buy when Bloq is cheap, sell when he pays well", () => {
  const pr = (buy: bigint, stock: bigint) => ({ shop_open: true, gold: 10000n, stock: items(stock, stock, stock), buy: items(buy, buy, buy), sell: items(buy + 1n, buy + 1n, buy + 1n) });
  const me = { gold: 300n, items: items(3n, 3n, 3n) };
  const cheap = pr(30n, 95n), dear = pr(60n, 20n), mid = pr(45n, 50n);
  assert.equal(plan("hoarder", cheap, me)!.kind, "buy");
  assert.equal(plan("hoarder", cheap, me)!.amount, LINES.maxBuy);
  assert.equal(plan("seller", cheap, me)!.kind, "buy"); // even a seller buys a couple when he is this cheap
  assert.deepEqual(plan("seller", dear, me), { kind: "sell", token_id: "key-fragment", amount: 2n, price: 60n }); // keeps one
  assert.equal(plan("trader", dear, me)!.amount, 1n);
  assert.equal(plan("hoarder", mid, me), null);
  assert.equal(plan("hoarder", cheap, { gold: 25n, items: items(1n, 1n, 1n) }), null); // under the gold floor
  assert.equal(plan("seller", { ...dear, shop_open: false }, me), null);
});
