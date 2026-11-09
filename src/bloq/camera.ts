/**
 * The game camera: the screen stays on Bloq, because he is the player's guide (approved Nov 9 in
 * docs/design/morning-fixes, section 1). Nothing moves while he is in the middle band of the screen; when he
 * nears the top or the bottom, the page glides after him, so he never leaves the screen.
 *
 *   const stop = followCamera(walkerEl);   // as he sets off
 *   …walk…
 *   setTimeout(stop, 700);                 // let it settle after he arrives
 *
 *   keepInView(walkerEl);                  // once, at once: motion off, he was just placed somewhere new
 *
 * It moves the page's own scroll, or the nearest scrolling box around him. If the player scrolls (wheel or
 * finger) while he walks, the camera lets go. With motion off (motion.ts) it jumps instead of gliding.
 */
import { motionOff } from "./motion";

type Band = [top: number, bottom: number];
const BAND: Band = [0.3, 0.68];

/** The nearest box around `el` that scrolls vertically, or null for the page itself. */
export function scrollBox(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}

function view(box: HTMLElement | null): { top: number; h: number } {
  return box ? { top: box.getBoundingClientRect().top, h: box.clientHeight } : { top: 0, h: window.innerHeight };
}

/** How far `el`'s middle is outside the band, in px (negative: above it). 0 inside the band. */
function outside(el: HTMLElement, box: HTMLElement | null, band: Band): number {
  const v = view(box), r = el.getBoundingClientRect(), y = (r.top + r.bottom) / 2 - v.top;
  const lo = v.h * band[0], hi = v.h * band[1];
  return y < lo ? y - lo : y > hi ? y - hi : 0;
}

// "instant": the app's CSS sets scroll-behavior: smooth, which would turn every small step into its own glide.
function nudge(box: HTMLElement | null, dy: number): void {
  (box ?? window).scrollBy({ top: dy, behavior: "instant" as ScrollBehavior });
}

/** Follows `el` until the returned stop() is called (or the player scrolls). */
export function followCamera(el: HTMLElement, { band = BAND, ease = 0.14 }: { band?: Band; ease?: number } = {}): () => void {
  const box = scrollBox(el);
  let raf = 0, on = true;
  const stop = () => {
    if (!on) return;
    on = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchmove", stop);
  };
  const tick = () => {
    if (!on) return;
    const d = outside(el, box, band);
    if (Math.abs(d) > 0.5) nudge(box, motionOff() ? d : d * ease);
    raf = requestAnimationFrame(tick);
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchmove", stop, { passive: true });
  raf = requestAnimationFrame(tick);
  return stop;
}

/** One step, at once: brings `el` back into the band if it is outside it. */
export function keepInView(el: HTMLElement, band: Band = BAND): void {
  const box = scrollBox(el), d = outside(el, box, band);
  if (Math.abs(d) > 0.5) nudge(box, d);
}
