/**
 * The board's daily bounty (Nov 10): "Today's quest, done" pays a Small reward to whoever completes the quest the
 * agent wrote today. The relayer signs as the board's owner, so after the quest is seeded it posts that day's bounty and
 * closes the one for the day before. Everything here is fixed code: the reward, the tier and the cap are constants, the
 * model writes only the quest text. Idempotent: run it as often as you like, it adds at most one bounty per day.
 */
import { GAS_30, ZERO, view, type NearContext } from "./near.js";
import { DAILY_PREFIX, lessonIdFor } from "./quests.js";

export const DAILY_BOUNTY_TITLE = "Today's quest, done";
/** 0.05 NEAR, the Small tier: the board pays it by itself from the DAO's allowance. */
export const DAILY_BOUNTY_REWARD = "50000000000000000000000";
export const DAILY_BOUNTY_MAX_CLAIMS = 50;

export interface BoardBounty {
  id: number;
  title: string;
  tier: string;
  reward: string;
  requirement: unknown;
  claims: number;
  max_claims: number;
  open: boolean;
}

export interface BountyInput {
  title: string;
  description: string;
  tier: "Small";
  reward: string;
  requirement: { QuestCompleted: { lesson_id: string } };
  max_claims: number;
}

/** The bounty for the quest with this id (YYYY-MM-DD in the description comes from the id). */
export function dailyBountyInput(lessonId: string): BountyInput {
  const day = lessonId.slice(DAILY_PREFIX.length);
  return {
    title: DAILY_BOUNTY_TITLE,
    description: `Complete today's quest, written by an AI agent this morning (${day}). The chain checks your answer; the board pays from the DAO's allowance.`,
    tier: "Small",
    reward: DAILY_BOUNTY_REWARD,
    requirement: { QuestCompleted: { lesson_id: lessonId } },
    max_claims: DAILY_BOUNTY_MAX_CLAIMS,
  };
}

const questOf = (b: BoardBounty): string | null => {
  const r = b.requirement as { QuestCompleted?: { lesson_id?: string } } | string;
  return typeof r === "object" && r.QuestCompleted?.lesson_id ? r.QuestCompleted.lesson_id : null;
};

/** What to do so the board shows exactly one open daily bounty, today's: ids to close, and whether to add today's. */
export function dailyBountyPlan(bounties: BoardBounty[], lessonId: string): { close: number[]; add: boolean } {
  const daily = bounties.filter((b) => b.open && b.title === DAILY_BOUNTY_TITLE && (questOf(b) ?? "").startsWith(DAILY_PREFIX));
  return {
    close: daily.filter((b) => questOf(b) !== lessonId).map((b) => b.id),
    add: !daily.some((b) => questOf(b) === lessonId),
  };
}

/** Post today's bounty and close the earlier daily ones. Does nothing when core has no board. */
export async function syncDailyBounty(ctx: NearContext, date = new Date(), log: (s: string) => void = console.log): Promise<{ boardId: string | null; closed: number[]; added: boolean }> {
  const boardId = await view<string | null>(ctx, ctx.config.coreContractId, "get_bounties_contract");
  if (!boardId) {
    log("[bounty] core has no bounty board; nothing to post");
    return { boardId: null, closed: [], added: false };
  }
  const lessonId = lessonIdFor(date);
  const bounties = await view<BoardBounty[]>(ctx, boardId, "get_bounties");
  const plan = dailyBountyPlan(bounties, lessonId);
  for (const id of plan.close) {
    await ctx.relayer.callFunction({ contractId: boardId, methodName: "close_bounty", args: { bounty_id: id }, gas: GAS_30, deposit: ZERO });
    log(`[bounty] closed #${id} (an earlier day's quest)`);
  }
  if (plan.add) {
    await ctx.relayer.callFunction({ contractId: boardId, methodName: "add_bounty", args: { bounty: dailyBountyInput(lessonId) }, gas: GAS_30, deposit: ZERO });
    log(`[bounty] posted "${DAILY_BOUNTY_TITLE}" for ${lessonId}`);
  }
  return { boardId, closed: plan.close, added: plan.add };
}
