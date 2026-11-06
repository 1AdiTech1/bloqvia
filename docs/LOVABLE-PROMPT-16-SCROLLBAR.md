# Lovable prompt 16 — one scroll bar on the game pages (Nov 7)

Approved preview: `docs/design/one-scrollbar/index.html`.

**Rules (as before).** Do not edit `src/bloq/*` or `src/near/*`. No logic, contract, reward, price or balance changes. Strict TypeScript and reduced motion as before. "Desktop" means `dk:` (≥1100px).

On desktop the game shows two scroll bars on the right: the "On NEAR" panel's own lime bar, because its list is taller than the screen, and Chrome's default white bar for the page. Make it one bar, in the game's colours.

1. **The "On NEAR" panel never scrolls on its own** (`src/components/PhoneShell.tsx`, `src/components/lab/ChainPanel.tsx`):
   - On the game tabs (Map, Shop, Missions, Passport), the panel shows the **4 latest** transactions (`limit={4}`). When `txLog` has more, put a lime link under the list: "See all {n} on the explorer ↗", where `n = txLog.length`. It goes to `explorer.account(accountId)`, new tab, `rel="noopener noreferrer"`, semibold display font, underline only on hover and focus. With 4 or fewer it doesn't show.
   - The panel's wrapper drops `overflow-y-auto` and `bq-scroll`. It stays `sticky top-0`, with `max-h-screen` and `overflow: hidden` as a safety net.
   - **Reveal** (`chain` mode): it shows the **whole** log. The panel is **not** sticky there and has no height cap, so it scrolls with the page.
   - Check at 1280×720 and 1440×900 with 8 or more entries: the panel fits with no inner scroll bar, and the "See all" link is visible.

2. **The page's own scroll bar matches the game, on game pages only** (`src/styles.css`). The `html.bq-game` class is already set by `PhoneShell`. Add:
   ```css
   html.bq-game::-webkit-scrollbar { width: 10px; }
   html.bq-game::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
   html.bq-game::-webkit-scrollbar-track { background: var(--navy); }
   html.bq-game::-webkit-scrollbar-thumb { background: var(--lime); border-radius: 999px; border: 3px solid var(--navy); }
   html.bq-game::-webkit-scrollbar-thumb:hover { background: var(--lime-d); }
   @supports (-moz-appearance: none) { html.bq-game { scrollbar-width: thin; scrollbar-color: var(--lime) var(--navy); } }
   ```
   As with `bq-scroll`, **don't** put `scrollbar-width` or `scrollbar-color` where Chrome sees them, or Chrome draws its default bar with arrows. The landing keeps the browser's default bar.

Confirm when done, and say what you did and didn't check in the browser:
- On the Map at 1280px, with 8 or more transactions: one scroll bar on the right (navy track, lime handle, no arrows), the panel shows 4 entries and the "See all" link, and the link opens the account on nearblocks.
- Reveal shows the whole list and scrolls with the page.
- The landing's scroll bar is unchanged.
- Nothing in `src/bloq/` or `src/near/` changed.
