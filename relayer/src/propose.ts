/**
 * Propose a bounty (Nov 10): a founder (Season 2 stamp) writes a bounty for the board; the relayer files it on the
 * cohort DAO as a FunctionCall proposal (`bounties.add_bounty`), pays the proposal bond (the DAO returns it when the
 * proposal is decided), and the founders vote with their own keys. If it passes, the DAO itself calls the board:
 * the relayer never adds the bounty, and the reward comes from the board's allowance, which the DAO funded.
 *
 * Proof of who proposes: the request carries a message signed with the account's second key (the one limited to the
 * DAO); the relayer checks the signature and that the key is on the account. Then: the seat, the caps, the rate limit.
 */
import { PublicKey } from "near-api-js";
import { teraToGas } from "near-api-js";
import { hasKey } from "./accounts.js";
import { getPolicy, seatsOf } from "./seats.js";
import { PolicyError } from "./policy.js";
import { view, withRetry, type NearContext } from "./near.js";

export const PROPOSE = {
  /** reward caps per tier in yoctoNEAR: Small ≤ 0.5 NEAR (the board pays alone), Medium ≤ 2, Large ≤ 10. */
  caps: { Small: 500_000_000_000_000_000_000_000n, Medium: 2_000_000_000_000_000_000_000_000n, Large: 10_000_000_000_000_000_000_000_000n } as const,
  title: 40, description: 300, maxClaims: 100,
  perFounderPerDay: 2, perDay: 10,
  /** a signed message is good for this long */
  windowMs: 5 * 60 * 1000,
} as const;

export type Requirement = "Graduated" | { PassportLevel: { min: number } } | { QuestCompleted: { lesson_id: string } };
export interface ProposeBody { accountId: string; title: string; description: string; tier: "Small" | "Medium" | "Large"; requirement: Requirement; reward_near: string; max_claims: number; signed: { message: string; signature: string; publicKey: string } }

const NEAR = 1_000_000_000_000_000_000_000_000n;
/** "0.25" NEAR → yocto, exact for up to 24 decimals. */
export function toYocto(near: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,24}))?$/.exec(near.trim());
  if (!m) throw new PolicyError("reward_near must be a number like 0.25");
  return BigInt(m[1]!) * NEAR + BigInt((m[2] ?? "").padEnd(24, "0"));
}

/** What the signed message must say, and how old it may be. */
export function expectedMessage(accountId: string, at: number): string { return `bloqvia:propose:${accountId}:${at}`; }
export function parseMessage(message: string): { accountId: string; at: number } | null {
  const m = /^bloqvia:propose:([a-z0-9_.-]+):(\d{10,16})$/.exec(message);
  return m ? { accountId: m[1]!, at: Number(m[2]) } : null;
}

/** Validate the body into the board's BountyInput. Pure, tested. Throws PolicyError with the reason. */
export function toBountyInput(b: Omit<ProposeBody, "accountId" | "signed">): { title: string; description: string; tier: ProposeBody["tier"]; reward: string; requirement: Requirement; max_claims: number } {
  const title = String(b.title ?? "").trim(), description = String(b.description ?? "").trim();
  if (!title || title.length > PROPOSE.title) throw new PolicyError(`title: 1 to ${PROPOSE.title} characters`);
  if (!description || description.length > PROPOSE.description) throw new PolicyError(`description: 1 to ${PROPOSE.description} characters`);
  if (!(b.tier in PROPOSE.caps)) throw new PolicyError("tier must be Small, Medium or Large");
  const reward = toYocto(String(b.reward_near ?? ""));
  if (reward <= 0n || reward > PROPOSE.caps[b.tier]) throw new PolicyError(`reward for ${b.tier}: more than 0 and at most ${Number(PROPOSE.caps[b.tier] / 10n ** 21n) / 1000} NEAR`);
  const max_claims = Number(b.max_claims);
  if (!Number.isInteger(max_claims) || max_claims < 1 || max_claims > PROPOSE.maxClaims) throw new PolicyError(`max_claims: 1 to ${PROPOSE.maxClaims}`);
  const r = b.requirement as Requirement;
  const ok = r === "Graduated"
    || (typeof r === "object" && "PassportLevel" in r && Number.isInteger(r.PassportLevel?.min) && r.PassportLevel.min >= 1 && r.PassportLevel.min <= 3)
    || (typeof r === "object" && "QuestCompleted" in r && /^[a-z0-9-]{3,40}$/.test(String(r.QuestCompleted?.lesson_id)));
  if (!ok) throw new PolicyError("requirement: Graduated, { PassportLevel: { min } } or { QuestCompleted: { lesson_id } }");
  return { title, description, tier: b.tier, reward: reward.toString(), requirement: r, max_claims };
}

const perFounder = new Map<string, number[]>();
let today = new Date().toISOString().slice(0, 10), runsToday = 0;

export async function propose(ctx: NearContext, body: ProposeBody, log: (s: string) => void = console.log): Promise<{ proposalId: number; url: string }> {
  const accountId = String(body.accountId ?? "");
  const s = body.signed;
  if (!s || typeof s.message !== "string" || typeof s.signature !== "string" || typeof s.publicKey !== "string") throw new PolicyError("Send signed: { message, signature, publicKey }");
  const parsed = parseMessage(s.message);
  if (!parsed || parsed.accountId !== accountId) throw new PolicyError("The signed message is not for this account");
  if (Math.abs(Date.now() - parsed.at) > PROPOSE.windowMs) throw new PolicyError("The signed message is too old; try again");
  let valid = false;
  try { valid = PublicKey.fromString(s.publicKey).verify(Buffer.from(s.message, "utf8"), Buffer.from(s.signature, "base64")); } catch { valid = false; }
  if (!valid) throw new PolicyError("Bad signature", 403);
  if (!(await hasKey(ctx, accountId, s.publicKey))) throw new PolicyError("That key is not on the account", 403);

  const policy = await getPolicy(ctx);
  if (!seatsOf(policy, accountId).founder) throw new PolicyError("Only founders (Season 2 stamp) can propose a bounty", 403);
  const day = new Date().toISOString().slice(0, 10);
  if (day !== today) { today = day; runsToday = 0; perFounder.clear(); }
  const mine = (perFounder.get(accountId) ?? []).filter((t) => Date.now() - t < 24 * 3600 * 1000);
  if (mine.length >= PROPOSE.perFounderPerDay) throw new PolicyError(`At most ${PROPOSE.perFounderPerDay} proposals a day per founder`, 429);
  if (runsToday >= PROPOSE.perDay) throw new PolicyError("The board's proposals for today are used up; tomorrow again", 429);

  const bounty = toBountyInput(body);
  const boardId = await withRetry(() => view<string | null>(ctx, ctx.config.coreContractId, "get_bounties_contract"));
  if (!boardId) throw new PolicyError("Core has no bounty board", 503);
  const proposal = {
    description: `Bloqvia: ${accountId} (founder) proposes the bounty "${bounty.title}" (${bounty.tier}, ${Number(BigInt(bounty.reward) / 10n ** 21n) / 1000} NEAR, ${bounty.max_claims} claims). Founders vote; if it passes the DAO adds it to the board.`,
    kind: { FunctionCall: { receiver_id: boardId, actions: [{ method_name: "add_bounty", args: Buffer.from(JSON.stringify({ bounty }), "utf8").toString("base64"), deposit: "0", gas: "30000000000000" }] } },
  };
  const proposalId = await withRetry(() => ctx.relayer.callFunction<number>({ contractId: ctx.config.daoId, methodName: "add_proposal", args: { proposal }, gas: teraToGas("50"), deposit: BigInt(policy.proposal_bond) }));
  mine.push(Date.now()); perFounder.set(accountId, mine); runsToday += 1;
  log(`[propose] ${accountId} proposed "${bounty.title}" → DAO proposal #${proposalId}`);
  return { proposalId, url: `https://testnet.nearblocks.io/address/${ctx.config.daoId}` };
}
