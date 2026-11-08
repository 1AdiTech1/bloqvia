# Lovable prompt 23 — one speech bubble for Bloq, and his name never in capitals (Nov 8)

Approved mock-up: `docs/design/bubbles/index.html` (real Bloq and the real `SpeechBubble`).

Two rules from Adi, for the whole app:
- **The name is written "Bloqvia" and "Bloq", never BLOQVIA or BLOQ** (as text or through an `uppercase` class). The one exception is the code line along the bottom of the Passport card (`P<BLQ<…<BLOQVIA<TESTNET`), which stays in capitals like a real passport.
- **Every line Bloq says uses the same speech bubble**: `SpeechBubble` from `@/bloq` (frosted glass, small tail pointing at him). The Passport page and the shop are the two places that still use an ivory card; this prompt moves them to the bubble.

**Most important rule (as in prompts 21 and 22): don't remove or change anything this prompt doesn't name.** Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict TypeScript and reduced motion as before.

`SpeechBubble` already has the variant these two pages need (`side="right"`, in `src/bloq` on `main`): the bubble sits in the row next to Bloq, after him, in the normal flow at every width, with its tail on its left edge pointing back at him. `src/bloq/bloq.css` is not inside a Tailwind layer and sets `margin: 0` on the bubble, so **put the spacing classes on a wrapper `div`, not on the bubble itself**.

## 1. Passport page (`src/pages/PassportPage.tsx`)

In the row at the bottom (`mt-8 flex items-end gap-3`), replace the ivory card:

```tsx
<div className="mb-6 flex-1 rounded-[18px] rounded-bl-md bg-ivory px-4 py-3.5 text-navy" aria-live="polite">
  <p className="mb-1.5 font-display text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bloq</p>
  <p className="font-display text-[1.02rem] font-medium leading-[1.35]">“{shown}”</p>
</div>
```

with

```tsx
<div className="mb-6 min-w-0">
  <SpeechBubble side="right" tone="light" text={shown} />
</div>
```

and add `SpeechBubble` to the existing `@/bloq` import. No label, no quote marks (the bubble has its own `aria-live`). The Bloq button, `tapCard`, `restLine`, `useSay`, `shown` and the talk effect stay exactly as they are. The wrapper has no `flex-1`, so the bubble hugs its line (up to 22rem) like every other bubble.

## 2. Bloq's shop (`src/pages/ShopPage.tsx`)

In the stall's `.row`, replace the ivory card (the `div` with the "Bloq" label, `AnimatePresence` and the `motion.p` with the quote marks) with:

```tsx
<div className="mb-[26px] min-w-0 self-center justify-self-start">
  <SpeechBubble side="right" tone="light" text={line} />
</div>
```

and add `SpeechBubble` to the existing `@/bloq` import. The words now change in place when the line changes, as in every other bubble. `line`, `react`, the reactions, the merchant button and the talk effect stay as they are. `AnimatePresence` and `motion` are still used elsewhere in the file (the price tip, the graduate checklist, the ceremony): keep those imports.

## 3. Missions: the DAO label (`src/pages/CohortPage.tsx`, `Treasury`)

```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">Bloqvia DAO</p>
```
becomes
```tsx
<p className="text-[11px] font-semibold tracking-[0.04em] text-lavender">Bloqvia DAO</p>
```
Same size, weight and colour; no capitals, and the letter spacing comes in because wide spacing only suits capitals. Every other label on the page stays as it is.

## 4. The /brand page wordmark (`src/components/Logo.tsx`, `Wordmark`)

The text `BLOQVIA` becomes `Bloqvia`. Nothing else in the file changes.

## Confirm when done

- Passport page at 390px and 1440px: Bloq's line sits in the glass bubble beside him, tail pointing at him, no "Bloq" label and no quote marks; tapping Bloq shows the NFT line, then the bubble goes back to his resting line.
- Shop at 390px and 1440px: the same bubble beside the merchant; selling, buying and tapping him change the words in the bubble.
- Missions: the Treasury card reads "Bloqvia DAO".
- `/brand`: the wordmark reads "Bloqvia".
- Search the app for any visible BLOQ or BLOQVIA (written in capitals, or an `uppercase` class on text containing Bloq or Bloqvia), apart from the Passport card's code line. List what you find; it should be nothing.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
