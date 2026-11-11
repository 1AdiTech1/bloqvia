# Lovable prompt 31 — the trader thinks (Nov 11)

The NPC trader in Bloq's shop is now an agent on NEAR AI Cloud: every 20 minutes it looks at the prices and picks one
move, with a one-line reason, but only among the moves the rules allow; a move outside them is overruled and it holds.
`useMarket()` already carries it:

```ts
m.trader.mind          // "ai" | "rules" | undefined   ("ai": the agent decides inside the rules)
m.trader.lastThought   // { at, move: "sell"|"buy"|"hold", token_id, reason, allowed: string[], overruled, generated_by: { model, chat_id, signature_kind } } | null
m.trader.last          // the last trade as before; now also `reason?: string`
```

**Most important rule (as in prompts 21 to 30): don't remove or change anything this prompt doesn't name.** Only
`src/pages/ShopPage.tsx` changes. Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict
TypeScript as before. Phone and desktop.

## The "Market · live" line, when the trader has a thought

In `ShopInner`, `traderLine` and `traderMeta` gain one case, placed **before** the existing `trader?.last` case and
after the fast-forward case, used when `trader?.lastThought` is set (`const t = trader?.lastThought`):

- `traderLine`: **The trader {verb}:** then the reason in quotes. `verb` = `t.move === "sell" ? "sold" : t.move === "buy" ? "bought" : t.overruled ? "was overruled and held" : "held"`.
  When `t.move` is sell or buy, append after the quote: ` — {amount} {itemLabel(t.token_id)} at {trader.last.price} gold` using
  `trader.last` (the trade it made). Example: *The trader bought: "Fuel cells are 2 under the day's average, so I take one." — 1 Fuel Cell at 41 gold*.
- `traderMeta`: `{traderAcct} · thought on NEAR AI Cloud` + (`t.generated_by.signature_kind === "provider_tee"` ? ` · signed in a TEE` : ``) + ` · ` + a link
  **Verify** to `https://cloud.near.ai/verify` (new tab, `rel="noreferrer"`) + (when `trader.last?.txHash` and `t.move !== "hold"`) ` · ` the existing **explorer** link to that tx + ` · next look in {trader.rules.intervalMin} min`.
- Under the line, in the same `<small>` style, one more line in `font-mono` at 10.5 px: `allowed then: {t.allowed.join(" · ")}` so a reader sees the cage the agent chose in.

When `trader.mind === "rules"` or `lastThought` is null, nothing changes: the existing lines stay as they are.

## Confirm when done

- With the hosted relayer: the line reads "The trader held: "…"" or "The trader bought: "…" — 1 Fuel Cell at 41 gold", with "thought on NEAR AI Cloud · signed in a TEE · Verify" and the allowed list under it.
- Switch the relayer to rules (no thought): the old line is back, unchanged.
- Phone (375 px) and desktop; Motion off.
- List every file you changed (it should be only `src/pages/ShopPage.tsx`).
