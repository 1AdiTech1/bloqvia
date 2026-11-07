# Lovable prompt 22 — four fixes after Adi's check (Nov 8)

Approved mock-up: `docs/design/season2-fixes/index.html` (four sections, real Bloq components).

**Most important rule (as in prompt 21): don't remove or change anything this prompt doesn't name.** Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict TypeScript, reduced motion and try/catch around storage as before.

## 1. Landing, phones: Bloq waits half a second before jumping into the Passport panel (`src/pages/Landing.tsx`, `ProgHop`)

Today `onScroll` jumps him to the panel (`go(-1, true)`) on the first frame `target()` returns `-1`. Change only that direction:
- When `target()` is `-1` and he isn't in the panel yet, start one 500ms timer (don't restart it on every scroll event). When it fires, call `go(-1, true)` only if `target()` is still `-1`.
- When `target()` returns a card index, clear that timer and behave exactly as today (`if (i !== s.at) go(i, true)`).
- The first placement on load (`go(target(), false)` in the IntersectionObserver) stays immediate. Clear the timer in the effect's cleanup.
- Everything else in `ProgHop` (positions, poses, lines, the desktop version) stays as it is.

## 2. Season 2 opens only after graduation, phones and desktop (`src/pages/MapPage.tsx`)

On chain, core now refuses a chapter until the account has graduated (`"Graduate first to open Season 2"`). The map shows the same rule:
- `graduated = !!learner?.graduated`. `s2Open = (s1Done && graduated) || stamped`.
- `started = (graduated && (chaptersDone > 0 || storedStart)) || stamped` (an account that played chapters before this rule but never graduated sees Season 2 locked).
- **Season 1 done, not graduated:** Bloq stays at the shop door after his cheer with the merchant. No perch on the Season 2 card. He says `Graduate in my shop first. Your sealed Passport opens Season 2.` (as the Season 1 trail's tip at level 3 while `!graduated`, and via `trail.current?.say(...)` after `arrived1(3)` instead of `perchAt`). `intro` on the Season 1 trail becomes `intro={!(s2Open && !started)}`.
- The Season 2 card stays **locked** (🔒 icon, dashed border, as before Season 1) while `!s2Open`. Its action, only when `s1Done && !graduated`: a `Link` to `/shop` styled as an outline pill: same size as the Start button, transparent background, lime text, `box-shadow: inset 0 0 0 1.5px var(--lime)`, no pulse. Text `Graduate first ↑` (narrow: `Graduate ↑`, same `season-wide`/`season-narrow` spans).
- The Season 2 trail: `locked={!s2Open || IS_MOCK}` and `dim` while `!s2Open`.
- While `s1Done && !graduated`: tapping the Season 2 card (not its button) or a Season 2 block makes Bloq say the same line (`playChapter` checks `graduated` first and says it instead of starting).
- **Graduated:** everything as approved in prompt 21 (perch on the card next to Start, the jump on Start). After graduating, the reveal's `Continue your journey →` already returns to `/map#season-2`, where the page opens with Season 1 done and graduated, so Bloq sits on the card at once.

## 3. A Season 2 reveal page, opened after the stamp moment

New route `/season-2` (file `src/routes/season-2.tsx`, like `src/routes/reveal.tsx`) rendering a new exported `Season2RevealPage` in `src/pages/RevealPage.tsx`, reusing that file's `Beat`, `Card`, `ExtLink`, the key card and `playAgain`. Wrapped in `RequireAccount` and `PhoneShell chain`, like the reveal. If the Passport has no Season 2 stamp, navigate to `/map`.

Content, top to bottom (same classes and Beat delays as the Season 1 reveal):
- Top row: on the left, instead of the gold seal, the **Season 2 stamp** SVG from `Web3Passport` (export it as `SeasonStamp`, `aria-hidden`), 132px wide, `rotate(-9deg)`, `filter: drop-shadow(0 0 8px rgb(212 240 51 / .35))`. On the right, Bloq `hat="captain" prop="passport"`, with the same timing as the detective: at 0.6s `Three chapters, one stamp. All of it on chain.`; at 3.4s cheer, jump, laugh and the cube burst; at 4.6s thumbs and `Stamped for good. This Passport only ever gains.`
- h1 `Season 2, stamped on NEAR.`; lead `Three chapters and a stamp: real transactions on the NEAR blockchain, in an account that belongs to you.`
- Cards: **Your account** (as the reveal); **Your Passport**: the `Web3Passport` with `stamps={p.stamps}` at the card's width, then `A non-transferable token at level {level}{graduated ? ", sealed as Graduate" : ""}, with the Season 2 stamp.` and **View Passport**; **Your key** (as the reveal, same Copy and warning).
- Eyebrow `What happened in Season 2`, then one step per completed chapter, in map order: `Chapter "Digital Ownership": rewards minted to your account`, `Chapter "Transactions": rewards minted to your account`, and for `chapter-defi` `Chapter "Decentralised Finance": rewards minted, and your Passport stamped in the same transaction`. Each step's **View transaction** opens that chapter's transaction from `useBloqvia().txLog` (`kind === "quest"`, `ref === lesson_id`) when it's there, else the account page. Chapter bullets `#e8beff`, the last one lime. Titles from `useChapters`, with the same fallbacks.
- `Both seasons done. Thanks for playing. Everything you earned is yours.`
- Buttons: lime `← Back to the map` (to `/map`) and outline `Start again` (the reveal's `playAgain`: sign out, go home), styled like the reveal's pair.

On the map, when the stamp moment has played (the 2.6s moment and the cheer), navigate to `/season-2` after another 2600ms (900ms with reduced motion), the same delay the shop uses after graduation. Only in that case; a page that opens already stamped stays on the map. The door keeps `✓ Stamped on NEAR · Season 2` and `See your Passport`.

## 4. Phones: the journey line first, the two cards at the bottom (`MapPage.tsx`)

Below 1100px the order becomes: the header (logo + Passport pill), **Your journey** and its line, the inventory, the season map (both cards and roads), then the Community streak and Today's quest cards. Desktop doesn't change: keep every `dk:` class as it is.
- Journey wrapper: `order-4` → `order-2`; its eyebrow `mt-8` → `mt-1` (keep `dk:mt-0`).
- Inventory wrapper: `order-2` → `order-3`, plus `mt-4 dk:mt-0`.
- Season map wrapper: `order-5` → `order-4`, plus `mt-6 dk:mt-0`.
- Cards wrapper: `order-3` → `order-5`, and `mt-3` → `mt-10` (keep `dk:mt-6` and the rest).

## Confirm when done

- Landing at 390px: scrolling slowly from the Contract Seal card, Bloq jumps into the Passport panel about half a second after it comes into view; scrolling back up within that half second keeps him on the cards.
- Map, Season 1 done and not graduated (phone and desktop): Bloq stays at the shop door with the graduate line, the Season 2 card is locked with `Graduate first ↑`, tapping the card or a Season 2 block repeats the line. Graduated: the perch and Start as before.
- After the third chapter: the stamp moment, the cheer, then `/season-2` with the content above and the two buttons.
- Map at 390px: header, journey line, inventory, the two seasons, then the streak and daily cards. 1440px unchanged.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
