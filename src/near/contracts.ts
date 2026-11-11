/**
 * Typed access to bloqvia-core and bloqvia-passport.
 * Views go straight to RPC. Changes are signed by the learner and relayed.
 */
import { JsonRpcProvider, actions, teraToGas } from "near-api-js";
import { CALL_GAS_TGAS, CLAIM_GAS_TGAS, VOTE_GAS_TGAS, NEAR_CONFIG } from "./config";
import { relayerApi } from "./relayer";
import type { LearnerSigner } from "./signer";
import type {
  BloqView, BountiesConfig, Bounty, CallRef, CallRound, CallSide, Claim, DaoPolicy, DaoProposal, ItemPrice, LearnerView, LessonPublic, LessonWithText, MemberView,
  MyCall, PassportView, PricingParams, RelayResult, StreakView,
} from "./types";

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
    view<PassportView | null>(NEAR_CONFIG.passportContractId, "get_passport", { account_id: accountId }).then(
      // the passport contract before Season 2 has no `stamps` field
      (p) => (p ? { ...p, stamps: p.stamps ?? [] } : null),
    ),
  /** Every lesson with its public text; bonus (daily) quests carry the AI provenance. */
  lessonsWithText: () => view<LessonWithText[]>(NEAR_CONFIG.coreContractId, "get_lessons_with_text"),
  /** Module A: null when core has no streak contract set (module not deployed). */
  streakContract: () => view<string | null>(NEAR_CONFIG.coreContractId, "get_streak_contract"),
  streak: (streakId: string = NEAR_CONFIG.streakContractId) => view<StreakView>(streakId, "get_streak"),
  member: (accountId: string, streakId: string = NEAR_CONFIG.streakContractId) =>
    view<MemberView>(streakId, "get_member", { account_id: accountId }),
  /** Module B: null when core has no bounty board set (module not deployed). */
  bountiesContract: () => view<string | null>(NEAR_CONFIG.coreContractId, "get_bounties_contract"),
  bountiesConfig: (boardId: string) => view<BountiesConfig>(boardId, "get_config"),
  /** The price call (Nov 11): the current (or a given) round of calls on one item. */
  priceCalls: (tokenId: string, round?: number) => view<CallRound>(NEAR_CONFIG.coreContractId, "get_price_calls", round === undefined ? { token_id: tokenId } : { token_id: tokenId, round }),
  /** The caller's open calls, plus the given settled ones (so a result can be shown once). */
  myCalls: (accountId: string, rounds?: CallRef[]) => view<MyCall[]>(NEAR_CONFIG.coreContractId, "get_my_calls", rounds ? { account_id: accountId, rounds } : { account_id: accountId }),
  /** [round, seconds_left, open] */
  callRound: () => view<[number, number, boolean]>(NEAR_CONFIG.coreContractId, "get_call_round"),
  bounties: (boardId: string) => view<Bounty[]>(boardId, "get_bounties", { limit: 100 }),
  claimsFor: (boardId: string, accountId: string) => view<Claim[]>(boardId, "get_claims_for", { account_id: accountId }),
  recentClaims: (boardId: string) => view<Claim[]>(boardId, "get_recent_claims", {}),
  proposalText: (boardId: string, bountyId: number, accountId: string) =>
    view<string>(boardId, "get_proposal_text", { bounty_id: bountyId, account_id: accountId }),
  /** The DAO (Sputnik v2) read straight from chain: who decides, what is pending. */
  daoPolicy: (daoId: string) => view<DaoPolicy>(daoId, "get_policy"),
  daoProposals: (daoId: string, fromIndex = 0, limit = 50) => view<DaoProposal[]>(daoId, "get_proposals", { from_index: fromIndex, limit }),
  daoLastProposalId: (daoId: string) => view<number>(daoId, "get_last_proposal_id"),
  /** Any account's NEAR balance in yocto (string). */
  accountBalance: async (accountId: string): Promise<string> => {
    const a = await provider.viewAccount({ accountId });
    return String(a.amount);
  },
};

type TGas = `${number}`;

function call(method: string, args: Record<string, unknown>, gasTgas: TGas = CALL_GAS_TGAS) {
  return actions.functionCall(method, args, teraToGas(gasTgas), 0n);
}

async function send(signer: LearnerSigner, method: string, args: Record<string, unknown>, gasTgas?: TGas): Promise<RelayResult> {
  const payload = await signer.signDelegate(NEAR_CONFIG.coreContractId, [call(method, args, gasTgas)]);
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
  /** Module B: claim a bounty; core forwards to the board, which checks the requirement against core. */
  claimBounty: (signer: LearnerSigner, bountyId: number) => send(signer, "claim_bounty", { bounty_id: bountyId }, CLAIM_GAS_TGAS),
  /** The price call (Nov 11): stake gold on Bloq paying More, the Same or Less for an item at the end of the round. */
  placeCall: (signer: LearnerSigner, tokenId: string, side: CallSide, stake: number) => send(signer, "place_call", { token_id: tokenId, side, stake: String(stake) }),
  /** The Passport's vote (Nov 10): act_proposal on the cohort DAO, signed with the account's second key. */
  voteDao: async (signer: LearnerSigner, proposalId: number, approve: boolean): Promise<RelayResult> => {
    const payload = await signer.signDelegate(NEAR_CONFIG.daoId, [call("act_proposal", { id: proposalId, action: approve ? "VoteApprove" : "VoteReject" }, VOTE_GAS_TGAS)]);
    return relayerApi.relay(payload);
  },
};
