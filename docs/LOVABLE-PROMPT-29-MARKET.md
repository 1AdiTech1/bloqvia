# Lovable prompt 29 — the market never sleeps (Nov 10)

Approved mock-up: `docs/design/market/index.html` (press **▶ Watch a day of trading** in it to see the motion). Three
additions to Bloq's shop, phone and desktop; the data and the visuals already exist on our side:

- `useMarket()` from `@/near` — the relayer's price snapshots (48 h), the NPC trader's last move, the fast-forward's state.
- `<PriceHistory points change />` from `@/bloq` — the "He pays · 24 h" curve for one item.

**Most important rule (as in prompts 21 to 28): don't remove or change anything this prompt doesn't name.** Only
`src/pages/ShopPage.tsx` and `src/styles.css` change. Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or
`public/`. Strict TypeScript as before.

## 1. Every trade card: "He pays · 24 h"

In `ShopInner`, once: `const market = useMarket();`. Pass `market` to each `<TradeCard … market={market} />` (new prop
`market: Market` from `@/near`).

In `TradeCard`, right after the `lab-trade-prices` grid (before the quantity row), add:

```tsx
<PriceHistory points={market.history(id)} change={market.change(id)} className="mt-3" />
```

`id` is the card's `price.token_id`, already typed `ItemId`. The component is self-contained (its own label, colours and
"collecting…" state); no wrapper, no extra styles. On desktop the three cards are narrow: the component stacks its
label above the curve by itself.

## 2. The stall: "Market · live"

Under the `treasury` row inside `.lab-stall`, add the strip from the mock (the mock's `.market` block, same classes,
appended to the stall's styles in `src/styles.css`):

```tsx
<div className="market">
  <div className="k"><i aria-hidden="true" />Market · live</div>
  <div className="line">{traderLine}<small>{traderMeta}</small></div>
  <div className="ff">
    <Press onClick={() => void fastForward()} disabled={!!ff?.running} className="ffbtn">{ff?.running ? "Trading…" : ff?.finishedAt && !ffNote ? "✓ Watched" : "▶ Watch a day of trading"}</Press>
    <div className="prog" aria-hidden="true"><i style={{ width: `${ff ? (ff.round / ff.rounds) * 100 : 0}%` }} /></div>
    <span className="ffnote">{ffNote}</span>
  </div>
</div>
```

With, in `ShopInner`:

```tsx
const ff = market.fastForward, trader = market.trader;
const [ffNote, setFfNote] = useState<string>("six learners sign up and trade for a couple of minutes");
const fastForward = async () => {
  const why = await market.startFastForward();
  setFfNote(why ?? "starting: six learners are signing up…");
};
const last = ff?.log.length ? ff.log[ff.log.length - 1] : null;
const traderLine = ff?.running && last
  ? <><b>{last.who}</b> {last.text}.</>
  : trader?.last
    ? <>The trader {trader.last.kind === "sell" ? "sold" : "bought"} <b>{trader.last.amount} {itemLabel(trader.last.token_id)}</b> {trader.last.kind === "sell" ? "to" : "from"} Bloq for {trader.last.price} gold.</>
    : trader?.on ? <>The trader is watching the prices: it sells above {trader.rules.sellAbove} gold and buys below {trader.rules.buyBelow}.</> : <>Bloq trades with whoever comes by. Prices follow one rule, in the contract.</>;
const traderMeta = ff?.running
  ? `fast-forward · round ${ff.round} of ${ff.rounds} · live on testnet`
  : trader?.last
    ? `${trader.accountId} · ${ago(trader.last.at)} · every trade on the explorer`
    : trader?.on ? `${trader.accountId} · next look in ${trader.rules.intervalMin} min` : "";
```

While a run is on, `ffNote` shows progress: in a `useEffect` on `[ff?.round, ff?.running, ff?.finishedAt, ff?.error]`
set it to `round ${ff.round} of ${ff.rounds} · ${last.who} ${last.text}` while running, to
`done · a day of trading · next run in ${ff.everyMin} min` when `finishedAt` is set, and to `ff.error`
if there is one. `ago(ms)` is the same helper the Chain panel uses ("just now", "3 min ago") — copy it, don't import
across pages. `itemLabel` is already imported from `@/components/GameBits`. When `market.data` is null (the relayer not
reachable), render the strip with the neutral line and the button disabled.

The trader's meta line is a link when there is a transaction: wrap `${trader.accountId}` in
`<a href={explorer.account(trader.accountId)} target="_blank" rel="noopener noreferrer">` (`explorer` from `@/near`),
and the fast-forward's `last.txHash`, when present, the same way with `explorer.tx(last.txHash)` on the word "explorer".

## 3. Styles (`src/styles.css`, appended to the `.lab-stall` block)

Copy the mock's rules for `.market`, `.market .k`, `.market .k i` (with its `pulse` keyframes; use the existing
`lv-pulse` keyframes instead of adding new ones), `.market .line`, `.market .line b`, `.market .line small`, `.ff`,
`.ffbtn`, `.ffbtn[disabled]`, `.ffnote`, `.prog`, `.prog i`. Reduced motion: no pulse, the bar still fills.

## Confirm when done

- Shop on a phone and on desktop: each card shows the curve with "He pays · 24 h" and the change ("collecting…" on a
  fresh relayer); the stall shows "Market · live" with the trader's last move and the button.
- Press the button: it reads "Trading…", the bar fills over six rounds (about two minutes), the line names the learners' moves, the
  curves and the treasury move; at the end "✓ Watched" and the note says when the next run is allowed. Press again
  within 10 minutes: the note shows the relayer's reason, nothing else changes.
- Motion off: no pulse; everything else the same.
- List every file you changed (it should be only the two named).
