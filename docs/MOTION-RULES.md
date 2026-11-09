# Bloq motion rules (Phase 1 of the motion programme, Nov 9)

Status: **proposal, waiting for Adi's go.** Nothing in `src/bloq/` has changed. The four proposals below run on a lab-only
copy of the engine and of the map trail. You can watch each one next to today's move in the Motion Lab
(`docs/design/motion-lab/`): slow motion, frame strips, onion skin, scores today → proposal.

The programme:

| Phase | What | Status |
| --- | --- | --- |
| 0 | Motion Lab: every move, slowed down, framed and scored | done (`docs/design/motion-lab/`) |
| 1 | These rules, plus premium proposals for the four moves that hurt most | **proposal (this file)** |
| 2 | Engine v3: the rules for every move (hops, sit/stand, cheer, props, idle, variety), changed in the preview rig and ported to `engine.ts` | next |
| 3 | Vector turnaround sheet (front, ¾, side, back for the body and each hat); turns go through the ¾ view; the light stays top-left | later |
| 4 | One way to travel on every page (Lovable prompts for the page-side movers) | later |
| 5 | QA in the lab and on bloqvia.app, phone and desktop, Motion on and off | last |

## The rules

"proposal" = already played by the Phase 1 proposals. "phase N" = comes in that phase.

1. **Nothing moves at one speed** (proposal). Anything that starts or stops eases in and out. Travel speeds up, keeps a
   pace and slows down; he slows on tight bends and where he turns round.
   *Ease in over 90 px, out over 110 px · full walking pace on the map 160 px/s · 45% at a turning point · bends cost up to 40%.*
2. **Get ready first (anticipation)** (proposal). Every action longer than a quarter of a second starts with a small
   move the other way: a dip before a jump, a lean back before a step, a widen before a turn.
   *10–15% of the action's size · 15–35% of its time (turn: 3% widen + 3.5 dip; start: 4° lean back + 4 dip in 90 ms).*
3. **Never a sheet of paper** (proposal). No frame is thinner than 60% of his width. Swapping drawings (turning round,
   front ↔ side) happens at the squash, where the eye can't catch the swap.
   *Turn: 300 ms · squash to 62% · swap at 150 ms · out with a 5% overshoot.*
4. **Parts arrive at different times (overlap)** (proposal). The head leads the body into a turn; arms, hat and backpack
   follow and settle after it. Every turn, start, stop and landing kicks the hat.
   *Head 30–50 ms ahead · hat and arms settle 1–3 frames after the body.*
5. **Feet stay on the ground** (proposal). While he travels, his steps follow the distance he really covers, measured in
   2D on the page (not the screen). Never a timed walk cycle on a moving Bloq.
   *Stride 0.52 of his width a cycle when walking, 0.8 when running · slip at most 2 px.*
6. **Start and stop like a body** (proposal). Starting: lean back and dip, turn to the side, then the stride grows while
   he leans into the first step. Stopping: the stride dies out, then he rocks back and his knees soak it up.
   *Start 260 ms (90 dip + 170 push) · stop 400 ms (200 stride out + 200 settle) · the next action waits for the settle.*
7. **Talk with the words** (proposal). The mouth follows the text (open, wide, round, closed) and closes on every pause.
   A nod on stressed words, the brows up through a question, one hand gesture a sentence (a free hand opens palm up;
   holding something, he lifts it toward you), a blink at each full stop.
   *No mouth shape under 70 ms · comma = 2.4 letters, full stop = 4 letters of silence · nod 240 ms, 4° · gesture 620 ms.*
8. **Gravity in the air** (phase 2). Anything in the air follows a gravity arc: fast up, a short hang, fast down. No sine
   arcs, no constant speed along a curve. Stretch on the way up and down, round at the top.
   *Three hops: small 520 ms, happy 700 ms, big 950 ms · landing squash 15–18% with the knees bending.*
9. **Keep his volume** (phase 2). Squash and stretch keep width × height the same. Stretch only with speed, squash only
   on impact. One overshoot, then rest.
   *Stretch ≤ 12% · squash ≤ 18% · width × height within ±4% · overshoot ≤ 6%.*
10. **Props have weight** (phase 2). Light things (key, coin, bulb) follow the hand almost at once; medium ones (scroll,
    passport, fuel cell) ride lower and lag; the cube takes two hands. Each prop has its own grip.
    *Light: 1 frame lag · medium: 6° lower, 2 frames lag · heavy: two hands, 4 frames.*
11. **Never the same twice** (phase 2). Moves he repeats (cheer, hop, peek, idle) pick from two or three versions and
    never the same one twice in a row. A waiting Bloq does something small every few seconds.
    *2–3 versions each · an idle beat every 4–8 s · a bigger one after 10 s.*
12. **Turn round in 3D** (phase 3). A ¾ drawing sits between the front and the side; a turn goes side → ¾ → front → ¾ →
    side. The light stays top-left whichever way he faces.
    *Four views for the body and each hat: front, ¾, side, back.*
13. **One way to travel** (phase 4). Every page moves him with the same walk (the pace above plus grounded steps) and the
    same hop (the leap). No page slides him with its own CSS.
    *Replaces six ways of moving today: walkTo, the map road, perchAt, jumpTo, the sign-in slide, the phone hop.*
14. **Motion off means calm** (proposal). With the Motion switch off, every move jumps to its last frame: nothing
    travels, squashes or flaps, the mouth rests in a smile, and he is simply where he needs to be.

## The four proposals (lab copy of the engine)

Today's average score → the proposal's (my estimate, 1 = poor, 5 = premium):

| Move | Today | Proposal | What changes |
| --- | --- | --- | --- |
| Turning around | 1.9 | 3.8 | Squash-swap turn instead of the CSS mirror: never thinner than 62%, head 40 ms ahead, knees step round, hat swings after. 300 ms. |
| Start and stop walking | 2.4 | 3.6 | Start: lean back and dip, side view at the dip, the stride grows. Stop: the stride dies out, front view back, he rocks back and soaks it up. |
| Talking | 2.4 | 3.7 | Mouth shapes from the text with pauses; nods, brows on questions, one gesture a sentence, blinks on full stops. |
| Walking the map road | 2.4 | 3.4 | A pace (ease in/out, slower on bends and at turns), steps tied to the ground in 2D, the new turn, start and stop; settles, then hops and speaks. |

The proposal's code, as a diff against today's `src/bloq/` (lab copy, every change marked `PRO:`):
`docs/design/motion-lab/proposal.diff`.

What Phase 2 would change in the code (only after Adi's go; `engine.ts` is changed by porting from the preview rig):

- `docs/design/landing-v2/bloq-rig.js` and `docs/design/game-v2/bloq-rig.js`, then `src/bloq/engine.ts` by porting:
  `face()` plays the turn (the CSS transition on `.bq-flip` goes); `walking()` gets the start and stop sequences;
  follow mode measures the distance in 2D on the page; `talk(ms, text)` plans the mouth from the text; a closed mouth
  shape is added to the front and side faces.
- `src/bloq/Bloq.tsx`: `talk(ms?, text?)` on the handle (without the text he talks as today, so no page breaks).
- `src/bloq/ChainTrail.tsx`: its lines call `talk(talkMs(text), text)`; the road walk uses the pace above and
  `walking(true, true)`; the hop and the line wait for the settle.
- `src/bloq/bloq.css`: the closed mouth; no transition on `.bq-flip`.
- Pages owned by Lovable that call `talk(ms)` keep working; passing the text (`talk(ms, text)`) is a later Lovable prompt.
