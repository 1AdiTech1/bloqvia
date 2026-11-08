# Lovable prompt 26b — three small fixes to the after-Season 2 tour (Nov 8)

Found reading commit `cc2dd63` (prompt 26). Adi approved them on Nov 8. No design change: same cards, same lines, same jumps.

**Most important rule (as in prompts 21 to 26): don't remove or change anything this prompt doesn't name.** Only `src/pages/MapPage.tsx` changes. Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict TypeScript and reduced motion as before.

## 1. No flash in the top-left corner

The tour Bloq's host is drawn at `left-0 top-0` for a frame or two before `placeTour` moves him onto the card. Keep him hidden until he is placed:

- The host's `style={{ width: W }}` becomes `style={{ width: W, visibility: "hidden" }}`.
- In `placeTour`, after `host.style.width = …`, add `host.style.visibility = "visible";`.

(React won't write `visibility` again on later renders, because the prop's value doesn't change; a new visit mounts the host hidden again.)

## 2. He follows the cards when something above them grows

The re-place effect only watches `cardsBox`, so if the roads above finish loading after he sits down, the cards move down and he stays where they were. In that effect, also observe the page's root:

```tsx
if (cardsBox.current) ro?.observe(cardsBox.current);
if (rootRef.current) ro?.observe(rootRef.current);
```

Nothing else in that effect changes (it still skips while he is in the air).

## 3. After Today's quest, he jumps once the quiz sheet has closed

Today the answer lands while the quiz sheet still covers the map, so Bloq jumps to "Every day on Bloqvia" behind it and the player misses the jump and his line. Now he waits while the sheet is open and jumps 600 ms after it closes (the sheet's exit).

- Add `const sheetWasOpen = useRef(false);` next to `leftCity`.
- Replace the step effect (the one commented "He appears sitting on the current step, then jumps (leap) to each next one on the same visit.") with:

```tsx
// He appears sitting on the current step, then jumps (leap) to each next one on the same visit.
// While the quiz sheet is open he waits; 600 ms after it closes (its exit) he jumps (prompt 26b).
useEffect(() => {
  if (!tourOn) { tourAt.current = null; return; }
  if (open) { sheetWasOpen.current = true; return; }
  const step = after.next, api = tourApi.current;
  if (tourAt.current === step) { sheetWasOpen.current = false; return; }
  const first = tourAt.current === null;
  tourAt.current = step;
  if (first || reduce) {
    sheetWasOpen.current = false;
    tourFlight.current?.(); tourFlight.current = null;
    requestAnimationFrame(() => { api.placeTour(step); setTourFacing("right"); setTourPose("sit"); });
    timers.current.push(setTimeout(() => tourApi.current.sayTour(tourApi.current.LINE[step]), 500));
    return;
  }
  const jump = () => {
    if (!mounted.current || tourAt.current !== step) return;
    const host = tourHost.current, spot = tourApi.current.spotFor(step);
    if (!host || !spot) return;
    tourFlight.current?.();
    setTourPose("idle");
    tourFlight.current = leap(host, spot, {
      body: tourBody.current,
      onTakeoff: (dir) => { setTourFacing(dir); setTourPose("cheer"); },
      onLand: () => { tourFlight.current = null; setTourFacing("right"); setTourPose("sit"); tourBloq.current?.setMood("laugh", 900); timers.current.push(setTimeout(() => tourApi.current.sayTour(tourApi.current.LINE[step]), 260)); },
    });
  };
  if (sheetWasOpen.current) { sheetWasOpen.current = false; timers.current.push(setTimeout(jump, 600)); }
  else jump();
}, [tourOn, after.next, reduce, open]);
```

(`open` is the map's existing quiz-sheet state. `close()` clears `timers.current` before `open` becomes `null`, so the 600 ms timer is pushed after that and isn't cleared. The check-in on the streak card opens no sheet, so that jump stays immediate.)

## Confirm when done

- Tests and build pass.
- With a stamped account: Bloq never shows in the top-left corner of the map; he appears on his card.
- Finish Today's quest: the sheet closes, then he jumps onto "Every day on Bloqvia" and says his line. Check in on the streak card: he jumps at once, as before.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
