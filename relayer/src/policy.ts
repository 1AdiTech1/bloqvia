/**
 * The relayer's allow-list. Everything the relayer is willing to pay for is
 * written here, and nothing else is relayed. The contract enforces the real
 * rules; this file only stops the relayer from burning gas on junk.
 */
import type { SignedDelegate } from "near-api-js";

/** Methods a learner may call on bloqvia-core through the relayer. */
export const ALLOWED_METHODS = ["complete_lesson", "sell_to_bloq", "buy_from_bloq", "graduate", "check_in", "claim_bounty"] as const;

/**
 * The same list, baked into the learner's function-call key at creation. The
 * key stays limited to these methods for the account's whole life (a key
 * cannot add methods to itself), so an account created before a method was
 * added here cannot call it; the list is never made open-ended because the
 * NEP-245 transfer methods on core must stay out of a learner's reach.
 */
export const LEARNER_KEY_METHODS: string[] = [...ALLOWED_METHODS];

/** The second key (Nov 10, the Passport's vote): one method on the cohort DAO, and the only two votes it can cast. */
export const DAO_KEY_METHODS: string[] = ["act_proposal"];
export const DAO_VOTES = ["VoteApprove", "VoteReject"] as const;

/**
 * Hard cap per relayed call. graduate needs ~25 TGas (own work + 15 TGas of
 * Passport calls); claim_bounty forwards to the board, which reads core back
 * and may file a DAO proposal, ~120 TGas end to end.
 */
export const MAX_GAS_PER_ACTION = 150_000_000_000_000n;

/** Learners never attach NEAR. A non-zero deposit is a bug or an attack. */
export const MAX_DEPOSIT = 0n;

export interface PolicyContext {
  coreContractId: string;
  /** The cohort DAO; a registered learner may relay act_proposal to it (the DAO checks the seat). */
  daoId?: string;
  /** Returns true when the sender is a registered learner (cached view call). */
  isRegistered: (accountId: string) => Promise<boolean>;
}

export class PolicyError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

/** Throws PolicyError if the delegate must not be relayed. */
export async function assertAllowed(sd: SignedDelegate, ctx: PolicyContext): Promise<void> {
  const da = sd.delegateAction;
  const toDao = !!ctx.daoId && da.receiverId === ctx.daoId;
  if (da.receiverId !== ctx.coreContractId && !toDao) {
    throw new PolicyError(`Receiver ${da.receiverId} is not ${ctx.coreContractId}`);
  }
  if (!Array.isArray(da.actions) || da.actions.length === 0) {
    throw new PolicyError("Delegate carries no actions");
  }
  if (da.actions.length > (toDao ? 1 : 2)) {
    throw new PolicyError(toDao ? "One vote per relayed call" : "At most two actions per relayed call");
  }
  for (const action of da.actions) {
    const fc = (action as { functionCall?: { methodName: string; gas: bigint; deposit: bigint; args: Uint8Array } }).functionCall;
    if (!fc) throw new PolicyError("Only function calls are relayed");
    if (toDao) {
      if (!DAO_KEY_METHODS.includes(fc.methodName)) throw new PolicyError(`Method ${fc.methodName} is not allowed on the DAO`);
      if (!isVote(fc.args)) throw new PolicyError("Only VoteApprove and VoteReject are relayed to the DAO");
    } else if (!(ALLOWED_METHODS as readonly string[]).includes(fc.methodName)) {
      throw new PolicyError(`Method ${fc.methodName} is not allowed`);
    }
    if (BigInt(fc.gas) > MAX_GAS_PER_ACTION) throw new PolicyError("Gas above the per-call cap");
    if (BigInt(fc.deposit) > MAX_DEPOSIT) throw new PolicyError("Deposits are not relayed");
  }
  if (!(await ctx.isRegistered(da.senderId))) {
    throw new PolicyError(`${da.senderId} is not a registered learner`, 403);
  }
}

/** act_proposal args must be { id, action: VoteApprove | VoteReject }: a vote, never Finalize, RemoveProposal or a council action. */
export function isVote(args: Uint8Array | string): boolean {
  try {
    const a = JSON.parse(typeof args === "string" ? args : Buffer.from(args).toString("utf8")) as { id?: unknown; action?: unknown };
    return Number.isInteger(a.id) && typeof a.action === "string" && (DAO_VOTES as readonly string[]).includes(a.action);
  } catch {
    return false;
  }
}

/** A global cap per UTC day (registrations, model calls). In memory: fine for one relayer instance. */
export class DailyCap {
  private day = "";
  private used = 0;
  constructor(private readonly max: number, private readonly message = "Today's allowance is used up; tomorrow again") {}
  take(now = new Date()): void {
    const d = now.toISOString().slice(0, 10);
    if (d !== this.day) { this.day = d; this.used = 0; }
    if (this.used >= this.max) throw new PolicyError(this.message, 429);
    this.used += 1;
  }
  get remaining(): number { return Math.max(0, this.max - this.used); }
}

/** Sliding-window rate limit per sender. In memory: fine for one relayer instance. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly max: number, private readonly windowMs: number, private readonly message = "Too many requests, slow down") {}
  check(key: string, now = Date.now()): void {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) throw new PolicyError(this.message, 429);
    list.push(now);
    this.hits.set(key, list);
  }
}
