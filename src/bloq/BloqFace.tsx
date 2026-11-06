/**
 * <BloqFace/> — only Bloq's head (with his hat), cropped under the chin, for small spots where a whole
 * Bloq doesn't fit: a dialog corner, a card header. He blinks, his eyes follow the pointer, and he laughs
 * on hover; jump() makes him bob.
 *
 *   <BloqFace size={96} hat="cap" />                     // 96px wide, box about 66px tall
 *   Place it so its bottom edge sits on a card's top edge and he peeks over it.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Bloq, type BloqHandle, type BloqHat } from "./Bloq";

export interface BloqFaceHandle { jump(): void; talk(ms?: number): void; }
export interface BloqFaceProps {
  /** Width in px; the box is size × 0.685 tall and ends under the chin. The hat and brim may stick out above and to the sides. */
  size?: number;
  hat?: BloqHat;
  /** Eyes follow the pointer across the window. Default true. */
  follow?: boolean;
  className?: string;
  label?: string;
}

export const BloqFace = forwardRef<BloqFaceHandle, BloqFaceProps>(function BloqFace(
  { size = 96, hat = "cap", follow = true, className, label = "Bloq peeking in" },
  ref,
) {
  const bloq = useRef<BloqHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ jump: () => bloq.current?.jump(), talk: (ms) => bloq.current?.talk(ms) }), []);

  useEffect(() => {
    if (!follow) return;
    const move = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect(); if (!r) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), dy = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
      bloq.current?.look(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [follow]);

  return (
    <div
      ref={box}
      className={["bloq-face", className ?? ""].join(" ")}
      style={{ width: size, height: Math.round(size * 0.685) }}
      onPointerEnter={() => bloq.current?.setMood("laugh", 800)}
      onPointerDown={() => { bloq.current?.jump(); bloq.current?.setMood("laugh", 900); }}
    >
      <Bloq ref={bloq} hat={hat} pose="idle" label={label} />
    </div>
  );
});
