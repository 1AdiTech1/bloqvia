# Lovable prompt 37 — the price call's busy state: one card, the side's colour

Only `src/pages/ShopPage.tsx` changes, inside `PriceCallCard`. Mock: `docs/design/price-call/busy.html`
("Fixed"). Don't remove or change anything this prompt doesn't name.

## The two faults

`c.busy` is the calls store's one flag, so a press on one card shows `<LabLoader label="Calling on chain…" />`
on all three cards; and that loader's default tone is lime on the ivory card, nearly invisible.

## Fix

1. A per-card state next to `tried`:

```tsx
const [placing, setPlacing] = useState<CallSide | null>(null);
const place = (side: CallSide) => {
  setTried(true);
  setPlacing(side);
  void c.place(id as ItemId, side, stake).then(() => game.refresh()).catch(() => { /* c.error shows the chain's message */ }).finally(() => setPlacing(null));
};
```

2. The keys always render: remove the `c.busy ? (<LabLoader …/>) : (…)` branch so the
`grid grid-cols-3 gap-2` of the three cells is rendered unconditionally (the `disabled` on the keys
and the stake keeps `closed || c.busy || game.busy`, so a call in flight on another card still blocks
a second one). `LabLoader` stays imported if used elsewhere in the file; drop the import only if it
becomes unused.

3. Each cell takes the busy look from `placing`:

```tsx
const COLOR = { More: { ring: "border-t-lime border-r-lime", word: "text-lime-ink" }, Same: { ring: "border-t-purple border-r-purple", word: "text-purple-d" }, Less: { ring: "border-t-coral-ink border-r-coral-ink", word: "text-coral-ink" } } as const;
```

For each of the three cells (side `S` = "More" | "Same" | "Less", word `more` | `same` | `less`):

```tsx
<div className={cn("flex flex-col items-center gap-1.5", placing && placing !== S && "opacity-35")}>
  <span className="relative">
    <Press aria-label={S} … unchanged classes …><ArrowX /></Press>
    {placing === S && <i aria-hidden="true" className={cn("pointer-events-none absolute -inset-[5px] rounded-full border-[2.5px] border-transparent animate-spin motion-reduce:animate-none", COLOR[S].ring)} />}
  </span>
  <span className={cn("font-mono text-[10.5px] leading-none", placing === S ? cn("font-bold", COLOR[S].word) : "text-muted-foreground")} aria-live={placing === S ? "polite" : undefined}>
    {placing === S ? "calling on chain…" : "more"}
  </span>
</div>
```

If `lime-ink` or `coral-ink` are not colour tokens in this project, use arbitrary values:
`text-[#5a8a00]` / `border-t-[#5a8a00] border-r-[#5a8a00]` for more, `text-[#b0532f]` /
`border-t-[#b0532f] border-r-[#b0532f]` for less; `purple` and `purple-d` exist. Under
`prefers-reduced-motion` the ring stands still (`motion-reduce:animate-none`); that's enough.

## Confirm

- Press **more** on Key Fragments: only that card changes; its more key gets a spinning lime ring and
  "calling on chain…" in lime-ink under it; its same/less keys fade; Fuel Cells and Contract Seals
  look exactly as before. When the call lands the card goes to "Your call: ↗ more, from N".
- Same with **same** (purple) and **less** (coral).
- A press while another card's call is in flight does nothing (keys disabled), as before.
- `src/pages/ShopPage.tsx` is the only file changed; list every file you changed.
