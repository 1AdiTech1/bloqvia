# Bloq motion rules (the motion programme, Nov 9)

Status: **all five phases shipped** (Phases 1 to 3 approved by Adi on Nov 9, Phase 4 on Nov 10, Phase 5 checked Nov 10),
in `src/bloq/`. Watch every changed move before → now in the Motion Lab (`docs/design/motion-lab/`, Phases 1 and 2) and
the Phase 3 check page (`docs/design/motion-lab-p3/`), with slow motion, frame strips, onion skin and scores.

The programme:

| Phase | What | Status |
| --- | --- | --- |
| 0 | Motion Lab: every move, slowed down, framed and scored | done (`docs/design/motion-lab/`) |
| 1 | These rules, plus the four moves that hurt most (turn, start/stop, talk, map road) | **shipped Nov 9** |
| 2 | The rules for every other move in the engine: hops with gravity in three sizes, a keyed walk, three cheers, sit and stand, idle beats, props with weight, the surprise take, the laugh, the wave | **shipped Nov 9** (the change as approved: `docs/design/motion-lab/proposal.diff`) |
| 3 | The 3D Bloq: head, hats, ears, backpack and strap drawn at any angle (`docs/design/turnaround/`, v4.13); turns really turn, through the ¾ view; the light stays top-left | **shipped Nov 9** (`8417f3d`) |
| 4 | The pages use the moves: lines drive the mouth, taps are small hops, a solved quest is the big hop, one seat curve (`docs/LOVABLE-PROMPT-28-MOTION.md`) | **shipped Nov 10** (`5202940`) |
| 5 | QA in the lab and on bloqvia.app, phone and desktop, Motion on and off | **done Nov 10** (see below) |

## The rules

"shipped" = on the site (Nov 9 and 10).

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
8. **Gravity in the air** (shipped). Anything in the air follows a gravity arc: fast up, a short hang, fast down. No sine
   arcs, no constant speed along a curve. Stretch on the way up and down, round at the top.
   *Three hops: small 520 ms, happy 700 ms, big 950 ms · landing squash 15–18% with the knees bending.*
9. **Keep his volume** (shipped). Squash and stretch keep width × height the same. Stretch only with speed, squash only
   on impact. One overshoot, then rest.
   *Stretch ≤ 12% · squash ≤ 18% · width × height within ±4% · overshoot ≤ 6%.*
10. **Props have weight** (shipped). Light things (key, coin, bulb) follow the hand almost at once; medium ones (scroll,
    passport, fuel cell) ride lower and lag; the cube takes two hands. Each prop has its own grip.
    *Light: 1 frame lag · medium: 6° lower, 2 frames lag · heavy: two hands, 4 frames.*
11. **Never the same twice** (shipped). Moves he repeats (cheer, hop, peek, idle) pick from two or three versions and
    never the same one twice in a row. A waiting Bloq does something small every few seconds.
    *2–3 versions each · an idle beat every 4–8 s · a bigger one after 10 s.*
12. **Turn round in 3D** (shipped). The head, the hats, the ears, the backpack and the strap are drawn from the angle
    he faces (`head3d.ts`, `hats3d.ts`, `body3d.ts`); a turn really turns, the head leading the body, through the ¾
    view. The light stays top-left whichever way he faces.
    *Walking on the map he is turned ¾ toward you; on a steep phone road he faces the block he is walking to.*
13. **One way to travel** (shipped). Every page moves him with the same walk (the pace above plus grounded steps) and the
    same hop (the leap), and lowers him onto a seat with the same curve (420 ms, `cubic-bezier(.3,.7,.4,1)`).
    *walkTo, the map road, perchAt, jumpTo, the sign-in walk and the phone hop all go through the engine.*
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

## Phase 2, shipped Nov 9

Average score before → now (my estimate):

| Move | Before | Now | What changed |
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

Code: `src/bloq/engine.ts` (hops, walk, cheers, sit/stand, idle beats, props, take, laugh, wave) and `src/bloq/Bloq.tsx`
(`jump(kind?)`: "small", "happy" (default) or "big"). No page had to change: a plain `jump()` is the happy hop.
Phase 4 (Nov 10, `docs/LOVABLE-PROMPT-28-MOTION.md`, applied by Lovable in `5202940`): the quiz asks for the big hop and
no longer shakes his box; every page passes the line to `talk`; taps are the small hop; the desktop tour lowers him onto
a seat with the same curve.

## Phase 3, shipped Nov 9

The 3D Bloq, approved in the turnaround mock (`docs/design/turnaround/`, v4.13) and checked in `docs/design/motion-lab-p3/`:
the head as a rounded slab with the face art laid on it, one inked crease, ear lights (hidden under the agent headset
and the helmets), fifteen hats placed point by point from the turnaround, the backpack as a soft box with the strap over
the shoulder nearer you, the idle hand holding the strap. Fixes after the first package: facing and the pointing
shoulder, the back arm behind the body in profile, the beanie seam, the map road ¾ toward you, and (Nov 10) the facing
on steep phone roads. Details in `src/bloq/README.md`.

## Phase 5, checked Nov 10

Adi walked bloqvia.app on his account, phone and desktop, Motion on and off: the quiz (hello hop, surprise take with the
options shaking and his box still, big hop on a right answer), the taps, the map walks on the phone, the hero. Code
sweep: the old 2D hat art left in `engine.ts` after Phase 3 removed (the hats are `hatArt.ts`), the dead mirror rule in
`bloq.css` removed; strict TypeScript with unused-locals checks clean. Open items live in the hackathon list, not here.
