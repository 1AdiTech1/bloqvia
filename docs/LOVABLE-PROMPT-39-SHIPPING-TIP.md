# Lovable prompt 39 — the shop's price tip learns the shipping rule

Only `src/pages/ShopPage.tsx` changes, one sentence. Don't remove or change anything this prompt
doesn't name.

In `TradeCard`, the floating "How prices work" panel (the `tip` dialog) reads today:

> Bloq pays less for what he already has a lot of: price = 100 × 40 ÷ (40 + his stock). Nobody can change this rule by hand.

Make it:

> Bloq pays less for what he already has a lot of: price = 100 × 40 ÷ (40 + his stock). Every hour he ships part of what he holds above 40, so a price that fell comes back by itself. Nobody can change either rule by hand.

Nothing else: same element, same classes, same behaviour.

## Confirm

- Tap (i) on a trade card: the panel floats as before and carries the three sentences.
- `src/pages/ShopPage.tsx` is the only file changed; list every file you changed.
