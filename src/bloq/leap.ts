/**
 * leap() — Bloq jumps for real from where his host box is to a new spot: a short crouch, an arc with
 * gravity (steady sideways speed, up then down), a small lean into the jump, a squash and a puff of dust
 * when he lands. Approved in docs/design/hop-jump/ (option A).
 *
 *   const cancel = leap(hostEl, { x, y, w }, {
 *     body: bodyEl,                                  // wraps only the <Bloq/>: gets the crouch and squash
 *     onTakeoff: (dir) => { setFacing(dir); setPose("cheer"); },
 *     onLand: () => { setFacing("right"); settle(); },
 *   });
 *
 * The host is an absolutely positioned box moved with `transform: translate(x, y)` and sized with `width`
 * (Bloq keeps a 3:4 box inside it). leap() writes the final transform and width first and plays the
 * flight over them, so cancel() (or an interruption) leaves him where he is and the next move starts there.
 * With motion off (motion.ts) he goes straight to the spot and both callbacks run at once.
 */
import { motionOff } from "./motion";

/** Where the host box goes: its translate in px and its width in px. */
export interface LeapSpot { x: number; y: number; w: number }

export interface LeapOptions {
  /** The element around the <Bloq/> only (not the speech bubble): it crouches, stretches and squashes. */
  body?: HTMLElement | null;
  /** How far the top of the arc rises above the higher end, in px. Near the top of the screen it rises less, so he never flies out of view. */
  lift?: number;
  /** Crouch before take-off, in ms. */
  crouchMs?: number;
  /** A puff of lavender dust at his feet when he lands. */
  dust?: boolean;
  /** Runs as he leaves the ground; `dir` is the way he is jumping. */
  onTakeoff?: (dir: "left" | "right") => void;
  /** Runs as he lands. */
  onLand?: () => void;
}

/** Flight time: longer jumps take a little longer (0.52 s to 1 s). */
export function leapMs(a: LeapSpot, b: LeapSpot): number {
  return Math.round(Math.min(1000, Math.max(520, 420 + Math.hypot(b.x - a.x, b.y - a.y) * 0.55)));
}

/** Keyframes for the host: a parabola whose top is `lift` px above the higher end, at constant sideways speed. */
export function leapFrames(a: LeapSpot, b: LeapSpot, lift: number, ms: number): Keyframe[] {
  const top = Math.min(a.y, b.y) - lift;
  const s0 = Math.sqrt(a.y - top), s1 = Math.sqrt(b.y - top);
  const g = (2 * (s0 + s1) ** 2) / (ms * ms); // px per ms², so the rise and the fall add up to ms
  const up = Math.sqrt((2 * (a.y - top)) / g);
  const lean = b.x < a.x ? -9 : 9;
  const n = 30;
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = (ms * k) / n, f = k / n;
    const y = t < up ? top + (g / 2) * (up - t) ** 2 : top + (g / 2) * (t - up) ** 2;
    const x = a.x + (b.x - a.x) * f;
    const w = a.w + (b.w - a.w) * f;
    return { transform: `translate(${x}px, ${y}px) rotate(${(lean * Math.sin(Math.PI * f)).toFixed(2)}deg)`, width: `${w}px`, offset: f };
  });
}

function puff(host: HTMLElement): void {
  const w = host.offsetWidth, h = host.offsetHeight;
  for (let i = 0; i < 7; i++) {
    const s = document.createElement("span");
    const dir = i % 2 ? 1 : -1, d = 18 + Math.random() * 26;
    Object.assign(s.style, {
      position: "absolute", left: `${w / 2}px`, top: `${h * 0.93}px`, width: "12px", height: "12px",
      borderRadius: "50%", background: "#c9a6f3", pointerEvents: "none", zIndex: "-1",
    });
    host.appendChild(s);
    s.animate(
      [
        { transform: "translate(-50%,-50%) scale(.4)", opacity: 0.9 },
        { transform: `translate(calc(-50% + ${dir * d}px), calc(-50% - ${6 + Math.random() * 12}px)) scale(1.1)`, opacity: 0 },
      ],
      { duration: 520 + Math.random() * 200, easing: "cubic-bezier(.22,1,.36,1)" },
    ).onfinish = () => s.remove();
  }
}

/** Bloq leaps from where the host is now to `to`. Returns cancel(). */
export function leap(host: HTMLElement, to: LeapSpot, opts: LeapOptions = {}): () => void {
  const { body = null, crouchMs = 130, dust = true, onTakeoff, onLand } = opts;
  const now = getComputedStyle(host).transform;
  const m = new DOMMatrixReadOnly(now && now !== "none" ? now : undefined);
  const from: LeapSpot = { x: m.m41, y: m.m42, w: host.offsetWidth };
  const dir: "left" | "right" = to.x < from.x - 8 ? "left" : "right";
  const land = () => {
    host.style.transition = "none";
    host.style.width = `${to.w}px`;
    host.style.transform = `translate(${to.x}px, ${to.y}px)`;
  };
  if (motionOff()) {
    land();
    onTakeoff?.(dir);
    onLand?.();
    return () => {};
  }

  const anims: Animation[] = [];
  let timer: number | undefined;
  let done = false;
  const squash = (frames: Keyframe[], ms: number) => { if (body) anims.push(body.animate(frames, { duration: ms, easing: "ease-out" })); };
  const screenTop = host.getBoundingClientRect().top;
  const lift = Math.max(12, Math.min(opts.lift ?? 46, screenTop - 8));

  squash([{ transform: "scale(1,1)" }, { transform: "scale(1.1,.86)" }], crouchMs);
  timer = window.setTimeout(() => {
    timer = undefined;
    const ms = leapMs(from, to);
    onTakeoff?.(dir);
    land(); // the end state; the flight plays over it
    const flight = host.animate(leapFrames(from, to, lift, ms), { duration: ms, easing: "linear" });
    anims.push(flight);
    squash([{ transform: "scale(1.1,.86)" }, { transform: "scale(.92,1.1)", offset: 0.35 }, { transform: "scale(1,1)" }], 260);
    flight.onfinish = () => {
      if (done) return;
      done = true;
      squash([{ transform: "scale(1,1)" }, { transform: "scale(1.14,.82)", offset: 0.25 }, { transform: "scale(.96,1.05)", offset: 0.6 }, { transform: "scale(1,1)" }], 360);
      if (dust) puff(host);
      onLand?.();
    };
  }, crouchMs);

  return () => {
    if (timer !== undefined) window.clearTimeout(timer);
    if (done) return;
    done = true;
    for (const a of anims) {
      try { a.commitStyles(); } catch { /* element gone */ }
      a.cancel();
    }
    if (body) body.style.transform = "";
  };
}
