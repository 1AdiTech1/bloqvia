# Lovable — prompt 5: polish after the chain went live

Sent Nov 4 evening, after the app started playing on NEAR testnet by default. Sign-in without the email field (path B needs nothing typed), honest timing copy, one toast instead of two, the repo link, a desktop and reduced-motion pass.

---

The game now plays on NEAR testnet by default (the preview included): `useGame()` is the chain store and every action is a real transaction through our relayer, so a quest takes 3–4 s and sign-in about 5 s. Polish the places where the UI still assumes the mock or the old email sign-in. Content and identity stay as they are; this is finishing, not redesign.

## Scope guard

- Touch only: `src/components/brand/SignInSheet.tsx`, `src/components/AppChrome.tsx`, `src/pages/RevealPage.tsx`, the homepage file(s) for the hero CTA and the footer, and `src/components/LabLoader.tsx` if the loader needs a size prop.
- Do not change `src/game/*`, `src/near/*`, `src/components/RequireAccount.tsx`, `QuizSheet`, `MapPage`, `ShopPage`, `PassportPage`, or anything outside `src/`.
- Everything still goes through `useGame()`; no new data paths.

## 1. Sign-in sheet — nothing to type

Sign-in is an app-held key: the browser generates it and the relayer creates the account. Remove the email field and the form semantics around it. The sheet becomes:

- Mark, then title **Start without a wallet**.
- Body: "No seed phrase, no password, no downloads. We create a NEAR account for you right here in this browser and hold its key for you — you get the key at the end, with everything you earned."
- One button, full width: **Create my account**. While `busy`: the LabLoader (small) and the text "Creating your NEAR account… about five seconds" — the real account is being created on chain, so the wait is honest, not a spinner for show.
- If `accountId` is already set when the sheet opens, title **Welcome back**, body "Your account is in this browser.", button **Continue to the map** → `/map` without calling `start()`.
- Keep Escape and the close button; keep the ivory sheet, navy type, bottom sheet on mobile, centered on desktop.

On the homepage, when `accountId` is set, the hero's primary CTA reads **Continue to the map** and links straight to `/map` (skip the sheet). Otherwise it stays **Start exploring** and opens the sheet, as today.

## 2. Reveal timeline — the first line

Replace "You signed in with your email — a NEAR account was created for you" with "You tapped Start — a NEAR account was created for you, and Bloqvia's relayer paid for it". Nothing else on that page changes.

## 3. One "Saved on NEAR ✓", not two

`AppChrome` shows a top "Saved on NEAR ✓" pill whenever `lastTx` changes. On `/map` the quiz sheet already shows its own "Saved on NEAR ✓" line a beat later, so the player sees it twice. Rule: on `/map`, do not show the top pill; on `/shop` and `/passport` keep it (trades and graduation have no sheet). The "Working on it…" pill and the coral error toast stay as they are everywhere.

## 4. Footer

In the homepage footer add a quiet link **Source on GitHub** → `https://github.com/1AdiTech1/bloqvia` (opens in a new tab), next to the existing footer items, same type style as the other footer links. Also add **NEAR testnet** as plain text in the footer so nobody mistakes the demo for mainnet.

## 5. Desktop and reduced-motion pass

- Open the homepage and every Lab screen at 1440 px wide and at 390 px wide. Fix anything that overflows, overlaps, or leaves the 480 px game column visually stranded on desktop (the navy background should fill the viewport and the column sit centered with the bottom nav aligned to it). No layout redesign; fixes only.
- With `prefers-reduced-motion: reduce`, walk start → one quest → shop once. Every animation must have its static end-state; nothing should be invisible because it was waiting to animate in.

## Verify

1. `bun run build` passes.
2. In the preview (this is testnet: allow 10 s per step), at 390 px: Start exploring → Create my account → map → The Vault with "Your public key" → shop → passport. Confirm the sign-in sheet shows the loader with the "about five seconds" copy during the wait, that only one "Saved on NEAR ✓" appears after the quest, and that reloading `/shop` stays on `/shop`.
3. List the files you changed and confirm the scope guard held.
