# Lovable prompt 28 — the pages use the new Bloq moves (motion programme, Phase 4; Nov 9)

Approved in the Motion Lab (`docs/design/motion-lab/`, Phase 2, and `docs/design/motion-lab-p3/`, Phase 3) and written up
in `docs/MOTION-RULES.md`. The engine in `src/bloq/` already has everything below; this prompt only makes the pages call
it. Four small rules, applied everywhere a page talks to a `Bloq` ref:

1. **Pass the line to `talk`.** `talk(ms, text)` moves his mouth with the words (shapes, pauses, nods, brows on a
   question, one gesture a sentence). `talk(ms)` alone only flaps. Everywhere a page has
   `bloq.current?.talk(talkMs(t))`, make it `bloq.current?.talk(talkMs(t), t)`. (`AgentPod` and `BloqFace` keep
   `talk(ms)`: their answers type out over time, there is no line to follow.)
2. **A tap on Bloq is a small hop.** `jump("small")` keeps his pose (the small 520 ms hop). Events keep the happy hop
   (`jump()`): a trade done, a reward, an arrival.
3. **A solved quest is the big hop.** `jump("big")` (950 ms, with a tuck) — once, in the quiz, when the contract says yes.
4. **Every seat lowers him with the same curve.** Wherever a page moves Bloq down onto an edge to sit (the host element,
   not the engine's own sit), use the sign-in card's lowering: `420 ms`, `cubic-bezier(.3,.7,.4,1)` (ChainTrail's perch
   and `SignInSheet.tsx` already do).

**Most important rule (as in prompts 21 to 27e): don't remove or change anything this prompt doesn't name.** Only the
`talk`, `jump` and seat-lowering calls listed here change; no layout, text, timing or class changes around them. Don't
touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict TypeScript as before.

## The quiz (`src/components/QuizSheet.tsx`)

- `say`: `bloq.current?.talk(talkMs(t), t)`.
- In `choose`, on success: `bloq.current?.jump("big")` (was `jump()`). The cheer pose, the laugh, the cube burst and the
  line stay.
- In `choose`, on a wrong answer: **remove the shake of Bloq's box** — the line
  `if (!reduce) void shakeCtl.start({ x: [0, -7, 6, -4, 2, 0], … })` goes, and with it `shakeCtl`
  (`useAnimationControls`) and the `animate={shakeCtl}` on his `motion.div`. His surprise take (`setMood("o")`, already
  there) is the reaction now. The options still shake (`key={shake}` on their column) — keep that.
- The tap on him (`onClick` of his box): `bloq.current?.jump("small")` (was `jump()`); the laugh stays.
- The hello on open (`bloq.current?.jump(); say(look.hello)`) keeps the happy hop.

## The map (`src/pages/MapPage.tsx`)

- `sayTour`: `tourBloq.current?.talk(talkMs(line), line)`.
- The desktop walk between the two cards (prompt 27): where he sits down on arrival,
  `host.animate([...], { duration: 300, easing: "cubic-bezier(.5,0,.6,1.3)" })` becomes
  `{ duration: 420, easing: "cubic-bezier(.3,.7,.4,1)" }`. The stand-up before the walk (260 ms) stays.
- ChainTrail's own hops and lines are in `src/bloq/` and already follow these rules; nothing to do there.

## The landing's stacked cards (`src/components/brand/HopBloq.tsx`)

- `speak`: `bloq.current?.talk(talkMs(t), t)`.
- The tap on him (`onClick` of the host): `bloq.current?.jump("small")`. The hop between cards (`hop`) keeps `jump()`.

## The shop (`src/pages/ShopPage.tsx`)

- `useEffect(() => { merchant.current?.talk(talkMs(line), line); }, [line]);`
- `tapMerchant`: `merchant.current?.jump("small")`. The hop after a sale (`onTraded`) keeps `jump()`.

## The Passport (`src/pages/PassportPage.tsx`)

- `say`: `bloq.current?.talk(talkMs(t), t)`; the first line on open: `bloq.current?.talk(talkMs(rest), rest)`.
- `tapCard` (a tap on the card or on him): `bloq.current?.jump("small")`.

## Everywhere else

Search `src/components/` and `src/pages/` for `talkMs(` and `.jump(` (the landing, the reveal, the cohort page, the
sign-in sheet, the Ask Bloq dock and sheet, the daily cards, the play-again sheet, …) and apply the same four rules:
every `talk(talkMs(t))` on a `Bloq` ref passes `t`; a hop that answers a tap or a hover becomes `jump("small")`; a hop
that answers something that happened stays `jump()`; a page-side lowering onto a seat uses the 420 ms curve. List each
file you changed in your reply.

## Confirm when done

- Tests and build pass.
- Open a quiz: his hello still comes with the happy hop; pick a wrong answer: the options shake, he does the surprise
  take and his box does not shake; pick the right one: the big hop with the tuck, the cheer, the cubes.
- Tap Bloq on the quiz, on the landing's cards, in the shop and on the Passport: a small hop, his pose kept.
- Any line he says (quiz, shop, Passport, landing cards, the map tour): his mouth follows the words, with a nod or a
  gesture, instead of a plain flap.
- Desktop, after both seasons: he walks from the streak card to today's quest and lowers onto its edge in the same
  easy way as on the sign-in card.
- Motion off (the Motion switch, or reduced motion on the device): nothing moves, lines still show.
- List every file you changed and anything you removed or changed that this prompt doesn't name (it should be only
  the quiz's box shake).
