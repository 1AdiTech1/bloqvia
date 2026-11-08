# Lovable prompt 26 — after Season 2: Bloq's tour, the "Every day on Bloqvia" card and a safe "Play again from zero" (Nov 8)

Approved mock-ups: `docs/design/after-seasons/index.html` (the tour, the card last, the sheet) and `docs/design/fixes-n8b/index.html` section 2 (the officer behind his curtain).

**Most important rule (as in prompts 21 to 25): don't remove or change anything this prompt doesn't name.** Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict TypeScript, reduced motion and try/catch around storage as before. Do prompt 25 first if it isn't in yet.

Already on `main` for this: `useAfterSeasons` and `markMissionsSeen` from `@/near` (`src/near/useAfterSeasons.ts`, read its header), `leap` and `useSay` from `@/bloq`, and `ChainTrail`'s `jumpTo`, `curtain` and `hostHello`.

## What the player sees

Once the Passport has the Season 2 stamp, the map shows a new last card, **Every day on Bloqvia**, after the Community streak and Today's quest. Bloq leaves the Network City office (the officer goes in behind his curtain, like the merchant), jumps onto the first thing not done yet and sits on that card's top edge with one line. When it's done he jumps (`leap`) to the next: the streak (Check in pulses), Today's quest (Play pulses), then the list card while Missions glows in the menu. When all three are done the card becomes **All done for today**. "Play again from zero" sits at the bottom of the card, behind a sheet that makes sure the player keeps the key of the account they leave.

## 1. The map (`src/pages/MapPage.tsx`)

a. **The hook.** `const after = useAfterSeasons({ accountId: game.accountId, stamped, completed });`. The tour runs when `const touring = after.active && after.ready && !moment && !thirdThisVisit.current;` (the stamp moment and the move to `/season-2` play first, untouched; the tour starts the next time the map opens).

b. **Layout, only while `after.active`** (everything stays as today otherwise):
- The cards wrapper (`order-5 … dk:grid dk:grid-cols-2 …`) gets `id="keep-going"`, `scroll-mt-[120px]`, and room for Bloq to sit on the cards: `mt-[112px]` instead of `mt-10`, `gap-[100px]` instead of `gap-3` on phones, and `dk:mt-[112px]` instead of `dk:mt-6` (keep `dk:gap-4`).
- Wrap `<StreakCard />` and `<DailyQuestCard />` in `<div ref={streakBox} className="min-w-0 empty:hidden">` and `<div ref={dailyBox} className="min-w-0 empty:hidden">` (a card that renders nothing leaves no gap).
- Add the new `AfterSeasonsCard` (section 2) as the last child of the wrapper, in `<div ref={listBox} className="min-w-0 dk:col-span-2 dk:mt-[84px]">`.
- The page's root `div` (`flex flex-col dk:grid …`, the first element inside `PhoneShell`) gets `ref={rootRef}` and `relative` so the tour Bloq can be placed in it; the cards wrapper gets `ref={cardsBox}`.
- With `location.hash === "#keep-going"`, scroll the cards wrapper into view on open (smooth, `block: "start"`, `auto` with reduced motion), in the same effect as `#season-2` today.

New refs and state in `MapInner`: `rootRef`, `cardsBox`, `streakBox`, `dailyBox`, `listBox` (`useRef<HTMLDivElement>(null)`), `tourHost`, `tourBody` (`HTMLDivElement`), `tourBloq` (`BloqHandle`), `tourFlight` (`(() => void) | null`), and `tourPose` (`BloqPose`, starts `"sit"`), `tourFacing` (`"left" | "right"`, starts `"right"`), `officerIn` and `leaving` (`false`). `const desktop = useIsDesktop();` from `@/components/lab/useDesktop`. Add `Bloq`, `SpeechBubble`, `leap`, `talkMs`, `useSay` and the types `BloqHandle`, `BloqPose` to the existing `@/bloq` import, and `useAfterSeasons`, `type AfterStep` to the `@/near` import.

c. **Where Bloq sits.** `const W = desktop ? 100 : 86;`. For a step, the box is `streakBox` ("streak"), `dailyBox` ("daily") or `listBox` ("missions" and "done") (`boxFor(step)`); his spot is that box's top edge near the right, in the root's coordinates:

```tsx
const spotFor = (step: AfterStep) => {
  const root = rootRef.current, box = boxFor(step);
  if (!root || !box) return null;
  const br = root.getBoundingClientRect(), r = box.getBoundingClientRect();
  return { x: r.right - br.left - W - 16, y: r.top - br.top - (W * 4) / 3 * 0.75 + 4, w: W };
};
```

d. **The tour Bloq**, rendered only while `touring && after.tourStarted`: an absolutely positioned host in the root (`ref={tourHost}`, `absolute left-0 top-0 z-[6]`), moved with `transform: translate(x, y)` and `width: W`, holding

```tsx
<div ref={tourBody} style={{ transformOrigin: "50% 92%" }}>
  <Bloq ref={tourBloq} hat="cap" pose={tourPose} facing={tourFacing} label="Bloq, your guide" className="w-full" />
</div>
<SpeechBubble text={tourLine} className="hop-say" />
```

(`hop-say` is the bubble placement the landing's hopping Bloq already uses: the bubble sits to his left with its tail pointing at him, so it never covers the card's button.) `const [tourLine, sayTour] = useSay();`; saying a line also calls `tourBloq.current?.talk(talkMs(line))`; tapping him repeats the current step's line. His lines (the missions one depends on the menu's place):
- streak: `Both seasons done! Now the community needs you: check in today. When enough of us do, everyone who checked in gets STREAK.`
- daily: `Checked in! Next, today's quest. An AI agent wrote it this morning, and the chain still checks your answer.`
- missions: phones `One more, just for graduates: Missions. The DAO's board pays testnet NEAR for small tasks. Tap Missions below.`; desktop `… It's in the menu on the left.`
- done: `That's everything for today. Come back tomorrow for a new quest and a new streak day.`

The first time he appears on a visit (and always with reduced motion) he is placed straight on `spotFor(after.next)`, sitting, and says that step's line after 500 ms. When `after.next` changes later on the same visit, he jumps there (`host = tourHost.current`, `spot = spotFor(after.next)`; skip if either is missing):

```tsx
tourFlight.current?.();
setTourPose("idle");
tourFlight.current = leap(host, spot, {
  body: tourBody.current,
  onTakeoff: (dir) => { setTourFacing(dir); setTourPose("cheer"); },
  onLand: () => { tourFlight.current = null; setTourFacing("right"); setTourPose("sit"); tourBloq.current?.setMood("laugh", 900); window.setTimeout(() => sayTour(LINE[after.next]), 260); },
});
```

Re-place him (no animation) on resize and when the cards change size (a `ResizeObserver` on `cardsBox`), unless he is in the air (`tourFlight.current` set). Cancel `tourFlight` on unmount.

e. **Leaving Network City (once per account).** An effect: when `touring && !after.tourStarted` (and a `leftCity` ref isn't set yet), 900 ms after the map is ready, Season 2's guide says his line and jumps from the office to the first spot (`jumpTo` takes the point under his feet, in viewport coordinates), the officer goes in as he takes off, then the tour Bloq takes over:

```tsx
const s = spotFor(after.next), br = rootRef.current?.getBoundingClientRect();
if (!s || !br) return;
leftCity.current = true;
setLeaving(true);
timers.current.push(setTimeout(() => { if (mounted.current) setOfficerIn(true); }, reduce ? 0 : 1400)); // as he takes off
await trail2.current?.jumpTo({ x: br.left + s.x + W / 2, y: br.top + s.y + (W * 4) / 3 * 0.75 }, "Both seasons done! Come with me.");
if (!mounted.current) return;
after.startTour();
setLeaving(false);
```

Clear the 900 ms timer in the effect's cleanup. With reduced motion `jumpTo` places him at once, so the tour Bloq simply appears on the card.

f. **The Season 2 road.** `guideAt` becomes `started && !(after.active && after.tourStarted) ? "here" : "gone"`; add `curtain={after.active && (after.tourStarted || officerIn)}` and `hostHello="Your stamp is safe with me. Come and see your Passport any time."`. Nothing else on the road changes (the stamp moment, the door text, `See your Passport`).

g. **Highlights.** Pass `highlight={touring && after.tourStarted && after.next === "streak"}` to `StreakCard` and `highlight={… after.next === "daily"}` to `DailyQuestCard` (section 4), and `glow={touring && after.tourStarted && after.next === "missions" ? "/cohort" : undefined}` to `PhoneShell` (section 5).

## 2. New `src/components/lab/AfterSeasonsCard.tsx`

Props: `{ after: AfterSeasons; onCheckIn: () => void; onPlay: () => void }` (the map passes functions that scroll `streakBox` / `dailyBox` into view, smooth, `block: "center"`). A `section` styled like the Today's quest card (`rounded-[1.6rem] border border-ivory/10 bg-navy-soft p-5 text-ivory shadow-lift`); when every available step is done it gets `ring-[1.5px] ring-lime`.
- Eyebrow (`text-[11px] font-semibold uppercase tracking-[0.18em] text-lime`): `Keep going`, or `All done for today`.
- Title (`font-display text-[22px] font-medium tracking-[-0.02em]`): `Every day on Bloqvia`, or `See you tomorrow.`
- Rows (each `grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 min-h-10 text-sm`; a done row has a lime filled dot with ✓ and lavender text, an open row a dashed lavender ring): `Season 1 · graduated` ✓, `Season 2 · stamped on your Passport` ✓, then only if available: `Check in for the community streak` (open: a lime text button `Check in ↑` → `onCheckIn`), `Play today's quest` (open: `Play ↑` → `onPlay`), and always `Take on a mission (graduates)` (open: a lime `Link` to `/cohort`, `Missions →`). Done rows show a lime `✓` on the right.
- A line (`text-[13px] text-lavender`): `Your Passport keeps everything. Nothing here resets it.`, or when all done `A new quest arrives every day, and the streak needs you again next Bloqvia day.`
- `Play again from zero`: a text button (`min-h-10 font-display text-[13.5px] font-semibold text-lavender underline underline-offset-4`) that opens the sheet (section 3).

## 3. New `src/components/lab/PlayAgainSheet.tsx`

Built like `AskBloqSheet` (a bottom sheet with the same grab handle on phones, a centred 460px dialog on desktop, Esc and the backdrop close it, focus moves into it and back to the button). `AfterSeasonsCard` renders it. Ivory, navy text:
- Eyebrow `Play again`; title `Start again from zero?` (`font-display text-[26px] font-medium tracking-[-0.03em]`).
- Text: `You'll get a brand-new NEAR account with an empty Passport, and the game starts from the first quest. This account isn't deleted: it stays on NEAR testnet with your Passport, both seasons and everything you earned. Only this key can open it again.`
- The key row as on the reveal: the first 12 characters of `game.exportSecretKey()` then dots, and a navy `Copy key` button (`Copied` for 2 s); copying also ticks the box.
- A checkbox `I've saved my key somewhere safe` (44px tall row).
- `Start from zero` (navy pill, lime text, disabled until the box is ticked): `game.signOut(); navigate({ to: "/" });`, exactly what the reveal's old "Play again" did. `Keep playing` (outline pill) closes the sheet.

## 4. `StreakCard` and `DailyQuestCard`: a `highlight` prop

First add two keyframes to `src/styles.css` (after the existing keyframes, outside any layer), used by sections 4 and 5:

```css
/* After Season 2 (prompt 26): the button Bloq points at, and the Missions tab. */
@keyframes bq-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgb(212 240 51 / .6); } 50% { box-shadow: 0 0 0 7px rgb(212 240 51 / 0); } }
@keyframes bq-glow { 0%, 100% { box-shadow: inset 0 0 0 1.5px rgb(212 240 51), 0 0 0 0 rgb(212 240 51 / .55); } 50% { box-shadow: inset 0 0 0 1.5px rgb(212 240 51), 0 0 0 7px rgb(212 240 51 / 0); } }
```

`highlight?: boolean` on both `StreakCard` and `DailyQuestCard` (default false, nothing changes without it); forward it from `StreakCard` to `StreakInner` and from `DailyQuestCard` to `DailyQuestInner`. When true: the card's `section` gets `ring-2 ring-lime shadow-[0_0_26px_rgb(212_240_51/.22)]`, and its main button (`Check in`, `Play`) pulses with `animate-[bq-pulse_1.8s_ease-in-out_infinite] motion-reduce:animate-none`.

## 5. `PhoneShell`: a `glow` prop for one menu tab (`src/components/PhoneShell.tsx`)

`glow?: string | undefined` on `PhoneShell` (a tab path, e.g. `"/cohort"`), passed to `BottomNav` and `Rail`. The matching tab in `tabs` gets, unless it is the active tab, a lime ring that pulses (`text-lime animate-[bq-glow_1.8s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:shadow-[inset_0_0_0_1.5px_rgb(212_240_51)]`) and a small lime dot (phones: an 8px dot at the top right of the tab, the tab gets `relative`; rail: a small lime `new` chip after the label, navy text). Nothing else in the shell changes.

## 6. Missions counts as seen (`src/pages/CohortPage.tsx`)

In `CohortPage`, `useEffect(() => { markMissionsSeen(game.accountId); }, [game.accountId]);` (`markMissionsSeen` from `@/near`; add `const game = useGame()` if the component doesn't have one yet). That is the only change on the Missions page.

## 7. The Season 2 reveal opens the map at the cards (`src/pages/RevealPage.tsx`)

On the Season 2 reveal (`season2`), "Back to the map" does `navigate({ to: "/map", hash: "keep-going" })`. The Season 1 reveal keeps `navigate({ to: "/map" })`.

## Confirm when done

- An account with the Season 2 stamp, on a phone (390 × 844) and at 1440px: from the Season 2 reveal, "Back to the map" opens at the streak card. Bloq says "Both seasons done! Come with me.", jumps out of Network City onto the Community streak card, and the officer goes in behind his curtain; tapping the office door makes him peek out with his line.
- Check in → Bloq jumps to Today's quest (Play pulses). Finish the quest → he jumps onto Every day on Bloqvia and Missions glows. Open Missions and come back → the card reads All done for today and he says goodbye until tomorrow. Reloading the map doesn't repeat the jump out of Network City; he sits straight on the current step.
- "Play again from zero": "Start from zero" stays disabled until the key is copied or the box is ticked; it signs out to the landing.
- An account without the stamp: the map is exactly as today. Reduced motion: no jumps, Bloq is placed on each card.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
