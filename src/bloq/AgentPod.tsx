/**
 * <AgentPod/> — Bloq the AI agent in a round window he leans out of.
 *
 * At rest he sits inside the circle, antenna over the rim. On hover, keyboard focus of the button
 * around it, or a tap, he leans out with his head in front of the ring, laughs and bounces.
 * Below the circle's middle he is clipped to the circle; above it he can break out of the frame.
 *
 *   <button className="..." aria-label="Ask Bloq"><AgentPod size={58} ref={pod} /></button>
 *   pod.current?.peek();          // lean out for a moment (e.g. every 14 s on the dock)
 *   pod.current?.talk(2400);      // mouth moves while an answer types
 *
 * The pod is decorative (aria-hidden); label the button or link that holds it.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import { Bloq, type BloqHandle } from "./Bloq";

export interface AgentPodHandle {
  /** Lean out for `ms` (default 2200) and bounce. No-op with reduced motion. */
  peek(ms?: number): void;
  jump(): void;
  talk(ms?: number): void;
}

export interface AgentPodProps {
  /** Diameter of the window in px (32 for inline links, 52 for a sheet header, 58 for the dock). */
  size?: number;
  /** false keeps him inside the window (for headers inside a box that clips, like the landing chat panel). Default true. */
  lean?: boolean;
  className?: string;
}

const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const AgentPod = forwardRef<AgentPodHandle, AgentPodProps>(function AgentPod({ size = 32, lean = true, className }, ref) {
  const pod = useRef<HTMLSpanElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const leanOut = (ms: number) => {
    const el = pod.current; if (!el || !lean) return;
    el.classList.add("pop");
    timers.current.push(window.setTimeout(() => el.classList.remove("pop"), ms));
  };

  useImperativeHandle(ref, () => ({
    peek: (ms = 2200) => {
      if (still()) return;
      leanOut(ms);
      timers.current.push(window.setTimeout(() => bloq.current?.jump(), 350));
    },
    jump: () => bloq.current?.jump(),
    talk: (ms) => bloq.current?.talk(ms),
  }), [lean]);

  return (
    <span
      ref={pod}
      aria-hidden="true"
      className={["bloq-pod", lean ? "" : "still", className ?? ""].join(" ")}
      style={{ "--s": `${size}px` } as CSSProperties}
      onPointerDown={() => { leanOut(900); bloq.current?.jump(); bloq.current?.setMood("laugh", 900); }}
      onPointerEnter={() => bloq.current?.setMood("laugh", 700)}
    >
      <span className="clip">
        <Bloq ref={bloq} hat="agent" outfit="agent" pose="idle" label="Bloq the AI agent" />
      </span>
    </span>
  );
});
