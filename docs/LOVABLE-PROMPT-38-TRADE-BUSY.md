# Lovable prompt 38 — the trade cards' busy state: one card, the pressed button filled

Only `src/pages/ShopPage.tsx` changes, inside `TradeCard`. Mock: `docs/design/price-call/trade-busy.html`,
the row labelled **fill** (the ring rows are not used: a ring only works on a circle). Don't remove or
change anything this prompt doesn't name.

## The fault

`game.busy` is the game store's one flag, so a Sell on one card puts Sell and Buy on all three cards
at 30 %, and the button that was pressed looks like every other.

## Fix

1. Per-card state next to `qty` / `tip`:

```tsx
const [acting, setActing] = useState<"sell" | "buy" | null>(null);
const act = async (fn: typeof game.sellToBloq, kind: "sell" | "buy") => {
  setActing(kind);
  try {
    await fn(id, qty);
    onTraded(id, kind);
    setQty(1);
  } catch { /* coral toast shows the error */ }
  finally { setActing(null); }
};
```

2. The look while this card acts. Keep `canSell` / `canBuy` as they are (they include `!game.busy`,
so another card's trade still blocks a second one). Add two booleans:

```tsx
const ownSell = shopOpen && have > 0;                                   // could sell, if nothing were in flight
const ownBuy = shopOpen && stock > 0 && gold >= Number(price.sell_price) * qty;
const other = game.busy && !acting;                                     // another card's trade is in flight
```

The row:

```tsx
<div className={cn("mt-3 flex items-center gap-2 dk:flex-col dk:items-stretch")}>
  <div className={cn("flex items-center rounded-full bg-muted dk:justify-between", acting && "opacity-35")}>
    … the stepper, unchanged …
  </div>
  <div className="flex flex-1 gap-2 dk:flex-none">
    <Press disabled={!canSell} onClick={() => act(game.sellToBloq, "sell")}
      className={cn("flex-1 rounded-full border-2 font-semibold",
        acting === "sell" ? "border-coral bg-coral text-navy animate-pulse motion-reduce:animate-none" : "border-navy",
        acting === "buy" && "opacity-35",
        other && ownSell ? "disabled:opacity-100" : "disabled:opacity-30")}>
      {acting === "sell" ? "selling…" : "Sell"}
    </Press>
    <Press disabled={!canBuy} onClick={() => act(game.buyFromBloq, "buy")}
      className={cn("flex-1 rounded-full font-semibold",
        acting === "buy" ? "bg-lime text-navy animate-pulse motion-reduce:animate-none" : "bg-navy text-ivory",
        acting === "sell" && "opacity-35",
        other && ownBuy ? "disabled:opacity-100" : "disabled:opacity-30")}>
      {acting === "buy" ? "buying…" : "Buy"}
    </Press>
  </div>
</div>
```

`animate-pulse` is Tailwind's own slow opacity fade (the app's `bq-pulse` is a lime ripple, wrong on a
coral button). `cn` is already imported.

## Confirm

- Press Sell on Key Fragments: that button fills coral and reads "selling…", breathing; its Buy and
  stepper fade to 35 %; Fuel Cells and Contract Seals look exactly as before (their buttons don't
  react until the trade lands). When it lands, everything returns and Bloq reacts as today.
- Press Buy: the button fills lime, "buying…".
- A card that cannot trade on its own (no items, not enough gold, shop closed) still shows its
  button at 30 %, as today.
- `src/pages/ShopPage.tsx` is the only file changed; list every file you changed.
