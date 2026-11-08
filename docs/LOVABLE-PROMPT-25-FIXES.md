# Lovable prompt 25 — four fixes after Adi's check (Nov 8 evening)

Approved mock-ups: `docs/design/fixes-n8/index.html` (walk option B, Passport card option A, the reveal buttons) and `docs/design/fixes-n8b/index.html` (the streak's ⓘ, option A).

**Most important rule (as in prompts 21 to 24): don't remove or change anything this prompt doesn't name.** Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict TypeScript and reduced motion as before. `walkTo` and `walking(on, follow)` are already in `@/bloq` on `main`.

## 1. Desktop landing, "A little context": Bloq walks like a person (`src/pages/Landing.tsx`, `Context`)

Today he glides at a steady 310 px a second with his legs at a slow fixed pace, so he slides like a car. Now he speeds up, walks to a nearby card, runs to a far one, and slows down before he sits; his steps follow the ground.

a. Add `walkTo` to the existing `@/bloq` import.

b. In `Context`, add `stroll` to the `st` ref: `useRef({ x: -160, idx: -1, sitting: false, lastUser: 0, walkT: 0, sitT: 0, stroll: null as null | (() => number) })`.

c. In `goTo`, right after `window.clearTimeout(s.walkT); window.clearTimeout(s.sitT);`:

```tsx
if (s.stroll) { s.x = s.stroll(); s.stroll = null; } // interrupted: carry on from where he is
```

d. In `walk()`, replace these lines

```tsx
const dur = Math.min(2600, Math.max(500, Math.abs(dx) * 3.2));
setPose("idle");
setFacing(dx < 0 ? "left" : "right");
bloq.current?.walking(true);
place(target, 0, dur);
s.walkT = window.setTimeout(() => sitDown(i), dur);
```

with

```tsx
setPose("idle");
setFacing(dx < 0 ? "left" : "right");
bloq.current?.walking(true, true);
const el = host.current;
if (!el) return;
s.stroll = walkTo(el, target, { onArrive: () => { s.stroll = null; sitDown(i); } });
s.x = target;
```

(The `if (!moving || Math.abs(dx) < 6)` line above them stays, so reduced motion is unchanged.)

e. In the effect's cleanup, add `st.current.stroll?.();`.

Nothing else in `Context` changes: the stand-up before walking, `sitDown`, the tour, the cards, the phones' `HopBloq`.

## 2. Passport cards narrower than 300 px: the last row hides (`src/styles.css`)

On phones the landing's example Passport is 220 px wide and its "Chain · standard" row runs into the code line. Add, after the existing `.lv-pass` rules (outside any layer, like the later rules in the file):

```css
/* Passport cards narrower than 300 px (the phone landing's example, the app's card on small phones):
   the Chain · standard row hides so nothing runs into the code line (prompt 25). */
.lv-pass { container-type: inline-size; }
@container (max-width: 299px) { .lv-pass .fields > span:last-child { display: none; } }
```

The row is the last span in `.fields` on both the landing card and `Web3Passport`; nothing else changes. Cards 300 px and wider look exactly as today.

## 3. No reset button on the reveals (`src/pages/RevealPage.tsx`)

"Start again" (Season 2 reveal) and "Play again" (Season 1 reveal, shown after both seasons) sign the player out, so they would never see the streak or Today's quest. Remove both. The second button block

```tsx
{s2 ? <Press onClick={playAgain} …>{season2 ? "Start again" : "Play again"}</Press> : <Press onClick={() => navigate({ to: "/map", hash: "season-2" })} …>Continue your journey →</Press>}
```

becomes

```tsx
{!s2 && <Press onClick={() => navigate({ to: "/map", hash: "season-2" })} …>Continue your journey →</Press>}
```

(same classes as today), and remove the now unused `playAgain` function. "Back to the map" stays as it is; with both seasons done it is the only button, centred on desktop and full width on phones.

## 4. The Community streak's ⓘ opens a small panel over the card (`src/components/lab/StreakCard.tsx`)

Today the explanation opens inside the card, the card grows and Today's quest stretches next to it. Now it opens in a floating panel, like "Last days", and the cards keep their size.

- Replace the `<AnimatePresence>` block with the `motion.p` (the explanation) by a panel shown while `info` is true:

```tsx
{info && (
  <div ref={infoPanel} id="streak-info" role="dialog" aria-label="How the streak works"
    className="bq-pop absolute left-[10px] right-[10px] top-[72px] z-30 rounded-[18px] bg-card px-4 py-3 text-sm leading-relaxed text-navy shadow-[0_22px_50px_rgb(0_0_0/.35),0_0_0_1px_#e3dccb]">
    {/* the same text as today, word for word */}
  </div>
)}
```

- Add `const infoBtn = useRef<HTMLButtonElement>(null); const infoPanel = useRef<HTMLDivElement>(null);`, give the ⓘ button `ref={infoBtn}` and `aria-controls="streak-info"`, and close the panel on a pointer-down outside it and the button, and on Esc (focus back on the ⓘ), the same way the "Last days" panel does.
- Only one of the two panels is open at a time: the ⓘ does `setLog(false)` before toggling `info`, and the "Last days" button does `setInfo(false)` before toggling `log`.
- Remove `AnimatePresence` from the `framer-motion` import if nothing else in the file uses it (`motion` stays, the progress bar uses it).

Everything else in the card stays: the text, the numbers, the bar, the countdown, Check in, the holdings line, "Last days".

## Confirm when done

- Desktop landing at 1440px: point at 01 then 04, his feet stay on the ground, he walks off, runs, slows down and sits (about 3 s); to a neighbour card he walks calmly (about 2 s). Interrupting a walk sends him on from where he is. Reduced motion: as before.
- Phone landing at 390px: the example Passport shows Holder, Level and Type, and nothing touches the code line. At 1440px the landing card still shows all four rows. The in-app Passport card at 390px is unchanged (it is wider than 300 px).
- Season 2 reveal and Season 1 reveal (with both seasons done): only "Back to the map". Season 1 reveal with Season 2 not done: "Back to the map" and "Continue your journey →" as today.
- Map at 1440px and 390px: tapping ⓘ opens the panel over the streak card; Today's quest doesn't change size; tapping outside or Esc closes it; opening "Last days" closes it.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
