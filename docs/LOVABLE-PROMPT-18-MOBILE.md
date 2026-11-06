# Lovable prompt 18 — mobile fixes (Adi's phone test, Nov 7)

Approved preview: `docs/design/mobile-fixes/index.html` (sections 1, 3 and option B of section 4).

**Rules (as before).** Do not edit `src/bloq/*` or `src/near/*`. No logic, contract, reward, price or balance changes. Strict TypeScript and reduced motion as before. Desktop (≥1100px) stays as it is unless an item says otherwise.

## 1. The daily quest crashes the page on phones (do this first)

On Adi's iPhone (Safari, normal and private), answering **today's quest** correctly shows the root error page, "This page didn't load". After a reload the quest shows "Done", so the transaction went through and the crash comes after it. The three founding quests don't crash.

- **Reproduce it in your sandbox browser.** Use a fresh account, at 390×844, in Playwright **WebKit** and in Chromium. Open today's quest from the Daily quest card and answer it. The answer is only a hash on chain, so try the options in order: wrong ones are refused by the contract and cost nothing. Capture the console error and its stack from `ErrorComponent` in `src/routes/__root.tsx`, which already does `console.error(error)`.
- **Fix the root cause** in the component that throws. Don't wrap the whole page in a try/catch. Report the error text, the file and line, and what you changed.
- **Make the next one easier to find.** In the root `ErrorComponent`, add a small "Show details" toggle under the buttons. It reveals `error.message` and the first 3 lines of `error.stack`, in mono, 12px, `break-all`, with a "Copy" button. Keep it closed by default.

## 2. Scroll bar on phones and tablets: our own lime indicator

iPhone and Android browsers ignore scroll-bar colours, so on touch screens we hide their bar where we can and draw our own.

- **A new component, `src/components/TouchScrollbar.tsx`,** mounted once in `AppChrome`. It's active only when `matchMedia("(pointer: coarse)")` matches.
  - It's a fixed lime pill on the right: `right: max(3px, env(safe-area-inset-right))`, 6px wide, `border-radius: 999px`, `#d4f033`, with a `0 0 0 1.5px rgb(22 36 58 / .35)` ring.
  - Its length is `max(40px, vh² / scrollHeight)`, and its position follows `scrollY`.
  - It fades in on `scroll` (.12s) and fades out 1s after scrolling stops (.35s).
  - A 22px-wide invisible strip under it (`touch-action: none`) lets the player drag it to scroll.
  - `pointer-events: none` on the pill itself; `aria-hidden`.
  - Reduced motion: no fade, just show and hide.
- **Hide the native bar where the browser allows it:** `html.touch-sb { scrollbar-width: none } html.touch-sb::-webkit-scrollbar { display: none }` (the component adds `touch-sb` to `<html>`). This is the one place where `scrollbar-width` is wanted, because the goal is to hide the bar.
- **iPhone/iPad:** Safari doesn't let a website hide its own grey indicator for the page itself. So on iOS (detect with `/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)`), **don't** draw our page indicator. There'd be two bars. Inner scroll areas (the quest window, Ask Bloq, the Last days list, the chat) already use `bq-scroll`. Add `.bq-scroll::-webkit-scrollbar { display: none }` under `(pointer: coarse)` there, since phones show their own overlay inside those too.
- Check at 390 and 820px in Chromium with touch emulation: one lime bar, and it fades. Then say plainly what iOS will show.

## 3. The grey bar on bottom sheets drags them down

On phones and tablets (below 1100px), the grab bar on `QuizSheet` and `AskBloqSheet` works like an iOS sheet. Use framer-motion:
- Put `drag="y"` with `dragListener={false}` on the sheet panel, and start it from the grab bar only (`useDragControls`, `onPointerDown={(e) => controls.start(e)}` on the bar, `touch-action: none`), so scrolling the content still scrolls.
- `dragConstraints={{ top: 0, bottom: 0 }}`, `dragElastic={{ top: 0, bottom: 1 }}`.
- `onDragEnd`: if `offset.y > panelHeight * 0.33` or `velocity.y > 600`, close with the same exit as the × or the backdrop. Otherwise it springs back.
- Make the bar a bigger target: 44px tall, with the 48×6 pill centred, `cursor: grab`. On hover or while dragging, the pill goes to 56px wide and `navy/35`.
- The bar gets `role="button"`, `aria-label="Drag down to close"`, and Enter or Space closes.
- Desktop keeps the centred window with no bar, as now.

## 4. Landing on phones: Bloq hops down onto the card in view (option B)

On narrow screens the cards stack, so Bloq stays at the top of the section and the player loses him while scrolling. This applies to the three card sections in `src/pages/Landing.tsx`: "A little context" (the walking Bloq, `cap2`), "Your first adventure" (the chapters perch, which changes hat per chapter) and the Experience Lab perch. Below the width where the cards stack (the existing `oneRow()` false / `max-width: 860px`):
- **Bloq lives inside the cards' container** (`position: relative`, with `padding-top` of about 96px so he fits above the first card). He sits on the top edge of one card at a time, at its right: `right: 12px`, `transform: translateY(card.offsetTop − H × 0.75 + 4px)` (H = his height; 0.75 is his seat line), `pose="sit"`, about 86px wide.
- **On scroll** (passive listener plus `requestAnimationFrame`), find the card whose centre is nearest 45% of the viewport height. When it changes:
  1. Hide the speech bubble. Set `pose="idle"` and call `jump()`.
  2. After 120ms, move him to that card: transition `transform .55s cubic-bezier(.34,1.3,.64,1)`. For chapters and Lab cards, set the card's `hat` and `prop` as the hover does on desktop, and mark the card `on`.
  3. At about 640ms, set `pose="sit"` and show the card's line (`data-say`) in his speech bubble, **to his left**: right edge 74px from his right, `max-width: 168px`, 13px text, the same bubble style as now. Call `talk()`.
  4. Fully inside the screen at 320px: nothing clipped.
- The first time a section comes into view, he's already seated on its first card (no hop). With reduced motion: no jump or transition; he's placed instantly.
- The section's Ask Bloq dock doesn't need to move: he's at the right of the card, above the dock's height.
- Desktop and tablets in landscape where the cards are in a row keep today's behaviour (walk along the top, perch hover).

Confirm when done, and say what you did and didn't check in the browser:
- The daily quest error: the cause, the fix, and a WebKit 390px run where today's quest completes with no error page.
- The error page's "Show details".
- The touch scroll bar at 390 and 820px (Chromium touch emulation), and what you did for iOS.
- Dragging the quest window's bar down closes it at 390px; a short drag springs back; scrolling the quest text doesn't drag.
- On the landing at 390px and 320px, Bloq hops to each card in all three sections, changes hat on the chapters, and his bubble is fully on screen.
- Nothing in `src/bloq/` or `src/near/` changed.
