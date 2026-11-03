/**
 * Learner onboarding (path B, and the fallback for path A accounts that
 * already exist): one batched transaction creates the sub-account, funds its
 * storage and adds the learner's key as a FUNCTION-CALL key scoped to
 * bloqvia-core. The relayer never holds the learner's private key.
 */
import { createHash } from "node:crypto";
import { PublicKey, actions, nearToYocto } from "near-api-js";
import { LEARNER_KEY_METHODS } from "./policy.js";
import { GAS_30, ZERO, type NearContext, view } from "./near.js";

export interface RegisterResult {
  accountId: string;
  created: boolean;
  registered: boolean;
  txHashes: string[];
}

/** Deterministic account name from the public key, so re-registering with the same key is idempotent. */
export function learnerAccountId(publicKey: string, parentAccountId: string): string {
  const digest = createHash("sha256").update(publicKey).digest("hex").slice(0, 12);
  return `learner-${digest}.${parentAccountId}`;
}

async function accountExists(ctx: NearContext, accountId: string): Promise<boolean> {
  try {
    await ctx.provider.viewAccount({ accountId });
    return true;
  } catch {
    return false;
  }
}

async function isRegistered(ctx: NearContext, accountId: string): Promise<boolean> {
  const learner = await view<{ registered: boolean }>(ctx, ctx.config.coreContractId, "get_learner", { account_id: accountId });
  return learner.registered === true;
}

/**
 * Creates (if needed) and registers a learner for the given public key.
 * Safe to call twice: every step checks on-chain state first.
 */
export async function registerLearner(ctx: NearContext, publicKeyString: string): Promise<RegisterResult> {
  const publicKey = PublicKey.fromString(publicKeyString);
  const accountId = learnerAccountId(publicKey.toString(), ctx.config.relayerAccountId);
  const txHashes: string[] = [];

  let created = false;
  if (!(await accountExists(ctx, accountId))) {
    const outcome = await ctx.relayer.signAndSendTransaction({
      receiverId: accountId,
      actions: [
        actions.createAccount(),
        actions.transfer(nearToYocto(Number(ctx.config.learnerFundingNear))),
        actions.addFunctionCallAccessKey(publicKey, ctx.config.coreContractId, LEARNER_KEY_METHODS),
      ],
    });
    txHashes.push(outcome.transaction.hash);
    created = true;
  }

  let registered = false;
  if (!(await isRegistered(ctx, accountId))) {
    const outcome = await ctx.relayer.callFunction({
      contractId: ctx.config.coreContractId,
      methodName: "register_learner",
      args: { account_id: accountId },
      gas: GAS_30,
      deposit: ZERO,
    });
    // callFunction returns the parsed result; the tx hash comes from the raw variant when needed.
    void outcome;
    registered = true;
  }

  return { accountId, created, registered, txHashes };
}

/**
 * Path A support: an account that already exists (created by NEAR Auth) only
 * needs registering. The relayer still pays, the learner still never sees gas.
 */
export async function registerExistingAccount(ctx: NearContext, accountId: string): Promise<RegisterResult> {
  if (!(await accountExists(ctx, accountId))) throw new Error(`Account ${accountId} does not exist`);
  let registered = false;
  if (!(await isRegistered(ctx, accountId))) {
    await ctx.relayer.callFunction({
      contractId: ctx.config.coreContractId,
      methodName: "register_learner",
      args: { account_id: accountId },
      gas: GAS_30,
      deposit: ZERO,
    });
    registered = true;
  }
  return { accountId, created: false, registered, txHashes: [] };
}
