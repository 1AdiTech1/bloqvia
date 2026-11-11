# Lovable prompt 36 — while a day of trading runs, the traders fold into chips

Only `src/pages/ShopPage.tsx` changes, in `ShopInner`'s Market · live block and with one small
component. Mock: `docs/design/market/run.html`, section "B". Don't remove or change anything this
prompt doesn't name.

## Now

Prompt 35 renders the three `TraderVoice` rows only when no fast-forward run is in progress; during a
run the block shows the run's narration line alone (`traderLine` + `traderMeta`), and the rows return
after it.

## Change

During a run, with two or more traders, keep the narration line exactly as it is and add **under it**
one row of chips, one per trader, in place of nothing. The full rows still return when the run ends.

```tsx
const traders = market.data?.traders;
const running = !!(ff?.running && last);
const voices = live && !running && traders && traders.length > 1 ? traders : null;
const chips = live && running && traders && traders.length > 1 ? traders : null;
```

In the JSX, the `voices ? (…) : (<div className="line">…</div>)` from prompt 35 becomes:

```tsx
{voices ? (
  … unchanged …
) : (
  <>
    <div className="line">{traderLine}<small>{traderMeta}</small>{live && !running && t ? <small …>allowed then: …</small> : null}</div>
    {chips && (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 font-mono text-lavender" style={{ fontSize: "10.5px" }}>the traders ·</span>
        {chips.map((tr) => <TraderChip key={tr.accountId ?? tr.temper} tr={tr} />)}
      </div>
    )}
  </>
)}
```

## TraderChip

Next to `TraderVoice` at the bottom of the file. Pull the "did" computation out of `TraderVoice` into
a small helper so both use it:

```tsx
function traderDid(tr: TraderView): string {
  const t = tr.lastThought;
  return t
    ? t.move === "sell" || t.move === "buy"
      ? `${t.move === "sell" ? "sold" : "bought"} 1 ${itemLabel(t.token_id ?? tr.last?.token_id ?? "")}${tr.last?.price ? ` at ${tr.last.price}` : ""}`
      : t.overruled ? "overruled, held" : "held"
    : tr.last ? `${tr.last.kind === "sell" ? "sold" : "bought"} ${tr.last.amount} ${itemLabel(tr.last.token_id)} at ${tr.last.price}` : tr.on ? "watching" : "off";
}

function TraderChip({ tr }: { tr: TraderView }) {
  const tone = tr.temper === "bull" ? "text-lime" : tr.temper === "bear" ? "text-coral" : "text-lavender";
  const Arrow = tr.temper === "bull" ? ArrowMore : tr.temper === "bear" ? ArrowLess : ArrowSame;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ivory/10 bg-ivory/5 py-1 pl-1.5 pr-2.5 font-display text-[12px] font-semibold text-ivory">
      <span className={cn("flex h-[22px] w-[22px] items-center justify-center rounded-full bg-navy", tone)} aria-hidden="true"><Arrow width={13} height={13} /></span>
      {tr.temper ?? "trader"}
      <em className="font-mono not-italic text-lavender" style={{ fontSize: "11px" }}>{traderDid(tr)}</em>
    </span>
  );
}
```

`TraderVoice` then calls `traderDid(tr)` where it computed `did` inline; its output is unchanged.

## Confirm

- Shop, three traders, no run: the three full rows (prompt 35), as now.
- Press Watch a day of trading: the narration line as now, and under it the three chips
  (→ patient · held, ↗ bull · bought 1 Contract Seal at 40, ↘ bear · held). The block's height barely
  changes. After the run the full rows return.
- Phone: the chips wrap to a second line if they must; no horizontal scroll.
- `src/pages/ShopPage.tsx` is the only file changed; list every file you changed.
