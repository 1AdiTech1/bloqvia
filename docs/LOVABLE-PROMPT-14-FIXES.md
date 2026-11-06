# Lovable prompt 14 — fixes from the live site (Adi's list, Nov 6, round 2)

Approved preview: `docs/design/fixes-14/index.html` (sections 2–6). Section 1 (Bloq walking backwards on the trail) is fixed in `src/bloq/ChainTrail.tsx` by Adi and isn't part of this prompt.

**Rules (as before).**
- **Don't touch the logic or the Bloq and chain code.** Do not edit `src/bloq/*` or `src/near/*`. Do not change any game logic, contract call, reward, price or balance.
- **Strict TypeScript and reduced motion** as before.
- "Desktop" means `dk:` (≥1100px).

1. **Quest window: the × doesn't work, and the scroll bar** (`src/components/QuizSheet.tsx`, all widths unless noted):
   - **The ×:** Bloq's box (`absolute z-10`, `right: 22`, lifted 74%) covers the ×, and the × sits inside the scrolling div, so it also scrolls away. Move the × out of the scrolling div into the positioned wrapper. Make it 44×44, at `top: 12px; right: 12px`, with `z-index` above Bloq. Move Bloq's box to `right: 68px` so he stands clear of it. Click, Enter and Space all close the window.
   - **The scroll bar, here and everywhere a card or panel scrolls.** That means this window, the Ask Bloq window (`AskBloqSheet`), the "Last days" popover (item 2), the landing chat log (`AskDock`) and the "On NEAR" panel. Make one shared class, `bq-scroll`, in `styles.css`:
     - **Inset the scroller from the card's edges** so the bar sits inside the card, clear of the rounded corners. In the quest window, the ivory card stays the rounded box and the scrolling div inside it is `position: absolute; inset: 14px 8px 14px 0` (content padding `16px 20px 12px 30px`; the × stays on the card, not in the scroller). Elsewhere, use the same idea: about 8px between the bar and the card's right edge, and 14px at the top and bottom.
     - Chrome, Edge and Safari: `.bq-scroll::-webkit-scrollbar { width: 6px }`, `::-webkit-scrollbar-button { display: none; width: 0; height: 0 }` (**no arrows**), `::-webkit-scrollbar-track { background: transparent }`, `::-webkit-scrollbar-thumb { background: #d4f033; border-radius: 999px }`, and `#a6c21a` on hover.
     - Firefox only: `@supports (-moz-appearance: none) { .bq-scroll { scrollbar-width: thin; scrollbar-color: #d4f033 transparent } }`. **Don't put `scrollbar-width` or `scrollbar-color` where Chrome sees them.** When Chrome finds them, it ignores the `::-webkit-scrollbar` rules and draws its own bar with arrow buttons at the very edge, which is the bug in Adi's screenshot.

2. **Map cards: "Last days" opens on its own, and no empty space** (`StreakCard.tsx`, `DailyQuestCard.tsx`, `MapPage.tsx`; all widths for the popover, desktop for equal heights):
   - **"Last days" becomes a popover.** Clicking the arrow opens the list as a floating panel anchored under the "Last days" row. It sits over whatever is below (`position: absolute`, `left/right: 10px`, `top: calc(100% − 12px)` of the card, `z-index` above the page), on `--card` with radius 18, `box-shadow: 0 22px 50px rgb(0 0 0 / .35)` and a 1px `#e3dccb` ring. Its list is `max-height: 236px`, scrolls inside with `bq-scroll` (about 8px from the panel's right edge), and opens with a .22s fade and `translateY(-6px)`. Click outside, Esc or the arrow closes it, and it's closed by default. **Neither card changes size** when it opens or closes.
   - **Each day is one line:** "**Day 290** · 1 check-in" on the left, and "missed · −100" (coral) or "kept · +100" (dark lime) on the right, never wrapping. Under the list: "Treasury {n} · supply {n}" in small mono.
   - **Shorter streak card:** "See it on the explorer" joins the "You hold 0 STREAK · 1 check-in" line, as a small "explorer ↗" link on the right of that line: semibold navy, **no underline** (`no-underline`), turning `#6f8f0f` on hover and keyboard focus. Use "check-in" in the singular when the count is 1.
   - **Today's quest card, no empty space:** under the title, the quest's idea (`concept`) in one or two lines (`line-clamp-2`, 14px, `ivory/80`), then the reward chips. The Play button and the "Written by an AI agent…" line go to the bottom of the card (`mt-auto`). On desktop both cards stay the same height (`items-stretch`).

3. **Reveal: "Back to the map" next to "Play again"** (`src/pages/RevealPage.tsx`, all widths): under "Thanks for playing. Everything you earned is yours.", put a row with:
   - a lime "← Back to the map" button (`ArrowLeft`, 52px tall) that goes to `/map`, the finished map;
   - "Play again" next to it as a ghost button (transparent, lavender text, 1.5px lavender/40 border), still doing what it does today.
   - On phones the two stack full width, "Back to the map" on top.

4. **Website chat opens bottom left instead of bottom right** (`src/components/brand/AskDock.tsx`): the chat `<section>` has `className="lv-chat relative"`. The Tailwind `relative` overrides `.lv-chat`'s `position: fixed`, so the panel drops into the page flow at the bottom left. **Remove `relative`.** A fixed element already positions the absolute × inside it. The panel stays anchored bottom right above the agent button, 16px from the right and bottom plus the safe-area insets. On phones it's full width minus 16px on each side. Check 1366 and 390px.

Confirm when done, and say plainly what you did and didn't check in the browser:
- At 1280px the quest window's × closes it, and Bloq stands left of the ×. The scroll bar is 6px, lime, rounded, inside the card, with no arrows, in Chrome. Same at 390px, and in the Ask Bloq window, the Last days popover, the landing chat and the On NEAR panel.
- Opening and closing "Last days" doesn't change either card's size at 1280 or 390px. Each day fits on one line.
- The Reveal shows "Back to the map", which opens `/map`.
- On the landing at 1366 and 390px, the chat opens bottom right, fully on screen.
- Nothing in `src/bloq/` or `src/near/` changed.
