/**
 * The relayer's allow-list. Everything the relayer is willing to pay for is
 * written here, and nothing else is relayed. The contract enforces the real
 * rules; this file only stops the relayer from burning gas on junk.
 */
import type { SignedDelegate } from "near-api-js";

/** Methods a learner may call on bloqvia-core through the relayer. */
export const ALLOWED_METHODS = ["complete_lesson", "sell_to_bloq", "buy_from_bloq", "graduate"] as const;

/** The same list, used when the relayer adds the learner's function-call key. */
export const LEARNER_KEY_METHODS: string[] = [...ALLOWED_METHODS];

/** Hard cap per relayed call. graduate needs ~25 TGas (own work + 15 TGas of Passport calls). */
export const MAX_GAS_PER_ACTION = 50_000_000_000_000n;

/** Learners never attach NEAR. A non-zero deposit is a bug or an attack. */
export const MAX_DEPOSIT = 0n;

export interface PolicyContext {
  coreContractId: string;
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
  if (da.receiverId !== ctx.coreContractId) {
    throw new PolicyError(`Receiver ${da.receiverId} is not ${ctx.coreContractId}`);
  }
  if (!Array.isArray(da.actions) || da.actions.length === 0) {
    throw new PolicyError("Delegate carries no actions");
  }
  if (da.actions.length > 2) {
    throw new PolicyError("At most two actions per relayed call");
  }
  for (const action of da.actions) {
    const fc = (action as { functionCall?: { methodName: string; gas: bigint; deposit: bigint } }).functionCall;
    if (!fc) throw new PolicyError("Only function calls are relayed");
    if (!(ALLOWED_METHODS as readonly string[]).includes(fc.methodName)) {
      throw new PolicyError(`Method ${fc.methodName} is not allowed`);
    }
    if (BigInt(fc.gas) > MAX_GAS_PER_ACTION) throw new PolicyError("Gas above the per-call cap");
    if (BigInt(fc.deposit) > MAX_DEPOSIT) throw new PolicyError("Deposits are not relayed");
  }
  if (!(await ctx.isRegistered(da.senderId))) {
    throw new PolicyError(`${da.senderId} is not a registered learner`, 403);
  }
}

/** Sliding-window rate limit per sender. In memory: fine for one relayer instance. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly max: number, private readonly windowMs: number) {}
  check(key: string, now = Date.now()): void {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) throw new PolicyError("Too many requests, slow down", 429);
    list.push(now);
    this.hits.set(key, list);
  }
}
