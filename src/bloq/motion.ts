/**
 * Motion on or off, for the whole site and the game: the landing's Motion switch (docs/design/morning-fixes,
 * option A, approved Nov 9). The choice is kept on this device. Until the player picks, it follows the
 * device's own setting (prefers-reduced-motion), so players who already ask for less motion get a calm site
 * without touching anything.
 *
 * When motion is off, <body> gets the class `still`: Bloq stands still (engine.ts), CSS animations and
 * transitions stop (bloq.css), Bloq steps straight to each block instead of walking, jumps land at once
 * (leap, walkTo) and the screen jumps to him instead of gliding (camera.ts).
 *
 *   const off = useMotionRoot();          // once, at the app's root: keeps body.still in step, returns "motion off"
 *   <MotionConfig reducedMotion={off ? "always" : "never"}>…</MotionConfig>
 *   const off = useMotionOff();           // anywhere in React: true while motion is off; re-renders when it changes
 *   setMotion(false);                     // the switch: true = motion on, false = off
 *   if (motionOff()) …                    // outside React (event handlers, animation code)
 *
 * A player's choice wins over the device's setting for everything that asks motionOff(). Bloq's puppet engine
 * and the CSS written for (prefers-reduced-motion: reduce) still follow the device, so on a device that asks
 * for less motion they stay calm even with the switch on.
 */
import { useEffect, useSyncExternalStore } from "react";

const KEY = "bloqvia:motion";
const EVENT = "bloqvia:motion";
const QUERY = "(prefers-reduced-motion: reduce)";

/** Used only when this browser won't store anything (private mode): the choice lasts until the page reloads. */
let memory: "on" | "off" | null = null;

function choice(): "on" | "off" | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "on" || v === "off" ? v : memory;
  } catch {
    return memory;
  }
}

const deviceAsksForLess = () => typeof matchMedia === "function" && matchMedia(QUERY).matches;

/** True while motion is off: the player turned it off, or hasn't picked and the device asks for less motion. */
export function motionOff(): boolean {
  if (typeof window === "undefined") return false;
  const c = choice();
  return c ? c === "off" : deviceAsksForLess();
}

/** The switch. Remembers the choice on this device and applies it at once, everywhere on the page. */
export function setMotion(on: boolean): void {
  memory = on ? "on" : "off";
  try { localStorage.setItem(KEY, memory); } catch { /* private mode: kept in memory until reload */ }
  if (typeof document !== "undefined") document.body.classList.toggle("still", !on);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  const mq = typeof matchMedia === "function" ? matchMedia(QUERY) : null;
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage); // the switch flipped in another tab
  mq?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    mq?.removeEventListener?.("change", onChange);
  };
}

/** True while motion is off. Re-renders when the switch flips (here or in another tab) or the device setting changes. */
export function useMotionOff(): boolean {
  return useSyncExternalStore(subscribe, motionOff, () => false);
}

/** Call once at the app's root: keeps body.still in step with the choice. Returns true while motion is off. */
export function useMotionRoot(): boolean {
  const off = useMotionOff();
  useEffect(() => { document.body.classList.toggle("still", off); }, [off]);
  return off;
}
