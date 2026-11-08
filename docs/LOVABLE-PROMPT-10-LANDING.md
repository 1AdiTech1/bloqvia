# Lovable prompt 10 — the new landing (Maria's design + the animated Bloq)

Sent in three parts after `src/bloq/` and `docs/design/landing-v2/` are on `main`.
Reference for every detail (copy, spacing, motion): `docs/design/landing-v2/index.html`, the approved preview.
It is plain HTML/JS; rebuild it in React with the existing stack. Parts that exist only in the preview and must
**not** be built: the "Motion" switch, the "Bloq's wardrobe" section, the sample chat answers (part C uses the real agent).

---

## Part A — tokens, header, hero, "A little context", "Your first adventure"

The landing gets a new design. Read `src/bloq/README.md` first: the animated Bloq and his pieces are ready in
`@/bloq` (`Bloq`, `SpeechBubble`, `useSay`, `talkMs`, `FloatingCubes`, `BloqviaLogo`). **Do not edit `src/bloq/*` or
`src/near/*`.** Open `docs/design/landing-v2/index.html` and rebuild its sections in `src/pages/Landing.tsx`, keeping the
copy exactly as written there.

**1. Tokens** (`src/styles.css`, keep the token names, change values; the game screens follow automatically):
`--lime: #d4f033`, add `--lime-d: #a6c21a`, add `--purple: #8b45d9`, `--purple-d: #6630b3`, `--purple-soft: #c9a6f3`;
`--lavender: #c9a6f3`, `--lavender-soft: #efe7fb`; add `--lav-card: #f2ebfc`, `--lime-pale: #f1f8d2`. Navy and ivory stay.
Add **JetBrains Mono** (500, 700) to the Google Fonts link (used on the Passport card in part B).
Buttons: lime (`--lime`, navy text, radius 12px, hard shadow `4px 4px 0 #0b1322`, lifts 2px on hover); ghost (1.5px ivory
inset border); navy (on lavender sections). Eyebrows: 12px Space Grotesk 600, letter-spacing .16em, uppercase, a 9px dot
before (purple on light sections, lime on navy).

**2. Header** (in the hero, not fixed): `<BloqviaLogo />` (ivory name) on the left; on the right links "The big picture"
(#context), "Chapters" (#chapters), "Experience Lab" (#lab) and a lime "Start learning" button. Links: no underline;
on hover a lime gradient sweeps across the text (`background-clip: text`, gradient ivory→#ebfb7a→lime→#a6c21a,
background-size 240%, position moves 0→100% over .55s). Links hidden under 760px.

**3. Hero** (navy, `bg-night`): left column eyebrow "A friendlier way into Web3", h1 "Web3, without the overwhelm."
(2.1–2.75rem), sub "Learn how the next generation of the internet works, one simple experience at a time.", buttons
"Start exploring" (lime, id used below) and "Discover Bloqvia" (ghost, scrolls to #context). Right column: a square stage
(max 470px) with two rings (1.5px, ivory at 7% opacity; inner ring at 9% inset), three lime "comet" lights travelling the
rings (a 46×3px tail fading to lime with an 8px glowing head; 9s, 13s, 17s; one reverse; group opacity .38),
`<FloatingCubes ref={cubes} />`, and the Bloq on top (66% of the stage, soft drop shadow, none under 640px):
`<Bloq ref={hero} hat="astro" outfit="astro" pose="space" label="Bloq in a space helmet, floating in orbit" />`.
- Eyes follow the pointer: on `pointermove` call `hero.look(dx, dy)` with dx/dy = pointer offset from his centre ÷ half the viewport, clamped −1..1.
- A light-tone `SpeechBubble` above him: at 1.2s "Hi, I'm Bloq. Tap me, or hover Start."
- Hovering/focusing "Start exploring": `hero.aimAt(startButton)` and the bubble says "Press Start and I'll make your NEAR account. No seed phrase."; leaving: `hero.aimAt(null)`. He turns and aims at the button wherever the layout puts it.
- Hint for touch screens: at 3.4s and then every 9s, if the button is on screen and not hovered, `aimAt` it for 2.6s, no text.
- Clicking him or any Start button: `hero.jump()` + `cubes.hop()` + lime spark burst (the preview's `burst()`; 10 small 5×17px lime bars flying out and fading). Start buttons keep opening the existing `SignInSheet`.

**4. "A little context"** (`#context`, lavender-soft): eyebrow "A little context", h2 "The internet has changed. Let's make
sense of it.", sub "You don't need to know all the jargon. Start with the big ideas, and we'll figure out the rest
together." Then a track (height clamp(230px,21vw,280px)) above four cards (ivory, 22px radius, purple-tinted border):
01 READ "Look around." / 02 WRITE "Join in." / 03 OWN "Take a stake." / 04 TRUST "Check the rules." (bodies as in the
reference). Bloq: `hat="cap2"`, width clamp(118px,11vw,150px), standing on the cards' top edge, with a dark
`SpeechBubble`. Each card's extra line:
01 "Web1 was like a library. You could read pages, but only a few people could publish them." ·
02 "Web2 let everyone post. The catch: the platform keeps your account and the data you create." ·
03 "Web3 gives you an account only your key controls. On NEAR it even has a name you can read." ·
04 "The rules live in open code on a shared ledger, so anyone can check what happened."
- Hover/focus/tap a card: the card lifts (−6px, purple border); Bloq stands up if sitting (300ms hop back to the edge), then walks to that card (`walking(true)`, `facing` toward it, move the wrapper with a linear `transform` transition, ~3.2ms per px, 500–2600ms), then sits on the card's top edge: `walking(false)`, pose `"sit"`, wrapper drops by `height × 0.255 − 20px` (420ms), then the bubble says the card's line and `talk(talkMs(line))`.
- If nobody touches a card for 7s, he tours the next card every 6.5s while the section is on screen.
- When the cards stack (they're not in one row), he stays at the right end of the track, faces left, pose `"present"`, and only talks.

**5. "Your first adventure"** (`#chapters`, ivory): eyebrow, h2 "Three chapters. A lot less confusion.", sub, three cards
(white, lavender, lime-pale; 26px radius, 7px bottom shadow #e6e0cf) with label, navy icon tile, title, body, "Explore ↗"
underlined; "Coming next · Digital ownership · Transactions · Decentralised finance". Bloq perched on the card row's top-right
(width clamp(120px,12vw,160px); under 860px he sits in flow, right-aligned above the cards): starts `hat="beanie" prop="bulb"
pose="hold"`, `SpeechBubble side="left"`. When the section is 45% visible he says "Three chapters, one idea each. Point at one
and I'll dress for it." Hover/focus a card → `hat`/`prop` change (he throws the old hat and the new one drops on, built in),
he looks toward the card, small lavender puff burst, then the line:
The Vault → `captain` + `key`: "Keys. Your public key is a mailbox anyone can see. The private key is the only one that opens it."
The Fuel System → `hardhat` + `fuel`: "Gas is the small fee for the computers doing the work. In Bloqvia I pay it for you."
Smart Agreements → `beret` + `scroll`: "A smart contract is a vending machine made of code, with the rules printed on it for everyone."

When done, list files changed and confirm: no file in `src/bloq/` or `src/near/` changed; no horizontal scroll at 360px;
reduced motion shows every Bloq standing still; the Start buttons still open sign-in.

---

## Part B — "Experience Lab", "Your progress", "Ready when you are", footer

Keep using `@/bloq` and the reference file; same rules.

**6. Experience Lab** (`#lab`, navy): h2 "Less memorising. More 'oh, I get it.'", sub, three navy-2 cards with a lime 36×7
pill, uppercase title and line: QUESTS / THE MERCHANT / THE PASSPORT; lime "Enter the Experience Lab" button. Bloq perched
like part A: starts `hat="tophat" prop="cube" pose="hold"`, **light** `SpeechBubble side="left"`. Intro at 45%: "Everything
in the Lab is a real NEAR testnet transaction you can check." Cards:
Quests → `detective` + `magnifier`: "Answer right and the contract mints your items. A wrong answer is refused by the chain itself."
The Merchant → `tophat` + `cube`: "My prices follow one rule in the contract: the more I hold of something, the less I pay for it."
The Passport → `aviator` + `passport`: "Your Passport is an NFT that levels up on chain. Nobody can sell you one."

**7. Your progress** (`#progress`, ivory, two columns): h2 "Your progress, made visible", sub, four item cards (BloqGold,
Key Fragment, Fuel Cell, Contract Seal; icon squircles purple-soft / lime / peach / lavender-soft), quote with a 4px lime left
border "Finish the season and earn a Passport that records your achievement." Right: a lavender-soft panel (30px radius,
overflow visible) with a ring (78%, 1.5px #cfb2f2), a faint dashed inner ring, three **violet** comet lights on them (same as
the hero's but purple `#8b45d9` tail and `#a86df0` head; 11s, 16s reverse, 8s inner), behind everything; Bloq bottom-left
(`hat="grad" prop="badge" pose="hold"`, width clamp(150px,15vw,210px), dark bubble) and the **Web3 Passport card**
bottom-right. Copy the card's markup and styles from the reference (`.pass-wrap`/`.pass`: navy card with blue/purple glows,
lime edge, white ring, soft purple shadow `6px 8px 0 4px rgb(201 166 243 / .45)`; holographic sweep; guilloche lines generated
in JS; logo blocks + "Bloqvia"; "WEB3 PASSPORT" in JetBrains Mono; lime-gold chip + contactless mark; fields Holder
`learner-7c4f.bloqvia.testnet`, Level `3 / 3`, Type `Soulbound`, Chain · standard `NEAR testnet · NEP-171`; rotating seal
"EARNED · NOT BOUGHT · VERIFIED ON CHAIN ·"; two-line MRZ strip; lime scan line). It rotates 6°; on hover it straightens,
lifts and tilts in 3D toward the pointer (`--rx/--ry` ±14/18°) with the hologram following. Intro at 45%: "Every reward here
is recorded on chain. Point at one." Items → prop + line: BloqGold `coin` "BloqGold is game gold minted by the contract. It's
for playing, not money." · Key Fragment `key` "Key Fragments come from The Vault, the chapter about keys." · Fuel Cell `fuel`
"Fuel Cells come from The Fuel System, the chapter about gas." · Contract Seal `badge` "The Contract Seal comes from Smart
Agreements, the smart contracts chapter." Hover/tap the Passport: `prop="badge"`, `jump()`, lime sparks, then "Graduate and
your Passport is sealed for good. That's the one you can't buy."
*(Later, once signed in, this card can show the player's real account and level from `useBloqvia()`; not in this part.)*

**8. Ready when you are** (`#ready`, lavender-soft, two columns): left a `relative` box (padding-top 20px) with
`<BlockSea riderRef={rider} />` and the rider wrapper (`relative z-[2] mx-auto mt-[110px] mb-[52px] w-[clamp(210px,25vw,300px)]`)
holding `<Bloq hat="surf" outfit="surf" pose="ride" />` and a dark bubble; right h2 "Ready when you are.", sub "You don't have
to understand everything to take the first step.", navy "Start learning". Intro at 45%: "Starting is free: I make your account
and pay the gas. Hop on!" Click Bloq or the button → `wobble()`; hover the button → `rideWave(true)` + `setMood("laugh", 900)`,
leave → `rideWave(false)`. On the rider's `bloq:splash` event, burst 12 small 9px cubes (lime / #b47ff0 / white, 1.5px ink
border, spinning) from the board's tail (`detail.dir > 0` → 12% of his width, else 88%).

**9. Footer**: navy, "Bloqvia · A friendlier way into Web3." left, lime "Back to top ↑" right.

Confirm: every section Bloq wears a different hat (cap2, beanie/captain/hardhat/beret, tophat/detective/aviator, grad, surf,
astro); bubbles never leave the screen at 360 / 820 / 1366px; nothing in `src/bloq/` or `src/near/` changed.

---

## Part C — "Ask Bloq": a docked button that opens a chat with the real agent

Replace any landing-page entry to Ask Bloq with a **dock** fixed bottom-right (safe-area aware): a navy pill with a lime
1.5px ring, a 48px round face window showing `<Bloq hat="agent" outfit="agent" pose="idle" />` cropped to the head (inner
box 76px wide, offset −14px/−6px), "Ask Bloq" (Space Grotesk 600 15px) and "AI agent · online" with a pulsing lime dot
(hidden under 520px). Every 14s while closed the face does `jump()`.

Tap → the dock hides and a chat panel opens from the corner (390px wide, up to 580px tall, 24px radius; a full-width
bottom sheet under 520px): navy header with the same agent face (40px), "Ask Bloq", "AI agent on NEAR AI Cloud", close ×
(Esc closes, focus returns to the dock). Log, suggestion chips, input (max 300 chars) + Send. First message: "Hi, I'm Bloq's AI
agent. Ask me anything about Bloqvia or Web3. I won't give quest answers, but I'll explain the idea behind them."
Chips (hidden after the first question): "What's a private key?", "Who pays the gas?", "How do your prices work?",
"Can you tell me the quest answer?"

Answers come from **`useAskBloq()`** (`@/near`), exactly as the in-game `AskBloqSheet` does: one hook instance for the panel,
`ask(question)` (no lessonId on the landing), append the user bubble at once, a three-dot typing bubble while `loading`, then
the answer typed out quickly; under each answer a small mono line `NEAR AI Cloud · {provenance.model}` and, when
`provenance.signature_kind` is set, `signed ({signature_kind}) · Verify ↗` linking to `https://cloud.near.ai/verify` with the
chat id copyable. Errors (`error`) show in the log as Bloq's message with the error text. The agent face `talk()`s while an
answer types. Keep the in-game `AskBloqSheet` as it is.

Confirm: a question gets a real answer in the published app; the quest-answer chip is refused by the agent; the dock never
covers the hero buttons at 360px (scroll if needed); nothing in `src/bloq/` or `src/near/` changed.
