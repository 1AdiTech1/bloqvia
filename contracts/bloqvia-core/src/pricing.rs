//! Bloq's price rule. This is the ONE file that decides how the merchant prices
//! items. It is pure arithmetic with no state, so it is easy to read, test and
//! simulate. The UI shows this rule in a tooltip next to every price.
//!
//! Rule
//! ----
//! Bloq pays less for an item the more of it he already holds:
//!
//! ```text
//! buy_price(stock)  = base_price * stock_halving / (stock_halving + stock)
//! sell_price(stock) = buy_price(stock) * (10_000 + spread_bps) / 10_000
//! ```
//!
//! * `buy_price`  is what Bloq pays a player who sells him one item.
//! * `sell_price` is what Bloq charges a player who buys one item from him.
//! * At `stock == 0` Bloq pays the full `base_price`.
//! * At `stock == stock_halving` Bloq pays half of it.
//! * The shop closes when Bloq's gold drops below `treasury_floor`.
//!
//! Everything else in the economy (what quests mint, what graduation costs)
//! reads prices from here. Nobody can change the parameters after `new()`.

use near_sdk::json_types::U128;
use near_sdk::near;

/// Parameters fixed at contract initialisation. Readable by anyone through
/// `get_pricing()`. There is no method that changes them afterwards.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PricingParams {
    /// Gold Bloq pays for one item when his stock of it is zero.
    pub base_price: U128,
    /// Stock level at which Bloq's buy price halves.
    pub stock_halving: U128,
    /// Markup Bloq adds when selling, in basis points (250 = 2.5%).
    pub spread_bps: u32,
    /// Bloq closes his shop when his gold is below this.
    pub treasury_floor: U128,
}

/// What Bloq pays for ONE unit of an item given his current stock of it.
pub fn buy_price(params: &PricingParams, stock: u128) -> u128 {
    let base = params.base_price.0;
    let halving = params.stock_halving.0.max(1);
    // base * halving / (halving + stock); all values are u128, overflow-checked in release.
    base.saturating_mul(halving) / (halving.saturating_add(stock))
}

/// What Bloq charges for ONE unit of an item given his current stock of it.
pub fn sell_price(params: &PricingParams, stock: u128) -> u128 {
    let buy = buy_price(params, stock);
    buy.saturating_mul(10_000u128 + params.spread_bps as u128) / 10_000u128
}

/// Total gold for `amount` units sold to Bloq, priced unit by unit as his
/// stock rises with every unit (so a large sale moves the price against the
/// seller, as it should).
pub fn buy_total(params: &PricingParams, stock: u128, amount: u128) -> u128 {
    let mut total = 0u128;
    for i in 0..amount {
        total = total.saturating_add(buy_price(params, stock.saturating_add(i)));
    }
    total
}

/// Total gold for `amount` units bought from Bloq, priced unit by unit as his
/// stock falls with every unit.
pub fn sell_total(params: &PricingParams, stock: u128, amount: u128) -> u128 {
    let mut total = 0u128;
    for i in 0..amount {
        let s = stock.saturating_sub(i.saturating_add(1));
        total = total.saturating_add(sell_price(params, s));
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params() -> PricingParams {
        PricingParams {
            base_price: U128(100),
            stock_halving: U128(10),
            spread_bps: 250,
            treasury_floor: U128(500),
        }
    }

    #[test]
    fn full_price_at_zero_stock() {
        assert_eq!(buy_price(&params(), 0), 100);
    }

    #[test]
    fn half_price_at_halving_stock() {
        assert_eq!(buy_price(&params(), 10), 50);
    }

    #[test]
    fn price_falls_as_stock_rises() {
        let p = params();
        let mut last = u128::MAX;
        for stock in 0..50 {
            let price = buy_price(&p, stock);
            assert!(price <= last, "price must never rise with stock");
            last = price;
        }
    }

    #[test]
    fn sell_price_carries_the_spread() {
        let p = params();
        assert_eq!(sell_price(&p, 0), 102); // 100 * 10250 / 10000 = 102 (integer)
        assert!(sell_price(&p, 5) > buy_price(&p, 5));
    }

    #[test]
    fn totals_price_unit_by_unit() {
        let p = params();
        // Selling 3 units from stock 0: 100 + 90 + 83 (integer division) = 273
        assert_eq!(buy_total(&p, 0, 3), 100 + 90 + 83);
        // Buying 2 units when stock is 2: priced at stock 1 then stock 0.
        assert_eq!(sell_total(&p, 2, 2), sell_price(&p, 1) + sell_price(&p, 0));
    }

    #[test]
    fn halving_of_zero_is_treated_as_one() {
        let mut p = params();
        p.stock_halving = U128(0);
        assert_eq!(buy_price(&p, 0), 100);
        assert_eq!(buy_price(&p, 1), 50);
    }
}
