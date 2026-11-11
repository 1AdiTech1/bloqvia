# Lovable prompt 34 — price call polish: the words under the keys, the bag after a round

Only `src/pages/ShopPage.tsx` changes, inside `PriceCallCard`. Mock: `docs/design/price-call/polish.html`.
Two small fixes; don't remove or change anything this prompt doesn't name.

## 1 · The words belong to their keys

Today the three round keys are one row (`grid grid-cols-3 justify-items-center gap-2`) and the words
"more · same · less" a second row (`-mt-1 grid grid-cols-3 …`) without the gaps, so the words sit
2–3 px off the keys' centres and touch them. Make each side one cell, key over word:

```tsx
<div className="grid grid-cols-3 gap-2">
  <div className="flex flex-col items-center gap-1.5">
    <Press aria-label="More" disabled={closed || c.busy || game.busy} onClick={() => place("More")}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lime shadow-[0_10px_20px_-12px_rgb(22_36_58/.8)] hover:bg-navy/90 disabled:opacity-50"><ArrowMore /></Press>
    <span className="font-mono text-[10.5px] leading-none text-muted-foreground" aria-hidden="true">more</span>
  </div>
  <div className="flex flex-col items-center gap-1.5">
    <Press aria-label="Same" … (unchanged classes) …><ArrowSame /></Press>
    <span className="font-mono text-[10.5px] leading-none text-muted-foreground" aria-hidden="true">same</span>
  </div>
  <div className="flex flex-col items-center gap-1.5">
    <Press aria-label="Less" … (unchanged classes) …><ArrowLess /></Press>
    <span className="font-mono text-[10.5px] leading-none text-muted-foreground" aria-hidden="true">less</span>
  </div>
</div>
```

The separate words row (`<div className="-mt-1 grid grid-cols-3 …">`) goes. The fragment `<>…</>`
that wrapped the two rows is no longer needed. The `Press` classes stay exactly as they are.

## 2 · The bag follows the round

The shop never re-reads the learner after a call is placed or settles, so the gold in the inventory
bar only changes on reload. Two additions in `PriceCallCard`, nothing else:

```tsx
// after the existing `showResult` line
useEffect(() => { if (showResult) void game.refresh().catch(() => {}); }, [showResult, result?.round]);
```

and in `place`, re-read the learner once the call is on chain:

```tsx
const place = (side: CallSide) => {
  setTried(true);
  void c.place(id as ItemId, side, stake).then(() => game.refresh()).catch(() => { /* c.error shows the chain's message */ });
};
```

`game.refresh` is the store's existing method (MapPage calls it the same way). The inventory bar
already animates on a value change (the gold counts to the new number and the chip springs), so no
animation code is added.

## Confirm

- The words sit centred under their keys with a little air (6 px), on desktop and phone.
- Place a call: the bag's gold drops by the stake within a second, with its spring.
- When a round settles and the result shows, the bag's gold counts up to the new number.
- `src/pages/ShopPage.tsx` is the only file changed; list every file you changed.
