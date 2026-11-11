# docs/design — the mocks

Every folder here is a design mock: a static HTML page (with its own preview.css / preview.js or the Bloq rig) that was
built first, screenshot on phone and desktop, approved, and then described to Lovable as a prompt (`docs/LOVABLE-PROMPT-N-*.md`).
Nothing in this folder ships. The app is `src/`; the animated character that the mocks prototyped is `src/bloq/`.

Rules the mocks settled, for every screen:

- An (i) button never pushes a card's content down. Its text opens in a panel over the card (the
  Community streak card's `info` panel is the reference: absolute, `z-30`, `bq-pop`, closes on a tap
  outside, on Escape, and on the button again). Prompt 33 brought the shop's trade cards in line.
