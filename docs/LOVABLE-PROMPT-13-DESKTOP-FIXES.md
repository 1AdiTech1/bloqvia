# Lovable prompt 13 — desktop fixes (Adi's list, Nov 6)

Items 2 and 9 were approved from design previews (`docs/design/signin-bloq/` and `docs/design/back-home/`, added to the repo later); everything you need is written below.

**Rules (as before).**
- **Don't touch the logic or the Bloq and chain code.** Do not edit `src/bloq/*` or `src/near/*`. Do not change any game logic, contract call, reward, price or balance.
- **Use the ready-made pieces** from `@/bloq` and `@/near`. Read `src/bloq/README.md`.
- **Strict TypeScript and reduced motion** as before. With `exactOptionalPropertyTypes`, pass optional props only when defined.
- "Desktop" means `dk:` (≥1100px). Below 1100px nothing changes unless an item says "all widths".

1. **Landing chat panel** (`src/components/brand/AskDock.tsx`): move the close × to the panel's top-right corner, `position: absolute; top: 14px; right: 14px`, so it no longer sits in the middle of the taller navy header. All widths.

2. **Bloq on "Start without a wallet"** (`src/components/brand/SignInSheet.tsx`), all widths:
   - Replace the `BloqFace` with the whole Bloq: `<Bloq hat="cap" />`, **112px wide** (96px when the card is under 400px wide), on the card's **top edge**. The wrapper is `position: absolute; left: 0; bottom: calc(100% - H * .04)` (H = his height = width × 4/3, so his feet stand on the edge), `z-index` above the card, and moved only with `transform: translate(x, y)`. The card must not clip him (`overflow: visible`).
   - **Entrance, each time the window opens** (as the landing's Context section does it, see `sitDown()` in `docs/design/landing-v2/index.html`):
     1. He starts standing at the left end of the edge (`x = 26px`, `y = 0`) and walks right, with `walking(true)` and facing right, to his spot: `x = cardWidth − width − 62px` (50px on narrow cards), clear of the ×. Speed about 4ms per px, at least 700ms, linear.
     2. On arrival: `walking(false)`, `pose="sit"`, and in the same moment move him down by `H × .21` over 420ms (`cubic-bezier(.3,.7,.4,1)`), so his seat lands on the edge and his legs hang over the front. Keep his seat shadow (`.bq-seat`); it grounds him on the card.
     3. Then `setMood("laugh", 900)`.
   - Reduced motion: no walk; he's already seated at his spot.
   - When seated, his eyes follow the pointer (`look()` from a window `pointermove`). Hover: `setMood("laugh", 700)`.
   - **Tap:** `setMood("laugh", 1400)` and a short bounce in his seat on an inner wrapper (CSS keyframes, about .9s: squash to `scale(1.06, .92)`, stretch to `scale(.96, 1.06) rotate(-3deg)`, settle; `transform-origin: 50% 75%`). **No `jump()`**, and he never leaves the edge. Reduced motion: no bounce.
   - The page owns this motion through Bloq's `pose` prop and the handle (`walking`, `setMood`, `look`), so nothing in `src/bloq/` changes.
   - The paragraph under the title: `text-align: justify; text-align-last: left; hyphens: auto; text-wrap: pretty`, with `lang="en"` on the `<p>` (hyphenation needs it). In a container query, when the card is 400px wide or less, it goes back to `text-align: left`, because a phone line holds too few words to justify without gaps.
   - Keep the title on one line as now.

3. **The rail and the "On NEAR" panel must stay in place while scrolling** (`src/components/PhoneShell.tsx`): the root `div` uses `overflow-x-hidden`, which turns it into a scroll container and stops `position: sticky` working, so both columns scroll away. Change it to `overflow-x-clip`. Then the rail (logo, tabs and the "Ask Bloq" card at the bottom left) and the panel stay put at every scroll position. There's still no sideways scroll.
   - **Remove the inline "Ask Bloq" links, all widths:** "Ask Bloq a question" under the map trail (`MapPage.tsx`) and "Ask Bloq why prices move" under the shop cards (`ShopPage.tsx`). The agent in the corner (the rail card on desktop, the dock on phones) is the way to ask. **Keep** "Ask Bloq about this" inside the quest window, because that window covers the corner agent.

4. **Map, the two cards under the trail** (desktop): the Community streak card and Today's quest card are the **same height**: let the grid stretch them (`items-stretch`, each card `h-full`, content top-aligned).
   - "Last days" in the streak card is **closed by default** and opens only when the player clicks its arrow. When it's open, the row grows and both cards keep the same height.

5. **"Verify" links** (the daily quest card, the daily quest's success state, and Ask Bloq answers on the landing and in the game): link to `https://cloud.near.ai/verify?model=${encodeURIComponent(model)}`, using `generated_by.model`. Today the link has no model, so NEAR AI shows an empty page. Keep new tab and `rel="noopener noreferrer"`.

6. **Shop on desktop: the three trade cards in one row** (`dk:grid-cols-3`).
   - Inside each trade card, put the quantity stepper on its own full-width row, with Sell and Buy side by side under it.
   - Use a container query on the card: when the card is under 210px wide (around 1100–1250px screens), stack "He pays" and "He charges" one above the other. Otherwise they stay side by side.
   - Check 1100, 1280 and 1440px: no clipped numbers or labels, and the buttons stay at least 44px tall.

7. **Desktop windows open in the middle of the screen, not from the bottom** (desktop only; phones keep the bottom sheets): the quest window (`QuizSheet`, for both the three quests and today's quest), the Ask Bloq window (`AskBloqSheet`) and any other bottom sheet in the game.
   - Centred over the centre column, both ways (keep the current left/right offsets for the rail and panel; also centre vertically).
   - All four corners rounded (28px), `max-width: 560px`, `max-height: calc(100vh - 96px)`, scrolling inside.
   - **No grab handle** (the grey bar) and no drag-to-close on desktop. The × closes it, as do Esc and a click on the backdrop.
   - Opens with a fade and `scale(.96)` → `1` (.22s); reduced motion: fade only.
   - Bloq standing on the window's top edge stays where he is now.

8. **Missions on desktop: Bloq's speech bubble spills into the "On NEAR" panel.** Keep it inside the centre column: on desktop, put the bubble to the left of Bloq (tail pointing right) so it never crosses the column's right edge. Check 1100, 1280 and 1440px.

9. **A way back to the website: a fifth tab, "Home"** (`PhoneShell.tsx`), linking to `/` (the landing page; signed in, it already shows "Continue to the map"). Use lucide `House`. It's never shown as active, since it leaves the game.
   - **Desktop rail:** "Home" is the first row, above Map, same row style as the tabs, in ivory text, with a thin divider line (`1px`, `ivory/10`) between it and Map.
   - **Phone tab pill:** "Home" is the first of five items. Keep the pill and the agent dock as they are and let the five items share the width. If the labels don't fit at 360px, drop them to 9px with `letter-spacing: .02em`; under 360px wide (320px phones), "Passport" may read "Pass". Nothing may clip or overlap; every item stays at least 44px tall.

10. **The block number shows once on desktop.** On desktop, hide the "NEAR testnet · block …" ticker on the map trail, because the "On NEAR" panel already shows it. On phones there's no panel, so the trail keeps its ticker. Do it in `styles.css` (for example `@media (min-width: 1100px) { .bloq-trail-wrap > .bloq-ticker { display: none } }`), not in `ChainTrail`.

Confirm when done, and say plainly what you did and didn't check in the browser:
- At 1280px, scrolling the Map to the bottom keeps the rail's tabs, the Ask Bloq card and the "On NEAR" panel on screen.
- The quest window and the Ask Bloq window open centred, with no grab handle, at 1280px; on a 390px phone they're still bottom sheets.
- The three shop cards fit one row at 1100, 1280 and 1440px with nothing clipped.
- Sign-in window at 320, 390 and 1366px: Bloq sits on the top edge, tapping him bounces him in place, and the text is justified on desktop and flush left at 320.
- The Verify link opens NEAR AI with the model filled in.
- "Home" goes to the landing from the rail at 1280px and from the tab pill at 320, 360 and 390px, with nothing clipped.
- On desktop the map trail has no block ticker; on a 390px phone it still does.
- No sideways scroll at any width, and nothing in `src/bloq/` or `src/near/` changed.
