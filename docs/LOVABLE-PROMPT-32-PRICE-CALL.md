# Lovable prompt 32 — the price call, and three traders (Nov 11)

Two additions on Bloq's shop. The mock is `docs/design/price-call/index.html` (open it: four states of the new block).
Everything is already in the hooks from `@/near`:

```ts
const c = useCalls();                 // src/near/useCalls.ts
c.loaded, c.enabled                   // enabled false → render nothing of section 1 (an older core)
c.round                               // { round, secondsLeft, open } | null — the clock, same for every item
c.rounds[item]                        // CallRound | undefined: { more_stake, same_stake, less_stake, calls, settled, close_price, open, seconds_left }
c.mineFor(item)                       // MyCall | null: my call in the current round ({ side, stake, open_price })
c.lastResultFor(item)                 // MyCall | null: my most recent settled call on that item ({ side, stake, open_price, close_price, paid })
await c.place(item, "More" | "Same" | "Less", stake)   // relayed; throws with the chain's message; c.busy while it runs
c.error, c.clearError()
crowd(c.rounds[item])                 // { more, same, less (percent), gold, calls } | null
crowdLeans(crowd(...))                // { side, pct } | null
CALL_STAKE                            // { min: 10, max: 50, default: 20 }
```

and in `useMarket()`: `m.traders` (array of the traders that are on, each with `temper` "patient" | "bull" | "bear",
`temperLine`, `last`, `lastThought`) next to the existing `m.trader` (the one that looked last).

**Most important rule (as in prompts 21 to 31): don't remove or change anything this prompt doesn't name.** Only
`src/pages/ShopPage.tsx` changes. Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict
TypeScript as before. Phone and desktop.

## 1. The price call block, on every trade card

In `TradeCard`, right under the `<PriceHistory …>` line, a new block, rendered only when `c.enabled` (take `const c =
useCalls()` at the top of `TradeCard`; the store is shared). Style: `mt-3 rounded-2xl border border-purple/20
bg-purple/5 p-3 grid gap-2` (the mock's `.call`: a faint purple field inside the ivory card).

Header row (`flex justify-between items-baseline`): **Price call** in `text-[10.5px] font-semibold uppercase
tracking-[0.16em] text-purple-700` (the mock's purple-d `#6630b3`; use the closest existing token or an arbitrary
value) and, right-aligned in `font-mono text-[10.5px] text-muted-foreground`, the clock: `m:ss left` from
`c.round.secondsLeft` while `c.round.open`, `m:ss to go` when the window is closed, `settled` in the result state.
Count the seconds down locally between polls (a 1 s interval in the component, from `secondsLeft`), so the clock moves.

Then one of four states, by priority:

**C — a result to show** (`c.lastResultFor(id)` exists and its `round` is newer than the last one this card dismissed;
keep a `seenRound` state per card): a line in `font-display text-[15px] font-semibold`:
`You called it: +{paid − stake} gold` when `paid > stake`; `Not this time: −{stake} gold` when `paid === "0"`;
`Nobody was right: {stake} gold back` when `paid === stake`; under it in `font-mono text-[10.5px] text-muted-foreground`:
`{open_price} → {close_price} · ` + (`your {stake} back plus {paid − stake} of the wrong sides' stakes` | `the stake went
to the right side` | `everyone got the stake back`). A ghost `Press` **OK** (`text-xs`) marks it seen (sets
`seenRound` to that round) and the block falls through to A, B or D. Show a result at most once.

**B — my call is in** (`c.mineFor(id)`): `Your call: **{more|same|less}**, from {open_price}` (`text-[13px]`, the
side in `font-display font-semibold`) with a `rounded-full bg-lavender-soft px-3 py-1 text-xs font-semibold` pill
`settles in m:ss` (the clock); under it the crowd line (section 2).

**D — the window is closed** (`c.round && !c.round.open`): `Calls open again in m:ss.` in `text-[13px]
text-muted-foreground`, the three buttons and the stake rendered but `disabled` at `opacity-45`, then the crowd line.

**A — open, no call yet** (default): the question `In 10 min, will Bloq pay more, the same or less for
{itemLabel(id)}s?` in `font-display text-[14px] font-medium`; a row of three `Press` buttons `grid grid-cols-3 gap-2`:
**▲ More** (`bg-navy text-lime`), **= Same** (`border-2 border-navy/40 text-navy`), **▼ Less** (`border-2 border-navy
text-navy`), each `min-h-[38px] rounded-full font-semibold text-[13px]`, disabled while `c.busy || game.busy`; under
them the stake stepper, same look as the quantity stepper (`rounded-full bg-muted h-[38px]`): `−`, the number, `+`,
the word `gold` in `text-xs`; `CALL_STAKE.min..max`, default `CALL_STAKE.default`, step 5. Pressing a side calls
`void c.place(id as ItemId, side, stake)`; while it runs show `<LabLoader size={22} label="Calling on chain…" />`
in place of the buttons. Under it the crowd line.

## 2. The crowd line (A, B, D)

`const k = crowd(c.rounds[id as ItemId])`. When `k` is null: `No calls yet this round. Be the first.` in `font-mono
text-[10.5px] text-muted-foreground`. Otherwise a 6 px `rounded-full bg-navy/10` bar split in three segments (`more`
in `bg-purple`, `same` in `bg-lavender`, `less` in `bg-navy/40`, widths in percent) and under it, same mono style:
`{pct} % of the gold says {side} · {calls} call{s} · {gold} gold in play` from `crowdLeans(k)`.

## 3. Errors

A failed call sets `c.error`; show it the way `BountyCard` does (the coral box with a dismiss X calling
`c.clearError()`), inside the block, once.

## 4. The traders, on the Market · live strip

Where prompt 31 put the thought line, the line stays as it is (it shows `m.trader`, the one that looked last). Add
after `traderMeta`, when `m.traders && m.traders.length > 1`, one more `<small>` line in the same mono style:
`{n} traders · ` + the list `patient · bull · bear` where each name is followed by its last move in brackets when it
has one (`bull (bought 1 Fuel Cell)`), else `(holds)`. Example: `3 traders · patient (holds) · bull (bought 1 Fuel
Cell) · bear (sold 1 Key Fragment)`.

## Confirm when done

- Fresh graduate with gold, before the window closes: the block shows A; pressing **= Same** with 20 gold shows
  "Calling on chain…", then B with "Your call: same, from 44" and the crowd line "100 % of the gold says same · 1 call ·
  20 gold in play"; the gold in the bar drops by 20.
- Ten minutes later (the relayer settles a minute after the round): C with one of the three sentences and OK.
- In the last three minutes of a round: D, buttons dimmed.
- An account from before today: pressing a side shows the coral box "This account was created before this feature
  existed…" (the key cannot sign `place_call`).
- The strip shows the three traders' line.
- Phone (375 px) and desktop; Motion off: nothing moves except the clock text.
- List every file you changed (it should be only `src/pages/ShopPage.tsx`).
