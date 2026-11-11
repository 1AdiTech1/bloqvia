import assert from "node:assert/strict";
import { test } from "node:test";
import { DailyCap, PolicyError, RateLimiter } from "../src/policy.js";
import { makeLimits } from "../src/http.js";

test("the per-address limiter and the daily cap refuse with 429 and their own sentence", () => {
  const l = new RateLimiter(2, 1000, "slow");
  l.check("ip:1", 0); l.check("ip:1", 10);
  assert.throws(() => l.check("ip:1", 20), (e: unknown) => e instanceof PolicyError && e.status === 429 && e.message === "slow");
  l.check("ip:2", 20); // another address is not affected
  l.check("ip:1", 1500); // the window slid
  const cap = new DailyCap(2, "today is used up");
  cap.take(new Date("2026-11-11T10:00:00Z")); cap.take(new Date("2026-11-11T11:00:00Z"));
  assert.throws(() => cap.take(new Date("2026-11-11T12:00:00Z")), /today is used up/);
  cap.take(new Date("2026-11-12T00:00:01Z")); // a new UTC day
  assert.equal(cap.remaining, 1);
});

test("the relayer's abuse limits: registrations per address and per day, relays per address", () => {
  const lim = makeLimits({ registerPerIpPerHour: 1, registerPerDay: 2, relayPerIpPerMin: 1 });
  lim.registerIp.check("ip:a"); lim.registerDay.take();
  assert.throws(() => lim.registerIp.check("ip:a"), /new accounts an hour/);
  lim.registerIp.check("ip:b"); lim.registerDay.take();
  assert.throws(() => lim.registerDay.take(), /today's share of accounts/);
  lim.relayIp.check("ip:a");
  assert.throws(() => lim.relayIp.check("ip:a"), /Too many calls from one address/);
});
