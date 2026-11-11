# Lovable prompt 33 — the price call as its own card, round buttons, the info popover

Only `src/pages/ShopPage.tsx` changes. Mock: `docs/design/price-call/buttons.html` (section 1 the
desktop layout with the (i) panel open, section 2 the phone, section 3 every other state). Everything prompt 32 built keeps working; this moves
it, redraws three buttons, fixes two sentences and one popover. Don't remove or change anything this
prompt doesn't name.

## 1 · The price call leaves the trade card

Today the price call block renders inside `TradeCard`, after `<PriceHistory …/>`. Move it out: the
trade card ends with the "He pays · 24 h" curve and its Sell/Buy row, as before prompt 32, and the
price call becomes a **sibling card right under each trade card**.

In `ShopInner`, the three cards are rendered as

```tsx
<div className="mt-5 flex flex-col gap-3 dk:grid dk:grid-cols-3">
  {bloq.prices.map((p) => <TradeCard … />)}
</div>
```

Make each entry a column holding both cards:

```tsx
<div className="mt-5 flex flex-col gap-3 dk:grid dk:grid-cols-3">
  {bloq.prices.map((p) => (
    <div key={p.token_id} className="flex min-w-0 flex-col gap-3">
      <TradeCard price={p} have={…} gold={…} shopOpen={…} onTraded={onTraded} market={market} />
      <PriceCallCard tokenId={p.token_id as ItemId} />
    </div>
  ))}
</div>
```

`PriceCallCard` is a new component in the same file. Move into it, unchanged, everything the price
call needs from `TradeCard`: `const c = useCalls()`, `stake`, `seenRound`, `tried`, the local clock
(`left` and its two effects), `mine`, `result`, `showResult`, `k`, `closed`, `clock`, `place`, and the
whole JSX that today sits in `{c.enabled && ( … )}`. It also needs `const game = useGame()` for the
`game.busy` checks. `TradeCard` goes back to what it was before prompt 32 (no `useCalls`, no call
state), apart from section 4 below.

The card itself, when `c.enabled` (otherwise render nothing):

```tsx
<section className="relative grid gap-2.5 rounded-3xl border border-purple/20 p-4 text-navy shadow-lift"
  style={{ background: "linear-gradient(rgb(139 69 217 / .07), rgb(139 69 217 / .07)), #f7f4eb" }}>
```

— the same radius (`rounded-3xl`) and shadow (`shadow-lift`) as the trade card above it, the ivory
ground with the purple tint on top, so the two read as a pair. Inside, the header row ("Price call"
+ the clock), the question, the buttons, the stake, the crowd line, the states B/C/D and the error
box are exactly as built.

## 2 · The three buttons: round, icons only (mock "2 · round")

Replace the `grid grid-cols-3 gap-2` of the three `Press` buttons with:

```tsx
<div className="grid grid-cols-3 justify-items-center gap-2">
  <Press aria-label="More" disabled={closed || c.busy || game.busy} onClick={() => place("More")}
    className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lime shadow-[0_10px_20px_-12px_rgb(22_36_58/.8)] hover:bg-navy-2 disabled:opacity-50"><ArrowMore /></Press>
  <Press aria-label="Same" disabled={closed || c.busy || game.busy} onClick={() => place("Same")}
    className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-navy/35 bg-card text-navy hover:bg-lavender-soft disabled:opacity-50"><ArrowSame /></Press>
  <Press aria-label="Less" disabled={closed || c.busy || game.busy} onClick={() => place("Less")}
    className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-navy bg-card text-navy hover:bg-lavender-soft disabled:opacity-50"><ArrowLess /></Press>
</div>
<div className="-mt-1 grid grid-cols-3 text-center font-mono text-[10.5px] text-muted-foreground" aria-hidden="true"><span>more</span><span>same</span><span>less</span></div>
```

If `hover:bg-navy-2` is not a token in this project, use `hover:bg-navy/90`. The three arrows are
small components at the bottom of the file (drawn, not typed; 26 px):

```tsx
const ARROW = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ArrowMore = () => <svg {...ARROW}><path d="M4 17l6-6 4 4 6-6" /><path d="M14 9h6v6" /></svg>;
const ArrowSame = () => <svg {...ARROW}><path d="M4 12h15" /><path d="m14 7 5 5-5 5" /></svg>;
const ArrowLess = () => <svg {...ARROW}><path d="M4 7l6 6 4-4 6 6" /><path d="M20 9v6h-6" /></svg>;
```

The same arrows replace the typed glyphs everywhere else in the block: in state B, "Your call:
**same**, from 44" becomes `Your call: <b className="inline-flex items-center gap-1 align-middle font-display font-semibold"><ArrowSame … at 14 px/> same</b>, from 44`
(render the matching arrow for the side, with `width={14} height={14}` overriding the defaults).
The stake stepper, the crowd line, the LabLoader while busy, and the `opacity-45` wrapper in state D
stay as they are (the wrapper now contains the round buttons and the words).

## 3 · The result sentences (state C): right with nobody wrong

Today `resultLine` says "Nobody was right: 20 gold back" whenever `paid === stake`. That is also what
a player sees when they **were right but nobody was on a wrong side** (the stake comes back because
there were no losers' stakes to split). Tell the two apart from the call itself:

```tsx
const outcomeOf = (open: string, close: string | null): CallSide | null => {
  if (close === null) return null;
  const o = BigInt(open), c = BigInt(close);
  return c > o ? "More" : c < o ? "Less" : "Same";
};
function resultLine(r: MyCall): string {
  const paid = Number(r.paid ?? 0), stake = Number(r.stake);
  const right = outcomeOf(r.open_price, r.close_price) === r.side;
  if (paid > stake) return `You called it: +${paid - stake} gold`;
  if (r.paid === "0") return `Not this time: −${r.stake} gold`;
  if (right) return `You called it: ${r.stake} gold back`;
  return `Nobody was right: ${r.stake} gold back`;
}
function resultSub(r: MyCall): string {
  const paid = Number(r.paid ?? 0), stake = Number(r.stake);
  const right = outcomeOf(r.open_price, r.close_price) === r.side;
  if (paid > stake) return `your ${r.stake} back plus ${paid - stake} of the wrong sides' stakes`;
  if (r.paid === "0") return `the stake went to the right side`;
  if (right) return `nobody was on a wrong side, so there was nothing to win`;
  return `everyone got the stake back`;
}
```

`MyCall.close_price` is `string | null` and `MyCall.side` is `CallSide` (see `src/near/types.ts`).
The mono sub-line keeps its `open → close · ` prefix.

## 4 · The info popover on the trade card (a rule for the whole app)

Rule: an (i) button never pushes a card's content down. The text opens in a **panel over the card**,
the way the Community streak card does it (`src/components/lab/StreakCard.tsx`, the `info` panel):
absolute, `z-30`, `bq-pop`, closes on a tap outside, on Escape, and on the button again. Today the
shop's trade card is the one place that still expands inline; fix it the same way:

- `TradeCard`'s `<article>` gets `relative` added to its classes.
- Replace the `onBlur={() => setTip(false)}` on the (i) button with the Streak pattern: refs
  `tipBtn` / `tipPanel`, an effect that listens for `pointerdown` outside both and for `Escape`
  (copy the `info` effect from StreakCard; on Escape also refocus the button). Keep `aria-expanded`,
  add `aria-controls={\`price-tip-${id}\`}`.
- Replace the `<AnimatePresence>{tip && <motion.div … height …>}</AnimatePresence>` with:

```tsx
{tip && (
  <div ref={tipPanel} id={`price-tip-${id}`} role="dialog" aria-label="How prices work"
    className="bq-pop absolute left-[10px] right-[10px] top-[64px] z-30 rounded-[18px] bg-card px-4 py-3 text-sm leading-relaxed text-navy shadow-[0_22px_50px_rgb(0_0_0/.35),0_0_0_1px_#e3dccb]">
    Bloq pays less for what he already has a lot of: price = 100 × 40 ÷ (40 + his stock). Nobody can change this rule by hand.
  </div>
)}
```

The sentence is unchanged. If `AnimatePresence`/`motion` are then unused in `TradeCard`, keep the
imports (they are used elsewhere in the file).

## Confirm

- Desktop: three columns; in each, the trade card (ending with the curve and Sell/Buy) and under it
  the price call card with three round buttons and the words under them.
- Phone: trade card, its price call card, next trade card, and so on.
- (i) on a trade card: the text floats over the card; the prices don't move; a tap anywhere else
  closes it.
- A settled "Same" call on an unmoved price with no other callers reads "You called it: 20 gold
  back · 43 → 43 · nobody was on a wrong side, so there was nothing to win".
- `src/pages/ShopPage.tsx` is the only file changed; list every file you changed.
