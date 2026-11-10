/**
 * Seats on the cohort DAO (Nov 10): the Passport as a vote.
 *
 *  - A sealed Passport (graduated) gets a seat in the `graduates` role: it votes on Transfer proposals, i.e. on who
 *    gets paid for a medium bounty.
 *  - A Season 2 stamp gets a seat in the `founders` role: that plus votes on FunctionCall proposals, i.e. on what the
 *    cohort pays for (a new bounty on the board, funding the board's allowance).
 *
 * The relayer relays every learner call and reads every receipt, so it sees a graduation and a stamp the moment they
 * happen; it then files `AddMemberToRole` on the DAO (with the proposal bond, which the DAO returns) and approves it
 * with the council vote it holds. The only condition is the chain's own record: no model, no form, no human. The seat
 * is on the DAO's policy for anyone to read (`get_policy`), and the vote itself is cast by the learner's account with
 * its second key (accounts.ts), relayed like any other call (policy.ts).
 *
 * Nothing here can mint, move balances or change a price. The roles are created once by `scripts/dao-roles.ts`.
 */
import { view, withRetry, type NearContext } from "./near.js";
import { teraToGas } from "near-api-js";

export const SEASON2_CHAPTERS = ["chapter-ownership", "chapter-transactions", "chapter-defi"] as const;
export type Seat = "graduates" | "founders";

export interface VotePolicy { weight_kind: "RoleWeight" | "TokenWeight"; quorum: string; threshold: string | [number, number] }
export interface Role { name: string; kind: "Everyone" | { Group: string[] }; permissions: string[]; vote_policy: Record<string, VotePolicy> }
export interface DaoPolicy { roles: Role[]; default_vote_policy: VotePolicy; proposal_bond: string; proposal_period: string; bounty_bond: string; bounty_forgiveness_period: string }

/** One vote of a seat holder decides (RoleWeight, threshold 1): testnet parameters, so a judge's vote counts at once. */
const ONE_VOTE: VotePolicy = { weight_kind: "RoleWeight", quorum: "0", threshold: "1" };

/** The two roles as they should exist on the DAO. Members are kept from the current policy when updating. */
export const SEAT_ROLES: Record<Seat, Omit<Role, "kind">> = {
  graduates: { name: "graduates", permissions: ["transfer:VoteApprove", "transfer:VoteReject"], vote_policy: { transfer: ONE_VOTE } },
  founders: { name: "founders", permissions: ["transfer:VoteApprove", "transfer:VoteReject", "call:VoteApprove", "call:VoteReject"], vote_policy: { transfer: ONE_VOTE, call: ONE_VOTE } },
};

export const members = (policy: DaoPolicy, role: string): string[] => {
  const r = policy.roles.find((x) => x.name === role);
  return r && typeof r.kind === "object" && "Group" in r.kind ? r.kind.Group : [];
};

/** The policy with the two seat roles added (or brought up to date), everything else untouched. Pure, tested. */
export function withSeatRoles(policy: DaoPolicy): DaoPolicy {
  const roles = policy.roles.filter((r) => !(r.name in SEAT_ROLES));
  for (const seat of Object.keys(SEAT_ROLES) as Seat[]) {
    const def = SEAT_ROLES[seat];
    roles.push({ ...def, kind: { Group: members(policy, seat) } });
  }
  return { ...policy, roles };
}

/** Which seats an account holds, from the policy. */
export function seatsOf(policy: DaoPolicy, accountId: string): { graduate: boolean; founder: boolean } {
  return { graduate: members(policy, "graduates").includes(accountId), founder: members(policy, "founders").includes(accountId) };
}

export async function getPolicy(ctx: NearContext): Promise<DaoPolicy> {
  return withRetry(() => view<DaoPolicy>(ctx, ctx.config.daoId, "get_policy"));
}

const pending = new Set<string>();

/** Give `accountId` the seat if it does not have it: AddMemberToRole + the council's approval. Idempotent. */
export async function ensureSeat(ctx: NearContext, accountId: string, seat: Seat, log: (s: string) => void = console.log): Promise<{ added: boolean; proposalId?: number }> {
  const key = `${accountId}:${seat}`;
  if (pending.has(key)) return { added: false };
  pending.add(key);
  try {
    const policy = await getPolicy(ctx);
    if (!policy.roles.some((r) => r.name === seat)) { log(`[seats] the DAO has no "${seat}" role yet (run scripts/dao-roles.ts); ${accountId} not seated`); return { added: false }; }
    if (members(policy, seat).includes(accountId)) return { added: false };
    const proposal = { description: `Bloqvia: ${accountId} ${seat === "graduates" ? "graduated (Passport sealed)" : "finished Season 2 (Passport stamped)"}; seat in ${seat}, as the chain records it`, kind: { AddMemberToRole: { member_id: accountId, role: seat } } };
    const id = await withRetry(() => ctx.relayer.callFunction<number>({ contractId: ctx.config.daoId, methodName: "add_proposal", args: { proposal }, gas: teraToGas("50"), deposit: BigInt(policy.proposal_bond) }));
    await withRetry(() => ctx.relayer.callFunction({ contractId: ctx.config.daoId, methodName: "act_proposal", args: { id, action: "VoteApprove" }, gas: teraToGas("100"), deposit: 0n }));
    log(`[seats] ${accountId} seated in ${seat} (proposal #${id}, approved)`);
    return { added: true, proposalId: id };
  } finally {
    pending.delete(key);
  }
}

/** Called after a relayed call went through: a graduation seats a graduate; the third chapter seats a founder. */
export function afterLearnerCall(ctx: NearContext, accountId: string, calls: { method: string; args: Record<string, unknown> }[], log: (s: string) => void = console.log): void {
  const run = async () => {
    if (calls.some((c) => c.method === "graduate")) await ensureSeat(ctx, accountId, "graduates", log);
    const chapter = calls.find((c) => c.method === "complete_lesson" && (SEASON2_CHAPTERS as readonly string[]).includes(String(c.args["lesson_id"])));
    if (chapter) {
      const l = await withRetry(() => view<{ completed: string[] }>(ctx, ctx.config.coreContractId, "get_learner", { account_id: accountId }));
      if (SEASON2_CHAPTERS.every((id) => l.completed.includes(id))) await ensureSeat(ctx, accountId, "founders", log);
    }
  };
  run().catch((e) => console.error(`[seats] ${accountId}: ${(e as Error).message}`));
}

