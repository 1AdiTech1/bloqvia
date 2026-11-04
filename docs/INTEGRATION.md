# Integrating the chain layer into the Lovable app

Lovable owns the React app at the repo root (`src/components`, `src/pages`,
`src/styles`, `index.html`, `vite.config.ts`, the root `package.json`). This
repo adds folders beside it and never edits Lovable's files. The one bridge is
`src/near/` and its single hook, `useBloqvia()`, which implements the `Game`
interface of `src/game/types.ts` as a shared store (same shape as the mock).

## How the switch works

`src/game/useGame.ts` picks the implementation once per build:

```ts
const useMock = import.meta.env.VITE_GAME_MODE === "mock";
export const useGame: () => Game = useMock ? useMockGame : useBloqvia;
```

- Default (Lovable preview, published site, a plain `bun run dev`): NEAR testnet
  through the hosted relayer `https://bloqvia-production.up.railway.app` (Railway,
  root directory `relayer/`, variables = the names in `relayer/.env.example`).
- Local relayer: `.env.local` with `VITE_RELAYER_URL=http://localhost:8787` and
  `cd relayer && npm run dev` — useful for its per-request log lines.
- Mock: `VITE_GAME_MODE=mock` — design work without the chain.

The dependency `near-api-js@^7.4.0` lives in the root `package.json`; the project's
package manager is **bun** (`bun install`, `bun run dev`, `bun run build`). Do not run
`npm i` at the root — it would add a second lockfile next to `bun.lock`.

## Session and loading

`useBloqvia` restores the learner's key from `localStorage` after mount (SSR-safe:
the server snapshot has `accountId: null, busy: true`). `RequireAccount` therefore
waits: no account **and** `busy` false → redirect to `/`; account but `learner`
still `null` → loader; otherwise the page. A reload on `/shop` stays on `/shop`.

## What a screen calls

```tsx
const b = useGame();

// Landing: "Start Learning"
await b.start();                                 // creates + registers the account, mints Passport L0. No wallet UI.

// Map: b.lessons (from chain), b.learner.completed, b.passport.level, b.bloq.shop_open
// Lesson text (question, options, concept, near_reveal, explanation) comes from
// src/game/lessons.json, matched by lesson_id. The contract stores only a hash
// of each answer and compares the submitted option against it.

// Quiz: on an option
const { txHash } = await b.completeLesson(lesson.lesson_id, chosenOptionText);
// show b.lastTx.url (explorer) next to the success copy and lesson.near_reveal

// Shop: b.bloq.prices[i].buy_price / sell_price / bloq_stock, tooltip = rule from pricing.rs
await b.sellToBloq("key-fragment", 2);
await b.buyFromBloq("fuel-cell", 1);

// Graduation: enabled when b.learner.level === 3 && every item >= 1 && gold >= b.bloq.graduation_fee
await b.graduate();

// Reveal: b.explorer.account(b.accountId), b.explorer.passport(b.accountId), b.exportSecretKey()
```

`b.busy` disables buttons while a call is in flight; `b.error` carries the
contract's panic message verbatim (e.g. "Wrong answer", "Shop closed: …"),
which is what the UI shows. `b.clearError()` exists on the chain store only.

## Amounts

All token amounts cross the wire as decimal strings (`"100"`). Gold and items
have 0 decimals, so `Number(x)` is safe for display.

## When lessons change

`cd scripts && npm run hash-lessons` rewrites `src/content/lessons.public.json`;
`npm run seed-lessons` adds new lessons on chain (existing ones are immutable).
Keep `src/game/lessons.json` (Lovable's copy with the UI text) in step by hand.
