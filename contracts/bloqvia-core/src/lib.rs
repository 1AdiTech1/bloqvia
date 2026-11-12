//! bloqvia-core — the game economy on NEAR.
//!
//! One NEP-245 multi-token contract holds everything a player can own:
//!
//! * `gold`           — the in-game currency (fungible)
//! * `key-fragment`   — minted by quest "The Vault"
//! * `fuel-cell`      — minted by quest "The Fuel System"
//! * `contract-seal`  — minted by quest "Smart Agreements"
//!
//! Rules the judges can verify by reading this file:
//!
//! 1. Rewards are decided HERE. `complete_lesson` checks the answer against a
//!    stored hash and mints a fixed reward, once per account per lesson. The
//!    relayer only pays gas; it cannot mint anything.
//! 2. Bloq the merchant is an account (`bloq_id`) whose stock and gold live in
//!    this contract. His prices come from `pricing.rs` and move with his stock.
//!    No admin method changes a price.
//! 3. Graduation costs the three items plus Bloq's CURRENT price for them, so
//!    the cost of graduating follows the market.
//! 4. The owner can only register lessons and learners. It cannot mint gold,
//!    move balances or edit prices.

use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap, LookupSet};
use near_sdk::{
    env, ext_contract, near, require, AccountId, AccountIdRef, BorshStorageKey, Gas,
    PanicOnDefault, Promise, PromiseError, PromiseOrValue,
};
use near_sdk_contract_tools::mt::metadata::{BaseMetadata, ContractMetadata, TokenMetadata};
use near_sdk_contract_tools::mt::{
    MetadataController, Nep245, Nep245Burn, Nep245Controller, Nep245Metadata, Nep245Mint, Nep245Transfer,
};

pub mod calls;
pub mod pricing;
pub mod shipping;
pub use pricing::PricingParams;

/// Token ids. Kept as constants so the frontend and the contract agree.
pub const GOLD: &str = "gold";
pub const ITEMS: [&str; 3] = ["key-fragment", "fuel-cell", "contract-seal"];

const GAS_PASSPORT_CALL: Gas = Gas::from_tgas(10);
const GAS_PASSPORT_CALLBACK: Gas = Gas::from_tgas(5);

/// The graduation fee is the price of a full set at Bloq's shop, but never under this (half of what
/// the three founding quests pay), so the milestone keeps its weight whatever the market does.
pub const GRADUATION_FEE_FLOOR: u128 = 150;

/// Cross-contract interface of `bloqvia-passport`.
#[ext_contract(ext_passport)]
pub trait Passport {
    fn mint_passport(&mut self, account_id: AccountId);
    fn set_level(&mut self, account_id: AccountId, level: u8);
    fn graduate(&mut self, account_id: AccountId);
    fn add_stamp(&mut self, account_id: AccountId, stamp: String);
}

/// Cross-contract interface of `bloqvia-streak` (Module A, optional).
#[ext_contract(ext_streak)]
pub trait StreakContract {
    fn check_in_for(&mut self, account_id: AccountId);
}

/// `check_in` forwards to the streak contract, which may settle up to 30
/// missed days (a burn each) in one call, so it gets a generous budget.
const GAS_STREAK_CALL: Gas = Gas::from_tgas(30);

/// The streak contract's id lives under its own storage key, outside the
/// contract struct, so adding Module A did not change the deployed state
/// layout (no migration on redeploy).
const STREAK_ID_KEY: &[u8] = b"streak_id";

/// Cross-contract interface of `bloqvia-bounties` (Module B, optional).
#[ext_contract(ext_bounties)]
pub trait BountiesContract {
    fn claim_for(&mut self, account_id: AccountId, bounty_id: u64);
}

/// `claim_bounty` forwards to the board, which reads this contract back,
/// then pays, or files a DAO proposal, in its callbacks: a long chain, so it
/// gets a large budget. The relayer allows up to 150 TGas for this call.
const GAS_BOUNTY_CALL: Gas = Gas::from_tgas(120);

/// Same pattern as `STREAK_ID_KEY`: outside the struct, no migration.
const BOUNTIES_ID_KEY: &[u8] = b"bounties_id";

/// Lessons whose id starts with this are **bonus quests** (the daily quests
/// written by the NEAR AI agent). They pay gold and an item like any lesson,
/// but do not count toward the Passport level, which is reserved for the
/// three founding quests, so the shop and graduation rules are unchanged.
pub const BONUS_PREFIX: &str = "daily-";

/// Season 2 chapters are bonus quests too: same rewards rule, no Passport level.
pub const CHAPTER_PREFIX: &str = "chapter-";

/// The three Season 2 chapters. Completing the last of the three stamps the
/// learner's Passport with `season-2`, in the same transaction (so it works for
/// every learner key, old ones included: no new method is needed).
pub const SEASON2_CHAPTERS: [&str; 3] = ["chapter-ownership", "chapter-transactions", "chapter-defi"];
pub const SEASON2_STAMP: &str = "season-2";

/// Public lesson text (concept, question, options, explanation, and the
/// AI signature for generated quests) lives under its own storage key per
/// lesson, outside the contract struct, so adding it needed no migration.
const LESSON_TEXT_PREFIX: &[u8] = b"lt:";
/// Hard cap on a lesson text blob (JSON), to keep storage costs predictable.
pub const MAX_LESSON_TEXT_BYTES: usize = 4096;

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum StorageKey {
    Lessons,
    Completions,
    CompletedCount,
    Learners,
    Graduates,
}

/// A lesson as stored on-chain. `answer_hash` is hex(sha256("{lesson_id}|{normalised answer}")).
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Lesson {
    pub lesson_id: String,
    pub title: String,
    pub answer_hash: String,
    pub reward_gold: U128,
    pub reward_item: String,
    pub reward_item_amount: U128,
}

/// A lesson plus its public text blob, if the owner attached one.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct LessonWithText {
    pub lesson: Lesson,
    pub bonus: bool,
    pub text: Option<String>,
}

/// Bloq's current price for one item.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ItemPrice {
    pub token_id: String,
    pub bloq_stock: U128,
    /// What Bloq pays you for one unit.
    pub buy_price: U128,
    /// What Bloq charges you for one unit.
    pub sell_price: U128,
}

/// Snapshot of the merchant.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct BloqView {
    pub account_id: AccountId,
    pub gold: U128,
    pub shop_open: bool,
    pub treasury_floor: U128,
    pub prices: Vec<ItemPrice>,
    pub graduation_fee: U128,
}

/// Snapshot of a learner.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct LearnerView {
    pub account_id: AccountId,
    pub registered: bool,
    pub completed: Vec<String>,
    pub level: u8,
    pub graduated: bool,
    pub gold: U128,
    pub items: Vec<(String, U128)>,
}

#[derive(Nep245, Nep245Metadata, PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    /// Can register lessons and learners. Cannot touch balances or prices.
    owner_id: AccountId,
    /// The `bloqvia-passport` contract.
    passport_id: AccountId,
    /// Bloq the merchant. His balances live in this contract like anyone else's.
    bloq_id: AccountId,
    pricing: PricingParams,
    lessons: IterableMap<String, Lesson>,
    /// "{account_id}|{lesson_id}" of every completed lesson.
    completions: LookupSet<String>,
    completed_count: LookupMap<AccountId, u8>,
    learners: LookupSet<AccountId>,
    graduates: LookupSet<AccountId>,
}

#[near]
impl Contract {
    /// Deploys the economy. Creates the four tokens, seeds Bloq with gold and
    /// stock, and fixes the price rule forever.
    #[init]
    pub fn new(
        owner_id: AccountId,
        passport_id: AccountId,
        bloq_id: AccountId,
        pricing: PricingParams,
        bloq_gold_seed: U128,
        bloq_item_seed: U128,
    ) -> Self {
        let mut contract = Self {
            owner_id,
            passport_id,
            bloq_id: bloq_id.clone(),
            pricing,
            lessons: IterableMap::new(StorageKey::Lessons),
            completions: LookupSet::new(StorageKey::Completions),
            completed_count: LookupMap::new(StorageKey::CompletedCount),
            learners: LookupSet::new(StorageKey::Learners),
            graduates: LookupSet::new(StorageKey::Graduates),
        };

        contract.set_contract_metadata(&ContractMetadata::new("Bloqvia Economy"));

        contract.define_token(GOLD, "Bloqvia Gold", "BGOLD", "In-game currency of Bloqvia.");
        contract.define_token(ITEMS[0], "Key Fragment", "KEY", "Minted by The Vault.");
        contract.define_token(ITEMS[1], "Fuel Cell", "FUEL", "Minted by The Fuel System.");
        contract.define_token(ITEMS[2], "Contract Seal", "SEAL", "Minted by Smart Agreements.");

        let bloq: &AccountIdRef = &bloq_id;
        contract.mint_to(GOLD, bloq_gold_seed.0, bloq, "bloq treasury seed");
        for item in ITEMS {
            contract.mint_to(item, bloq_item_seed.0, bloq, "bloq stock seed");
        }
        contract
    }

    // ------------------------------------------------------------------
    // Owner: content and onboarding (no economic power)
    // ------------------------------------------------------------------

    /// Registers a lesson. Only the owner. A lesson id can be registered once,
    /// so rewards for an existing lesson can never be changed.
    pub fn add_lesson(&mut self, lesson: Lesson) {
        self.require_owner();
        require!(
            !self.lessons.contains_key(&lesson.lesson_id),
            "Lesson already registered; rewards are immutable"
        );
        require!(
            self.token_exists(&lesson.reward_item),
            "reward_item must be one of the item tokens"
        );
        require!(lesson.reward_item != GOLD, "reward_item cannot be gold");
        require!(lesson.answer_hash.len() == 64, "answer_hash must be hex sha256");
        self.lessons.insert(lesson.lesson_id.clone(), lesson);
    }

    /// Marks an account as a learner and asks the Passport contract to mint
    /// its Passport at level 0. Only the owner (the relayer) calls this, right
    /// after it created the learner's sub-account.
    pub fn register_learner(&mut self, account_id: AccountId) -> Promise {
        self.require_owner();
        require!(self.learners.insert(account_id.clone()), "Already registered");
        ext_passport::ext(self.passport_id.clone())
            .with_static_gas(GAS_PASSPORT_CALL)
            .mint_passport(account_id)
    }

    /// Owner: point `check_in` at the streak contract (Module A). This is
    /// configuration, not a power over balances: core never holds or moves
    /// streak tokens, and the streak contract accepts calls only from core.
    pub fn set_streak_contract(&mut self, account_id: Option<AccountId>) {
        self.require_owner();
        match account_id {
            Some(id) => {
                env::storage_write(STREAK_ID_KEY, id.as_bytes());
            }
            None => {
                env::storage_remove(STREAK_ID_KEY);
            }
        }
    }

    /// Learner: one check-in per day on the streak contract. Forwarded with
    /// the learner's own account id, so the streak contract knows who it was
    /// without trusting the relayer.
    pub fn check_in(&mut self) -> Promise {
        let learner = env::predecessor_account_id();
        require!(self.learners.contains(&learner), "Not a registered learner");
        let streak_id = self
            .get_streak_contract()
            .unwrap_or_else(|| env::panic_str("Streak is not enabled"));
        ext_streak::ext(streak_id)
            .with_static_gas(GAS_STREAK_CALL)
            .check_in_for(learner)
    }

    /// Owner: point `claim_bounty` at the bounty board (Module B).
    /// Configuration only: core holds no NEAR for bounties and the board
    /// accepts `claim_for` only from core.
    pub fn set_bounties_contract(&mut self, account_id: Option<AccountId>) {
        self.require_owner();
        match account_id {
            Some(id) => {
                env::storage_write(BOUNTIES_ID_KEY, id.as_bytes());
            }
            None => {
                env::storage_remove(BOUNTIES_ID_KEY);
            }
        }
    }

    /// Learner: claim a bounty on the board. Forwarded with the learner's own
    /// account id; the board then reads `get_learner` here to check the
    /// requirement, so nothing the relayer sends can change who qualified.
    pub fn claim_bounty(&mut self, bounty_id: u64) -> Promise {
        let learner = env::predecessor_account_id();
        require!(self.learners.contains(&learner), "Not a registered learner");
        let bounties_id = self
            .get_bounties_contract()
            .unwrap_or_else(|| env::panic_str("Bounties are not enabled"));
        ext_bounties::ext(bounties_id)
            .with_static_gas(GAS_BOUNTY_CALL)
            .claim_for(learner, bounty_id)
    }

    // ------------------------------------------------------------------
    // Learner: the game loop
    // ------------------------------------------------------------------

    /// Completes a lesson. The caller is the learner. The contract hashes the
    /// answer, compares it to the stored hash, refuses a second completion,
    /// mints the fixed reward and levels the Passport.
    pub fn complete_lesson(&mut self, lesson_id: String, answer: String) -> PromiseOrValue<()> {
        let learner = env::predecessor_account_id();
        require!(self.learners.contains(&learner), "Not a registered learner");

        let lesson = self
            .lessons
            .get(&lesson_id)
            .unwrap_or_else(|| env::panic_str("Unknown lesson"))
            .clone();

        require!(
            answer_hash(&lesson_id, &answer) == lesson.answer_hash,
            "Wrong answer"
        );

        // Season 2 opens with a sealed Passport: chapters need graduation
        // (which itself needs the three founding quests, one of each item and the fee).
        require!(
            !lesson_id.starts_with(CHAPTER_PREFIX) || self.graduates.contains(&learner),
            "Graduate first to open Season 2"
        );

        let key = completion_key(&learner, &lesson_id);
        require!(self.completions.insert(key), "Lesson already completed");

        let bonus = is_bonus(&lesson_id);
        let level = if bonus {
            self.completed_count.get(&learner).copied().unwrap_or(0)
        } else {
            let next = self.completed_count.get(&learner).copied().unwrap_or(0) + 1;
            self.completed_count.insert(learner.clone(), next);
            next
        };

        let learner_ref: &AccountIdRef = &learner;
        self.mint_to(GOLD, lesson.reward_gold.0, learner_ref, "lesson reward");
        self.mint_to(
            &lesson.reward_item,
            lesson.reward_item_amount.0,
            learner_ref,
            "lesson reward",
        );

        log_event(
            "lesson_completed",
            &near_sdk::serde_json::json!({
                "account_id": learner,
                "lesson_id": lesson_id,
                "level": level,
                "bonus": bonus,
                "reward_gold": lesson.reward_gold,
                "reward_item": lesson.reward_item,
                "reward_item_amount": lesson.reward_item_amount,
            }),
        );

        if bonus {
            // The last of the three Season 2 chapters: stamp the Passport in this transaction.
            if SEASON2_CHAPTERS.contains(&lesson_id.as_str()) && self.season2_done(&learner) {
                PromiseOrValue::Promise(self.send_stamp(learner))
            } else {
                PromiseOrValue::Value(())
            }
        } else {
            PromiseOrValue::Promise(self.sync_passport(learner, level))
        }
    }

    /// Owner: attach the public text of a lesson (JSON: concept, question,
    /// options, explanation, and for generated quests the model id and the
    /// NEAR AI signature). Readable by anyone; the answer is never in it.
    pub fn set_lesson_text(&mut self, lesson_id: String, text: String) {
        self.require_owner();
        require!(self.lessons.contains_key(&lesson_id), "Unknown lesson");
        require!(text.len() <= MAX_LESSON_TEXT_BYTES, "Lesson text too long");
        env::storage_write(&lesson_text_key(&lesson_id), text.as_bytes());
    }

    /// Sells `amount` of an item to Bloq at his current buy price, unit by unit.
    pub fn sell_to_bloq(&mut self, token_id: String, amount: U128) {
        let learner = env::predecessor_account_id();
        require!(self.learners.contains(&learner), "Not a registered learner");
        require!(is_item(&token_id), "Only items can be sold");
        require!(amount.0 > 0, "amount must be > 0");
        require!(self.shop_open(), "Shop closed: Bloq's treasury is below the floor");
        self.settle_shipping();

        let stock = self.balance_of(&token_id, &self.bloq_id);
        let total = pricing::buy_total(&self.pricing, stock, amount.0);
        require!(
            self.balance_of(GOLD, &self.bloq_id) >= total,
            "Bloq cannot afford this trade"
        );

        self.move_tokens(&learner, &self.bloq_id.clone(), &token_id, amount.0, "sell to bloq");
        self.move_tokens(&self.bloq_id.clone(), &learner, GOLD, total, "bloq pays");

        log_event(
            "trade",
            &near_sdk::serde_json::json!({
                "account_id": learner,
                "side": "sell",
                "token_id": token_id,
                "amount": amount,
                "gold": U128(total),
                "bloq_stock_after": U128(stock + amount.0),
            }),
        );
    }

    /// Buys `amount` of an item from Bloq at his current sell price, unit by unit.
    pub fn buy_from_bloq(&mut self, token_id: String, amount: U128) {
        let learner = env::predecessor_account_id();
        require!(self.learners.contains(&learner), "Not a registered learner");
        require!(is_item(&token_id), "Only items can be bought");
        require!(amount.0 > 0, "amount must be > 0");
        self.settle_shipping();

        let stock = self.balance_of(&token_id, &self.bloq_id);
        require!(stock >= amount.0, "Bloq does not have enough stock");
        let total = pricing::sell_total(&self.pricing, stock, amount.0);
        require!(self.balance_of(GOLD, &learner) >= total, "Not enough gold");

        self.move_tokens(&learner, &self.bloq_id.clone(), GOLD, total, "buy from bloq");
        self.move_tokens(&self.bloq_id.clone(), &learner, &token_id, amount.0, "bloq delivers");

        log_event(
            "trade",
            &near_sdk::serde_json::json!({
                "account_id": learner,
                "side": "buy",
                "token_id": token_id,
                "amount": amount,
                "gold": U128(total),
                "bloq_stock_after": U128(stock - amount.0),
            }),
        );
    }

    /// Graduates the learner: burns one of each item (stamped into the Passport) and pays the graduation fee
    /// (Bloq's current sell price for the three items) to Bloq, then asks the
    /// Passport to mark the learner as Graduate.
    pub fn graduate(&mut self) -> Promise {
        let learner = env::predecessor_account_id();
        require!(self.learners.contains(&learner), "Not a registered learner");
        require!(!self.graduates.contains(&learner), "Already graduated");
        require!(
            self.completed_count.get(&learner).copied().unwrap_or(0) as usize >= ITEMS.len(),
            "Finish all three quests first"
        );
        for item in ITEMS {
            require!(
                self.balance_of(item, &learner) >= 1,
                "You need one of each item to graduate"
            );
        }
        self.settle_shipping();
        let fee = self.graduation_fee();
        require!(self.balance_of(GOLD, &learner) >= fee, "Not enough gold for the fee");

        self.graduates.insert(learner.clone());
        // the set is stamped into the Passport: burned, not handed to Bloq (Nov 12), so graduating
        // does not push his prices down for the next player
        for item in ITEMS {
            self.burn_from(&learner, item, 1, "graduation: stamped into the Passport");
        }
        self.move_tokens(&learner, &self.bloq_id.clone(), GOLD, fee, "graduation fee");

        log_event(
            "graduated",
            &near_sdk::serde_json::json!({ "account_id": learner, "fee": U128(fee) }),
        );

        ext_passport::ext(self.passport_id.clone())
            .with_static_gas(GAS_PASSPORT_CALL)
            .graduate(learner.clone())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_PASSPORT_CALLBACK)
                    .on_passport_synced(learner, u8::MAX),
            )
    }

    /// Re-sends the Season 2 stamp for `account_id` if, and only if, that account has
    /// completed all three Season 2 chapters here. Anyone can call it; the Passport
    /// adds a stamp once, so it is idempotent. It exists so a failed cross-contract
    /// call can never leave a finished learner without their stamp.
    pub fn resync_stamp(&mut self, account_id: AccountId) -> Promise {
        require!(self.learners.contains(&account_id), "Not a registered learner");
        require!(self.season2_done(&account_id), "Finish the three Season 2 chapters first");
        self.send_stamp(account_id)
    }

    /// Re-sends the learner's level to the Passport from this contract's own
    /// record. Anyone can call it; it is idempotent and exists so a failed
    /// cross-contract call can never leave a Passport behind.
    pub fn resync_passport(&mut self, account_id: AccountId) -> Promise {
        require!(self.learners.contains(&account_id), "Not a registered learner");
        let level = self.completed_count.get(&account_id).copied().unwrap_or(0);
        self.sync_passport(account_id, level)
    }

    #[private]
    pub fn on_passport_synced(
        &mut self,
        account_id: AccountId,
        level: u8,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> bool {
        match result {
            Ok(()) => true,
            Err(_) => {
                env::log_str(&format!(
                    "passport sync failed for {account_id} (level {level}); call resync_passport"
                ));
                false
            }
        }
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    pub fn get_pricing(&self) -> PricingParams {
        self.pricing.clone()
    }

    pub fn get_lessons(&self) -> Vec<Lesson> {
        self.lessons.values().cloned().collect()
    }

    pub fn get_prices(&self) -> Vec<ItemPrice> {
        ITEMS
            .iter()
            .map(|item| {
                let stock = self.stock_now(item);
                ItemPrice {
                    token_id: item.to_string(),
                    bloq_stock: U128(stock),
                    buy_price: U128(pricing::buy_price(&self.pricing, stock)),
                    sell_price: U128(pricing::sell_price(&self.pricing, stock)),
                }
            })
            .collect()
    }

    pub fn get_bloq(&self) -> BloqView {
        BloqView {
            account_id: self.bloq_id.clone(),
            gold: U128(self.balance_of(GOLD, &self.bloq_id)),
            shop_open: self.shop_open(),
            treasury_floor: self.pricing.treasury_floor,
            prices: self.get_prices(),
            graduation_fee: U128(self.graduation_fee()),
        }
    }

    pub fn get_learner(&self, account_id: AccountId) -> LearnerView {
        let completed = self
            .lessons
            .keys()
            .filter(|id| self.completions.contains(&completion_key(&account_id, id)))
            .cloned()
            .collect();
        LearnerView {
            registered: self.learners.contains(&account_id),
            completed,
            level: self.completed_count.get(&account_id).copied().unwrap_or(0),
            graduated: self.graduates.contains(&account_id),
            gold: U128(self.balance_of(GOLD, &account_id)),
            items: ITEMS
                .iter()
                .map(|i| (i.to_string(), U128(self.balance_of(i, &account_id))))
                .collect(),
            account_id,
        }
    }

    pub fn is_completed(&self, account_id: AccountId, lesson_id: String) -> bool {
        self.completions.contains(&completion_key(&account_id, &lesson_id))
    }

    pub fn get_lesson_text(&self, lesson_id: String) -> Option<String> {
        env::storage_read(&lesson_text_key(&lesson_id)).and_then(|b| String::from_utf8(b).ok())
    }

    /// Every lesson with its public text (None for the founding three, whose
    /// text ships with the app). Bonus quests are the ones starting `daily-` or `chapter-`.
    pub fn get_lessons_with_text(&self) -> Vec<LessonWithText> {
        self.lessons
            .values()
            .map(|l| LessonWithText {
                bonus: is_bonus(&l.lesson_id),
                text: self.get_lesson_text(l.lesson_id.clone()),
                lesson: l.clone(),
            })
            .collect()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn get_passport_contract(&self) -> AccountId {
        self.passport_id.clone()
    }

    /// The streak contract, if Module A is enabled.
    pub fn get_streak_contract(&self) -> Option<AccountId> {
        env::storage_read(STREAK_ID_KEY)
            .and_then(|b| String::from_utf8(b).ok())
            .and_then(|s| s.parse().ok())
    }

    pub fn get_bounties_contract(&self) -> Option<AccountId> {
        env::storage_read(BOUNTIES_ID_KEY)
            .and_then(|b| String::from_utf8(b).ok())
            .and_then(|s| s.parse().ok())
    }
}

// ----------------------------------------------------------------------
// Internals (not exported)
// ----------------------------------------------------------------------

impl Contract {
    fn require_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the owner can call this"
        );
    }

    fn shop_open(&self) -> bool {
        self.balance_of(GOLD, &self.bloq_id) >= self.pricing.treasury_floor.0
    }

    /// Bloq's current sell price for one of each item, never under GRADUATION_FEE_FLOOR.
    fn graduation_fee(&self) -> u128 {
        ITEMS
            .iter()
            .fold(0u128, |acc, item| acc.saturating_add(pricing::sell_price(&self.pricing, self.stock_now(item))))
            .max(GRADUATION_FEE_FLOOR)
    }

    /// Bloq's stock of an item as it stands now: what is on record less what the hours since the
    /// last settlement ship (`shipping.rs`). Views read this; writes call `settle_shipping` first,
    /// after which the balance on record is this number.
    pub(crate) fn stock_now(&self, item: &str) -> u128 {
        let stock = self.balance_of(item, &self.bloq_id);
        let (periods, _) = shipping::periods_due(env::block_timestamp());
        shipping::stock_after(stock, self.pricing.stock_halving.0, periods)
    }

    /// Burns what the hours since the last settlement ship, item by item, and moves the clock.
    /// The first call after deployment only starts the clock.
    pub(crate) fn settle_shipping(&mut self) {
        let now = env::block_timestamp();
        let (periods, advance_to) = shipping::periods_due(now);
        if periods > 0 {
            let bloq = self.bloq_id.clone();
            let midpoint = self.pricing.stock_halving.0;
            let mut shipped = Vec::with_capacity(ITEMS.len());
            for item in ITEMS {
                let stock = self.balance_of(item, &bloq);
                let gone = stock - shipping::stock_after(stock, midpoint, periods);
                if gone > 0 {
                    self.burn_from(&bloq, item, gone, "shipped to Network City");
                }
                shipped.push((item, U128(gone)));
            }
            log_event(
                "shipped",
                &near_sdk::serde_json::json!({ "hours": periods, "items": shipped }),
            );
        }
        shipping::write_last_settled_ns(advance_to);
    }

    fn define_token(&mut self, token_id: &str, name: &str, symbol: &str, description: &str) {
        Nep245Controller::create_token(self, token_id.to_string())
            .unwrap_or_else(|e| env::panic_str(&format!("create_token: {e}")));
        let mut base = BaseMetadata::new(name, token_id);
        base.symbol = Some(symbol.to_string());
        base.decimals = Some(0.into());
        self.create_base_metadata(base)
            .unwrap_or_else(|e| env::panic_str(&format!("base metadata: {e}")));
        let meta = TokenMetadata::new().title(name).description(description);
        self.set_token_metadata(token_id, token_id.to_string(), meta)
            .unwrap_or_else(|e| env::panic_str(&format!("token metadata: {e}")));
    }

    fn mint_to(&mut self, token_id: &str, amount: u128, receiver: &AccountIdRef, memo: &str) {
        if amount == 0 {
            return;
        }
        let mint = Nep245Mint::single(token_id, amount, receiver).memo(memo);
        Nep245Controller::mint(self, &mint)
            .unwrap_or_else(|e| env::panic_str(&format!("mint: {e}")));
    }

    pub(crate) fn move_tokens(
        &mut self,
        from: &AccountId,
        to: &AccountId,
        token_id: &str,
        amount: u128,
        memo: &str,
    ) {
        let from_ref: &AccountIdRef = from;
        let to_ref: &AccountIdRef = to;
        let transfer = Nep245Transfer::new(from_ref, to_ref, 1, [token_id], [amount], Some(memo))
            .unwrap_or_else(|_| env::panic_str("transfer: length mismatch"));
        Nep245Controller::transfer(self, &transfer)
            .unwrap_or_else(|e| env::panic_str(&format!("transfer: {e}")));
    }

    pub(crate) fn burn_from(&mut self, owner: &AccountId, token_id: &str, amount: u128, memo: &str) {
        if amount == 0 {
            return;
        }
        let owner_ref: &AccountIdRef = owner;
        let burn = Nep245Burn::single(token_id, amount, owner_ref).memo(memo);
        Nep245Controller::burn(self, &burn).unwrap_or_else(|e| env::panic_str(&format!("burn: {e}")));
    }

    fn season2_done(&self, account_id: &AccountId) -> bool {
        SEASON2_CHAPTERS.iter().all(|id| self.completions.contains(&completion_key(account_id, id)))
    }

    fn send_stamp(&self, account_id: AccountId) -> Promise {
        log_event(
            "stamp_requested",
            &near_sdk::serde_json::json!({ "account_id": account_id, "stamp": SEASON2_STAMP }),
        );
        ext_passport::ext(self.passport_id.clone())
            .with_static_gas(GAS_PASSPORT_CALL)
            .add_stamp(account_id.clone(), SEASON2_STAMP.to_string())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_PASSPORT_CALLBACK)
                    .on_passport_synced(account_id, u8::MAX),
            )
    }

    fn sync_passport(&self, account_id: AccountId, level: u8) -> Promise {
        ext_passport::ext(self.passport_id.clone())
            .with_static_gas(GAS_PASSPORT_CALL)
            .set_level(account_id.clone(), level)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_PASSPORT_CALLBACK)
                    .on_passport_synced(account_id, level),
            )
    }
}

fn is_bonus(lesson_id: &str) -> bool {
    lesson_id.starts_with(BONUS_PREFIX) || lesson_id.starts_with(CHAPTER_PREFIX)
}

fn lesson_text_key(lesson_id: &str) -> Vec<u8> {
    [LESSON_TEXT_PREFIX, lesson_id.as_bytes()].concat()
}

fn is_item(token_id: &str) -> bool {
    ITEMS.contains(&token_id)
}

fn completion_key(account_id: &AccountId, lesson_id: &str) -> String {
    format!("{account_id}|{lesson_id}")
}

/// hex(sha256("{lesson_id}|{answer trimmed, lower-cased}")). The same function
/// lives in `scripts/hash-lessons.ts`; the two must agree.
pub fn answer_hash(lesson_id: &str, answer: &str) -> String {
    let normalised = answer.trim().to_lowercase();
    let digest = env::sha256(format!("{lesson_id}|{normalised}").as_bytes());
    hex(&digest)
}

fn hex(bytes: &[u8]) -> String {
    const CHARS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(CHARS[(b >> 4) as usize] as char);
        out.push(CHARS[(b & 0x0f) as usize] as char);
    }
    out
}

/// NEP-297 structured event under the `bloqvia` standard.
pub(crate) fn log_event(event: &str, data: &near_sdk::serde_json::Value) {
    let payload = near_sdk::serde_json::json!({
        "standard": "bloqvia",
        "version": "1.0.0",
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{payload}"));
}

// ----------------------------------------------------------------------
// Unit tests
// ----------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn owner() -> AccountId {
        accounts(0)
    }
    fn passport() -> AccountId {
        accounts(1)
    }
    fn bloq() -> AccountId {
        accounts(2)
    }
    fn alice() -> AccountId {
        accounts(3)
    }

    fn as_caller(caller: AccountId) {
        as_caller_at(caller, 0);
    }

    fn as_caller_at(caller: AccountId, timestamp_ns: u64) {
        let mut ctx = VMContextBuilder::new();
        ctx.current_account_id("core.bloqvia.testnet".parse().unwrap())
            .signer_account_id(caller.clone())
            .predecessor_account_id(caller)
            .block_timestamp(timestamp_ns);
        testing_env!(ctx.build());
    }

    fn params() -> PricingParams {
        PricingParams {
            base_price: U128(100),
            stock_halving: U128(10),
            spread_bps: 250,
            treasury_floor: U128(500),
        }
    }

    fn deployed() -> Contract {
        as_caller(owner());
        let mut c = Contract::new(owner(), passport(), bloq(), params(), U128(10_000), U128(5));
        for (i, item) in ITEMS.iter().enumerate() {
            let id = format!("lesson-{}", i + 1);
            c.add_lesson(Lesson {
                lesson_id: id.clone(),
                title: format!("Lesson {}", i + 1),
                answer_hash: answer_hash(&id, "Public Key"),
                // 3 items per lesson: one for graduation, two to trade with Bloq.
                // 100 gold per lesson: covers the graduation fee at seed stock (3 x 68 = 204).
                reward_gold: U128(100),
                reward_item: item.to_string(),
                reward_item_amount: U128(3),
            });
        }
        let _ = c.register_learner(alice());
        c
    }

    #[test]
    fn init_seeds_bloq() {
        let c = deployed();
        assert_eq!(c.balance_of(GOLD, &bloq()), 10_000);
        for item in ITEMS {
            assert_eq!(c.balance_of(item, &bloq()), 5);
        }
        assert!(c.get_bloq().shop_open);
        assert_eq!(c.get_lessons().len(), 3);
    }

    #[test]
    fn complete_lesson_mints_once() {
        let mut c = deployed();
        as_caller(alice());
        let _ = c.complete_lesson("lesson-1".into(), "  public key ".into());
        let view = c.get_learner(alice());
        assert_eq!(view.level, 1);
        assert_eq!(view.gold.0, 100);
        assert_eq!(c.balance_of(ITEMS[0], &alice()), 3);
        assert!(c.is_completed(alice(), "lesson-1".into()));
    }

    #[test]
    #[should_panic(expected = "Lesson already completed")]
    fn complete_lesson_twice_fails() {
        let mut c = deployed();
        as_caller(alice());
        let _ = c.complete_lesson("lesson-1".into(), "public key".into());
        let _ = c.complete_lesson("lesson-1".into(), "public key".into());
    }

    #[test]
    #[should_panic(expected = "Wrong answer")]
    fn wrong_answer_fails() {
        let mut c = deployed();
        as_caller(alice());
        let _ = c.complete_lesson("lesson-1".into(), "private key".into());
    }

    #[test]
    #[should_panic(expected = "Not a registered learner")]
    fn unregistered_cannot_play() {
        let mut c = deployed();
        as_caller(accounts(4));
        let _ = c.complete_lesson("lesson-1".into(), "public key".into());
    }

    #[test]
    #[should_panic(expected = "Only the owner")]
    fn only_owner_registers() {
        let mut c = deployed();
        as_caller(alice());
        let _ = c.register_learner(accounts(4));
    }

    #[test]
    #[should_panic(expected = "rewards are immutable")]
    fn lesson_rewards_cannot_change() {
        let mut c = deployed();
        as_caller(owner());
        c.add_lesson(Lesson {
            lesson_id: "lesson-1".into(),
            title: "x".into(),
            answer_hash: answer_hash("lesson-1", "x"),
            reward_gold: U128(1_000_000),
            reward_item: ITEMS[0].into(),
            reward_item_amount: U128(1),
        });
    }

    #[test]
    fn selling_moves_bloqs_price_down() {
        let mut c = deployed();
        as_caller(alice());
        let _ = c.complete_lesson("lesson-1".into(), "public key".into());
        let before = c.get_prices()[0].buy_price.0;
        c.sell_to_bloq(ITEMS[0].into(), U128(1));
        let after = c.get_prices()[0].buy_price.0;
        assert!(after < before, "Bloq pays less once he holds more");
        assert_eq!(c.balance_of(ITEMS[0], &alice()), 2);
        assert_eq!(c.balance_of(ITEMS[0], &bloq()), 6);
        assert_eq!(c.balance_of(GOLD, &alice()), 100 + before);
    }

    #[test]
    fn buying_moves_bloqs_price_up() {
        let mut c = deployed();
        as_caller(alice());
        for id in ["lesson-1", "lesson-2", "lesson-3"] {
            let _ = c.complete_lesson(id.into(), "public key".into());
        }
        let before = c.get_prices()[1].sell_price.0;
        c.buy_from_bloq(ITEMS[1].into(), U128(1));
        let after = c.get_prices()[1].sell_price.0;
        assert!(after > before, "Bloq charges more once he holds less");
        assert_eq!(c.balance_of(ITEMS[1], &alice()), 4);
    }

    #[test]
    fn graduation_burns_the_set_and_pays_the_fee_to_bloq() {
        let mut c = deployed();
        as_caller(alice());
        for id in ["lesson-1", "lesson-2", "lesson-3"] {
            let _ = c.complete_lesson(id.into(), "public key".into());
        }
        let fee = c.get_bloq().graduation_fee.0;
        // the price of a set at seed stock (3 x 68 = 204) is over the floor, so the fee is the set's price
        assert_eq!(fee, ITEMS.iter().map(|i| pricing::sell_price(&params(), 5)).sum::<u128>());
        assert!(fee > GRADUATION_FEE_FLOOR);
        let gold_before = c.balance_of(GOLD, &alice());
        let treasury_before = c.balance_of(GOLD, &bloq());
        assert!(gold_before >= fee, "test setup: rewards must cover the fee");
        let _ = c.graduate();
        let view = c.get_learner(alice());
        assert!(view.graduated);
        assert_eq!(view.gold.0, gold_before - fee);
        assert_eq!(c.balance_of(GOLD, &bloq()), treasury_before + fee);
        for item in ITEMS {
            assert_eq!(c.balance_of(item, &alice()), 2, "one of each item is stamped into the Passport");
            assert_eq!(c.balance_of(item, &bloq()), 5, "Bloq's stock does not grow with a graduation");
        }
    }

    #[test]
    fn the_graduation_fee_never_falls_under_the_floor() {
        let mut c = deployed();
        as_caller(alice());
        for id in ["lesson-1", "lesson-2", "lesson-3"] {
            let _ = c.complete_lesson(id.into(), "public key".into());
        }
        // alice sells six of each (three earned, three minted for the test): Bloq holds 11 of each, a set costs 3 x 48 = 144 < 150
        for item in ITEMS {
            c.mint_to(item, 3, &alice(), "test");
            let _ = c.sell_to_bloq(item.into(), U128(6));
        }
        let set = ITEMS.iter().map(|_| pricing::sell_price(&params(), 11)).sum::<u128>();
        assert!(set < GRADUATION_FEE_FLOOR, "{set}");
        assert_eq!(c.get_bloq().graduation_fee.0, GRADUATION_FEE_FLOOR);
    }

    const HOUR: u64 = shipping::PERIOD_NS;

    #[test]
    fn bloq_ships_his_surplus_an_hour_at_a_time_and_views_agree_with_writes() {
        let mut c = deployed();
        // the clock starts at the first write: alice's first trade, at t = 0
        as_caller_at(alice(), 0);
        let _ = c.complete_lesson("lesson-1".into(), "public key".into());
        let _ = c.sell_to_bloq("key-fragment".into(), U128(2)); // Bloq: 7 key fragments, midpoint 10: no surplus
        assert_eq!(c.balance_of("key-fragment", &bloq()), 7);
        // bob brings the stock to 40: a surplus of 30 over the midpoint of 10
        as_caller(owner());
        let _ = c.register_learner(bob());
        as_caller_at(bob(), 0);
        let _ = c.complete_lesson("lesson-1".into(), "public key".into());
        let _ = c.mint_to("key-fragment", 30, &bob(), "test");
        let _ = c.sell_to_bloq("key-fragment".into(), U128(33));
        assert_eq!(c.balance_of("key-fragment", &bloq()), 40);
        let price_at_40 = c.get_prices()[0].buy_price.0;

        // nothing ships inside the hour
        as_caller_at(alice(), HOUR - 1);
        assert_eq!(c.get_prices()[0].bloq_stock.0, 40);
        // an hour later a view already shows one item gone (4 % of 30 rounds to 1): the price is up
        as_caller_at(alice(), HOUR);
        assert_eq!(c.get_prices()[0].bloq_stock.0, 39);
        assert!(c.get_prices()[0].buy_price.0 >= price_at_40);
        assert_eq!(c.balance_of("key-fragment", &bloq()), 40, "the balance on record moves only on a write");
        // a day later the view shows 24 gone; the next write burns exactly that, and the view and the record agree
        as_caller_at(alice(), 24 * HOUR);
        assert_eq!(c.get_prices()[0].bloq_stock.0, 40 - 24);
        let _ = c.buy_from_bloq("fuel-cell".into(), U128(1));
        assert_eq!(c.balance_of("key-fragment", &bloq()), 16);
        assert_eq!(c.get_prices()[0].bloq_stock.0, 16);
        assert!(c.get_prices()[0].buy_price.0 > price_at_40, "the price came back up");
        // the two items with no surplus never ship
        assert_eq!(c.balance_of("contract-seal", &bloq()), 5);
        // the remainder of the hour is kept: half an hour on, nothing more; a full hour on, one more
        as_caller_at(alice(), 24 * HOUR + HOUR / 2);
        assert_eq!(c.get_prices()[0].bloq_stock.0, 16);
        as_caller_at(alice(), 25 * HOUR);
        assert_eq!(c.get_prices()[0].bloq_stock.0, 15);
    }

    #[test]
    #[should_panic(expected = "Finish all three quests first")]
    fn cannot_graduate_early() {
        let mut c = deployed();
        as_caller(alice());
        let _ = c.complete_lesson("lesson-1".into(), "public key".into());
        let _ = c.graduate();
    }

    #[test]
    fn shop_closes_below_treasury_floor() {
        as_caller(owner());
        let mut c = Contract::new(owner(), passport(), bloq(), params(), U128(120), U128(0));
        c.add_lesson(Lesson {
            lesson_id: "l".into(),
            title: "L".into(),
            answer_hash: answer_hash("l", "a"),
            reward_gold: U128(0),
            reward_item: ITEMS[0].into(),
            reward_item_amount: U128(1),
        });
        let _ = c.register_learner(alice());
        assert!(!c.get_bloq().shop_open, "120 gold is below the 500 floor");
        as_caller(alice());
        let _ = c.complete_lesson("l".into(), "a".into());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.sell_to_bloq(ITEMS[0].into(), U128(1))
        }));
        assert!(result.is_err(), "selling to a closed shop must fail");
    }

    #[test]
    fn answer_hash_is_normalised() {
        assert_eq!(answer_hash("l1", "Public Key"), answer_hash("l1", "  public key\n"));
        assert_ne!(answer_hash("l1", "public key"), answer_hash("l2", "public key"));
        assert_eq!(answer_hash("l1", "x").len(), 64);
    }

    #[test]
    fn streak_is_off_until_the_owner_sets_it() {
        let mut c = deployed(); // alice is registered here
        assert_eq!(c.get_streak_contract(), None);
        as_caller(owner());
        c.set_streak_contract(Some(accounts(4)));
        assert_eq!(c.get_streak_contract(), Some(accounts(4)));
        as_caller(alice());
        let _p = c.check_in(); // builds the forward; the promise itself runs on chain
        as_caller(owner());
        c.set_streak_contract(None);
        assert_eq!(c.get_streak_contract(), None);
    }

    #[test]
    #[should_panic(expected = "Streak is not enabled")]
    fn check_in_panics_while_streak_is_off() {
        let mut c = deployed();
        as_caller(alice());
        let _ = c.check_in();
    }

    #[test]
    fn bounties_contract_is_owner_set_and_forwarded() {
        let mut c = deployed();
        assert_eq!(c.get_bounties_contract(), None);
        as_caller(owner());
        c.set_bounties_contract(Some(accounts(5)));
        assert_eq!(c.get_bounties_contract(), Some(accounts(5)));
        as_caller(alice());
        let _ = c.claim_bounty(1); // a Promise to accounts(5).claim_for(alice, 1)
        as_caller(owner());
        c.set_bounties_contract(None);
        assert_eq!(c.get_bounties_contract(), None);
    }

    #[test]
    #[should_panic(expected = "Bounties are not enabled")]
    fn claim_bounty_panics_while_bounties_are_off() {
        let mut c = deployed();
        as_caller(alice());
        let _ = c.claim_bounty(1);
    }

    #[test]
    #[should_panic(expected = "Not a registered learner")]
    fn claim_bounty_needs_a_registered_learner() {
        let mut c = deployed();
        as_caller(owner());
        c.set_bounties_contract(Some(accounts(5)));
        as_caller(accounts(5));
        let _ = c.claim_bounty(1);
    }

    #[test]
    #[should_panic(expected = "Not a registered learner")]
    fn check_in_needs_a_registered_learner() {
        let mut c = deployed();
        as_caller(owner());
        c.set_streak_contract(Some(accounts(4)));
        as_caller(accounts(5)); // never registered
        let _ = c.check_in();
    }

    fn add_daily(c: &mut Contract, id: &str) {
        as_caller(owner());
        c.add_lesson(Lesson {
            lesson_id: id.into(),
            title: "Daily quest".into(),
            answer_hash: answer_hash(id, "True"),
            reward_gold: U128(50),
            reward_item: ITEMS[1].to_string(),
            reward_item_amount: U128(1),
        });
    }

    #[test]
    fn bonus_quest_pays_but_does_not_level() {
        let mut c = deployed();
        add_daily(&mut c, "daily-2026-11-06");
        as_caller(alice());
        let _ = c.complete_lesson("lesson-1".into(), "public key".into());
        as_caller(alice());
        let r = c.complete_lesson("daily-2026-11-06".into(), "true".into());
        assert!(matches!(r, PromiseOrValue::Value(())), "a bonus quest does not call the Passport");
        let v = c.get_learner(alice());
        assert_eq!(v.level, 1, "level counts founding quests only");
        assert_eq!(v.gold.0, 150);
        assert_eq!(c.balance_of(ITEMS[1], &alice()), 1);
        assert!(v.completed.contains(&"daily-2026-11-06".to_string()));
        assert!(c.is_completed(alice(), "daily-2026-11-06".into()));
    }

    /// Alice finishes Season 1 (the three founding quests).
    fn finish_season1(c: &mut Contract) {
        for id in ["lesson-1", "lesson-2", "lesson-3"] {
            as_caller(alice());
            let _ = c.complete_lesson(id.into(), "public key".into());
        }
    }

    /// The three Season 2 chapters, and Alice through Season 1 and graduated so she may play them.
    fn add_chapters(c: &mut Contract) {
        finish_season1(c);
        as_caller(alice());
        let _ = c.graduate();
        as_caller(owner());
        for (i, id) in SEASON2_CHAPTERS.iter().enumerate() {
            c.add_lesson(Lesson {
                lesson_id: id.to_string(),
                title: format!("Chapter {}", i + 4),
                answer_hash: answer_hash(id, "Yes"),
                reward_gold: U128(50),
                reward_item: ITEMS[i].to_string(),
                reward_item_amount: U128(1),
            });
        }
    }

    #[test]
    fn chapters_pay_but_do_not_level() {
        let mut c = deployed();
        add_chapters(&mut c);
        let gold_before = c.get_learner(alice()).gold.0;
        let items_before: Vec<u128> = ITEMS.iter().map(|i| c.balance_of(i, &alice())).collect();
        for id in SEASON2_CHAPTERS {
            as_caller(alice());
            let _ = c.complete_lesson(id.into(), "yes".into());
        }
        let v = c.get_learner(alice());
        assert_eq!(v.level, 3, "chapters never raise the Passport level");
        assert_eq!(v.gold.0, gold_before + 150);
        for (i, item) in ITEMS.iter().enumerate() {
            assert_eq!(c.balance_of(item, &alice()), items_before[i] + 1);
        }
    }

    fn add_one_chapter(c: &mut Contract) {
        as_caller(owner());
        c.add_lesson(Lesson {
            lesson_id: "chapter-ownership".into(),
            title: "Chapter 4".into(),
            answer_hash: answer_hash("chapter-ownership", "Yes"),
            reward_gold: U128(50),
            reward_item: ITEMS[0].to_string(),
            reward_item_amount: U128(1),
        });
    }

    #[test]
    #[should_panic(expected = "Graduate first to open Season 2")]
    fn chapters_wait_for_season1() {
        let mut c = deployed();
        add_one_chapter(&mut c);
        as_caller(alice());
        let _ = c.complete_lesson("chapter-ownership".into(), "yes".into());
    }

    #[test]
    #[should_panic(expected = "Graduate first to open Season 2")]
    fn chapters_wait_for_graduation() {
        let mut c = deployed();
        finish_season1(&mut c);
        add_one_chapter(&mut c);
        as_caller(alice());
        let _ = c.complete_lesson("chapter-ownership".into(), "yes".into());
    }

    #[test]
    fn a_daily_quest_needs_no_graduation() {
        let mut c = deployed();
        add_daily(&mut c, "daily-2026-11-08");
        as_caller(alice());
        let _ = c.complete_lesson("daily-2026-11-08".into(), "true".into());
        assert!(c.is_completed(alice(), "daily-2026-11-08".into()));
    }

    #[test]
    fn the_third_chapter_stamps_the_passport() {
        let mut c = deployed();
        add_chapters(&mut c);
        as_caller(alice());
        let r = c.complete_lesson("chapter-ownership".into(), "yes".into());
        assert!(matches!(r, PromiseOrValue::Value(())), "one chapter: no stamp yet");
        as_caller(alice());
        let r = c.complete_lesson("chapter-defi".into(), "yes".into());
        assert!(matches!(r, PromiseOrValue::Value(())), "two chapters: no stamp yet");
        as_caller(alice());
        let r = c.complete_lesson("chapter-transactions".into(), "yes".into());
        assert!(matches!(r, PromiseOrValue::Promise(_)), "the third chapter calls the Passport");
        let logs = near_sdk::test_utils::get_logs();
        assert!(logs.iter().any(|l| l.contains("stamp_requested") && l.contains("season-2")), "{logs:?}");
    }

    #[test]
    fn a_daily_quest_never_stamps() {
        let mut c = deployed();
        add_chapters(&mut c);
        add_daily(&mut c, "daily-2026-11-07");
        for id in ["chapter-ownership", "chapter-transactions"] {
            as_caller(alice());
            let _ = c.complete_lesson(id.into(), "yes".into());
        }
        as_caller(alice());
        let r = c.complete_lesson("daily-2026-11-07".into(), "true".into());
        assert!(matches!(r, PromiseOrValue::Value(())));
    }

    #[test]
    #[should_panic(expected = "Finish the three Season 2 chapters first")]
    fn resync_stamp_refused_before_the_three_chapters() {
        let mut c = deployed();
        add_chapters(&mut c);
        as_caller(alice());
        let _ = c.complete_lesson("chapter-ownership".into(), "yes".into());
        as_caller(accounts(5)); // anyone may call it, but it checks the learner's record
        let _ = c.resync_stamp(alice());
    }

    #[test]
    fn resync_stamp_after_the_three_chapters() {
        let mut c = deployed();
        add_chapters(&mut c);
        for id in SEASON2_CHAPTERS {
            as_caller(alice());
            let _ = c.complete_lesson(id.into(), "yes".into());
        }
        as_caller(accounts(5));
        let _ = c.resync_stamp(alice());
    }

    #[test]
    #[should_panic(expected = "Lesson already completed")]
    fn bonus_quest_is_once_per_account_too() {
        let mut c = deployed();
        add_daily(&mut c, "daily-2026-11-06");
        as_caller(alice());
        let _ = c.complete_lesson("daily-2026-11-06".into(), "true".into());
        as_caller(alice());
        let _ = c.complete_lesson("daily-2026-11-06".into(), "true".into());
    }

    #[test]
    fn lesson_text_is_owner_set_and_public() {
        let mut c = deployed();
        add_daily(&mut c, "daily-2026-11-06");
        assert_eq!(c.get_lesson_text("daily-2026-11-06".into()), None);
        as_caller(owner());
        c.set_lesson_text("daily-2026-11-06".into(), r#"{"question":"Is NEAR a blockchain?","options":["True","False"]}"#.into());
        assert!(c.get_lesson_text("daily-2026-11-06".into()).unwrap().contains("Is NEAR"));
        let all = c.get_lessons_with_text();
        assert_eq!(all.len(), 4);
        let daily = all.iter().find(|l| l.lesson.lesson_id == "daily-2026-11-06").unwrap();
        assert!(daily.bonus);
        assert!(daily.text.is_some());
        assert!(all.iter().filter(|l| !l.bonus).all(|l| l.text.is_none()));
    }

    #[test]
    #[should_panic(expected = "Only the owner")]
    fn lesson_text_needs_owner() {
        let mut c = deployed();
        add_daily(&mut c, "daily-2026-11-06");
        as_caller(alice());
        c.set_lesson_text("daily-2026-11-06".into(), "{}".into());
    }

    #[test]
    #[should_panic(expected = "Lesson text too long")]
    fn lesson_text_is_capped() {
        let mut c = deployed();
        add_daily(&mut c, "daily-2026-11-06");
        as_caller(owner());
        c.set_lesson_text("daily-2026-11-06".into(), "x".repeat(MAX_LESSON_TEXT_BYTES + 1));
    }

    // ---- the price call (calls.rs) ----
    const NS: u64 = 1_000_000_000;
    const ROUND: u64 = calls::ROUND_SECONDS * NS;

    fn bob() -> AccountId {
        accounts(4)
    }

    /// alice and bob registered, each with 100 gold from lesson-1 (3 key fragments too). Time: start of round 1.
    fn two_players() -> Contract {
        let mut c = deployed();
        as_caller(owner());
        let _ = c.register_learner(bob());
        for who in [alice(), bob()] {
            as_caller_at(who, ROUND);
            let _ = c.complete_lesson("lesson-1".into(), "Public Key".into());
        }
        c
    }

    #[test]
    fn a_call_moves_the_stake_to_the_contract_and_remembers_the_price() {
        let mut c = two_players();
        as_caller_at(alice(), ROUND + 10 * NS);
        let r = c.place_call(ITEMS[0].into(), calls::Side::More, U128(30));
        assert_eq!(r.round, 1);
        assert_eq!(c.balance_of(GOLD, &alice()), 70);
        assert_eq!(c.balance_of(GOLD, &"core.bloqvia.testnet".parse::<AccountId>().unwrap()), 30);
        let v = c.get_price_calls(ITEMS[0].into(), None);
        assert_eq!(v.calls.len(), 1);
        assert_eq!(v.more_stake.0, 30);
        assert_eq!(v.calls[0].open_price.0, pricing::buy_price(&params(), 5)); // Bloq holds 5 of them
        assert!(v.open);
        let mine = c.get_my_calls(alice(), None);
        assert_eq!(mine.len(), 1);
        assert!(!mine[0].settled);
    }

    #[test]
    fn the_right_side_takes_the_losers_stakes_when_the_round_settles() {
        let mut c = two_players();
        as_caller_at(alice(), ROUND + 10 * NS);
        c.place_call(ITEMS[0].into(), calls::Side::Less, U128(40)); // alice: Bloq will pay less
        as_caller_at(bob(), ROUND + 20 * NS);
        c.place_call(ITEMS[0].into(), calls::Side::More, U128(20)); // bob: more
        // alice sells 2 key fragments: Bloq's stock rises, his price falls
        as_caller_at(alice(), ROUND + 30 * NS);
        c.sell_to_bloq(ITEMS[0].into(), U128(2));
        let alice_before = c.balance_of(GOLD, &alice());
        // the round ends; anyone settles
        as_caller_at(owner(), 2 * ROUND + 5 * NS);
        let close = c.settle_calls(ITEMS[0].into(), 1).unwrap();
        assert_eq!(close.0, pricing::buy_price(&params(), 7));
        assert_eq!(c.balance_of(GOLD, &alice()), alice_before + 40 + 20); // her stake back plus bob's
        assert_eq!(c.balance_of(GOLD, &bob()), 80); // bob lost his 20
        assert_eq!(c.balance_of(GOLD, &"core.bloqvia.testnet".parse::<AccountId>().unwrap()), 0);
        let mine = c.get_my_calls(bob(), Some(vec![calls::CallRef { token_id: ITEMS[0].into(), round: 1 }]));
        assert_eq!(mine[0].paid.unwrap().0, 0);
        assert!(mine[0].settled);
        assert!(c.get_my_calls(alice(), None).is_empty()); // settled calls leave the open list
        // settling twice changes nothing
        assert_eq!(c.settle_calls(ITEMS[0].into(), 1).unwrap().0, close.0);
        assert_eq!(c.balance_of(GOLD, &alice()), alice_before + 60);
    }

    #[test]
    fn an_unmoved_price_pays_whoever_called_same_and_refunds_when_nobody_did() {
        let mut c = two_players();
        as_caller_at(alice(), ROUND + 10 * NS);
        c.place_call(ITEMS[0].into(), calls::Side::More, U128(10));
        as_caller_at(bob(), ROUND + 20 * NS);
        c.place_call(ITEMS[0].into(), calls::Side::Same, U128(10));
        as_caller_at(owner(), 2 * ROUND);
        c.settle_calls(ITEMS[0].into(), 1);
        assert_eq!(c.balance_of(GOLD, &alice()), 90); // nothing moved: "more" lost
        assert_eq!(c.balance_of(GOLD, &bob()), 110); // "same" took it
        // the next round: alice alone says "more", nothing moves, nobody was right: her stake comes back
        as_caller_at(alice(), 2 * ROUND + 10 * NS);
        c.place_call(ITEMS[0].into(), calls::Side::More, U128(10));
        as_caller_at(owner(), 3 * ROUND);
        c.settle_calls(ITEMS[0].into(), 2);
        assert_eq!(c.balance_of(GOLD, &alice()), 90);
    }

    #[test]
    #[should_panic(expected = "This round is closing")]
    fn calls_close_seven_minutes_into_the_round() {
        let mut c = two_players();
        as_caller_at(alice(), ROUND + calls::CALL_WINDOW_SECONDS * NS);
        c.place_call(ITEMS[0].into(), calls::Side::More, U128(10));
    }

    #[test]
    #[should_panic(expected = "One call per item per round")]
    fn one_call_per_item_per_round() {
        let mut c = two_players();
        as_caller_at(alice(), ROUND + 10 * NS);
        c.place_call(ITEMS[0].into(), calls::Side::More, U128(10));
        c.place_call(ITEMS[0].into(), calls::Side::Less, U128(10));
    }

    #[test]
    #[should_panic(expected = "Stake between 10 and 50 gold")]
    fn the_stake_is_capped() {
        let mut c = two_players();
        as_caller_at(alice(), ROUND + 10 * NS);
        c.place_call(ITEMS[0].into(), calls::Side::More, U128(51));
    }

    #[test]
    #[should_panic(expected = "The round is still running")]
    fn a_running_round_cannot_be_settled() {
        let mut c = two_players();
        as_caller_at(alice(), ROUND + 10 * NS);
        c.place_call(ITEMS[0].into(), calls::Side::More, U128(10));
        c.settle_calls(ITEMS[0].into(), 1);
    }

    #[test]
    #[should_panic(expected = "Not a registered learner")]
    fn only_learners_call() {
        let mut c = deployed();
        as_caller_at(bob(), ROUND);
        c.place_call(ITEMS[0].into(), calls::Side::More, U128(10));
    }
}
