# Lovable prompt 21b — Season 2 fixes on top of 2e8e94d (Nov 7)

Same rules as prompt 21: change only what's listed here, don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. The approved look is `docs/design/seasons/index.html` and `docs/design/season2/index.html`.

## 1. Bloq jumps to the Season 2 card while the last Season 1 quiz is still open (bug)

In `MapPage.tsx` the "perch on load" effect depends on `s1Done`. `s1Done` turns true as soon as the third founding quest is saved, while the quiz sheet is still open and the trail still shows level 2. 450ms later the effect calls `perchAt(seat(), ASK, true, true)`, so Bloq is placed on the Season 2 card behind the sheet. When the sheet closes, the trail then walks him to the shop from the card instead of from Smart Agreements.

Fix: the instant perch is only for a page that **opens** with Season 1 already done. Use what the trail shows, not `s1Done`:
- condition `trailLevel >= 3 && !started && !pendingS1.current` (and keep `startReady`), with `trailLevel` in the deps;
- keep `pendingS1.current = true` being set in `close()` before `setTrailLevel`, so that finishing Season 1 in this visit goes only through `arrived1` (walk to the shop, cheer, then walk to the card and sit).
- Keep the resize re-perch, but only while he is seated (after the instant perch or after `arrived1`'s perch).

## 2. The Passport office door shows "Stamped" before the stamp moment

When the third chapter is answered in this visit, `stamped` is already true while Bloq is still walking to the office, so the door shows "✓ Stamped on NEAR · Season 2" before the moment plays. Until the moment has finished (`thirdThisVisit` and not yet celebrated), the door shows `Season 2 complete. Here comes your stamp…`. After the 2.6s moment: the stamped door and the cheer, as now. A page that opens already stamped shows the stamped door at once, as now.

## 3. Keep the season cards, the Start button and the Passport rows as you made them

No change to their styles, the shorter Season 2 title while Start shows, or Bloq's bubble on his left while he waits.

## 4. Remove `roadmap.md`

Delete the new `roadmap.md` at the repo root (it was a working checklist). Keep the `.lovable/` plan files and the AGENTS.md line.

## 5. The "Your journey" line under the eyebrow (`MapPage.tsx`)

Replace the text of the `h2` under "Your journey" ("Three quests. One merchant. A Passport that's yours.").
- **Desktop (`dk`, ≥1100px):** `Six quests. Two seasons. A Passport that's yours.` on **one line**, sized to the column: never above today's 2rem.
- **Phones and tablets (<1100px):** `Two seasons. One Passport.` on one line at today's size (`text-2xl`, 24px).

```tsx
<div className="journey-line order-4 dk:order-1 dk:col-span-2 dk:mb-5">  {/* same wrapper as today, plus journey-line */}
  <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime dk:mt-0">Your journey</p>
  <h2 className="mt-2 whitespace-nowrap font-display text-2xl font-medium leading-tight tracking-[-0.03em]">
    <span className="dk:hidden">Two seasons. One Passport.</span>
    <span className="hidden dk:inline">Six quests. Two seasons. A Passport that's yours.</span>
  </h2>
</div>
```
In `src/styles.css`:
```css
.journey-line { container-type: inline-size; min-width: 0; }
@media (min-width: 1100px) { .journey-line h2 { font-size: min(2rem, 4.3cqi); } }
```
That gives about 30px at 1440px and 21px at 1100px. Keep the eyebrow, the wrapper's order and spacing classes exactly as they are today.

## Confirm when done

- Finish Season 1's third quest in this visit: Bloq stays at Smart Agreements while the sheet is open; after closing he walks to the shop, cheers, walks down to the Season 2 card and sits. No jump, no teleport.
- Reload with Season 1 done: he is seated on the card at once.
- Third chapter answered in this visit: the door says "Here comes your stamp…" until the moment ends, then "✓ Stamped on NEAR · Season 2".
- The journey line: one line at 390px ("Two seasons. One Passport.", 24px) and at 1100px and 1440px (the full line); nothing else in the heading block changed.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
