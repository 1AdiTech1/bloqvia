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
}

export interface RegisterResult {
  accountId: string;
  created: boolean;
  registered: boolean;
  txHashes: string[];
}

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
