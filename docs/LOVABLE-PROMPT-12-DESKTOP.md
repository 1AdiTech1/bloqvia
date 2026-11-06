# Lovable prompt 12 — desktop fixes on the landing, and the desktop game (layout A)

References:
- `docs/design/game-v2/desktop.html`: layout A, the one picked. Open it and look at tab A.
- `docs/design/game-v2/index.html`: the phone design. It stays as it is.

Send the two parts one at a time.

**Rules (as before).**
- **Don't touch the logic or the Bloq and chain code.** Do not edit `src/bloq/*` or `src/near/*`. Do not change any game logic, contract call, reward, price or balance.
- **Use the ready-made pieces.** Bloq pieces come from `@/bloq`: `Bloq`, `SpeechBubble`, `useSay`, `talkMs`, `AgentPod`, `ChainTrail`, plus the new `BloqCoin` and `BloqFace`. Chain data comes from `@/near`: `useBloqvia()` (now with `txLog`), `useFinalBlock()`, `NEAR_CONFIG` and `explorer`. Read `src/bloq/README.md`.
- **Strict TypeScript and reduced motion** as before.
- **Phones and tablets keep today's layout.** The desktop layout starts at 1100px.

---

## Part A — the landing fixes, the coin, the chat header, Bloq on the sign-in window

1. **"Explore ↗" on the three chapter cards** (`src/pages/Landing.tsx`):
   - Remove the underline.
   - On hover and keyboard focus, the text gets the same lime gradient sweep as the header links ("The big picture" and the others).
   - Make it a real button that goes somewhere: signed in, it goes to `/map`; signed out, it opens the existing `SignInSheet`, like the Start buttons.
2. **"Start learning" in "Ready when you are":** the button's hard shadow is dark grey, not black: `4px 4px 0 rgb(92 96 112 / .55)`, and `6px 6px 0` of the same on hover.
3. **Start buttons when the player has already started.** This covers the header's "Start learning", the "Ready when you are" button, and "Enter the Experience Lab".
   - When signed in, clicking any of them **doesn't** open the sheet or navigate.
   - Instead, a small ivory popover opens anchored under the clicked button (radius 16, soft shadow). It says "You've already started. Your progress is waiting on the map." and has a lime "Continue to the map" button that goes to `/map`.
   - Esc, a click outside, or 6 seconds closes it.
   - The hero button already says "Continue to the map" when signed in; keep it.
4. **Footer:** write the brand as "Bloqvia · A friendlier way into Web3.", with only the B uppercase. Remove any `uppercase` class or text-transform on that span.
5. **The BloqGold coin is the same everywhere:** use `<BloqCoin size={…} />` from `@/bloq`.
   - In `src/components/GameBits.tsx`, `GoldDisc` renders `<BloqCoin size={20} />` (it keeps its `className` for sizing), so the inventory, reward chips, shop, quiz rewards and daily quest card all switch at once.
   - On the landing, the "BloqGold" item in "Your progress" shows `<BloqCoin size={26} />` inside its squircle instead of the empty square.
   - Bloq's hand coin already has the mark (the prop `coin`).
6. **The landing chat header** (`src/components/brand/AskDock.tsx`):
   - Make the navy header taller: `padding-top: 40px`, with the pod at `size={44}`. When the agent leans out on hover or tap, his head comes out of the window and stays inside the panel instead of being cut off.
   - Keep `lean` on there; it's the fun of it.
7. **Bloq on "Start without a wallet"** (`src/components/brand/SignInSheet.tsx`):
   - Add `<BloqFace size={80} hat="cap" />` inside the card at the top right, just left of the close ×: `position: absolute; right: 60px; top: 14px`, on the same row as the logo. It's only his head with cap v1, cut under the chin; cap v1 isn't used anywhere else on the landing.
   - **Keep the title "START WITHOUT A WALLET" on one line at every width:**
     - Put `container-type: inline-size` on the card.
     - On the title, set `white-space: nowrap` and `font-size: min(25px, 7.6cqi)`.
     - Check it at 320, 360, 390 and 1366px.

Confirm when done:
- Each change works on desktop and at 360px.
- The coin shows the block mark in the inventory, the chips, the shop and the landing.
- The agent's head stays inside the chat panel when he leans out.
- The title stays on one line at 320px.
- Nothing in `src/bloq/` or `src/near/` changed.

---

## Part B — the desktop game: layout A (≥1100px)

Build it from `docs/design/game-v2/desktop.html`, tab A. Below 1100px, nothing changes.

1. **The frame** (`PhoneShell` when `nav` is true, at `min-width: 1100px`): a three-column grid filling the viewport height.
   - **Left rail, 220px, sticky:**
     - `<BloqviaLogo />` at the top.
     - The four tabs as vertical rows (icon and label, 48px tall, radius 14; the active one lime with navy text): Map, Shop, Missions, Passport.
     - At the bottom, the **AI agent card**: a navy-2 card with `<AgentPod size={44} />`, "Ask Bloq" and "AI agent · online". It opens `AskBloqSheet` with the same route context as the mobile dock, and calls `peek()` every 14s.
   - **Centre:** the screen's content, `max-width: 760px`, with 28px padding. The game header's Passport pill moves into the centre, at the top right next to the inventory bar.
   - **Right, 330px, sticky: the "On NEAR" panel** (see 2).
   - On desktop, hide the bottom tab pill and the floating agent button; the rail replaces them.
2. **The "On NEAR" panel** (a new `src/components/lab/ChainPanel.tsx`; it only reads):
   - The eyebrow "On NEAR · live", then the h3 "What the chain saw".
   - The block ticker: `NEAR testnet · block {useFinalBlock()}`, styled like the map's ticker.
   - A navy-2 card of mono rows:
     - "Your account": the account id shortened to `learner-7c4f…testnet`, linking to `explorer.account(id)`.
     - "Game contract": `NEAR_CONFIG.coreContractId`.
     - "Gas you paid": **0 NEAR**, in lime.
     - "Paid by": the relayer.
   - **"Your transactions"** from `useBloqvia().txLog`, newest first, at most 8, each a small navy-2 card:
     - **The title:** "Quest: {lesson title}" (the title from `LESSON_CONTENT` or the daily quest), "Sold {amount} {item name} to Bloq", "Bought {amount} {item name} from Bloq", or "Graduated: Passport sealed".
     - **Under it, a mono line:** the method (`entry.methods[0]`) and a relative time ("2 min ago") on the left, and a lime "explorer ↗" link to `entry.url` on the right.
   - **Empty state:** "Nothing yet. Your first quest will show up here."
   - **In mock mode** (`IS_MOCK`): "Mock mode: these actions aren't on chain."
   - At the bottom, a small line: "Every action here is a real NEAR testnet transaction. Open any of them on the explorer."
   - New entries slide in from the top (.3s; no motion with reduced motion).
3. **Each screen inside the centre column on desktop:**
   - **Map:** the heading, then a row with the inventory bar and the Passport pill, then `<ChainTrail />` at the column's width (it adapts by itself). Under the trail, the streak card and today's quest card side by side, two columns.
   - **Shop:** the stall at full width, then the trade cards in two columns, then the Graduate panel.
   - **Passport:** two columns. The Web3 Passport card is on the left. On the right are the stamps, then Bloq with his speech card, then "View on the explorer".
   - **Missions:** the header with Bloq, then the DAO card at full width, then the bounty cards in two columns.
   - **The quest sheet and the Ask Bloq sheet:** keep them as bottom sheets, centred over the centre column, `max-width: 560px`.
   - **Reveal:** no rail. It's centred at 760px, with the "On NEAR" panel on the right showing the whole log.
4. **The game header on desktop:** the logo lives in the rail, so the centre header shows only the Passport pill, aligned right in the inventory row.

Confirm when done:
- At 1280 and 1440px, every game tab shows the rail, the centre and the "On NEAR" panel.
- At 1024px and below, the game looks exactly as it does today.
- After a quest, a sell, a buy and graduating, each transaction appears in the panel with a working explorer link.
- There's no sideways scroll at any width.
- Nothing in `src/bloq/` or `src/near/` changed.
