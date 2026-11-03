# Lovable — prompt 3: the Experience Lab (game screens)

Restyles `/map`, the quiz sheet, `/shop`, `/passport` and `/reveal` in the identity from prompt 2 and makes them feel like a game. Same `Game` interface; no data-layer changes.

---

Now restyle the **Experience Lab** — the game screens — in the identity you built for the homepage, and make them feel like a game you want to keep playing. Same register as the homepage: Monument Valley, Alto's Odyssey, Duolingo for adults. Tactile, rewarding, grown-up. No toy UI, no cartoon easing.

## Scope guard

- Touch only: `src/pages/MapPage.tsx`, `src/pages/ShopPage.tsx`, `src/pages/PassportPage.tsx`, `src/pages/RevealPage.tsx`, `src/components/QuizSheet.tsx`, `src/components/Bloq.tsx`, `src/components/PassportCard.tsx`, `src/components/PhoneShell.tsx`, `src/components/GameBits.tsx`, `src/components/VineLoader.tsx` (rename to `LabLoader.tsx` if you like) and new components under `src/components/lab/`.
- Reuse the brand primitives from `src/components/brand/primitives.tsx` and the theme tokens in `src/styles.css`. Do not change the homepage.
- `src/game/*` stays exactly as it is. Every screen keeps reading and writing through `useGame()`; the fields and functions available are the ones in `src/game/types.ts`. If something you want to show isn't in `Game`, derive it in the component from what is there, or leave it out.
- Keep the routes and the bottom nav (Map, Shop, Passport). Keep the centered column, max 480px, on the navy background with the ivory surface for cards.
- Respect `prefers-reduced-motion`: every animation below has a static fallback.

## Game feel — the rules

1. **Progress is spatial.** The map is a path you move along. A "you are here" marker travels to the next node when a quest completes (Framer Motion `layout` / `animate`), not a list that re-renders.
2. **Rewards land.** When `completeLesson` resolves, the reward chips fly from the quiz sheet into the inventory counter, the gold number counts up (tween, ~700 ms), and the Passport ring ticks one step. One beat each, in sequence, then "Saved on NEAR ✓" fades in.
3. **The market breathes.** Every price pill animates when its value changes: number tween plus a brief lime flash when it rises, coral when it falls. Bloq's stock pills do the same.
4. **The merchant reacts.** Bloq's speech bubble line depends on his stock of the item you last traded (see the lines below) and his pose shifts slightly on each trade.
5. **Feedback is physical but quiet.** 44px targets, press-down scale 0.98 on tap, `navigator.vibrate(12)` on success where supported, no sounds.
6. **Errors are honest.** `error` is shown verbatim in a coral toast ("Wrong answer", "Not enough gold", …); a wrong quiz answer also shakes the option row once.

## Screens

### Map `/map`
- Header: compact `PassportCard` (level ring 0–3, "Graduate" state) and an inventory bar: BloqGold with a coin-like lime disc, then three item chips (Key Fragment, Fuel Cell, Contract Seal) with counts from `learner.items`.
- Body: a vertical winding SVG path on the navy background with three nodes, in order: The Vault, The Fuel System, Smart Agreements. States: done (lime fill, check, the item it minted), available (ivory, soft pulse), locked (lavender outline). The "you are here" marker is a small lime block sitting on the current node. Tapping an available node opens the Quiz sheet.
- Foot of the path: Bloq's shop door. Locked until `learner.level === 3` ("Finish the three quests to meet Bloq"), then it opens (a short door animation) and becomes the button to `/shop`.
- Empty/first-visit state (level 0): a one-line welcome in the eyebrow style: "Three quests. One merchant. A Passport that's yours."

### Quiz sheet (over the map)
- Bottom sheet, ivory surface, navy type. Top: topic chip and "Chapter n". Then the `concept` as a short readable paragraph, the `question`, and the options as large stacked buttons.
- Tapping an option calls `completeLesson(lesson_id, optionText)` and disables the row while `busy`.
- Success state replaces the options: the `success` line, reward chips (that then fly to the inventory bar), a card titled "What just happened on NEAR" with the lesson's `near_reveal`, a link "See it on the explorer" → `lastTx.url` (external), and "Back to the map". Lessons content comes from `src/game/lessons.json` (already there).

### Shop `/shop`
- Bloq at the top, built as the companion from the brand (three stacked rounded blocks, navy body, lime head block, two ivory eyes, lavender band). Speech bubble with one of these lines, chosen by his stock `s` of the item you last traded (default: the item with the lowest stock):
  - `s < 10`: "I'm short on those. I'll pay well."
  - `10 ≤ s < 40`: "Fair stock. Fair price."
  - `s ≥ 40`: "I've got plenty of those already. I'll pay less."
  - shop closed: "My treasury's thin. Come back when it refills."
- Three trade cards, one per item: name, your count, Bloq's stock, **He pays** `buy_price`, **He charges** `sell_price`, a quantity stepper (1–9), **Sell** (disabled if you have none or the shop is closed) and **Buy** (disabled if his stock is 0 or your gold is short). Prices and stocks animate on change (rule 3).
- An info icon next to the prices opens a tooltip: "Bloq pays less for what he already has a lot of: price = 100 × 40 ÷ (40 + his stock). Nobody can change this rule by hand."
- Banner when `!bloq.shop_open`: "Bloq's treasury is below 500 gold — shop closed until it refills."
- Graduation card at the bottom: a three-line checklist with animated ticks — "Three quests complete" (`learner.level === 3`), "One of each item" (every count ≥ 1), "Fee: {graduation_fee} BloqGold" (`gold ≥ fee`) — and a **Graduate** button that calls `graduate()`. On success: a short ceremony (the Passport gets a gold seal, 1.5 s), then navigate to `/reveal`.

### Passport `/passport`
- A physical-card feel: tall navy card with one lime edge, the wordmark small at the top, the learner's account id in mono type, the level ring large, three stamp slots that fill as quests complete (stamps appear with a small scale-in and 2° rotation), a "Non-transferable" badge, and the Graduate gold seal when `passport.graduated`. Link "View on the explorer" → `explorer.passport(accountId)` (external).

### Reveal `/reveal`
- Full navy, cinematic pacing: the headline "It was on NEAR the whole time." reveals first, then three cards one after another: **Your account** (`accountId`, link `explorer.account`), **Your Passport** (link `explorer.passport`), **Your key** (masked, a Copy button that calls `exportSecretKey()`, a coral note "Whoever holds this key controls the account", and the line "Import it into any NEAR wallet").
- Then a timeline of what happened — sign-in, the three quests, your trades, graduation — each with "View transaction" → `explorer.tx(lastTx.txHash)` for the last one and the account link for the rest (the `Game` interface only exposes the last transaction; do not invent hashes).
- Final line: "Thanks for playing. Everything you earned is yours." and a quiet "Play again" that calls `signOut()` and returns to `/`.

## Loader and chrome
- Replace the vine loader with a lab loader in the new identity: three blocks assembling into the logo mark, looped. Use it for `busy` on sign-in.
- The bottom nav uses the primitives; active item lime, inactive lavender.

When done, list the files you changed, confirm `src/game/*` and the homepage are unchanged, and walk the whole loop once at mobile width: start → three quests → sell two Key Fragments → graduate → reveal. Tell me anything that didn't work.

## Wrong-answer explanation (added)

After a wrong answer, keep the coral "Wrong answer" toast and also show, inside the sheet under the options, a short explanation grounded in that chapter, with a "Try again" affordance. The text is static content, not an AI call: add an `explanation` field to each lesson in `src/game/lessons.json` with these exact strings, and render it from there. Do not add an AI gateway, a backend call or any data path outside `useGame()`.

- the-vault: "Not that one. Your private key and your seed phrase are what open your mailbox: share them and anyone can take what is inside. The public key is the address people use to send you things. Try again."
- the-fuel-system: "The other way round. When the network is busy, many transactions compete for the same computer power, so the fee goes up, not down. Try again."
- smart-agreements: "Not quite. No person is involved and Bloq's mood does not count: a smart contract holds the price rule and moves the gold by itself, the same way for everyone. Try again."
