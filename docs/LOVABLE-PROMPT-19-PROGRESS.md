# Lovable prompt 19 — "Your progress, made visible" on phones (Nov 7)

Approved preview: `docs/design/progress-mobile/index.html`.

**Rules (as before).** Do not edit `src/bloq/*` or `src/near/*`. No logic, contract, reward, price or balance changes. Strict TypeScript and reduced motion as before. Desktop, where the cards and the Passport panel sit side by side (≥960px), stays exactly as it is.

On phones and tablets, the progress section in `src/pages/Landing.tsx` stacks: the four reward cards, then the quote, then the Passport panel with Bloq (`hat="grad"`). He's only in the panel, so the player doesn't see him while reading the cards. Below 960px (where `.lv-prog` stacks), make him travel down the section, as option B does in the other three sections (prompt 18):

1. **One Bloq for the whole section.** Move the progress Bloq into an absolutely positioned wrapper inside the section's container (`position: relative`), placed with `transform: translate(x, y)` only. Give the cards' grid `padding-top: ~100px` so he fits above the first card. Keep the Bloq that's in the panel on desktop.

2. **On the cards.** On scroll (passive listener plus `requestAnimationFrame`), pick the card whose centre is nearest 45% of the viewport height. Seat him on its top edge at its right, 86px wide: `x = card.right − 86 − 12`, `y = card.top − H × 0.75 + 4` (H = width × 4/3), `pose="sit"`. He holds that card's `data-prop` (coin, key, fuel, badge), the card gets `on`, and his speech bubble to his left (right edge 74px from his right, `max-width: 178px`, 13px) shows its `data-say`. When the card changes:
   - hide the bubble;
   - `pose="idle"` and `jump()`;
   - after 120ms, move (`transform .6s cubic-bezier(.34,1.3,.64,1)`) and swap the prop;
   - at about 700ms, `pose="sit"` and speak.

   With two cards per row (461–959px), seat him on the card in view the same way.

3. **At the Passport.** When the panel's top passes 62% of the viewport height, he jumps into the panel:
   - **Landing:** he grows to 112px and stands at the panel's bottom-left (14px in from its left and bottom).
   - **At about 760ms:** `prop="badge"`, `pose="cheer"`, `setMood("laugh", 1600)`, `jump()`, the existing spark burst, and the Passport card gets its `on` state (it straightens and lifts, as on hover). Its seal centre (the three blocks) stamps in: scale 0 → 1 and rotate −30° → 0, spring.
   - **At about 1.4s:** `pose="hold"` and the bubble says "Graduate and your Passport is sealed for good. That's the one you can't buy." In the panel the bubble goes above him, left-aligned, `max-width: 230px`.

4. **Scrolling back up** takes him back onto the card in view: he hops back to 86px and sits. The Passport loses `on` and its seal lifts off, so the moment replays next time.

5. **Taps.** Tapping Bloq makes him `jump()` and laugh. Tapping the Passport while he's in the panel makes him cheer and spark again.

6. **The first time the section comes into view,** he's already seated on the card in view (no hop). With reduced motion: no jumps or transitions, he's placed directly, and the seal shows without animating.

Confirm when done, and say what you did and didn't check in the browser:
- At 390px and 320px: he sits on each card with the right prop, his bubble is fully on screen, he lands by the Passport and the seal stamps, scrolling up undoes it, and there's no sideways scroll.
- At 768px (two cards per row) he follows the card in view.
- At 1280px the section looks exactly as it does today.
- Nothing in `src/bloq/` or `src/near/` changed.
