//! bloqvia-streak — a community streak token (NEP-141) with the whole
//! mechanic inside the contract and no admin key.
//!
//! The idea, in the words of the `memecoins` track: a token whose supply moves
//! with what the community does, by rules anyone can read.
//!
//! * Each learner may `check_in` once per day. The call comes through
//!   `bloqvia-core` (the only caller this contract accepts), so a learner's
//!   existing scoped key works and nobody can check in for someone else.
//! * Each day has a **community target** (`daily_target` check-ins).
//! * The first call of a new day settles the previous one:
//!   - target met   → `reward_per_checkin` is minted to every account that
//!                    checked in, and the community streak grows by one;
//!   - target missed → `burn_per_miss` is burned from this contract's own
//!                    treasury and the streak resets to zero.
//! * Every parameter is fixed at `new()` and readable through `get_streak()`.
//!   There is no method that mints, burns or moves tokens by hand.
//!
//! Day length is a parameter so the testnet demo can run short "days"; the
//! README states the value used.
//!
//! Sybil limit, stated plainly: one account = one check-in per day. Accounts
//! are created by the relayer, which funds and rate-limits them; this contract
//! cannot tell two accounts of one person apart.

use near_sdk::json_types::U128;
use near_sdk::store::{IterableSet, LookupMap, Vector};
use near_sdk::{
    env, near, require, AccountId, AccountIdRef, BorshStorageKey, PanicOnDefault,
};
use near_sdk_contract_tools::ft::{
    ContractMetadata, Nep141, Nep141Burn, Nep141Controller, Nep141Mint, Nep148, Nep148Controller,
};

/// Settling runs at most this many missed days in one call, so a long quiet
/// period cannot make a single transaction run out of gas.
pub const MAX_DAYS_SETTLED_PER_CALL: u64 = 30;
/// `get_streak` returns at most this many settled days.
pub const HISTORY_IN_VIEW: u32 = 14;

/// Fixed at `new()`. Readable by anyone through `get_streak()`.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StreakParams {
    /// Check-ins a day needs for the community to "make" it.
    pub daily_target: u32,
    /// Tokens minted to EACH account that checked in on a day that made it.
    pub reward_per_checkin: U128,
    /// Tokens burned from the treasury on a day that missed.
    pub burn_per_miss: U128,
    /// Length of a day. 86400 for real days; shorter for a demo.
    pub day_length_seconds: u64,
}

/// One settled day.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DayResult {
    pub day: u64,
    pub checkins: u32,
    pub target: u32,
    pub met: bool,
    pub minted: U128,
    pub burned: U128,
    pub streak_after: u32,
}

/// Everything the streak card shows.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct StreakView {
    pub day: u64,
    pub seconds_left_in_day: u64,
    pub today_count: u32,
    pub today_target: u32,
    pub streak: u32,
    pub best_streak: u32,
    pub treasury: U128,
    pub total_supply: U128,
    pub params: StreakParams,
    pub last: Option<DayResult>,
    pub history: Vec<DayResult>,
}

/// One learner's standing.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MemberView {
    pub account_id: AccountId,
    pub checked_in_today: bool,
    pub last_checkin_day: Option<u64>,
    pub total_checkins: u32,
    pub balance: U128,
}

/// What `check_in_for` returns to the caller.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct CheckInResult {
    pub day: u64,
    pub today_count: u32,
    pub today_target: u32,
    pub days_settled: u32,
}

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum StorageKey {
    Today,
    LastCheckin,
    TotalCheckins,
    History,
}

#[derive(Nep141, Nep148, PanicOnDefault)]
#[near(contract_state)]
pub struct Streak {
    core_id: AccountId,
    params: StreakParams,
    genesis_ns: u64,
    current_day: u64,
    today: IterableSet<AccountId>,
    last_checkin: LookupMap<AccountId, u64>,
    total_checkins: LookupMap<AccountId, u32>,
    streak: u32,
    best_streak: u32,
    history: Vector<DayResult>,
}

#[near]
impl Streak {
    /// `treasury_seed` tokens are minted to this contract's own account; that
    /// balance is what missed days burn from. Nothing else is ever minted
    /// except daily rewards.
    #[init]
    pub fn new(core_id: AccountId, params: StreakParams, treasury_seed: U128) -> Self {
        require!(params.daily_target > 0, "daily_target must be at least 1");
        require!(params.day_length_seconds >= 60, "day_length_seconds must be at least 60");
        let mut contract = Self {
            core_id,
            params,
            genesis_ns: env::block_timestamp(),
            current_day: 0,
            today: IterableSet::new(StorageKey::Today),
            last_checkin: LookupMap::new(StorageKey::LastCheckin),
            total_checkins: LookupMap::new(StorageKey::TotalCheckins),
            streak: 0,
            best_streak: 0,
            history: Vector::new(StorageKey::History),
        };
        contract.set_metadata(&ContractMetadata::new("Bloqvia Streak", "STREAK", 0));
        let treasury = env::current_account_id();
        contract.mint(treasury_seed.0, &treasury, "treasury seed");
        contract
    }

    // ------------------------------------------------------------------
    // Calls
    // ------------------------------------------------------------------

    /// Record a check-in for `account_id`. Only `bloqvia-core` may call this,
    /// and core only forwards for the registered learner who signed.
    pub fn check_in_for(&mut self, account_id: AccountId) -> CheckInResult {
        require!(env::predecessor_account_id() == self.core_id, "Only bloqvia-core may check in");
        let day = self.day_now();
        let days_settled = self.settle_until(day);
        require!(
            self.last_checkin.get(&account_id) != Some(&day),
            "Already checked in today"
        );
        self.today.insert(account_id.clone());
        self.last_checkin.insert(account_id.clone(), day);
        let total = self.total_checkins.get(&account_id).copied().unwrap_or(0) + 1;
        self.total_checkins.insert(account_id.clone(), total);
        log_event(
            "check_in",
            &format!(
                r#"{{"account_id":"{account_id}","day":{day},"today_count":{},"target":{}}}"#,
                self.today.len(),
                self.params.daily_target
            ),
        );
        CheckInResult {
            day,
            today_count: self.today.len(),
            today_target: self.params.daily_target,
            days_settled,
        }
    }

    /// Settle any finished days without checking in. Anyone may call it; the
    /// result is the same as the next check-in would produce.
    pub fn settle(&mut self) -> u32 {
        let day = self.day_now();
        self.settle_until(day)
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    pub fn get_streak(&self) -> StreakView {
        let day = self.day_now();
        let day_ns = self.day_length_ns();
        let elapsed = env::block_timestamp().saturating_sub(self.genesis_ns) % day_ns;
        let len = self.history.len();
        let from = len.saturating_sub(HISTORY_IN_VIEW);
        let history = (from..len).filter_map(|i| self.history.get(i).cloned()).collect();
        // If the day has moved on, "today" is empty until someone settles.
        let today_count = if day == self.current_day { self.today.len() } else { 0 };
        StreakView {
            day,
            seconds_left_in_day: (day_ns - elapsed) / 1_000_000_000,
            today_count,
            today_target: self.params.daily_target,
            streak: self.streak,
            best_streak: self.best_streak,
            treasury: U128(self.balance_of(&env::current_account_id())),
            total_supply: U128(self.total_supply()),
            params: self.params.clone(),
            last: (len > 0).then(|| self.history.get(len - 1).cloned()).flatten(),
            history,
        }
    }

    pub fn get_member(&self, account_id: AccountId) -> MemberView {
        let day = self.day_now();
        let last = self.last_checkin.get(&account_id).copied();
        MemberView {
            checked_in_today: last == Some(day),
            last_checkin_day: last,
            total_checkins: self.total_checkins.get(&account_id).copied().unwrap_or(0),
            balance: U128(self.balance_of(&account_id)),
            account_id,
        }
    }

    pub fn get_core(&self) -> AccountId {
        self.core_id.clone()
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    fn day_length_ns(&self) -> u64 {
        self.params.day_length_seconds * 1_000_000_000
    }

    fn day_now(&self) -> u64 {
        env::block_timestamp().saturating_sub(self.genesis_ns) / self.day_length_ns()
    }

    /// Settle every finished day up to (not including) `day`, at most
    /// `MAX_DAYS_SETTLED_PER_CALL` of them. Returns how many were settled.
    fn settle_until(&mut self, day: u64) -> u32 {
        if day <= self.current_day {
            return 0;
        }
        let gap = day - self.current_day;
        let to_settle = gap.min(MAX_DAYS_SETTLED_PER_CALL);
        for _ in 0..to_settle {
            self.settle_one(self.current_day);
            self.current_day += 1;
        }
        // Days beyond the cap are skipped silently; the loop cannot run forever.
        self.current_day = day;
        to_settle as u32
    }

    fn settle_one(&mut self, day: u64) {
        let checkins = self.today.len();
        let target = self.params.daily_target;
        let met = checkins >= target;
        let mut minted = 0u128;
        let mut burned = 0u128;

        if met {
            let reward = self.params.reward_per_checkin.0;
            let members: Vec<AccountId> = self.today.iter().cloned().collect();
            for m in &members {
                self.mint(reward, m, "streak reward");
                minted += reward;
            }
            self.streak += 1;
            self.best_streak = self.best_streak.max(self.streak);
        } else {
            let treasury = env::current_account_id();
            burned = self.params.burn_per_miss.0.min(self.balance_of(&treasury));
            if burned > 0 {
                let burn = Nep141Burn::new(burned, &treasury).memo("target missed");
                Nep141Controller::burn(self, &burn)
                    .unwrap_or_else(|e| env::panic_str(&format!("burn: {e}")));
            }
            self.streak = 0;
        }

        self.today.clear();
        let result = DayResult {
            day,
            checkins,
            target,
            met,
            minted: U128(minted),
            burned: U128(burned),
            streak_after: self.streak,
        };
        log_event(
            "day_settled",
            &format!(
                r#"{{"day":{day},"checkins":{checkins},"target":{target},"met":{met},"minted":"{minted}","burned":"{burned}","streak":{}}}"#,
                self.streak
            ),
        );
        self.history.push(result);
    }

    fn mint(&mut self, amount: u128, receiver: &AccountIdRef, memo: &str) {
        if amount == 0 {
            return;
        }
        let mint = Nep141Mint::new(amount, receiver).memo(memo);
        Nep141Controller::mint(self, &mint)
            .unwrap_or_else(|e| env::panic_str(&format!("mint: {e}")));
    }
}

/// NEP-297 style event under our own standard name.
fn log_event(event: &str, data_json: &str) {
    env::log_str(&format!(
        r#"EVENT_JSON:{{"standard":"bloqvia-streak","version":"1.0.0","event":"{event}","data":[{data_json}]}}"#
    ));
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    const DAY: u64 = 600; // demo-length days in these tests
    const NS: u64 = 1_000_000_000;

    fn core() -> AccountId {
        accounts(0)
    }
    fn alice() -> AccountId {
        accounts(1)
    }
    fn bob() -> AccountId {
        accounts(2)
    }
    fn carol() -> AccountId {
        accounts(3)
    }
    fn me() -> AccountId {
        "streak.bloqvia.testnet".parse().unwrap()
    }

    fn at(caller: AccountId, seconds: u64) {
        let mut ctx = VMContextBuilder::new();
        ctx.current_account_id(me())
            .signer_account_id(caller.clone())
            .predecessor_account_id(caller)
            .block_timestamp(1_000_000 * NS + seconds * NS);
        testing_env!(ctx.build());
    }

    fn params() -> StreakParams {
        StreakParams {
            daily_target: 2,
            reward_per_checkin: U128(10),
            burn_per_miss: U128(50),
            day_length_seconds: DAY,
        }
    }

    fn fresh() -> Streak {
        at(core(), 0);
        Streak::new(core(), params(), U128(1_000))
    }

    #[test]
    fn init_seeds_treasury_and_metadata() {
        let c = fresh();
        let v = c.get_streak();
        assert_eq!(v.treasury.0, 1_000);
        assert_eq!(v.total_supply.0, 1_000);
        assert_eq!(v.day, 0);
        assert_eq!(v.streak, 0);
        assert_eq!(c.get_metadata().symbol, "STREAK");
    }

    #[test]
    #[should_panic(expected = "Only bloqvia-core may check in")]
    fn only_core_may_check_in() {
        let mut c = fresh();
        at(alice(), 10);
        c.check_in_for(alice());
    }

    #[test]
    #[should_panic(expected = "Already checked in today")]
    fn one_check_in_per_day() {
        let mut c = fresh();
        at(core(), 10);
        c.check_in_for(alice());
        at(core(), 20);
        c.check_in_for(alice());
    }

    #[test]
    fn target_met_mints_to_everyone_and_grows_the_streak() {
        let mut c = fresh();
        at(core(), 10);
        c.check_in_for(alice());
        at(core(), 20);
        let r = c.check_in_for(bob());
        assert_eq!(r.today_count, 2);

        // Next day: carol's check-in settles day 0.
        at(core(), DAY + 5);
        let r = c.check_in_for(carol());
        assert_eq!(r.days_settled, 1);
        assert_eq!(r.day, 1);
        assert_eq!(r.today_count, 1);

        let v = c.get_streak();
        assert_eq!(v.streak, 1);
        assert_eq!(v.best_streak, 1);
        assert_eq!(v.treasury.0, 1_000, "rewards are minted, not taken from the treasury");
        assert_eq!(v.total_supply.0, 1_020);
        let last = v.last.unwrap();
        assert!(last.met);
        assert_eq!(last.minted.0, 20);
        assert_eq!(last.burned.0, 0);
        assert_eq!(c.get_member(alice()).balance.0, 10);
        assert_eq!(c.get_member(bob()).balance.0, 10);
        assert_eq!(c.get_member(carol()).balance.0, 0);
    }

    #[test]
    fn target_missed_burns_from_treasury_and_resets() {
        let mut c = fresh();
        at(core(), 10);
        c.check_in_for(alice());
        at(core(), 20);
        c.check_in_for(bob());
        at(core(), DAY + 1);
        c.check_in_for(alice()); // settles day 0: met, streak 1
        at(core(), 2 * DAY + 1);
        c.check_in_for(alice()); // settles day 1: only alice -> missed

        let v = c.get_streak();
        assert_eq!(v.streak, 0);
        assert_eq!(v.best_streak, 1);
        assert_eq!(v.treasury.0, 950);
        assert_eq!(v.total_supply.0, 1_020 - 50);
        let last = v.last.unwrap();
        assert!(!last.met);
        assert_eq!(last.burned.0, 50);
        assert_eq!(v.history.len(), 2);
    }

    #[test]
    fn quiet_days_are_settled_as_misses_up_to_the_cap() {
        at(core(), 0);
        let mut c = Streak::new(core(), params(), U128(10_000));
        at(core(), 10);
        c.check_in_for(alice());
        // Nobody comes back for 40 days; settle() is public and anyone may call it.
        at(alice(), 40 * DAY + 1);
        let settled = c.settle();
        assert_eq!(settled as u64, MAX_DAYS_SETTLED_PER_CALL);
        let v = c.get_streak();
        assert_eq!(v.day, 40);
        assert_eq!(v.treasury.0, 10_000 - 30 * 50);
        assert_eq!(v.streak, 0);
        assert_eq!(v.history.len() as u32, HISTORY_IN_VIEW, "the view shows the last 14 days");
    }

    #[test]
    fn burns_stop_at_an_empty_treasury() {
        let mut c = fresh(); // treasury 1_000, burn 50 per miss
        at(alice(), 25 * DAY + 1);
        c.settle(); // 25 misses: 20 burn 50 each, the last 5 burn nothing
        let v = c.get_streak();
        assert_eq!(v.treasury.0, 0);
        assert_eq!(v.total_supply.0, 0);
        assert_eq!(v.last.unwrap().burned.0, 0);
    }

    #[test]
    fn member_view_tracks_today_and_totals() {
        let mut c = fresh();
        at(core(), 10);
        c.check_in_for(alice());
        let m = c.get_member(alice());
        assert!(m.checked_in_today);
        assert_eq!(m.total_checkins, 1);
        at(core(), DAY + 10);
        let m = c.get_member(alice());
        assert!(!m.checked_in_today);
        assert_eq!(m.last_checkin_day, Some(0));
        let v = c.get_streak();
        assert_eq!(v.today_count, 0, "a new day shows empty until settled");
        assert!(v.seconds_left_in_day <= DAY);
    }

    #[test]
    fn no_admin_methods_exist() {
        // Compile-time statement of intent: the only mutating entry points are
        // check_in_for (core only) and settle (anyone, deterministic).
        let mut c = fresh();
        at(alice(), 5);
        assert_eq!(c.settle(), 0);
    }
}
