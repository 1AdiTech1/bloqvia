import assert from "node:assert/strict";
import { test } from "node:test";
import { prune, thin, dayAverage, KEEP_MS, MAX_POINTS, type Snapshot } from "../src/market.js";
import { decide, lines, RULES } from "../src/trader.js";
import { gate, plan, slack, LINES, type FFState } from "../src/fastforward.js";

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

test("the day's average: the last 24 h of snapshots per item, the newest point when the relayer is young", () => {
  const now = 10_000_000_000, pt = (t: number, buy: number): Snapshot => ({ t, gold: "1", shop_open: true, prices: [{ token_id: "key-fragment", bloq_stock: "50", buy_price: String(buy), sell_price: String(buy + 1) }] });
  assert.equal(dayAverage([], now), null);
  assert.deepEqual(dayAverage([pt(now - 2 * 24 * 3600 * 1000, 80), pt(now - 3600 * 1000, 40), pt(now, 50)], now), { "key-fragment": 45n }); // the old point is out
  assert.deepEqual(dayAverage([pt(now - 2 * 24 * 3600 * 1000, 80)], now), { "key-fragment": 80n }); // only old points: the newest counts
});

test("the trader's lines sit band over and under the day's average, and it never sells its last one", () => {
  const mine = { gold: 100n, items: items(2n, 3n, 1n) };
  const l = lines({ "key-fragment": 44n, "fuel-cell": 40n, "contract-seal": 43n }, p(items(44n, 40n, 43n), items(45n, 41n, 44n)));
  assert.deepEqual(l, { sellAbove: 42n + RULES.band, buyBelow: 42n - RULES.band });
  assert.deepEqual(lines(null, p(items(60n, 60n, 60n), items(61n, 61n, 61n))), { sellAbove: 60n + RULES.band, buyBelow: 60n - RULES.band }); // no history: the price itself
  const d = decide(p(items(80n, 75n, 90n), items(82n, 77n, 92n)), mine, { sellAbove: 55n, buyBelow: 40n });
  assert.deepEqual(d, { kind: "sell", token_id: "key-fragment", price: 80n }); // contract-seal pays more but it is the last one
  assert.equal(decide(p(items(50n, 50n, 50n), items(52n, 52n, 52n)), mine, { sellAbove: 55n, buyBelow: 40n }), null); // nothing past the lines
  assert.deepEqual(decide(p(items(44n, 38n, 43n), items(45n, 39n, 44n)), mine, l), { kind: "buy", token_id: "fuel-cell", price: 39n }); // fuel cells under the average
});

test("the trader buys the cheapest item below the line and keeps its gold floor; a closed shop means no trade", () => {
  const prices = p(items(30n, 35n, 32n), items(31n, 36n, 33n)), l = { sellAbove: 55n, buyBelow: 40n };
  assert.deepEqual(decide(prices, { gold: 100n, items: items(1n, 1n, 1n) }, l), { kind: "buy", token_id: "key-fragment", price: 31n });
  assert.equal(decide(prices, { gold: RULES.keepGold + 30n, items: items(1n, 1n, 1n) }, l), null); // would go under the floor
  assert.equal(decide({ ...prices, shop_open: false }, { gold: 100n, items: items(5n, 5n, 5n) }, l), null);
});

test("the fast-forward gate: one at a time, a pause between runs, a daily cap", () => {
  const base: FFState = { running: false, round: 0, rounds: 6, startedAt: null, finishedAt: null, nextAt: 0, runsToday: 0, dailyCap: 24, log: [], error: null };
  assert.equal(gate(base, 1000), null);
  assert.match(gate({ ...base, running: true }, 1000)!, /in progress/);
  assert.match(gate({ ...base, nextAt: 1000 + 5 * 60000 }, 1000)!, /Next run in 5 min/);
  assert.match(gate({ ...base, runsToday: 24 }, 1000)!, /used up/);
});

test("the fast-forward's players trade around the day's average, each with its own slack", () => {
  const pr = (buy: bigint, stock: bigint) => ({ shop_open: true, gold: 10000n, stock: items(stock, stock, stock), buy: items(buy, buy, buy), sell: items(buy + 1n, buy + 1n, buy + 1n) });
  const me = { gold: 300n, items: items(3n, 3n, 3n) };
  const fair = items(45n, 45n, 45n);
  const cheap = pr(30n, 95n), dear = pr(60n, 20n), mid = pr(45n, 50n);
  assert.deepEqual([0, 1, 3, 4].map(slack), [1n, 2n, 4n, 1n]);
  // at the average the market still moves: a seller sells, a hoarder buys, a trader waits
  assert.deepEqual(plan("seller", mid, me, fair, 2n), { kind: "sell", token_id: "key-fragment", amount: 2n, price: 45n }); // keeps one
  assert.equal(plan("hoarder", mid, me, fair, 2n)!.kind, "buy");
  assert.equal(plan("hoarder", mid, me, fair, 2n)!.amount, LINES.maxBuy);
  assert.equal(plan("trader", mid, me, fair, 2n), null);
  // away from it: the trader acts, the others stop
  assert.equal(plan("trader", dear, me, fair, 2n)!.kind, "sell");
  assert.equal(plan("trader", dear, me, fair, 2n)!.amount, 1n);
  assert.equal(plan("trader", cheap, me, fair, 2n)!.kind, "buy");
  assert.equal(plan("hoarder", dear, me, fair, 2n), null); // too dear for a hoarder
  assert.equal(plan("seller", cheap, me, fair, 2n), null); // too cheap for a seller
  assert.equal(plan("seller", pr(43n, 50n), me, fair, 1n), null); // 2 under with a slack of 1: waits
  assert.equal(plan("seller", pr(43n, 50n), me, fair, 2n)!.kind, "sell"); // with a slack of 2: sells
  // the item is picked relative to its own average
  const skew = { ...mid, buy: items(45n, 47n, 45n), sell: items(46n, 48n, 46n) };
  assert.equal(plan("seller", skew, me, fair, 2n)!.token_id, "fuel-cell");
  // sells what it still has, not the item it would like to sell: 1 Key Fragment and 1 Fuel Cell left, 3 Contract Seals
  assert.deepEqual(plan("seller", skew, { gold: 300n, items: items(1n, 1n, 3n) }, fair, 2n), { kind: "sell", token_id: "contract-seal", amount: 2n, price: 45n });
  assert.equal(plan("seller", mid, { gold: 300n, items: items(1n, 1n, 1n) }, fair, 2n), null); // nothing to spare
  assert.equal(plan("hoarder", mid, me, null, 2n)!.kind, "buy"); // no history: the price itself is the average
  assert.equal(plan("hoarder", cheap, { gold: 25n, items: items(1n, 1n, 1n) }, fair, 2n), null); // under the gold floor
  assert.equal(plan("seller", { ...dear, shop_open: false }, me, fair, 2n), null);
});
