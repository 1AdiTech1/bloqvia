// src/game/types.ts — copy exactly
export interface LessonPublic {
  lesson_id: string; title: string; answer_hash: string;
  reward_gold: string; reward_item: string; reward_item_amount: string;
}
export interface ItemPrice { token_id: string; bloq_stock: string; buy_price: string; sell_price: string; }
export interface BloqView {
  account_id: string; gold: string; shop_open: boolean; treasury_floor: string;
  prices: ItemPrice[]; graduation_fee: string;
}
export interface LearnerView {
  account_id: string; registered: boolean; completed: string[]; level: number;
  graduated: boolean; gold: string; items: [string, string][];
}
export interface PassportView { token_id: string; owner_id: string; level: number; graduated: boolean; stamps: string[]; }
export interface RelayResult { txHash: string; senderId: string; methods: string[]; }

export interface Game {
  accountId: string | null;
  learner: LearnerView | null;
  passport: PassportView | null;
  bloq: BloqView | null;
  lessons: LessonPublic[];
  lastTx: (RelayResult & { url: string }) | null;
  busy: boolean;
  error: string | null;
  start: () => Promise<string>;                                   // sign-in; returns accountId
  refresh: () => Promise<void>;
  completeLesson: (lessonId: string, answer: string) => Promise<RelayResult>;
  sellToBloq: (tokenId: string, amount?: number) => Promise<RelayResult>;
  buyFromBloq: (tokenId: string, amount?: number) => Promise<RelayResult>;
  graduate: () => Promise<RelayResult>;
  signOut: () => void;
  exportSecretKey: () => string | null;
  explorer: { tx: (hash: string) => string; account: (id: string) => string; passport: (id: string) => string; };
}
