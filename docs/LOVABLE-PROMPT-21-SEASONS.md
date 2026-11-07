# Lovable prompt 21 — Season 2 on the map, the Passport stamp, Reveal and landing (Nov 7)

Approved previews (open them, they are the real components):
- `docs/design/season2-app/index.html` — corrections on top of the two below: the block pill stays as today (phones: above each road; desktop: only in the On NEAR panel), Ask Bloq inside chapters 04–06, and the app's own Passport card keeping all its fields with the stamp added.
- `docs/design/seasons/index.html` — the two worlds (Block Fields above, Network City below), the two season cards, Bloq walking round the blocks, sitting on the Season 2 card's edge, the jump over it on Start, the curtain on the shop, and the Reveal buttons.
- `docs/design/season2/index.html` — the Season 2 road ending at the Passport office, the stamp moment, the stamped Passport card and the Passport page rows.

**Most important rule: don't remove or change anything this prompt doesn't name.** Everything on these screens that isn't listed below stays exactly as it is today (texts, buttons, pills, cards, animations, the On NEAR panel, the Ask Bloq dock and buttons). If something seems to be in the way, ask in your reply instead of removing it.

**Rules (as before).** Do not edit `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`; they are already in your copy from GitHub. No contract, reward, price or balance logic in the app: the chain decides. Strict TypeScript and reduced motion as before. Wrap any `localStorage` read or write in try/catch.

What's new from GitHub, ready to use:
- `@/near`: `useChapters()` → `{ chapters, loading, error, refresh }`. Each chapter has the same fields as a daily quest (`lesson_id, title, topic, concept, question, options, success, near_reveal, explanation, reward_gold, reward_item, reward_item_amount`), in map order. Also `SEASON2_CHAPTERS` (`["chapter-ownership", "chapter-transactions", "chapter-defi"]`), `SEASON2_STAMP` (`"season-2"`) and `season2Done(passport)`. `PassportView` now has `stamps: string[]`. `useDailyQuests()` now returns `daily-` quests only.
- `@/bloq`: `ChainTrail` has new props `world`, `locked`, `guideAt`, `curtain`, `hostHello`, `onArrived`, `ticker`, `firstNumber`, `host`, and the handle has `cheer`, `entry`, `jumpTo`, `greet`, `perchAt`. The doc comments in `src/bloq/ChainTrail.tsx` explain each one. `BlockTicker` is exported too. The road now starts 46px below the top of the trail (was 18px), so the first block's number stays clear of the season card above it, and of the block pill on phones; that spacing is in `src/bloq/bloq.css`, so don't add extra margin for it.
- How it works on chain: the three chapters are bonus quests (BloqGold + an item, the Passport level never changes), and the contract refuses them until Season 1's three quests are done. **The right answer to the third chapter is also the transaction that stamps the Passport**: there is no separate "stamp" call or button.

## 0. Types

- `src/game/types.ts`: add `stamps: string[];` to `PassportView`.
- `src/game/mockGame.ts`: the mock passport gets `stamps: []`. Chapters don't play in mock mode (same as daily quests today).

## 1. The map: two seasons (`src/pages/MapPage.tsx`)

Keep the header, inventory, streak and daily cards and the "Your journey" heading exactly as they are. Replace the single trail (`order-5` block) with, in this order: **Season 1 card → Season 1 trail → Season 2 card → Season 2 trail**, as in the seasons preview.

**Progress.**
- `FOUNDING = LESSON_CONTENT.map(l => l.lesson_id)`. `foundingDone = completed.filter(id => FOUNDING.includes(id))` (today it's "not `daily-`", which would now count chapters). `s1Done = foundingDone.length >= 3`.
- `chaptersDone = SEASON2_CHAPTERS.filter(id => completed.includes(id)).length`. Keep a second trail level `s2Level` that follows `chaptersDone` the same way `trailLevel` follows `foundingDone` (updated after the quiz closes, 450ms later).
- `stamped = season2Done(game.passport)`.
- `started` (Season 2 started): true if `chaptersDone > 0 || stamped`, or if `localStorage["bloqvia:s2:" + accountId] === "1"` (set when Start is pressed).

**Season cards.** A small `SeasonCard` component in MapPage: one slim row, two lines, 30px rounded icon on the left, optional action on the right.
- Season 1: icon `1` (or `✓` when `s1Done`), eyebrow `Season 1 · The Block Fields · {foundingDone.length}/3`, title `The Vault · The Fuel System · Smart Agreements` (narrow: `Vault · Fuel · Agreements`).
- Season 2: `id="season-2"` (with `scroll-margin-top: 96px`), 64px above it. Icon `🔒` until `s1Done`, then `2`, `✓` when stamped. Eyebrow `Season 2 · Network City`, plus ` · {chaptersDone}/3` once `started`. Title `Digital ownership · Transactions · Decentralised finance` (narrow: `Ownership · Tx · DeFi`). When `s1Done && !started`, the action is a lime pill button `Start Season 2 ↓` (narrow: `Start ↓`), 40px high, with the soft lime pulse from the preview (none under reduced motion).
- Styles from `docs/design/seasons/index.html` (`.scard`, `.g-ico`, `.eb`, `.g-btn`): padding 10px 14px, radius 1.1rem, 1.5px border `ivory/14`; open or done → lime border with a faint lime glow; locked → 1.5px dashed `lavender/50`. Season 1 background `linear-gradient(90deg,#23344f,#1f2d47)`, Season 2 `linear-gradient(90deg,#23344f,#2c2058)`. Eyebrow 10.5px, uppercase, letter-spacing .16em, lime (Season 2: `#e8beff`), progress in lavender; title 15.5px display. Both lines are one line each with an ellipsis. Narrow = the map column under 480px (use a container query on the column, as the preview does); there: icon 26px, title 15px, eyebrow 10px with .1em spacing, gap 10px, padding 10px 12px.
- No block number on the season cards. **The "NEAR testnet · block" pill above the road stays exactly as today:** don't pass `ticker` (it defaults to on), so on phones and tablets it shows above each road, Season 1 and Season 2. On desktop the existing rule in `styles.css` (`@media (min-width: 1100px) { .bloq-trail-wrap > .bloq-ticker { display: none; } }`, from prompt 13) keeps it off the map, because the On NEAR panel on the right shows it. Keep that rule as it is.
- Both trails keep today's `className="mt-4 dk:mt-6"`.

**Season 1 trail.** As today, plus: `guideAt={started ? "gone" : "here"}`, `curtain={started}`, `hostHello="Hello! The shop's still open. Come and trade any time."`, `intro={!(s1Done && !started)}`, `onArrived={arrived1}`. The shop door text and "Enter Bloq's shop" stay as they are (the button keeps working behind the curtain).

**Season 2 trail.**
```tsx
const S2_KINDS = ["ownership", "transfer", "pool"] as const;
const S2_POSTS = ["NFTs · NEP-171", "signed · NEP-366", "pricing.rs · the curve"] as const;
const OFFICER = { hat: "captain", prop: "passport", label: "Bloq the officer, in the Passport office" } as const;
// stops: from useChapters().chapters (fallback titles "Digital Ownership", "Transactions", "Decentralised Finance"),
// id = SEASON2_CHAPTERS[i], kind = S2_KINDS[i], post = S2_POSTS[i], reward = <ItemIcon id={chapter.reward_item} />
<ChainTrail ref={trail2} world="city" locked={!s1Done} level={s2Level}
  stops={S2_STOPS} firstNumber={4} host={OFFICER} doorAccount="passport.bloqvia.testnet" className={s1Done ? "mt-4 dk:mt-6" : "dim mt-4 dk:mt-6"}
  guideAt={started ? "here" : "gone"} intro={started} blockHeight={height} tip={tip2}
  onPlay={(i) => playChapter(i)} onArrived={arrived2} door={officeDoor} />
```
- `.bloq-trail-wrap.dim .bloq-trail { opacity: .55; filter: saturate(.6); }`
- `tip2(l, st) = l >= 3 ? "Season 2 done! Your Passport has its stamp." : \`Welcome to Network City! Chapter 0${l + 4}: ${st[l]?.title}. Tap the glowing block.\``
- `playChapter(i)`: if `started`, open the quiz for `SEASON2_CHAPTERS[i]`. If not started yet, do the Start jump first (below), then open it when he has landed.

**Bloq waiting on the Season 2 card, then jumping over it** (exactly as in the seasons preview):
```ts
const ASK = "Ready for Season 2? Press Start and I'll jump in!";
// his seat: on the card's top edge, in the gap just left of the Start button
const seat = () => {
  const r = card2.current?.getBoundingClientRect(), b = card2.current?.querySelector(".g-btn")?.getBoundingClientRect();
  const t = card2.current?.querySelector(".g-txt b")?.getBoundingClientRect();
  if (!r) return null;
  if (!b) return { x: r.right - 70, y: r.top };
  const gapL = t ? Math.min(t.right, b.left) : b.left - 90;
  return { x: Math.max(Math.min((gapL + b.left) / 2, b.left - 46), gapL + 16), y: r.top };
};
```
- **Page opens with `s1Done && !started`:** 450ms after mount, `trail1.current?.perchAt(seat(), ASK, true, true)` (placed there, sitting). Do it again (instant) on resize, debounced 200ms.
- **Season 1 finished in this visit** (`arrived1(level)` with level 3, after his cheer with the merchant): wait two animation frames (the Start button has just appeared), then `trail1.current?.perchAt(seat(), ASK, false, true)`. He walks down the left of the shop and along the card edge and sits; never a hop.
- **Start:** `localStorage` flag on; disable the button; at 900ms turn the curtain on; `await trail1.current?.jumpTo(trail2.current!.entry()!, "Here I go!")`; then set `started` (Season 1 `guideAt="gone"`, Season 2 `guideAt="here"`) and, 60ms later, `trail2.current?.greet()`. This is the only jump on the map.
- After Start the card loses its button and shows the progress.

**The Passport office (end of Season 2).** `officeDoor`:
- not all three chapters: `Finish Season 2 to get your Passport stamp` (lavender, like the shop's line).
- `chaptersDone === 3 && !stamped`: `Season 2 complete. Here comes your stamp…`. While in this state call `game.refresh()` every 3s for up to 30s; after that: `Your stamp is on its way. Check back in a minute.`
- `stamped`: `✓ Stamped on NEAR · Season 2` (ivory, the tick in lime) and an outline pill link `See your Passport` → `/passport` (border 1.5px lime, lime text, same size as "Enter Bloq's shop").

**The stamp moment** (only when the third chapter was answered in this visit): when `arrived2(3)` fires and `stamped` is true (or as soon as it becomes true after he arrived), show the moment over the office for 2.6s, then the door's stamped state and `trail2.current?.cheer("Stamped! Season 2 is on your Passport for good.")`.
- The moment: absolutely positioned in the Season 2 trail's wrapper, centred, `bottom: 150px`, z-index 20, a column with 8px gap; pops in (0.45s, `cubic-bezier(.34,1.4,.64,1)`, from 24px lower at scale .7). Inside: the `Web3Passport` (section 3) at `width: min(300px, 84vw)` with `stamps={["season-2"]}` and `slam`, then a pill caption `Stamped on NEAR · View transaction ↗` (12.5px, ivory on `rgb(13 22 38 / .85)`, 6px 10px padding); the link opens `game.lastTx.url` in a new tab. `role="status"`, `aria-label="Your Passport gets the Season 2 stamp"`. Reduced motion: no pop, no slam.

Everything else on the map stays: the quiz sheet, held numbers, "Saved on NEAR ✓", the inventory flight.

## 2. Quiz sheet for chapters (`src/components/QuizSheet.tsx`)

- `const chapter = useChapters().chapters.find(c => c.lesson_id === lessonId);` and `lesson = daily ?? chapter ?? founding`.
- Tag line: `Chapter 0${SEASON2_CHAPTERS.indexOf(lessonId) + 4}` for chapters (founding stays `Chapter {index + 1}`, daily stays as is).
- Looks:
  - `chapter-ownership`: `{ hat: "aviator", prop: "passport", hello: "Chapter four: owning things on chain. Your Passport is the example." }`
  - `chapter-transactions`: `{ hat: "agent", prop: "key", hello: "Chapter five: transactions. Who signs, who pays, and why nobody can change it." }`
  - `chapter-defi`: `{ hat: "tophat", prop: "coin", hello: "Last one: DeFi. My shop is a tiny market run by code." }`
- **Bloq's AI agent, the same as in quests 1–3:** keep `AskBloqButton label="Ask Bloq about this"` under the concept and `AskBloqSheet` with `lessonId={lesson.lesson_id}` (the chapter id) and `context="quiz"`, so the sheet opens with the quiz chips. Don't hide or change them for chapters. The relayer now reads a chapter's text from the chain as context for Ask Bloq, the same way it does for daily quests.
- No "Who wrote this quest" block for chapters (they have no `generated_by`); daily quests keep theirs. Everything else is the same as for the founding quests.

## 3. The stamped Passport card (`src/components/lab/Web3Passport.tsx`)

- New optional props `stamps?: string[]` and `slam?: boolean`. `const s2 = stamps?.includes("season-2")`.
- Every field stays as today (Holder, Level, Status, Chain · standard); nothing is replaced. When `s2`: the second MRZ line becomes `pad(\`NEP171<SOULBOUND<<LVL${level}<<\`.padEnd(34, "<") + (graduated ? "SEALED" : "<<<<<<") + "<<S2", 44)`; the aria-label ends with `, Season 2 stamp`.
- When `s2`, render the stamp after the seal SVG (`aria-hidden`), copied from `docs/design/season2` (`Stamp` in its source): a 156×100 SVG, a turbulence "ink" filter (give the filter id a `useId()` suffix), lime `#d4f033` strokes: outer rounded rect (x4 y4 w148 h92 rx14, stroke 3.2), inner (x10 y10 w136 h80 rx9, stroke 1.3), `SEASON 2` (Space Grotesk 700, 24px, centred at y45), `GOING FURTHER` (JetBrains Mono 700, 8.4px, letter-spacing 2.2, y60), a dashed line `M20 68 H136`, and `NEAR TESTNET · NEP-171` (mono 500, 7.2px, letter-spacing 1.4, y82).
- CSS: `.lv-pass .stamp { position:absolute; left:49%; top:57%; width:38%; transform:rotate(-9deg); z-index:2; mix-blend-mode:screen; filter:drop-shadow(0 0 6px rgb(212 240 51 / .35)); }`. With `slam`: the stamp plays `slam` (.7s `cubic-bezier(.2,.9,.3,1.2)` .35s both: from scale 2.4 rotate -28deg opacity 0 → scale .9 → 1.05 → 1 at -9deg) and the card plays `shake` (.35s ease-out .72s: down 3px and back). Both off under reduced motion.

## 4. Passport page (`src/pages/PassportPage.tsx`)

- Pass `stamps={p.stamps}` to `Web3Passport` (no slam here).
- Under the three stamp tiles, a white rounded list (14px padding, radius 14px, navy text, as in the season2 preview's "On the Passport page") with one row per season, each a 24px round dot, the name, and a mono note on the right:
  - `Season 1 · First steps` — dot `✓` lime when `p.graduated` (note `graduated`) or when level 3 (note `3 of 3 quests`); otherwise a grey dot and `{level} of 3 quests`.
  - `Season 2 · Going further` — when stamped: lime `✓` and the note `stamped · explorer ↗` linking to `game.explorer.passport(accountId)`; otherwise a grey `·` and `{chaptersDone} of 3 chapters` (or `opens after Season 1` before level 3).
- The three quest stamp tiles, Bloq, his line (`restLine`) and "View on the explorer" stay exactly as today.

## 4b. On NEAR panel (`src/components/lab/ChainPanel.tsx`), one addition

In `TxList`'s `title`, a quest's title also looks in the chapters, so a chapter shows as `Quest: Digital Ownership`, not its id: `… ?? quests.find((q) => q.lesson_id === e.ref)?.title ?? chapters.find((c) => c.lesson_id === e.ref)?.title ?? e.ref ?? ""` with `const { chapters } = useChapters();` next to `useDailyQuests()`. Nothing else in the panel changes (its block pill stays).

## 5. Reveal page buttons (`src/pages/RevealPage.tsx`)

`const s2 = season2Done(game.passport)`.
- Steps: keep today's steps. If any chapters are completed, add `Chapters "Digital Ownership", "Transactions", "Decentralised Finance": rewards minted to your account` (only the completed ones' titles, from `useChapters`). If `s2`, add `Season 2 stamp: added to your Passport by the Passport office`.
- Thanks line: `s2` → `Both seasons done. Thanks for playing. Everything you earned is yours.`; otherwise `Season 1 done. Everything you earned is yours.`
- Buttons:
  - not `s2`: `← Back to the map` (outline, as "Play again" is styled today) and the lime primary `Continue your journey →`, which navigates to `/map` with hash `season-2` (the map scrolls to the Season 2 card, where Bloq is waiting). No "Play again".
  - `s2`: today's pair, unchanged: lime `← Back to the map` and outline `Play again`.

## 6. Landing line (`src/pages/Landing.tsx`, end of `Chapters`)

Replace `Coming next · Digital ownership · Transactions · Decentralised finance` with:
`<b>Continue your journey with</b> Digital ownership · Transactions · Decentralised finance · <a>Season 2 on the map ↗</a>` — the link calls the same `onExplore` as the cards' "Explore ↗" (signed in → map, signed out → sign-in sheet), styled like `lv-explore`, min-height 44px.

## Confirm when done

Say what you did and didn't check in the browser:
- At 390px: the "NEAR testnet · block" pill above both roads, as on today's map. At 1100px and 1440px: no pill on the map, and the On NEAR panel still shows it. Two slim season cards, each two lines, nothing wrapping.
- With Season 1 done and Season 2 not started, Bloq sits on the Season 2 card's top edge just left of the Start button (not over the button or the title), and says the ASK line. Start: one jump over the card onto Digital Ownership; the merchant goes behind his curtain; hovering or tapping the shop shows him saying hello.
- Daily quest card still shows only today's `daily-` quest; the chapters open in the quiz sheet with the Chapter 04–06 labels, and each has "Ask Bloq about this", which opens the Ask Bloq sheet with the quiz chips.
- The Passport card still shows Holder, Level, Status and Chain, with and without the stamp.
- The Reveal page in both states.
- Nothing in `src/bloq/`, `src/near/`, `src/content/` or `public/` changed.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
