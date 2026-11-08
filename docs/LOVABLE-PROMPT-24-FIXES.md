# Lovable prompt 24 — two fixes after Adi's check (Nov 8)

Approved mock-ups: `docs/design/passport-bubble/index.html` and `docs/design/hop-jump/index.html` (option A).

**Most important rule (as in prompts 21 to 23): don't remove or change anything this prompt doesn't name.** Don't touch `src/bloq/*`, `src/near/*`, `src/content/*` or `public/`. Strict TypeScript and reduced motion as before. `leap` is already exported from `@/bloq` on `main` (`src/bloq/leap.ts`).

## 1. Passport page: Bloq's bubble beside his face (`src/pages/PassportPage.tsx`)

On a 390 × 844 phone, before any scroll, the bubble's lower edge sits behind the bottom menu bar. Move it up beside his face. The wrapper around the bubble

```tsx
<div className="mb-6 min-w-0">
```

becomes

```tsx
<div className="mt-3 min-w-0 self-start">
```

Nothing else changes: the `SpeechBubble` inside it, Bloq, the row and everything above and below stay as they are (desktop gets the same position).

## 2. Landing, phones: a real jump into the Passport panel (`src/pages/Landing.tsx`, `ProgHop`)

Today Bloq does a small hop on the spot and then slides in a straight line into the Passport panel, which looks like a teleport. He now jumps for real with `leap()` from `@/bloq`: a short crouch, an arc with gravity (about 0.9 s for this distance), a small lean, then a squash and a puff of dust as he lands in the same corner as today, where `settle(-1)` runs exactly as now.

**Only the jump from a reward card into the panel changes.** The hops between the reward cards, the 500 ms `panelTimer`, `settle()`, his lines, the sparks, `onPass`, the desktop layout (the non-narrow branch of `Progress`) and reduced motion all stay as they are.

a. Add `leap` to the existing `@/bloq` import.

b. In `ProgHop`, next to the other refs and state:

```tsx
const body = useRef<HTMLDivElement>(null);
const flight = useRef<(() => void) | null>(null);
const [facing, setFacing] = useState<"left" | "right">("right");
```

c. Inside the effect, add `spot(i)` with exactly the numbers `place()` uses now, and make `place()` use it (same behaviour):

```tsx
const spot = (i: number): { x: number; y: number; w: number } | null => {
  const br = b.getBoundingClientRect();
  if (i === -1) {
    const pr = panel()?.getBoundingClientRect();
    if (!pr) return null;
    const w = 112;
    return { x: pr.left - br.left + 14, y: pr.bottom - br.top - 14 - (w * 4) / 3, w };
  }
  const r = cards()[i]?.getBoundingClientRect();
  if (!r) return null;
  const w = 86;
  return { x: r.right - br.left - w - 12, y: r.top - br.top - (w * 4) / 3 * 0.75 + 4, w };
};
const place = (i: number, animate: boolean) => {
  const p = spot(i);
  if (!p) return;
  const anim = animate && !stillRef.current;
  el.style.transition = anim ? "transform .6s cubic-bezier(.34,1.3,.64,1), width .6s cubic-bezier(.34,1.3,.64,1)" : "none";
  el.style.width = `${p.w}px`;
  el.style.transform = `translate(${p.x}px, ${p.y}px)`;
};
```

d. In `go()`, right after `clear();`:

```tsx
flight.current?.();
flight.current = null;
setFacing("right");
```

e. In `go()`, after the `if (!animate || stillRef.current) { … return; }` block and before `setQuiet(true);`:

```tsx
if (i === -1) {
  const to = spot(-1);
  if (to) {
    setQuiet(true);
    setPose("idle");
    flight.current = leap(el, to, {
      body: body.current,
      onTakeoff: (dir) => { setFacing(dir); setPose("cheer"); },
      onLand: () => { flight.current = null; setFacing("right"); settle(-1); },
    });
    return;
  }
}
```

So this jump no longer calls `bloq.current?.jump()` first and no longer uses the 120 ms / 760 ms timers: `leap()` does the crouch, the flight and the landing, and `settle(-1)` runs as he lands. The card-to-card path below it is unchanged.

f. In the effect's cleanup, add `flight.current?.();`.

g. In the JSX, wrap only the `Bloq` (not the bubble) in the body element and pass `facing`:

```tsx
<div className="relative">
  <div ref={body} style={{ transformOrigin: "50% 92%" }}>
    <Bloq ref={bloq} hat="grad" prop={prop} pose={pose} facing={facing} label="Bloq graduating" className="w-full" />
  </div>
  <SpeechBubble text={quiet ? null : line} className={inPanel ? "hop-say hop-up" : "hop-say"} />
</div>
```

## Confirm when done

- Passport page at 390 × 844, before scrolling: Bloq's bubble sits beside his face and ends above the bottom menu bar; tapping him still changes the line. 1440px: the same position.
- Landing at 390px: scroll from the reward cards to the Passport panel and stop. Half a second later Bloq crouches, jumps in an arc down and to the left into the panel's bottom-left corner (leaning, facing the way he jumps), lands with a squash and a little lavender dust, then cheers, the sparks fly, the seal stamps in and his line shows, as today. Scrolling back up during the jump sends him back to the card from where he is.
- Card-to-card hops, desktop, and reduced motion behave exactly as before.
- List anything you removed or changed that this prompt doesn't name (it should be nothing).
