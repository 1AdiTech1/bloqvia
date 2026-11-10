import assert from "node:assert/strict";
import { test } from "node:test";
import { DAILY_BOUNTY_MAX_CLAIMS, DAILY_BOUNTY_REWARD, DAILY_BOUNTY_TITLE, dailyBountyInput, dailyBountyPlan, type BoardBounty } from "../src/bounties.js";

const b = (id: number, lessonId: string | null, open = true, title = DAILY_BOUNTY_TITLE): BoardBounty => ({
  id, title, tier: "Small", reward: DAILY_BOUNTY_REWARD, claims: 0, max_claims: DAILY_BOUNTY_MAX_CLAIMS, open,
  requirement: lessonId ? { QuestCompleted: { lesson_id: lessonId } } : "Graduated",
});

test("today's bounty is the Small tier with a fixed reward and today's quest as the requirement", () => {
  const input = dailyBountyInput("daily-2026-11-10");
  assert.equal(input.title, DAILY_BOUNTY_TITLE);
  assert.equal(input.tier, "Small");
  assert.equal(input.reward, "50000000000000000000000");
  assert.deepEqual(input.requirement, { QuestCompleted: { lesson_id: "daily-2026-11-10" } });
  assert.match(input.description, /2026-11-10/);
  assert.equal(input.max_claims, 50);
});

test("the plan closes earlier days' daily bounties and adds today's once", () => {
  const board = [b(1, null), b(2, "daily-2026-11-05"), b(3, "daily-2026-11-09"), b(4, "daily-2026-11-01", false)];
  assert.deepEqual(dailyBountyPlan(board, "daily-2026-11-10"), { close: [2, 3], add: true });
  assert.deepEqual(dailyBountyPlan([...board, b(5, "daily-2026-11-10")], "daily-2026-11-10"), { close: [2, 3], add: false });
  // a second run on the same day does nothing
  assert.deepEqual(dailyBountyPlan([b(1, null), b(5, "daily-2026-11-10")], "daily-2026-11-10"), { close: [], add: false });
});

test("other bounties are never touched, even a quest bounty with another title", () => {
  const board = [b(1, null), b(7, "the-vault", true, "Finish The Vault"), b(8, "daily-2026-11-09", true, "A one-off")];
  assert.deepEqual(dailyBountyPlan(board, "daily-2026-11-10"), { close: [], add: true });
});
