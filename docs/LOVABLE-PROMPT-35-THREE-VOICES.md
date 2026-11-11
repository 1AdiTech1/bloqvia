# Lovable prompt 35 — Market · live: the three traders each speak

Only `src/pages/ShopPage.tsx` changes, inside `ShopInner`'s `<div className="market">`. Mock:
`docs/design/market/three-voices.html` ("After"). Don't remove or change anything this prompt doesn't name.

## What's there now

`traderLine` quotes whichever trader thought last (`market.trader`), `traderMeta` is its mono proof line,
then `allowed then: …`, then the `3 traders · patient (holds) · …` line added by prompt 32.

## What changes

When `market.data?.traders` has **two or more** entries and no fast-forward run is in progress
(`!(ff?.running && last)`), render the three rows below **instead of** `traderLine`, `traderMeta`, the
`allowed then` line and the `3 traders · …` line. With one trader or none, or while a run is in
progress, everything stays exactly as it is today (the run's narration line included).

```tsx
const traders = market.data?.traders;
const voices = live && !(ff?.running && last) && traders && traders.length > 1 ? traders : null;
```

In the JSX, where `<div className="line">{traderLine}…</div>` is:

```tsx
{voices ? (
  <>
    <div className="grid gap-2">
      {voices.map((tr) => <TraderVoice key={tr.accountId ?? tr.temper} tr={tr} />)}
    </div>
    <small className="font-mono text-lavender" style={{ fontSize: "11px" }}>
      three NPC traders, each an agent on NEAR AI Cloud that may only pick from the moves its rules allow · next look in {voices[0]?.rules.intervalMin ?? 5} min
    </small>
  </>
) : (
  <div className="line">{traderLine}<small>{traderMeta}</small>{live && !(ff?.running && last) && t ? <small …>allowed then: …</small> : null}</div>
)}
```

(The old `{market.data?.traders && market.data.traders.length > 1 ? <small …>3 traders · …</small> : null}`
is removed from the `line` div: the rows replace it.)

## TraderVoice

A new component at the bottom of the file. `TraderView` is the element type of `market.data.traders`
(`src/near/useMarket.ts`: `temper`, `temperLine`, `accountId`, `last`, `lastThought`, `note`, `on`, `rules`).

```tsx
function TraderVoice({ tr }: { tr: TraderView }) {
  const t = tr.lastThought;
  const did = t
    ? t.move === "sell" || t.move === "buy"
      ? `${t.move === "sell" ? "sold" : "bought"} 1 ${itemLabel(t.token_id ?? tr.last?.token_id ?? "")}${tr.last?.price ? ` at ${tr.last.price}` : ""}`
      : t.overruled ? "overruled, held" : "held"
    : tr.last ? `${tr.last.kind === "sell" ? "sold" : "bought"} ${tr.last.amount} ${itemLabel(tr.last.token_id)} at ${tr.last.price}` : tr.on ? "watching" : "off";
  const sentence = t ? `"${t.reason}"` : tr.note;
  const tone = tr.temper === "bull" ? "text-lime" : tr.temper === "bear" ? "text-coral" : "text-lavender";
  const Arrow = tr.temper === "bull" ? ArrowMore : tr.temper === "bear" ? ArrowLess : ArrowSame;
  const acted = t ? t.move !== "hold" && !t.overruled : !!tr.last;
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-x-3 rounded-[14px] bg-ivory/5 py-2.5 pl-2.5 pr-3">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-full border border-ivory/10 bg-navy", tone)} aria-hidden="true"><Arrow width={18} height={18} /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-display text-[13px] font-semibold">
          {tr.temper ?? "trader"}
          <span className={cn("font-display text-[12px] font-medium", acted ? "text-lime" : "text-lavender")}>{did}</span>
        </div>
        <p className="mt-0.5 text-[14px] leading-[1.45]">{sentence}</p>
        <small className="mt-1 block font-mono text-lavender" style={{ fontSize: "10.5px" }}>
          {tr.accountId && <a href={explorer.account(tr.accountId)} target="_blank" rel="noopener noreferrer">{tr.accountId}</a>}
          {t && <>{t.generated_by.signature_kind === "provider_tee" ? " · signed in a TEE" : " · thought on NEAR AI Cloud"} · <a href={`https://cloud.near.ai/verify?model=${encodeURIComponent(t.generated_by.model)}`} target="_blank" rel="noreferrer">Verify</a> · allowed then: {t.allowed.join(", ")}</>}
          {acted && tr.last?.txHash && <> · <a href={explorer.tx(tr.last.txHash)} target="_blank" rel="noopener noreferrer">explorer</a></>}
        </small>
      </div>
    </div>
  );
}
```

Import `type TraderView` from `"@/near"` if it is exported there; otherwise from `"@/near/useMarket"`.
`ArrowMore` / `ArrowSame` / `ArrowLess` already exist at the bottom of the file (prompt 33) and take
`width`/`height`. `cn`, `explorer`, `itemLabel` are already imported. The `.market .line` CSS stays for
the single-trader case; the rows use utility classes only.

## Confirm

- Shop, live, three traders configured: three rows in the block (patient, bull, bear), each with its
  icon, name, what it did, its sentence and its mono line; the footer under them; the old
  `3 traders · …` line gone; the Watch button and the fast-forward line untouched.
- Press Watch a day of trading: the rows give way to the run's narration line; after the run they come back.
- Phone: the rows stack within the block, no horizontal scroll.
- `src/pages/ShopPage.tsx` is the only file changed; list every file you changed.
