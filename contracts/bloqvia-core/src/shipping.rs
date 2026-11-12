//! Bloq ships his surplus (Nov 12).
//!
//! Without this, every item a player earns ends up in Bloq's stock and never leaves (selling
//! and graduation both hand items to him), so his prices slide forever and a full set, which
//! is what graduation costs, gets cheaper every day while the quests keep paying the same gold.
//!
//! The rule: every hour Bloq sends to Network City a share of what he holds **above** the
//! curve's midpoint (`stock_halving`, 40 on testnet): `SHARE_BPS` of the surplus, at least one
//! item while there is any surplus. Items below the midpoint never ship. The shipped items are
//! burned; nobody receives them and Bloq is paid nothing for them. Prices therefore drift back
//! toward the midpoint (50 gold at 40 of each on testnet) at a pace of a few items an hour,
//! small enough that no hour's step is a free price call, steady enough that a week of selling
//! cannot bury the price.
//!
//! It is settled lazily: a view shows the stock as if the hours since the last settlement had
//! already shipped (`stock_now`), and the next write that touches a price (a trade, a
//! graduation, a price call, a settlement) burns exactly that amount first. No owner method,
//! no parameter anyone can change; the schedule is time read from the chain.
//!
//! The last settlement time is stored under its own storage key, outside the contract struct,
//! so adding the rule to the deployed contract needed no state migration.

use near_sdk::env;

/// One shipping period: an hour.
pub const PERIOD_NS: u64 = 3_600 * 1_000_000_000;
/// Share of the surplus shipped per period, in basis points (400 = 4 %; about 62 % of a surplus in a day).
pub const SHARE_BPS: u128 = 400;
/// The last settlement, as a block timestamp in nanoseconds (little-endian u64). Absent before the first write.
const LAST_KEY: &[u8] = b"ship:last_ns";

/// How many of `surplus` items ship in `periods` periods: each period takes SHARE_BPS of what is
/// left, at least one while anything is left. Pure; the loop ends when the surplus is gone.
pub fn shipped(surplus: u128, periods: u64) -> u128 {
    let mut left = surplus;
    for _ in 0..periods {
        if left == 0 {
            break;
        }
        let share = (left.saturating_mul(SHARE_BPS) / 10_000).max(1);
        left = left.saturating_sub(share);
    }
    surplus.saturating_sub(left)
}

/// What one item's stock is now, given the stock on record, the midpoint and the periods elapsed.
pub fn stock_after(stock: u128, midpoint: u128, periods: u64) -> u128 {
    if stock <= midpoint || periods == 0 {
        return stock;
    }
    stock - shipped(stock - midpoint, periods)
}

pub fn last_settled_ns() -> Option<u64> {
    env::storage_read(LAST_KEY).and_then(|b| b.try_into().ok()).map(u64::from_le_bytes)
}

pub fn write_last_settled_ns(ns: u64) {
    env::storage_write(LAST_KEY, &ns.to_le_bytes());
}

/// Whole periods elapsed since the last settlement, and the timestamp that settlement advances to
/// (the remainder of a period is kept, so the schedule does not drift with the timing of trades).
pub fn periods_due(now: u64) -> (u64, u64) {
    match last_settled_ns() {
        None => (0, now),
        Some(last) if now <= last => (0, last),
        Some(last) => {
            let periods = (now - last) / PERIOD_NS;
            (periods, last + periods * PERIOD_NS)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_share_an_hour_at_least_one() {
        assert_eq!(shipped(0, 24), 0);
        assert_eq!(shipped(10, 0), 0);
        assert_eq!(shipped(10, 1), 1); // 4 % of 10 rounds to 0: at least one ships
        assert_eq!(shipped(100, 1), 4);
        assert_eq!(shipped(100, 2), 4 + 3); // 4 % of 96 = 3.84 -> 3
        assert_eq!(shipped(10, 10), 10); // one an hour until it is gone
        assert_eq!(shipped(10, 100), 10); // never below zero
    }

    #[test]
    fn a_day_takes_most_of_a_surplus_and_nothing_below_the_midpoint() {
        let day = shipped(1_000, 24);
        assert!(day > 600 && day < 650, "{day}"); // 1 - 0.96^24 = 62.5 %
        assert_eq!(stock_after(40, 40, 24), 40);
        assert_eq!(stock_after(12, 40, 24), 12);
        assert_eq!(stock_after(62, 40, 1), 61); // 22 over: one ships this hour
        assert_eq!(stock_after(62, 40, 24), 40); // 22 over, an hour each: all gone in a day
    }
}
