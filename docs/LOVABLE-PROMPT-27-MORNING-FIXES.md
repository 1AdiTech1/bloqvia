# Lovable prompt 27 — the screen stays on Bloq, the desktop walk, and the Motion switch (Nov 9)

Approved mock-up: `docs/design/morning-fixes/index.html`. Adi chose: section 1 option **B** (your bag slides down), section 2 (he walks between the two cards on desktop), section 3 option **A** (Maria's Motion pill, bottom left of the landing).

**Most important rule (as in prompts 21 to 26b): don't remove or change anything this prompt doesn't name.** Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict TypeScript and try/catch around storage as before.

Already on `main` for this (read the headers of `src/bloq/motion.ts` and `src/bloq/camera.ts`), all exported from `@/bloq`:

- `useMotionRoot()`, `useMotionOff()`, `setMotion(on)`, `motionOff()`: motion on or off for the whole site and the game. The choice is kept on this device; until the player picks, it follows the device's reduced-motion setting. Off puts the class `still` on `<body>`; `src/bloq/bloq.css` then ends every animation at once and skips transitions (don't add your own copy of those rules).
- `walkTo(host, x, { y, run: false, onArrive })`: `run: false` keeps it a calm walk however far.
- `ChainTrail` now keeps the screen on Bloq while he walks to the next block (a follow camera), so nothing needs to scroll for him.

## 1. After a quiz, the screen stays where the player is (`QuizSheet.tsx`, `MapPage.tsx`, `styles.css`)

Today the quiz scrolls the page to the top so the rewards can fly into the inventory bar; then the map scrolls back down when Bloq sets off. Now the screen doesn't move. If the inventory bar is in view (above the sheet), the rewards fly into it as today. If it isn't, **the bag slides down from the top** (a copy of the inventory bar), the rewards fly into it, the numbers count up, and it slides away.

**`QuizSheet.tsx`**

- New optional prop `onBag?: (show: boolean) => void`.
- Replace the rewards effect (the one commented "Rewards land: chips fly to the inventory bar, then hand over to the map.") with this. The `window.scrollTo({ top: 0 … })` line goes; nothing else in the file changes.

```tsx
// Rewards land (prompt 27): the screen stays where the player is. If the inventory bar is in view above the sheet,
// the chips fly into it; otherwise the bag (the map's copy of the bar, [data-bag]) slides down from the top,
// the chips fly into it, and it slides away.
useEffect(() => {
  if (!done || !lesson) return;
  const ids = ["gold", lesson.reward_item];
  const onPage = (id: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-inv="${id}"]`)).find((el) => !el.closest("[data-bag]"));
  const bar = onPage("gold")?.getBoundingClientRect();
  const sheetTop = sheetPanel.current?.getBoundingClientRect().top ?? window.innerHeight;
  const inView = !!bar && bar.top >= 0 && bar.bottom <= Math.min(window.innerHeight, sheetTop);
  const bag = !inView && !!onBag;
  if (bag) onBag?.(true);
  const target = (id: string) => (bag ? document.querySelector<HTMLElement>(`[data-bag] [data-inv="${id}"]`) : onPage(id));
  const t1 = setTimeout(() => {
    const fl = ids
      .map((id) => {
        const r = bloqBox.current?.getBoundingClientRect();
        const from = r ? new DOMRect(r.left + r.width * 0.45 - 18, r.top + r.height * 0.35 - 18, 36, 36) : document.querySelector(`[data-chip="${id}"]`)?.getBoundingClientRect();
        const to = target(id)?.getBoundingClientRect();
        return from && to ? { id, from, to } : null;
      })
      .filter((f): f is Flight => !!f);
    if (!reduce) setFlights(fl);
  }, reduce ? 0 : bag ? 420 : 350); // with the bag: once it has slid down (0.4 s)
  const t2 = setTimeout(() => { setFlights([]); onLanded(); setPose("thumbs"); }, reduce ? 50 : bag ? 1220 : 1100);
  const t3 = bag ? setTimeout(() => onBag?.(false), reduce ? 2000 : 3100) : undefined;
  return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); if (bag) onBag?.(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [done]);
```

- `sheetPanel` is the sheet panel itself, the `motion.div` that has `ref={sheet.ref}` (its top edge is the sheet's top edge). If `sheet.ref` is a ref object, use it (`const sheetPanel = sheet.ref`); if it is a callback ref, add a `useRef<HTMLDivElement>(null)` and set both on that element.

**`MapPage.tsx`**

- `const [bag, setBag] = useState(false);` and `const [bagBox, setBagBox] = useState<{ left: number; width: number }>();` and `const invBox = useRef<HTMLDivElement>(null);`.
- Put `ref={invBox}` on the existing wrapper around `<InventoryBar gold={held?.gold} items={held?.items} />` (the `order-3 mt-4 …` div). Nothing else on it changes.
- `const showBag = (on: boolean) => { if (on) { const r = invBox.current?.getBoundingClientRect(); if (r) setBagBox({ left: r.left, width: r.width }); } setBag(on); };` and pass `onBag={showBag}` to `<QuizSheet>`.
- In `close()`, add `setBag(false);` next to `setHeld(null);`.
- Render the bag once in the map, in a portal on `document.body` (like the quiz's flights; import `createPortal` from `react-dom`), so it sits over everything at the top of the screen, lined up with the real bar:

```tsx
{typeof document !== "undefined" && createPortal(
  <div data-bag="" aria-hidden="true" className={bag ? "bag-dock in" : "bag-dock"} style={bagBox}>
    <InventoryBar gold={held?.gold} items={held?.items} />
  </div>,
  document.body,
)}
```

It shows the same held numbers as the real bar, so they count up when the rewards land (`landed()` releases them), exactly like the real bar.

**`styles.css`** (as in the mock: navy bar with a lime ring, sliding 0.4 s)

```css
/* The bag slides down after a quiz when the inventory bar is off screen (prompt 27, docs/design/morning-fixes, 1B). */
.bag-dock { position: fixed; z-index: 55; top: env(safe-area-inset-top, 0px); pointer-events: none; visibility: hidden; transform: translateY(-110%); transition: transform .4s cubic-bezier(.22,1,.36,1), visibility 0s linear .4s; }
.bag-dock.in { visibility: visible; transform: translateY(10px); transition: transform .4s cubic-bezier(.22,1,.36,1), visibility 0s; }
.bag-dock > div { background: #1d2c47; box-shadow: 0 0 0 1.5px rgb(212 240 51 / .6), 0 16px 30px rgb(0 0 0 / .5); }
```

(z-index 55: over the quiz sheet's layer, 45, and under the flying chips, 60.)

After the sheet closes, the map raises the trail level as today and Bloq walks to the next block; the screen now stays on him (`ChainTrail`'s camera). Nothing to add for that.

## 2. Desktop: from the Community streak card to Today's quest he walks (`MapPage.tsx`)

On desktop the two cards sit side by side, so instead of jumping Bloq stands up on the streak card's top edge, walks along the edges to Today's quest, and sits down. On phones (cards one under the other) and for every other step he jumps as today.

In the step effect (the one commented "He appears sitting on the current step, then jumps (leap) to each next one on the same visit."):

- Keep the step he is leaving before it is overwritten: change `const first = tourAt.current === null;` to

```tsx
const prevStep = tourAt.current;
const first = prevStep === null;
```

- In `jump`, after `if (!host || !spot) return;` and `tourFlight.current?.();`, before `setTourPose("idle");`, add:

```tsx
// Desktop, the next card is beside this one (streak → Today's quest): he stands up, walks along the cards'
// top edges and sits down (prompt 27, docs/design/morning-fixes, section 2). Otherwise he jumps, as before.
const from = prevStep ? tourApi.current.spotFor(prevStep) : null;
if (desktop && from && Math.abs(from.y - spot.y) < 8) {
  const lift = (W * 4) / 3 * 0.22 + 4; // from sitting on the edge to standing on it
  const upFrom = from.y - lift, up = spot.y - lift;
  let stopWalk: (() => number) | null = null;
  setTourPose("idle");
  host.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${from.x}px, ${upFrom}px)` }], { duration: 260, easing: "cubic-bezier(.3,.7,.4,1)" });
  host.style.transform = `translate(${from.x}px, ${upFrom}px)`;
  const t = window.setTimeout(() => {
    setTourFacing(spot.x >= from.x ? "right" : "left");
    tourBloq.current?.walking(true, true);
    stopWalk = walkTo(host, spot.x, {
      y: up,
      run: false,
      onArrive: () => {
        stopWalk = null;
        tourFlight.current = null;
        tourBloq.current?.walking(false);
        host.animate([{ transform: `translate(${spot.x}px, ${up}px)` }, { transform: `translate(${spot.x}px, ${spot.y}px)` }], { duration: 300, easing: "cubic-bezier(.5,0,.6,1.3)" });
        host.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
        setTourFacing("right");
        setTourPose("sit");
        tourBloq.current?.setMood("laugh", 900);
        timers.current.push(setTimeout(() => tourApi.current.sayTour(tourApi.current.LINE[step]), 260));
      },
    });
  }, 280);
  tourFlight.current = () => { window.clearTimeout(t); stopWalk?.(); tourBloq.current?.walking(false); };
  return;
}
```

- Import `walkTo` from `@/bloq`. Add `desktop` to the effect's dependency list only if lint asks; the behaviour doesn't depend on it changing mid-step.

While he walks, `tourFlight.current` is set, so the re-place on resize waits for him as it does during a jump. With motion off the effect already places him at once (the `first || reduce` branch).

## 3. The Motion switch on the landing, for the landing and the game

Maria's pill from `docs/design/landing-v2/index.html` (`.switch`): a small ivory pill fixed in the bottom-left corner of the landing, opposite Ask Bloq, with one button, **Motion**. Dark when motion is on, light when it's off. The choice goes with the player into the game and stays on this device.

**`src/routes/__root.tsx`**: in `RootComponent`, keep `body.still` in step and tell framer-motion:

```tsx
const off = useMotionRoot(); // the Motion switch (prompt 27)
return (
  <QueryClientProvider client={queryClient}>
    <MotionConfig reducedMotion={off ? "always" : "never"}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AppChrome />
    </MotionConfig>
  </QueryClientProvider>
);
```

(`MotionConfig` from `framer-motion`, `useMotionRoot` from `@/bloq`.)

**One setting everywhere.** framer-motion's `useReducedMotion()` only reads the device, not the switch. In every file under `src/components/` and `src/pages/`, replace `useReducedMotion()` from `framer-motion` with `useMotionOff()` from `@/bloq` (same meaning: true = keep still), and any other check of `(prefers-reduced-motion: reduce)` in TS/TSX (`matchMedia`, `useMedia`) with `motionOff()` / `useMotionOff()`. Keep the variable names (`reduce`, `still`) and everything they do. The `@media (prefers-reduced-motion: reduce)` rules in `styles.css` stay as they are. If a test mocks `useReducedMotion`, mock `useMotionOff` instead.

This matters on the map: `close()` uses `reduce` to fire `arrived1` itself because `ChainTrail` places Bloq at once with motion off; both now read the same setting.

**New `src/components/brand/MotionSwitch.tsx`:**

```tsx
import { setMotion, useMotionOff } from "@/bloq";

/** The Motion switch, bottom left of the landing (Maria's design in docs/design/landing-v2; prompt 27).
 *  Dark = motion on. The choice applies to the landing and the game and stays on this device. */
export function MotionSwitch() {
  const on = !useMotionOff();
  return (
    <div className="lv-motion">
      <button type="button" aria-pressed={on} onClick={() => setMotion(!on)} title={on ? "Turn motion off" : "Turn motion on"}>
        Motion
      </button>
    </div>
  );
}
```

**`src/pages/Landing.tsx`**: render it like the Ask Bloq dock, hidden while the sign-in sheet is open: `{!open && <MotionSwitch />}` next to `{!open && <AskDock />}`. Only on the landing; not in the game.

**`styles.css`** (Maria's `.switch`, plus an invisible 44 px tap area):

```css
/* The Motion switch, bottom left of the landing (prompt 27; Maria's .switch in docs/design/landing-v2) */
.lv-motion { position: fixed; z-index: 41; left: calc(12px + env(safe-area-inset-left, 0px)); bottom: calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; gap: 6px; padding: 6px; border-radius: 999px; background: rgb(255 253 247 / .94); box-shadow: 0 8px 24px -12px rgb(22 36 58 / .5); }
.lv-motion button { all: unset; position: relative; cursor: pointer; font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 600; font-size: 11px; line-height: 1; text-transform: uppercase; letter-spacing: .1em; padding: 9px 12px; border-radius: 999px; color: #16243a; }
.lv-motion button::after { content: ""; position: absolute; inset: -8px; }
.lv-motion button[aria-pressed="true"] { background: #16243a; color: #f7f4eb; }
.lv-motion button:focus-visible { outline: 2px solid #d4f033; outline-offset: 2px; }
```

## Confirm when done

- Tests and build pass.
- Map, phone width: scroll down to The Fuel System and play it. When you answer right the screen doesn't move; the bag slides down at the top, the gold and the fuel cell fly into it, the numbers count up, and it slides away. **Back to the map**: Bloq walks to Smart Agreements and the screen stays on him. When the inventory bar is in view above the sheet (for example on desktop with the map at the top), the rewards fly into the real bar and no bag appears.
- Desktop, after Season 2: check in on the streak card. Bloq stands up, walks to Today's quest and sits down. On a phone he still jumps.
- Landing: the **Motion** pill sits bottom left on desktop and on a phone, clear of Ask Bloq. Tap it: it turns light, the cubes, rings, logo and Bloq stop, and in the game Bloq steps straight to each block. Reload: still off. Tap again: everything moves again.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
