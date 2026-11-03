# Integrating the chain layer into the Lovable app

Lovable owns the React app at the repo root (`src/components`, `src/pages`,
`src/styles`, `index.html`, `vite.config.ts`, the root `package.json`). This
repo adds folders beside it and never edits Lovable's files. The one bridge is
`src/near/` and its single hook.

## One-time setup (Adi, after Maria's first Lovable sync)

1. Add the dependency to the root `package.json`: `npm i near-api-js@^7.4.0`.
2. Copy `.env.example` to `.env.local` and point `VITE_RELAYER_URL` at the relayer.
3. Add two scripts to the root `package.json`:
   ```json
   "relayer": "npm --prefix relayer run dev",
   "simulate": "npm --prefix scripts run simulate:offline"
   ```
4. Run `npm --prefix scripts run hash-lessons` whenever `src/content/lessons.json` changes.
   The app imports `src/content/lessons.public.json` (no answers in the bundle).

## What a screen calls

```tsx
import { useBloqvia } from "@/near";            // or "../near" depending on Lovable's alias

const b = useBloqvia();

// Landing: "Start Learning"
await b.start();                                 // creates + registers the account, mints Passport L0. No wallet UI.

// Map: b.lessons (from chain), b.learner.completed, b.passport.level, b.bloq.shop_open

// Quiz modal: on the correct option
const { txHash } = await b.completeLesson(lesson.lesson_id, chosenOptionText);
// show b.lastTx.url (Explorer) next to the success copy and lesson.near_reveal

// Shop: b.bloq.prices[i].buy_price / sell_price / bloq_stock, tooltip = rule from pricing.rs
await b.sellToBloq("key-fragment", 2);
await b.buyFromBloq("fuel-cell", 1);

// Graduation: enabled when b.learner.level === 3 && every item >= 1 && gold >= b.bloq.graduation_fee
await b.graduate();

// Reveal: b.explorer.account(b.accountId), b.explorer.passport(b.accountId), b.exportSecretKey()
```

`b.busy` disables buttons while a call is in flight; `b.error` carries the
contract's panic message verbatim (e.g. "Wrong answer", "Shop closed: …"),
which is what the UI should show.

## Amounts

All token amounts cross the wire as decimal strings (`"100"`). Gold and items
have 0 decimals, so `Number(x)` is safe for display.
