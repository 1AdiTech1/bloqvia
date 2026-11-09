/**
 * walkTo() — Bloq walks (or runs) along the ground to x like a person, not a car: he speeds up, keeps a
 * steady pace, and slows down before he stops. Trips of up to 3 body widths are a calm walk (about one body
 * width a second); longer ones become a run (about 2.7 widths a second) with a longer speed-up.
 * Approved in docs/design/fixes-n8 (option B).
 *
 *   bloq.walking(true, true);                 // his steps follow the ground and turn into a run when fast
 *   const stop = walkTo(hostEl, x, { onArrive: () => sitDown() });
 *   const xNow = stop();                      // interrupted: he stays where he is; returns that x
 *
 * The host is an absolutely positioned box moved with `transform: translate(x, y)`. walkTo() writes the
 * final transform first and plays the trip over it. With motion off (motion.ts) he is placed there at once.
 * `run: false` keeps it a calm walk however far he goes (along a card's edge, docs/design/morning-fixes).
 */
import { motionOff } from "./motion";

export interface WalkOptions {
  /** The y to walk at (default 0, standing on the ground line). */
  y?: number;
  /** Runs when he gets there (not when the walk is interrupted). */
  onArrive?: () => void;
  /** false: always a calm walk, however far. By default trips over 3 body widths become a run. */
  run?: boolean;
}

function translateOf(el: HTMLElement): { x: number; y: number } {
  const t = getComputedStyle(el).transform;
  const m = new DOMMatrixReadOnly(t && t !== "none" ? t : undefined);
  return { x: m.m41, y: m.m42 };
}

/** A trip with a speed-up, a steady part and a slow-down (trapezoid speed). Distances in px, speeds in px/s. */
export function walkFrames(x0: number, x1: number, y: number, vmax: number, acc: number): { frames: Keyframe[]; ms: number } {
  const d = Math.abs(x1 - x0), dir = Math.sign(x1 - x0) || 1;
  let ta = vmax / acc, da = 0.5 * acc * ta * ta, vp = vmax;
  if (2 * da > d) { vp = Math.sqrt(d * acc); ta = vp / acc; da = d / 2; }
  const tc = vp > 0 ? (d - 2 * da) / vp : 0, T = 2 * ta + tc;
  const at = (t: number) => (t < ta ? 0.5 * acc * t * t : t < ta + tc ? da + vp * (t - ta) : d - 0.5 * acc * (T - t) ** 2);
  const n = 40;
  return {
    ms: Math.max(1, Math.round(T * 1000)),
    frames: Array.from({ length: n + 1 }, (_, k) => ({ transform: `translate(${x0 + dir * at((T * k) / n)}px, ${y}px)`, offset: k / n })),
  };
}

/** Bloq walks from where the host is now to x. Returns stop(), which leaves him where he is and returns that x. */
export function walkTo(host: HTMLElement, x: number, opts: WalkOptions = {}): () => number {
  const { y = 0, onArrive, run } = opts;
  const from = translateOf(host);
  const end = () => {
    host.style.transition = "none";
    host.style.transform = `translate(${x}px, ${y}px)`;
  };
  if (motionOff() || Math.abs(x - from.x) < 1) {
    end();
    onArrive?.();
    return () => x;
  }
  const w = host.offsetWidth || 120;
  const long = run !== false && Math.abs(x - from.x) > w * 3;
  const { frames, ms } = walkFrames(from.x, x, y, long ? w * 2.7 : w * 1.05, long ? w * 3.2 : w * 4);
  end(); // the end state; the trip plays over it
  const trip = host.animate(frames, { duration: ms, easing: "linear" });
  let done = false;
  trip.onfinish = () => { if (done) return; done = true; onArrive?.(); };
  return () => {
    if (done) return x;
    done = true;
    try { trip.commitStyles(); } catch { /* element gone */ }
    trip.cancel();
    return translateOf(host).x;
  };
}
