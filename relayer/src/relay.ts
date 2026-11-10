/** Relays one allow-listed signed delegate; the relayer pays the gas. */
import { decodeSignedDelegateBase64 } from "./codec.js";
import { receiptFailure } from "./outcome.js";
import { PolicyError, RateLimiter, assertAllowed } from "./policy.js";
import { type NearContext, view } from "./near.js";
import { afterTrade } from "./market.js";

const limiter = new RateLimiter(30, 60_000); // 30 calls per minute per sender
const registeredCache = new Map<string, number>();

async function isRegisteredCached(ctx: NearContext, accountId: string): Promise<boolean> {
  const until = registeredCache.get(accountId);
  if (until && until > Date.now()) return true;
  const learner = await view<{ registered: boolean }>(ctx, ctx.config.coreContractId, "get_learner", { account_id: accountId });
  if (learner.registered) registeredCache.set(accountId, Date.now() + 10 * 60_000);
  return learner.registered === true;
}

export interface RelayResult {
  txHash: string;
  senderId: string;
  methods: string[];
}

export async function relay(ctx: NearContext, payloadBase64: string): Promise<RelayResult> {
  let signedDelegate;
  try {
    signedDelegate = decodeSignedDelegateBase64(payloadBase64);
  } catch (e) {
    throw new PolicyError(`Cannot decode payload: ${(e as Error).message}`);
  }
  const senderId = signedDelegate.delegateAction.senderId;
  limiter.check(senderId);
  await assertAllowed(signedDelegate, {
    coreContractId: ctx.config.coreContractId,
    isRegistered: (id) => isRegisteredCached(ctx, id),
  });

  const outcome = await ctx.relayer.relayMetaTransaction(signedDelegate);
  const methods = signedDelegate.delegateAction.actions
    .map((a) => (a as { functionCall?: { methodName: string } }).functionCall?.methodName ?? "?");
  const txHash: string = outcome.transaction.hash;

  // The relayer's own transaction succeeded; the delegated call may still have
  // panicked inside the contract. Surface that as the player's error.
  const failure = receiptFailure(outcome);
  if (failure) {
    console.log(`[relayer] relay ${senderId} ${methods.join(",")} tx=${txHash} FAILED in ${failure.executor}: ${failure.message}`);
    throw new PolicyError(failure.message, 422);
  }
  if (methods.some((m) => m === "sell_to_bloq" || m === "buy_from_bloq" || m === "graduate")) afterTrade(ctx); // the curve gets the trade's point
  return { txHash, senderId, methods };
}
