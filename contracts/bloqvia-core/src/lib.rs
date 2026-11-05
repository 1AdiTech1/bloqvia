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
    MetadataController, Nep245, Nep245Controller, Nep245Metadata, Nep245Mint, Nep245Transfer,
};

pub mod pricing;
pub use pricing::PricingParams;

/// Token ids. Kept as constants so the frontend and the contract agree.
pub const GOLD: &str = "gold";
pub const ITEMS: [&str; 3] = ["key-fragment", "fuel-cell", "contract-seal"];

const GAS_PASSPORT_CALL: Gas = Gas::from_tgas(10);
const GAS_PASSPORT_CALLBACK: Gas = Gas::from_tgas(5);

/// Cross-contract interface of `bloqvia-passport`.
#[ext_contract(ext_passport)]
pub trait Passport {
    fn mint_passport(&mut self, account_id: AccountId);
    fn set_level(&mut self, account_id: AccountId, level: u8);
    fn graduate(&mut self, account_id: AccountId);
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

/// Lessons whose id starts with this are **bonus quests** (the daily quests
/// written by the NEAR AI agent). They pay gold and an item like any lesson,
/// but do not count toward the Passport level, which is reserved for the
/// three founding quests, so the shop and graduation rules are unchanged.
pub const BONUS_PREFIX: &str = "daily-";

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
            PromiseOrValue::Value(())
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

    /// Graduates the learner: hands one of each item plus the graduation fee
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
        let fee = self.graduation_fee();
        require!(self.balance_of(GOLD, &learner) >= fee, "Not enough gold for the fee");

        self.graduates.insert(learner.clone());
        for item in ITEMS {
            self.move_tokens(&learner, &self.bloq_id.clone(), item, 1, "graduation");
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
                let stock = self.balance_of(item, &self.bloq_id);
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
    /// text ships with the app). Bonus quests are the ones starting `daily-`.
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

    /// Bloq's current sell price for one of each item.
    fn graduation_fee(&self) -> u128 {
        ITEMS.iter().fold(0u128, |acc, item| {
            let stock = self.balance_of(item, &self.bloq_id);
            acc.saturating_add(pricing::sell_price(&self.pricing, stock))
        })
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

    fn move_tokens(
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
    lesson_id.starts_with(BONUS_PREFIX)
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
fn log_event(event: &str, data: &near_sdk::serde_json::Value) {
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
        let mut ctx = VMContextBuilder::new();
        ctx.current_account_id("core.bloqvia.testnet".parse().unwrap())
            .signer_account_id(caller.clone())
            .predecessor_account_id(caller);
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
    fn graduation_hands_items_and_fee_to_bloq() {
        let mut c = deployed();
        as_caller(alice());
        for id in ["lesson-1", "lesson-2", "lesson-3"] {
            let _ = c.complete_lesson(id.into(), "public key".into());
        }
        let fee = c.get_bloq().graduation_fee.0;
        let gold_before = c.balance_of(GOLD, &alice());
        assert!(gold_before >= fee, "test setup: rewards must cover the fee");
        let _ = c.graduate();
        let view = c.get_learner(alice());
        assert!(view.graduated);
        assert_eq!(view.gold.0, gold_before - fee);
        for item in ITEMS {
            assert_eq!(c.balance_of(item, &alice()), 2, "one of each item went to Bloq");
            assert_eq!(c.balance_of(item, &bloq()), 6);
        }
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
        c.check_in();
    }

    #[test]
    #[should_panic(expected = "Not a registered learner")]
    fn check_in_needs_a_registered_learner() {
        let mut c = deployed();
        as_caller(owner());
        c.set_streak_contract(Some(accounts(4)));
        as_caller(accounts(5)); // never registered
        c.check_in();
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
}
