import assert from "node:assert/strict";
import { test } from "node:test";
import { buyPrice, buyTotal, newPlayer, newWorld, sellPrice, sellTotal, snapshot, step, type Pricing } from "./economy.js";

const p: Pricing = { base_price: 100n, stock_halving: 10n, spread_bps: 250n, treasury_floor: 500n };

test("price rule matches the Rust unit tests", () => {
  assert.equal(buyPrice(p, 0n), 100n);
  assert.equal(buyPrice(p, 10n), 50n);
  assert.equal(sellPrice(p, 0n), 102n);
  assert.equal(buyTotal(p, 0n, 3n), 100n + 90n + 83n);
  assert.equal(sellTotal(p, 2n, 2n), sellPrice(p, 1n) + sellPrice(p, 0n));
  assert.equal(buyPrice({ ...p, stock_halving: 0n }, 1n), 50n);
});

test("sellers push Bloq's buy price down, hoarders graduate", () => {
  const lessons = [
    { lesson_id: "a", reward_gold: 100n, reward_item: "key-fragment" as const, reward_item_amount: 3n },
    { lesson_id: "b", reward_gold: 100n, reward_item: "fuel-cell" as const, reward_item_amount: 3n },
    { lesson_id: "c", reward_gold: 100n, reward_item: "contract-seal" as const, reward_item_amount: 3n },
  ];
  const players = [...Array(10)].map((_, i) => newPlayer(`s${i}`, "seller", 0)).concat([newPlayer("h", "hoarder", 0)]);
  const w = newWorld(p, lessons, 10_000n, 5n, players);
  const before = snapshot(w, 0).prices["key-fragment"];
  for (let r = 1; r <= 4; r += 1) step(w, r);
  const after = snapshot(w, 4);
  assert.ok(after.prices["key-fragment"] < before, "10 sellers dumping fragments must lower the price");
  assert.ok(after.graduates >= 1, "the hoarder can afford graduation from rewards alone");
});
