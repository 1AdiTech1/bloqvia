# Lovable prompt 15 — two small fixes, plus the scroll-bar CSS that didn't land (Nov 7)

**Rules (as before).** Do not edit `src/bloq/*` or `src/near/*`. No logic, contract, reward, price or balance changes. Strict TypeScript and reduced motion as before.

0. **The `bq-scroll` and `bq-pop` CSS from prompt 14 is missing from `src/styles.css`.** The components carry the classes, but the rules never reached the commit (`992f251` only changed `.lv-chat-log` and the phone `.lv-chat`). That's why the "On NEAR" panel still shows Chrome's white scroll bar with arrows. Append this to the end of `src/styles.css` exactly, then confirm with `grep -n "bq-scroll" src/styles.css` that it's there:
   ```css
   /* Shared inset lime scroll bar. The Firefox properties are gated so Chrome keeps the webkit rules (and draws no arrows). */
   .bq-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
   .bq-scroll::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
   .bq-scroll::-webkit-scrollbar-track { background: transparent; }
   .bq-scroll::-webkit-scrollbar-thumb { background: #d4f033; border-radius: 999px; }
   .bq-scroll::-webkit-scrollbar-thumb:hover { background: #a6c21a; }
   @supports (-moz-appearance: none) { .bq-scroll { scrollbar-width: thin; scrollbar-color: #d4f033 transparent; } }
   @keyframes bq-pop-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
   .bq-pop { animation: bq-pop-in .22s ease-out both; }
   @media (prefers-reduced-motion: reduce) { .bq-pop { animation: none; } }
   /* Game pages: the page behind the game is navy, never the landing's ivory. */
   html.bq-game, html.bq-game body { background: var(--navy); }
   ```

1. **"ASK BLOQ" → "Ask Bloq"** in the Ask Bloq window's title (`src/components/lab/AskBloqSheet.tsx`): remove `uppercase` (and any uppercase tracking) from that heading so it reads "Ask Bloq", as in the rail card and the website chat. All widths.

2. **A white band appears at the bottom when "Last days" opens near the end of the page** (`StreakCard.tsx`, `PhoneShell.tsx`):
   - **The cause:** the popover hangs below the card, past the end of the navy game page, so the page grows. The extra space shows the `body` background, which is the landing's ivory.
   - **Fix 1:** in `PhoneShell`, add the class `bq-game` to `<html>` while a game page is mounted (`useEffect`: add it on mount, remove it on unmount), so the page behind the game is always navy (the CSS is in item 0).
   - **Fix 2:** the popover **opens upward** when there isn't room below. On open, measure the panel with `getBoundingClientRect()`. If its bottom would be within 16px of the bottom of the viewport, anchor it above the "Last days" row instead: `bottom: 56px` from the card's bottom, `top: auto`, with the entrance from `translateY(6px)`. Re-check on window resize while it's open. That way opening it never makes the page longer.

Confirm when done, and say what you did and didn't check in the browser:
- `grep -n "bq-scroll" src/styles.css` shows the rules.
- At 1280px the "On NEAR" panel's scroll bar is thin and lime with no arrows.
- Scrolled to the bottom of the Map at 1280 and 390px, opening "Last days" shows no ivory band and the page doesn't get longer.
- The Ask Bloq window title reads "Ask Bloq".
- Nothing in `src/bloq/` or `src/near/` changed.
