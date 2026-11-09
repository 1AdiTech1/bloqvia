# Bloq motion rules (the motion programme, Nov 9)

Status: **Phase 1 shipped** (approved by Adi on Nov 9): the turn, starting and stopping a walk, talking with the words and
the map road walk are in `src/bloq/`. **Phase 2 is a proposal, waiting for Adi's go**: it runs on a lab-only copy of the
engine. Watch both in the Motion Lab (`docs/design/motion-lab/`): before → now for Phase 1, now → proposal for Phase 2,
with slow motion, frame strips, onion skin and scores.

The programme:

| Phase | What | Status |
| --- | --- | --- |
| 0 | Motion Lab: every move, slowed down, framed and scored | done (`docs/design/motion-lab/`) |
| 1 | These rules, plus the four moves that hurt most (turn, start/stop, talk, map road) | **shipped Nov 9** |
| 2 | The rules for every other move in the engine: hops with gravity in three sizes, a keyed walk, three cheers, sit and stand, idle beats, props with weight, the surprise take, the laugh, the wave | **proposal** (`docs/design/motion-lab/proposal.diff`) |
| 3 | Vector turnaround sheet (front, ¾, side, back for the body and each hat); turns go through the ¾ view; the light stays top-left | later |
| 4 | One way to travel on every page (Lovable prompts for the page-side movers) | later |
| 5 | QA in the lab and on bloqvia.app, phone and desktop, Motion on and off | last |

## The rules

"shipped" = on the site since Nov 9. "proposal" = played by the Phase 2 proposal in the lab. "phase N" = comes in that phase.

1. **Nothing moves at one speed** (shipped). Anything that starts or stops eases in and out. Travel speeds up, keeps a
   pace and slows down; he slows on tight bends and where he turns round.
   *Ease in over 90 px, out over 110 px · full walking pace on the map 160 px/s · 45% at a turning point · bends cost up to 40%.*
2. **Get ready first (anticipation)** (shipped). Every action longer than a quarter of a second starts with a small
   move the other way: a dip before a jump, a lean back before a step, a widen before a turn.
   *10–15% of the action's size · 15–35% of its time (turn: 3% widen + 3.5 dip; start: 4° lean back + 4 dip in 90 ms).*
3. **Never a sheet of paper** (shipped). No frame is thinner than 60% of his width. Swapping drawings (turning round,
   front ↔ side) happens at the squash, where the eye can't catch the swap.
   *Turn: 300 ms · squash to 62% · swap at 150 ms · out with a 5% overshoot.*
4. **Parts arrive at different times (overlap)** (shipped). The head leads the body into a turn; arms, hat and backpack
   follow and settle after it. Every turn, start, stop and landing kicks the hat.
   *Head 30–50 ms ahead · hat and arms settle 1–3 frames after the body.*
5. **Feet stay on the ground** (shipped). While he travels, his steps follow the distance he really covers, measured in
   2D on the page (not the screen). Never a timed walk cycle on a moving Bloq.
   *Stride 0.52 of his width a cycle when walking, 0.8 when running · slip at most 2 px.*
6. **Start and stop like a body** (shipped). Starting: lean back and dip, turn to the side, then the stride grows while
   he leans into the first step. Stopping: the stride dies out, then he rocks back and his knees soak it up.
   *Start 260 ms (90 dip + 170 push) · stop 400 ms (200 stride out + 200 settle) · the next action waits for the settle.*
7. **Talk with the words** (shipped). The mouth follows the text (open, wide, round, closed) and closes on every pause.
   A nod on stressed words, the brows up through a question, one hand gesture a sentence (a free hand opens palm up;
   holding something, he lifts it toward you), a blink at each full stop.
   *No mouth shape under 70 ms · comma = 2.4 letters, full stop = 4 letters of silence · nod 240 ms, 4° · gesture 620 ms.*
8. **Gravity in the air** (proposal). Anything in the air follows a gravity arc: fast up, a short hang, fast down. No sine
   arcs, no constant speed along a curve. Stretch on the way up and down, round at the top.
   *Three hops: small 520 ms, happy 700 ms, big 950 ms · landing squash 15–18% with the knees bending.*
9. **Keep his volume** (proposal). Squash and stretch keep width × height the same. Stretch only with speed, squash only
   on impact. One overshoot, then rest.
   *Stretch ≤ 12% · squash ≤ 18% · width × height within ±4% · overshoot ≤ 6%.*
10. **Props have weight** (proposal). Light things (key, coin, bulb) follow the hand almost at once; medium ones (scroll,
    passport, fuel cell) ride lower and lag; the cube takes two hands. Each prop has its own grip.
    *Light: 1 frame lag · medium: 6° lower, 2 frames lag · heavy: two hands, 4 frames.*
11. **Never the same twice** (proposal). Moves he repeats (cheer, hop, peek, idle) pick from two or three versions and
    never the same one twice in a row. A waiting Bloq does something small every few seconds.
    *2–3 versions each · an idle beat every 4–8 s · a bigger one after 10 s.*
12. **Turn round in 3D** (phase 3). A ¾ drawing sits between the front and the side; a turn goes side → ¾ → front → ¾ →
    side. The light stays top-left whichever way he faces.
    *Four views for the body and each hat: front, ¾, side, back.*
13. **One way to travel** (phase 4). Every page moves him with the same walk (the pace above plus grounded steps) and the
    same hop (the leap). No page slides him with its own CSS.
    *Replaces six ways of moving today: walkTo, the map road, perchAt, jumpTo, the sign-in slide, the phone hop.*
14. **Motion off means calm** (shipped). With the Motion switch off, every move jumps to its last frame: nothing
    travels, squashes or flaps, the mouth rests in a smile, and he is simply where he needs to be.

## Phase 1, shipped Nov 9

Average score before → now (my estimate, 1 = poor, 5 = premium):

| Move | Before | Now | What changed |
| --- | --- | --- | --- |
| Turning around | 1.9 | 3.8 | Squash-swap turn instead of the CSS mirror: never thinner than 62%, head 40 ms ahead, knees step round, hat swings after. 300 ms. |
| Start and stop walking | 2.4 | 3.6 | Start: lean back and dip, side view at the dip, the stride grows. Stop: the stride dies out, front view back, he rocks back and soaks it up. A page that moves on at once (sit, a jump, pointing) skips to the settle. |
| Talking | 2.4 | 3.7 | `talk(ms, text)`: mouth shapes from the text with pauses; nods, brows on questions, one gesture a sentence, blinks on full stops. `talk(ms)` alone flaps as before. |
| The jump into Season 2 | 2.2 | 4.0 | The same leap as the tour: a crouch, one arc with gravity that rises only 40 px above where he takes off (before: a curve 230 px above him at one speed), a landing with a squash and dust; he stays through the landing, then the next road's guide greets. About 0.7 s instead of 1.4 s. Both ways (into Network City and back home). |
| Holding things (fix) | | | The arm no longer goes through what he holds: the arm is drawn behind the prop and the hand over it; walking with something in hand he carries it up in front with a bent elbow (both hands for the cube) and that arm swings 30%; a hanging arm lets the prop hang from the hand. |
| Walking the map road | 2.4 | 3.4 | A pace (ease in/out, slower on bends and at turns), steps tied to the ground in 2D on the page (scrolling doesn't count as steps), the new turn, start and stop; settles, then hops and speaks. The camera follows as before. |

Code: `src/bloq/engine.ts` (`face`, `walking`, `talk`, follow mode, the closed mouth), `src/bloq/Bloq.tsx`
(`talk(ms, text?)`), `src/bloq/bloq.css` (closed mouth; no transition on `.bq-flip`), `src/bloq/ChainTrail.tsx` (the road
walk; its lines pass their text; `jumpTo` uses `leap`). The arm fix: `engine.ts` (svg order, the carry pose, the prop's place). Lovable's pages that call `talk(ms)` keep working; passing the text is a later prompt.

## Phase 2, proposal (lab copy of the engine)

Average score now → proposal (my estimate):

| Move | Now | Proposal | What changes |
| --- | --- | --- | --- |
| Jump on the spot | 2.8 | 3.9 | One gravity for all hops (a parabola): small 520 ms keeps his pose, happy 720 ms cheers (the default), big 950 ms with a tuck. Arms swing back in the crouch, stretch by speed, 12–18% landing squash with the knees and one rebound; volume kept. `jump(kind?)`; a plain `jump()` is the happy one. |
| Walk cycle | 2.9 | 3.8 | Keyed: a fast drop after each contact, a slow rise to passing, the landing leg gives; arms 60% of the legs and late; head late; heel-toe roll; the hat bounces each step. |
| Cheering | 2.9 | 3.8 | Three cheers (V arms, fist pump, shimmy), never twice in a row, each easing in over 200 ms; a cheering jump picks one too. |
| Waving | 3.0 | 3.6 | Shoulder joins in, the hand flops behind the forearm, he leans in. |
| Sitting down | 2.6 | 3.6 | 650 ms: a glance at the seat and hands reaching back, a squash and one soft bounce, a settle wiggle; kicks that come and go. |
| Standing up | 2.1 | 3.2 | 450 ms: lean over the feet, hands push, rise with a small stretch, settle. |
| Holding things | 2.8 | 3.9 | (The arm fix is shipped.) Weight classes: light props follow the hand, medium ones ride 6° lower and swing wider, the cube takes two hands; every prop trails the hand like a weight on a spring. |
| Faces | 3.0 | 4.0 | Surprise (mood "o", so wrong answers too): a take, head and body pull back, eyes 22% wider. The laugh shakes him a little. |
| Idle | 4.0 | 4.3 | Every 4–8 s a weight shift or a glance; after 10 s also fixing his hat or a stretch; never the same twice in a row. |
| Quiz answers | 2.8 | 3.7 | Right: the new hop and a cheer; wrong: the surprise take. Engine only, the quiz page doesn't change. |

The proposal's code, as a diff against today's `src/bloq/` (every change marked `P2:`): `docs/design/motion-lab/proposal.diff`.
After Adi's go it is ported to `src/bloq/engine.ts` and `Bloq.tsx` (`jump(kind?)`); no page has to change.
Later, Lovable prompts (Phase 4): the quiz asks for the big hop and stops shaking the whole box; pages pass the line to
`talk`; every page lowers him onto a seat with the same curve.
