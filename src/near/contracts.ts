/**
 * Typed access to bloqvia-core and bloqvia-passport.
 * Views go straight to RPC. Changes are signed by the learner and relayed.
 */
import { JsonRpcProvider, actions, teraToGas } from "near-api-js";
import { CALL_GAS_TGAS, NEAR_CONFIG } from "./config";
import { relayerApi } from "./relayer";
import type { LearnerSigner } from "./signer";
import type { BloqView, ItemPrice, LearnerView, LessonPublic, MemberView, PassportView, PricingParams, RelayResult, StreakView } from "./types";

const provider = new JsonRpcProvider({ url: NEAR_CONFIG.rpcUrl });

async function view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await provider.callFunction({ contractId, method, args })) as T;
}

export const views = {
  lessons: () => view<LessonPublic[]>(NEAR_CONFIG.coreContractId, "get_lessons"),
  prices: () => view<ItemPrice[]>(NEAR_CONFIG.coreContractId, "get_prices"),
  bloq: () => view<BloqView>(NEAR_CONFIG.coreContractId, "get_bloq"),
  pricing: () => view<PricingParams>(NEAR_CONFIG.coreContractId, "get_pricing"),
  learner: (accountId: string) => view<LearnerView>(NEAR_CONFIG.coreContractId, "get_learner", { account_id: accountId }),
  passport: (accountId: string) =>
    view<PassportView | null>(NEAR_CONFIG.passportContractId, "get_passport", { account_id: accountId }),
  /** Module A: null when core has no streak contract set (module not deployed). */
  streakContract: () => view<string | null>(NEAR_CONFIG.coreContractId, "get_streak_contract"),
  streak: (streakId: string = NEAR_CONFIG.streakContractId) => view<StreakView>(streakId, "get_streak"),
  member: (accountId: string, streakId: string = NEAR_CONFIG.streakContractId) =>
    view<MemberView>(streakId, "get_member", { account_id: accountId }),
};

function call(method: string, args: Record<string, unknown>) {
  return actions.functionCall(method, args, teraToGas(CALL_GAS_TGAS), 0n);
}

async function send(signer: LearnerSigner, method: string, args: Record<string, unknown>): Promise<RelayResult> {
  const payload = await signer.signDelegate(NEAR_CONFIG.coreContractId, [call(method, args)]);
  return relayerApi.relay(payload);
}

/** The four moves a learner can make. Each returns the relayed transaction hash. */
export const game = {
  completeLesson: (signer: LearnerSigner, lessonId: string, answer: string) =>
    send(signer, "complete_lesson", { lesson_id: lessonId, answer }),
  sellToBloq: (signer: LearnerSigner, tokenId: string, amount: number) =>
    send(signer, "sell_to_bloq", { token_id: tokenId, amount: String(amount) }),
  buyFromBloq: (signer: LearnerSigner, tokenId: string, amount: number) =>
    send(signer, "buy_from_bloq", { token_id: tokenId, amount: String(amount) }),
  graduate: (signer: LearnerSigner) => send(signer, "graduate", {}),
  /** Module A: one check-in per streak day, forwarded by core to the streak contract. */
  checkIn: (signer: LearnerSigner) => send(signer, "check_in", {}),
};
