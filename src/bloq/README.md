# `src/bloq/` — Bloq, the animated character

Owned by Adi (like `src/near/`). Screens import from `@/bloq`; they do not edit these files.
The drawing and motion were approved in the design previews (`docs/design/landing-v2/`, `docs/design/game-v2/`);
`engine.ts` is a port of that preview's `bloq-rig.js` and is changed only by porting again.

| Export | What it is |
| --- | --- |
| `Bloq` | The character. Props: `hat`, `prop`, `pose`, `outfit`, `facing`, `floating`, `head`, `className`, `label`. Ref (`BloqHandle`): `jump()`, `talk(ms)`, `setMood(m, ms)`, `look(dx, dy)`, `aimAt(el)`, `walking(on)`, `wobble()`, `rideWave(on)`, `element()`. Size it with the wrapper's width (it keeps a 3:4 box). |
| `SpeechBubble`, `useSay`, `talkMs` | Glass speech bubble that sits above Bloq (or on his left with `side="left"`), stays on screen, `tone="light"` on navy sections. `side="right"`: a sibling after Bloq in a row, in the flow at every width, tail pointing back at him (Passport page, shop). Every line Bloq says in the app uses this bubble. `useSay()` gives `[line, say(text)]`; call `bloq.talk(talkMs(text))` with it. Put the bubble in the same `relative` box as the Bloq. |
| `leap` | A real jump for a Bloq whose box moves with `transform: translate(x, y)` and `width`: `leap(hostEl, { x, y, w }, { body, lift?, onTakeoff(dir), onLand })` crouches, flies an arc with gravity (0.52–1 s by distance), leans, lands with a squash and a puff of dust; returns `cancel()`. `body` wraps only the `<Bloq/>`. Reduced motion: straight to the spot. Used by the landing's Progress section on phones (Bloq into the Passport panel). Design: `docs/design/hop-jump/` (option A). |
| `FloatingCubes` | Six faded cubes behind the hero Bloq, each with its own random motion; ref `hop()`. Place inside the hero's square stage. |
| `BlockSea` | The block sea for the surfing Bloq; pass `riderRef` (the Bloq's wrapper) and it lifts him onto the crest each frame. The rider fires a `bloq:splash` DOM event (`detail.dir`) when he hops back onto the board. |
| `BloqviaLogo` | The logo in motion: blocks drop and stack, the name types itself. Colours `#D4F033 / #A6C21A`, name Space Grotesk 600. |
| `BloqCoin` | The BloqGold coin (lime disc, inner ring, the Bloqvia block mark), the same coin Bloq holds. `size` in px; `label` makes it announced. Use it everywhere BloqGold is drawn. |
| `BloqFace` | Only Bloq's head with his hat, cut under the chin (box height = size × 0.685, cut under the chin; the hat may stick out above it), for dialog corners and card headers. Eyes follow the pointer; laughs on hover; ref `jump()`, `talk(ms)`. Sit its bottom edge on a card's top edge so he peeks over it. |
| `AgentPod` | Bloq the AI agent in a round window he leans out of (hover, focus of the button around it, or tap). `size` in px (32 inline, 52 sheet header, 58 dock); `lean={false}` keeps him inside a plain round avatar (for headers inside a box that clips). Ref (`AgentPodHandle`): `peek(ms)`, `jump()`, `talk(ms)`. Decorative: label the button that holds it. |
| `ChainTrail` | The game map as a NEAR world: isometric floor, validator towers, chunks drifting up, a road of block tiles that lights up lime with lamps and moving transactions, three quest blocks drawn as a vault / battery station / contract machine, Bloq the guide (cap) at the current stop and Bloq the merchant (top hat) behind the shop door. Props: `stops` (3 × `{ id, title, kind: "vault" \| "battery" \| "contract", post, reward? }`), `level` (0–3; raise it after the quest sheet closes and he walks there), `onPlay(i)`, `doorAccount`, `doorOpen?`, `door` (content under the door), `blockHeight` (pass `useFinalBlock()` from `@/near`; null hides the number), `tip?`, `intro?`. Ref: `say(text)`. Design: `docs/design/game-v2/`. |

**Values.** Hats: `cap cap2 bucket beanie captain hardhat beret detective agent moto astro tophat aviator surf grad`.
Props: `star chip thumb key fuel scroll bulb cube magnifier passport badge coin`.
Poses: `idle thumbs wave point hold present cheer walk sit ride bike space board boardwave`.
Outfits: `surf agent astro`.

**Rules.** Never the same hat on two Bloqs of one page (make a v2 hat instead). The AI agent always wears `agent` and appears only through `AgentPod`. Fuel / gas is always drawn as a battery (lucide `BatteryCharging`), never a flame or a pump. Reduced motion: everything
stands still and stays visible. SSR-safe: nothing touches the DOM until mount.
