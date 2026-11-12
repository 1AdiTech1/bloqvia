//! The price call (Nov 11): every price in Bloqvia is also a question.
//!
//! "In ten minutes, will Bloq pay more or less for Key Fragments?" A learner stakes
//! a little gold on *more* or *less*. The call remembers Bloq's buy price at that
//! moment. When the round ends, anyone settles it: the contract reads its own
//! current buy price (`pricing.rs`, the same rule that set every price), and
//!
//! * a call whose side was right (more, same or less) gets its stake back plus a
//!   pro-rata share of the stakes of the two wrong sides;
//! * a call on a wrong side loses its stake to the winners;
//! * when nobody was right (nobody called the side that happened) every call gets
//!   its stake back.
//!
//! No house money, no odds set by anyone, no owner method: the pool is only the
//! players' stakes, held by this contract's own account until settlement. The
//! outcome is read from the price rule by the contract that enforces it. The
//! result is a market on the market: the pool shows what the crowd expects, and
//! ten minutes later the chain says whether the crowd was right.
//!
//! Limits that make it a lesson rather than a lever: one call per account, item
//! and round; a stake between MIN_STAKE and MAX_STAKE; calls only in the first
//! CALL_WINDOW of the round, so a call lives at least a few minutes; at most
//! MAX_CALLS_PER_ROUND so a settlement always fits in one transaction. Moving
//! the price costs items and Bloq's spread, which is more than a capped stake
//! can win; that is the point a learner is meant to notice.
//!
//! Storage lives under its own keys (not fields of `Contract`), so adding this
//! needed no state migration: the deployed state keeps its layout.

use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey};

use near_sdk_contract_tools::mt::Nep245Controller;

use crate::{log_event, pricing, Contract, ContractExt, GOLD, ITEMS};

/// Round length. 10 minutes on testnet (a Bloqvia day, like the streak); a real day in production.
pub const ROUND_SECONDS: u64 = 600;
/// Calls are accepted only this long into a round, so every call lives at least the rest of it.
pub const CALL_WINDOW_SECONDS: u64 = 420;
pub const MIN_STAKE: u128 = 10;
pub const MAX_STAKE: u128 = 50;
/// Keeps one settlement inside a single transaction's gas.
pub const MAX_CALLS_PER_ROUND: usize = 40;

const NS: u64 = 1_000_000_000;

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum CallsKey {
    Rounds,
    Open,
}

/// Which way the caller says Bloq's buy price will go by the end of the round.
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    More,
    Same,
    Less,
}

/// One learner's call in one round.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PriceCall {
    pub account_id: AccountId,
    pub side: Side,
    pub stake: U128,
    /// Bloq's buy price when the call was made
    pub open_price: U128,
}

/// What happened to a call's price between its open and the round's close.
pub fn outcome(open: u128, close: u128) -> Side {
    if close > open {
        Side::More
    } else if close < open {
        Side::Less
    } else {
        Side::Same
    }
}

/// A round of calls on one item.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, Default)]
pub struct CallRound {
    pub calls: Vec<PriceCall>,
    pub settled: bool,
    /// Bloq's buy price when the round was settled (None until then)
    pub close_price: Option<U128>,
}

/// A pointer to a round a learner has a call in (kept until it is settled).
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CallRef {
    pub token_id: String,
    pub round: u64,
}

/// What the app shows on a trade card.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct RoundView {
    pub token_id: String,
    pub round: u64,
    pub seconds_left: u64,
    /// calls are accepted now (inside the window of the current round)
    pub open: bool,
    pub settled: bool,
    pub close_price: Option<U128>,
    pub more_stake: U128,
    pub same_stake: U128,
    pub less_stake: U128,
    pub calls: Vec<PriceCall>,
}

/// One of the caller's calls, with its outcome once settled.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MyCall {
    pub token_id: String,
    pub round: u64,
    pub side: Side,
    pub stake: U128,
    pub open_price: U128,
    pub settled: bool,
    pub close_price: Option<U128>,
    /// after settlement: what came back to the account (stake + winnings; the stake alone when nobody was right; 0 on a loss)
    pub paid: Option<U128>,
}

fn rounds_map() -> LookupMap<String, CallRound> {
    LookupMap::new(CallsKey::Rounds)
}
fn open_map() -> LookupMap<AccountId, Vec<CallRef>> {
    LookupMap::new(CallsKey::Open)
}
fn round_key(token_id: &str, round: u64) -> String {
    format!("{token_id}|{round}")
}

pub fn round_at(timestamp_ns: u64) -> u64 {
    timestamp_ns / (ROUND_SECONDS * NS)
}
fn seconds_into_round(timestamp_ns: u64) -> u64 {
    (timestamp_ns % (ROUND_SECONDS * NS)) / NS
}

/// How a settled round pays each call, in the order of `calls`. Pure, so it is tested without a chain.
/// Returns the amount each call gets back: stake + a pro-rata share of the wrong sides' stakes when right, 0 when
/// wrong, and the stake alone for everyone when nobody in the round was right (there is no one to pay).
pub fn payouts(calls: &[PriceCall], close: u128) -> Vec<u128> {
    let right = |c: &PriceCall| outcome(c.open_price.0, close) == c.side;
    let winners_stake: u128 = calls.iter().filter(|c| right(c)).map(|c| c.stake.0).sum();
    if winners_stake == 0 {
        return calls.iter().map(|c| c.stake.0).collect();
    }
    let losers_stake: u128 = calls.iter().filter(|c| !right(c)).map(|c| c.stake.0).sum();
    calls
        .iter()
        .map(|c| {
            if right(c) {
                // integer division: dust stays in the pool rather than overpaying
                c.stake.0.saturating_add(losers_stake.saturating_mul(c.stake.0) / winners_stake)
            } else {
                0
            }
        })
        .collect()
}

#[near]
impl Contract {
    /// Stake gold on Bloq's buy price for `token_id` being higher (More), unchanged (Same) or lower (Less) at the end
    /// of the current round. Caller: a registered learner. One call per item per round; MIN_STAKE..=MAX_STAKE gold;
    /// only inside the window.
    pub fn place_call(&mut self, token_id: String, side: Side, stake: U128) -> CallRef {
        let learner = env::predecessor_account_id();
        require!(self.learners.contains(&learner), "Not a registered learner");
        require!(ITEMS.contains(&token_id.as_str()), "Only items have a price");
        require!(stake.0 >= MIN_STAKE && stake.0 <= MAX_STAKE, "Stake between 10 and 50 gold");
        let now = env::block_timestamp();
        require!(seconds_into_round(now) < CALL_WINDOW_SECONDS, "This round is closing; call in the next one");
        require!(self.balance_of(GOLD, &learner) >= stake.0, "Not enough gold");
        let round = round_at(now);
        let key = round_key(&token_id, round);
        let mut rounds = rounds_map();
        let mut r = rounds.get(&key).cloned().unwrap_or_default();
        require!(!r.settled, "This round is settled");
        require!(r.calls.len() < MAX_CALLS_PER_ROUND, "This round is full; call in the next one");
        require!(!r.calls.iter().any(|c| c.account_id == learner), "One call per item per round");

        self.settle_shipping();
        let open_price = pricing::buy_price(&self.pricing, self.balance_of(&token_id, &self.bloq_id));
        // the stake moves to this contract's own account until settlement; nobody can move it from there by hand
        self.move_tokens(&learner, &env::current_account_id(), GOLD, stake.0, "price call stake");
        r.calls.push(PriceCall { account_id: learner.clone(), side, stake, open_price: U128(open_price) });
        rounds.insert(key, r);
        rounds.flush();

        let mut open = open_map();
        let mut mine = open.get(&learner).cloned().unwrap_or_default();
        let r#ref = CallRef { token_id: token_id.clone(), round };
        if !mine.contains(&r#ref) {
            mine.push(r#ref.clone());
        }
        open.insert(learner.clone(), mine);
        open.flush();

        log_event(
            "price_call",
            &near_sdk::serde_json::json!({ "account_id": learner, "token_id": token_id, "round": round, "side": side, "stake": stake, "open_price": U128(open_price) }),
        );
        r#ref
    }

    /// Settle a finished round of calls on `token_id`: read Bloq's buy price now, pay every call by `payouts`.
    /// Anyone may call it (the relayer does, a minute after each round ends); the second call changes nothing.
    pub fn settle_calls(&mut self, token_id: String, round: u64) -> Option<U128> {
        require!(ITEMS.contains(&token_id.as_str()), "Only items have a price");
        require!(round < round_at(env::block_timestamp()), "The round is still running");
        let key = round_key(&token_id, round);
        let mut rounds = rounds_map();
        let mut r = match rounds.get(&key) {
            Some(r) => r.clone(),
            None => return None, // no calls that round: nothing to settle, nothing stored
        };
        if r.settled {
            return r.close_price;
        }
        self.settle_shipping();
        let close = pricing::buy_price(&self.pricing, self.balance_of(&token_id, &self.bloq_id));
        let paid = payouts(&r.calls, close);
        let pool: &AccountId = &env::current_account_id();
        let mut open = open_map();
        for (c, amount) in r.calls.iter().zip(paid.iter()) {
            if *amount > 0 {
                self.move_tokens(pool, &c.account_id, GOLD, *amount, "price call settled");
            }
            if let Some(mut mine) = open.get(&c.account_id).cloned() {
                mine.retain(|x| !(x.token_id == token_id && x.round == round));
                open.insert(c.account_id.clone(), mine);
            }
        }
        open.flush();
        r.settled = true;
        r.close_price = Some(U128(close));
        let winners = r.calls.iter().zip(paid.iter()).filter(|(c, a)| **a > c.stake.0).count();
        log_event(
            "calls_settled",
            &near_sdk::serde_json::json!({ "token_id": token_id, "round": round, "close_price": U128(close), "calls": r.calls.len(), "winners": winners, "paid": U128(paid.iter().sum::<u128>()) }),
        );
        rounds.insert(key, r);
        rounds.flush();
        Some(U128(close))
    }

    /// The current round for `token_id`: the calls so far, both sides' stakes, and whether calls are open now.
    pub fn get_price_calls(&self, token_id: String, round: Option<u64>) -> RoundView {
        let now = env::block_timestamp();
        let current = round_at(now);
        let round = round.unwrap_or(current);
        let r = rounds_map().get(&round_key(&token_id, round)).cloned().unwrap_or_default();
        let into = seconds_into_round(now);
        RoundView {
            token_id,
            round,
            seconds_left: if round == current { ROUND_SECONDS.saturating_sub(into) } else { 0 },
            open: round == current && into < CALL_WINDOW_SECONDS,
            settled: r.settled,
            close_price: r.close_price,
            more_stake: U128(r.calls.iter().filter(|c| c.side == Side::More).map(|c| c.stake.0).sum()),
            same_stake: U128(r.calls.iter().filter(|c| c.side == Side::Same).map(|c| c.stake.0).sum()),
            less_stake: U128(r.calls.iter().filter(|c| c.side == Side::Less).map(|c| c.stake.0).sum()),
            calls: r.calls,
        }
    }

    /// The caller's calls that are not settled yet, plus the last settled one per item it took part in (from `rounds`).
    pub fn get_my_calls(&self, account_id: AccountId, rounds: Option<Vec<CallRef>>) -> Vec<MyCall> {
        let mut refs = open_map().get(&account_id).cloned().unwrap_or_default();
        for r in rounds.unwrap_or_default() {
            if !refs.contains(&r) {
                refs.push(r);
            }
        }
        let map = rounds_map();
        refs.iter()
            .filter_map(|r| {
                let round = map.get(&round_key(&r.token_id, r.round))?;
                let idx = round.calls.iter().position(|c| c.account_id == account_id)?;
                let c = &round.calls[idx];
                let paid = round.close_price.map(|close| U128(payouts(&round.calls, close.0)[idx]));
                Some(MyCall { token_id: r.token_id.clone(), round: r.round, side: c.side, stake: c.stake, open_price: c.open_price, settled: round.settled, close_price: round.close_price, paid })
            })
            .collect()
    }

    /// The round clock: current round, seconds left, whether calls are open. Same for every item.
    pub fn get_call_round(&self) -> (u64, u64, bool) {
        let now = env::block_timestamp();
        let into = seconds_into_round(now);
        (round_at(now), ROUND_SECONDS.saturating_sub(into), into < CALL_WINDOW_SECONDS)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use Side::{Less, More, Same};

    fn call(acc: &str, side: Side, stake: u128, open: u128) -> PriceCall {
        PriceCall { account_id: acc.parse().unwrap(), side, stake: U128(stake), open_price: U128(open) }
    }

    #[test]
    fn winners_split_the_wrong_sides_stakes_pro_rata_and_keep_their_own() {
        let calls = vec![call("a.near", More, 30, 44), call("b.near", More, 10, 44), call("c.near", Less, 20, 44), call("d.near", Same, 20, 44)];
        // price went up: a and b were right; c and d lose 40 between them; a gets 3/4 of it, b 1/4
        assert_eq!(payouts(&calls, 45), vec![30 + 30, 10 + 10, 0, 0]);
        // price went down: c wins the 60 the others staked
        assert_eq!(payouts(&calls, 43), vec![0, 0, 20 + 60, 0]);
        // nothing moved: d, who called "same", wins the 60
        assert_eq!(payouts(&calls, 44), vec![0, 0, 0, 20 + 60]);
    }

    #[test]
    fn when_nobody_was_right_everyone_gets_the_stake_back() {
        let calls = vec![call("a.near", More, 30, 44), call("b.near", Less, 10, 44)];
        assert_eq!(payouts(&calls, 44), vec![30, 10]); // it stayed the same and nobody said so
        assert_eq!(payouts(&[call("a.near", More, 30, 44)], 45), vec![30]); // a lonely winner: nothing to share
        assert_eq!(payouts(&[call("a.near", More, 30, 44)], 43), vec![30]); // a lonely loser: no winner to pay
    }

    #[test]
    fn each_call_is_judged_against_its_own_open_price() {
        let calls = vec![call("a.near", More, 10, 42), call("b.near", More, 10, 46)];
        // close 44: a was right (42 -> 44), b was wrong (46 -> 44); b's 10 goes to a
        assert_eq!(payouts(&calls, 44), vec![20, 0]);
        assert_eq!(outcome(44, 44), Same);
        assert_eq!(outcome(44, 45), More);
        assert_eq!(outcome(44, 40), Less);
    }

    #[test]
    fn integer_division_leaves_dust_in_the_pool_never_overpays() {
        let calls = vec![call("a.near", More, 10, 44), call("b.near", More, 10, 44), call("c.near", More, 10, 44), call("d.near", Less, 10, 44)];
        let paid = payouts(&calls, 45);
        assert_eq!(paid, vec![13, 13, 13, 0]);
        assert!(paid.iter().sum::<u128>() <= 40);
    }

    #[test]
    fn rounds_are_ten_minutes_and_the_window_is_the_first_seven() {
        let ten_min = ROUND_SECONDS * NS;
        assert_eq!(round_at(0), 0);
        assert_eq!(round_at(ten_min - 1), 0);
        assert_eq!(round_at(ten_min), 1);
        assert_eq!(seconds_into_round(ten_min + 419 * NS), 419);
        assert!(seconds_into_round(ten_min + 419 * NS) < CALL_WINDOW_SECONDS);
        assert!(seconds_into_round(ten_min + 420 * NS) >= CALL_WINDOW_SECONDS);
    }
}
