# Lovable prompt 27c — on desktop the bag lines up with the quiz card (Nov 9)

Approved mock-up: `docs/design/bag-desktop/index.html` (Fix). After a right answer the bag slides down at the top. On a phone it already lines up with the quiz sheet. On desktop it lines up with the map's own inventory bar (left of centre), so it sits off the quiz card. Now, on desktop, the bag takes the quiz card's left and right edges. Phones keep today's position. Same bag, same slide, same timing.

**Most important rule (as in prompts 21 to 27b): don't remove or change anything this prompt doesn't name.** Only `src/components/QuizSheet.tsx` and `src/pages/MapPage.tsx` change.

**`QuizSheet.tsx`**

- The prop becomes `onBag?: (show: boolean, card?: DOMRect) => void`.
- In the rewards effect, `if (bag) onBag?.(true);` becomes:

```tsx
if (bag) onBag?.(true, sheetPanel.current?.getBoundingClientRect()); // the card's edges, for desktop (prompt 27c)
```

Nothing else in the file changes (the other `onBag?.(false)` calls stay as they are).

**`MapPage.tsx`**

- `showBag` becomes:

```tsx
// Phones: lined up with the inventory bar (as the sheet is). Desktop: lined up with the quiz card (prompt 27c).
const showBag = (on: boolean, card?: DOMRect) => { if (on) { const r = desktop && card ? card : invBox.current?.getBoundingClientRect(); if (r) setBagBox({ left: r.left, width: r.width }); } setBag(on); };
```

Nothing else changes.

## Confirm when done

- Tests and build pass.
- Desktop: play a quest with the map scrolled down. The bag slides down with the same left and right edges as the quiz card; the rewards fly into it and it slides away. Phone width: the bag sits where it does today.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
