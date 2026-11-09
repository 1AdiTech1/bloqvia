/**
 * <Bloq/> — the animated Bloq character (block head, springy limbs, hats, props, outfits).
 *
 * Declarative props set what he wears and how he stands; the ref handle triggers one-off moments.
 *
 *   const b = useRef<BloqHandle>(null);
 *   <Bloq ref={b} hat="cap2" pose="idle" className="w-36" label="Bloq waving" />
 *   b.current?.jump();  b.current?.talk(2400);  b.current?.aimAt(buttonEl);
 *
 * Rules the landing keeps: one hat per Bloq on a page (never the same hat twice);
 * the drawing lives in engine.ts and is not edited by hand.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { BloqRig } from "./engine";
import "./bloq.css";

export type BloqHat =
  | "cap" | "cap2" | "bucket" | "beanie" | "captain" | "hardhat" | "beret" | "detective"
  | "agent" | "moto" | "astro" | "tophat" | "aviator" | "surf" | "grad";
export type BloqProp =
  | "star" | "chip" | "thumb" | "key" | "fuel" | "scroll" | "bulb" | "cube" | "magnifier" | "passport" | "badge" | "coin";
export type BloqPose =
  | "idle" | "thumbs" | "wave" | "point" | "hold" | "present" | "cheer" | "walk" | "sit"
  | "ride" | "bike" | "space" | "board" | "boardwave";
export type BloqOutfit = "surf" | "agent" | "astro";
export type BloqMood = "smile" | "laugh" | "o";

export interface BloqProps {
  hat?: BloqHat;
  prop?: BloqProp | null;
  pose?: BloqPose;
  outfit?: BloqOutfit | null;
  facing?: "left" | "right";
  /** Feet together, speed lines under him, floating up and down. */
  floating?: boolean;
  head?: "block" | "round";
  className?: string;
  /** Accessible description; the character is drawn as role="img". */
  label?: string;
}

/** One-off moments. All are no-ops before mount and with reduced motion where it matters. */
export interface BloqHandle {
  jump(): void;
  /** Mouth moves for ms milliseconds (use while a speech bubble shows). */
  /** Mouth moves for ms; with the line's text it follows the words (shapes, pauses, nods, brows, a gesture). */
  talk(ms?: number, text?: string): void;
  setMood(mood: BloqMood, ms?: number): void;
  /** -1..1 each: where his eyes look. */
  look(dx: number, dy: number): void;
  /** Point at an element and keep aiming while it moves; null stops and returns to `pose`. */
  aimAt(el: Element | null): void;
  /** Side view walking cycle on/off (the parent moves the element). With `follow`, his steps follow how far he really moves (no sliding), and fast trips become a run. */
  walking(on: boolean, follow?: boolean): void;
  /** Riding pose only: start losing balance now. */
  wobble(): void;
  /** Riding pose only: wave with the free hand. */
  rideWave(on: boolean): void;
  /** The host element (for measuring, or listening to "bloq:splash"). */
  element(): HTMLDivElement | null;
}

interface Rig {
  setHat(h: string, animate?: boolean): Rig;
  setProp(p: string | null, animate?: boolean): Rig;
  setPose(p: string, snap?: boolean): Rig;
  setOutfit(o: string | null): Rig;
  setHead(shape: string): Rig;
  setMood(m: string, ms?: number): Rig;
  face(d: string): Rig;
  look(dx: number, dy: number): Rig;
  jump(): Rig;
  talk(ms?: number, text?: string): Rig;
  aimAt(el: Element | null): Rig;
  walking(on: boolean, follow?: boolean): Rig;
  wobble(): Rig;
  rideWave(on: boolean): Rig;
  destroy(): void;
  el: SVGSVGElement;
}

export const Bloq = forwardRef<BloqHandle, BloqProps>(function Bloq(
  { hat = "cap", prop = null, pose = "idle", outfit = null, facing = "right", floating = false, head = "block", className, label = "Bloq" },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<Rig | null>(null);
  const first = useRef(true);

  // mount once; later prop changes go through the setters below
  useEffect(() => {
    if (!host.current) return;
    const r = new BloqRig(host.current, { hat, prop, pose, outfit, head, face: facing }) as unknown as Rig;
    rig.current = r;
    return () => { r.destroy(); rig.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!first.current) rig.current?.setHat(hat); }, [hat]);
  useEffect(() => { if (!first.current) rig.current?.setProp(prop); }, [prop]);
  useEffect(() => { if (!first.current) rig.current?.setPose(pose); }, [pose]);
  useEffect(() => { if (!first.current) rig.current?.setOutfit(outfit); }, [outfit]);
  useEffect(() => { if (!first.current) rig.current?.setHead(head); }, [head]);
  useEffect(() => { if (!first.current) rig.current?.face(facing); }, [facing]);
  useEffect(() => { rig.current?.el.classList.toggle("floaty", floating); }, [floating]);
  useEffect(() => { first.current = false; }, []);

  useImperativeHandle(ref, () => ({
    jump: () => { rig.current?.jump(); },
    talk: (ms, text) => { rig.current?.talk(ms, text); },
    setMood: (m, ms) => { rig.current?.setMood(m, ms); },
    look: (dx, dy) => { rig.current?.look(dx, dy); },
    aimAt: (el) => {
      const r = rig.current; if (!r) return;
      r.aimAt(el);
      if (!el) r.face(facing).setPose(pose);
    },
    walking: (on, follow) => { rig.current?.walking(on, !!follow); if (!on) rig.current?.setPose(pose); },
    wobble: () => { rig.current?.wobble(); },
    rideWave: (on) => { rig.current?.rideWave(on); },
    element: () => host.current,
  }), [facing, pose]);

  return <div ref={host} className={className} role="img" aria-label={label} />;
});
