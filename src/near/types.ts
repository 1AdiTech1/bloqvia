/** JSON shapes returned by bloqvia-core and bloqvia-passport view methods. */

export interface LessonPublic {
  lesson_id: string;
  title: string;
  answer_hash: string;
  reward_gold: string;
  reward_item: string;
  reward_item_amount: string;
}

export interface ItemPrice {
  token_id: string;
  bloq_stock: string;
  /** What Bloq pays you for one unit. */
  buy_price: string;
  /** What Bloq charges you for one unit. */
  sell_price: string;
}

export interface BloqView {
  account_id: string;
  gold: string;
  shop_open: boolean;
  treasury_floor: string;
  prices: ItemPrice[];
  graduation_fee: string;
}

export interface LearnerView {
  account_id: string;
  registered: boolean;
  completed: string[];
  level: number;
  graduated: boolean;
  gold: string;
  items: [string, string][];
}

export interface PricingParams {
  base_price: string;
  stock_halving: string;
  spread_bps: number;
  treasury_floor: string;
}

export interface PassportView {
  token_id: string;
  owner_id: string;
  level: number;
  graduated: boolean;
  /** Season stamps, e.g. ["season-2"]. Empty for a Passport with none (and on the pre-Season-2 contract). */
  stamps: string[];
}

export interface RegisterResult {
  accountId: string;
  created: boolean;
  registered: boolean;
  txHashes: string[];
  /** The account carries the second key (the Passport's vote on the cohort DAO). */
  canVote?: boolean;
}
/** GET /seat: the account's seats on the cohort DAO. */
export interface SeatResult { daoId: string; graduate: boolean; founder: boolean; canVote: boolean }

export interface RelayResult {
  txHash: string;
  senderId: string;
  methods: string[];
}

// ---- Module A: streak token ----
export interface StreakParams { daily_target: number; reward_per_checkin: string; burn_per_miss: string; day_length_seconds: number; }
export interface DayResult { day: number; checkins: number; target: number; met: boolean; minted: string; burned: string; streak_after: number; }
export interface StreakView {
  day: number; seconds_left_in_day: number; today_count: number; today_target: number;
  streak: number; best_streak: number; treasury: string; total_supply: string;
  params: StreakParams; last: DayResult | null; history: DayResult[];
}
export interface MemberView { account_id: string; checked_in_today: boolean; last_checkin_day: number | null; total_checkins: number; balance: string; }

// ---- Daily quests (NEAR AI agent) ----
export interface LessonWithText { lesson: LessonPublic; bonus: boolean; text: string | null; }
export interface AiSignature { text: string; signature: string; signing_address: string; signing_algo: string; signature_kind: string; }
export interface GeneratedBy {
  provider: string; model: string; chat_id: string; request_sha256: string; response_sha256: string;
  signature: AiSignature | null; generated_at: string;
}
/** Same shape as src/game/content.ts LessonContent minus `answer`, plus provenance. */
export interface DailyQuest {
  lesson_id: string; title: string; topic: string; concept: string; question: string; options: string[];
  success: string; near_reveal: string; explanation: string;
  reward_gold: string; reward_item: string; reward_item_amount: string;
  generated_by: GeneratedBy;
}

/** A Season 2 chapter: same shape as a daily quest, written by us (no model provenance). */
export type Chapter = Omit<DailyQuest, "generated_by">;

/** The day's sponsored quest (Nov 14): a daily-shaped quest whose slot was bought over x402; `sponsor` says by whom, `slot` what it cost and the payment's transaction. */
export interface SponsoredQuest extends Omit<DailyQuest, "generated_by"> {
  sponsor: { name: string; url: string | null; house: boolean };
  slot: { paid_by: string | null; amount: string; asset: string; tx_hash: string | null; bought_at: string; price: string; route: string };
  written_by: string;
  checked_by: string;
}

/** POST /ask — what the model said and how to verify that it said it. */
export interface AskResult {
  answer: string;
  generated_by: { provider: string; model: string; chat_id: string; signature_kind: string | null };
}

// ---------- Module B: bounties + DAO ----------
export type Tier = "Small" | "Medium" | "Large";
export type Requirement = { PassportLevel: { min: number } } | { QuestCompleted: { lesson_id: string } } | "Graduated";
export type ClaimStatus = "Pending" | "Paid" | { Proposed: { proposal_id: number } } | "Eligible";
export interface Bounty {
  id: number; title: string; description: string; tier: Tier;
  /** yoctoNEAR as a string. */
  reward: string;
  requirement: Requirement; max_claims: number; claims: number; open: boolean; created_by: string; created_ns: number;
}
export interface Claim { bounty_id: number; account_id: string; status: ClaimStatus; at_ns: number; }
export interface BountiesConfig {
  owner_id: string; dao_id: string; core_id: string; small_cap: string; proposal_bond: string; allowance: string; paid_total: string; bounties_total: number;
}
/** The slice of Sputnik v2's proposal we show. `kind` is left loose on purpose. */
export interface DaoProposal {
  id: number; proposer: string; description: string; kind: Record<string, unknown> | string;
  status: "InProgress" | "Approved" | "Rejected" | "Removed" | "Expired" | "Moved" | "Failed";
  vote_counts: Record<string, [number, number, number]>; votes: Record<string, "Approve" | "Reject" | "Remove">; submission_time: string;
}
export interface DaoPolicy {
  roles: { name: string; kind: "Everyone" | { Group: string[] }; permissions: string[] }[];
  default_vote_policy: { weight_kind: string; quorum: string; threshold: [number, number] | string };
  proposal_bond: string; proposal_period: string;
}

/** POST /propose (founders): a new bounty for the board, filed by the relayer as a DAO FunctionCall proposal. */
export interface ProposeInput { title: string; description: string; tier: "Small" | "Medium" | "Large"; requirement: "Graduated" | { PassportLevel: { min: number } } | { QuestCompleted: { lesson_id: string } }; reward_near: string; max_claims: number }
export interface ProposeResult { proposalId: number; url: string }

/** The price call (Nov 11): one learner's call in one ten-minute round on one item. */
export type CallSide = "More" | "Same" | "Less";
export interface PriceCall { account_id: string; side: CallSide; stake: string; open_price: string }
export interface CallRound { token_id: string; round: number; seconds_left: number; open: boolean; settled: boolean; close_price: string | null; more_stake: string; same_stake: string; less_stake: string; calls: PriceCall[] }
export interface MyCall { token_id: string; round: number; side: CallSide; stake: string; open_price: string; settled: boolean; close_price: string | null; paid: string | null }
export interface CallRef { token_id: string; round: number }
