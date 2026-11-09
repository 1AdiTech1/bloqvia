/**
 * Six cubes around the hero Bloq. Each gets its own kind of motion (drift, spin, tumble, orbit, sway,
 * hop) with random speed and timing on every visit; they drift with the pointer (bigger = nearer = more)
 * and hop together when you call hop() on the handle. Sits behind Bloq, faded (the eyes go to Bloq).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { motionOff, useMotionOff } from "./motion";

type Kind = "drift" | "spin" | "tumble" | "orbit" | "sway" | "hop";
// [left %, top %, size px, color]
const SPOTS: [number, number, number, "l" | "p" | "w"][] = [[-2, 18, 56, "l"], [84, 6, 66, "p"], [96, 44, 36, "w"], [-6, 60, 44, "p"], [80, 76, 58, "l"], [16, 90, 32, "w"]];
const COLORS = { p: ["#b47ff0", "#8b45d9", "#6630b3"], l: ["#ebfb7a", "#d4f033", "#a6c21a"], w: ["#ffffff", "#e6dcf7", "#c9b8ea"] } as const;

export interface FloatingCubesHandle { hop(): void }

export const FloatingCubes = forwardRef<FloatingCubesHandle, { className?: string }>(function FloatingCubes({ className }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const off = useMotionOff(); // motion off: the cubes stand still (motion.ts)
  useImperativeHandle(ref, () => ({
    hop: () => {
      if (motionOff()) return;
      box.current?.querySelectorAll("svg").forEach((s, i) =>
        s.animate([{ translate: "0 0" }, { translate: "0 -26px" }, { translate: "0 0" }], { duration: 520, delay: i * 40, easing: "cubic-bezier(.3,.7,.4,1)" }));
    },
  }), []);
  useEffect(() => {
    const root = box.current; if (!root) return;
    const reduce = off;
    // Motion turned off: every cube goes back to its resting spot.
    if (reduce) root.querySelectorAll<HTMLElement | SVGElement>("[data-cube], [data-cube] > svg").forEach((el) => { el.style.transform = ""; });
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const kinds: Kind[] = (["drift", "spin", "tumble", "orbit", "sway", "hop"] as Kind[]).sort(() => Math.random() - 0.5);
    const wraps = [...root.querySelectorAll<HTMLElement>("[data-cube]")];
    const life = wraps.map((w, i) => ({ el: w.firstElementChild as SVGElement, kind: kinds[i] ?? "drift", ph: rnd(0, 6.28), sp: rnd(0.7, 1.3), amp: rnd(0.7, 1.3), next: rnd(1, 4), ev: -1, rot: rnd(-12, 12), dir: Math.random() < 0.5 ? -1 : 1 }));
    let on = true, raf = 0, last = performance.now();
    const io = new IntersectionObserver((es) => { on = !!es[0]?.isIntersecting; });
    io.observe(root);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!on || reduce || document.hidden) return;
      for (const q of life) {
        const t = (now / 1000) * q.sp + q.ph, A = q.amp;
        let x = 0, y = 0, r = q.rot, sc = 1;
        if (q.kind === "drift") { x = 12 * A * Math.sin(t * 0.9); y = 9 * A * Math.sin(t * 1.7); r += 6 * Math.sin(t * 0.6); }
        if (q.kind === "spin") { r += (now / 1000) * 40 * q.dir * q.sp; y = 5 * Math.sin(t * 1.2); }
        if (q.kind === "orbit") { x = 14 * A * Math.cos(t * 1.1 * q.dir); y = 10 * A * Math.sin(t * 1.1 * q.dir); r += 10 * Math.sin(t * 1.1); }
        if (q.kind === "sway") { r += 18 * A * Math.sin(t * 1.4); x = 5 * Math.sin(t * 1.4); }
        if (q.kind === "tumble" || q.kind === "hop") {
          y = 3 * Math.sin(t * 1.3); q.next -= dt;
          if (q.next <= 0 && q.ev < 0) q.ev = 0;
          if (q.ev >= 0) {
            q.ev += dt / (q.kind === "tumble" ? 0.75 : 0.5);
            const e = Math.min(1, q.ev);
            y -= (q.kind === "tumble" ? 30 : 22) * A * Math.sin(Math.PI * e);
            if (q.kind === "tumble") r += 90 * q.dir * (e * e * (3 - 2 * e));
            else sc = e < 0.15 ? 1 - e : e > 0.85 ? 1 - (1 - e) * 0.8 : 1;
            if (q.ev >= 1) { q.ev = -1; q.next = rnd(1.8, 5); if (q.kind === "tumble") q.rot += 90 * q.dir; q.dir = Math.random() < 0.5 ? -1 : 1; }
          }
        }
        q.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg) scale(${sc.toFixed(3)}, ${(2 - sc).toFixed(3)})`;
      }
    };
    raf = requestAnimationFrame(frame);
    const onMove = (e: PointerEvent) => {
      if (reduce) return;
      const dx = e.clientX / window.innerWidth - 0.5, dy = e.clientY / window.innerHeight - 0.5;
      wraps.forEach((w) => { const z = Number(w.dataset["z"]); w.style.transform = `translate(${(-dx * 34 * z).toFixed(1)}px, ${(-dy * 26 * z).toFixed(1)}px)`; });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("pointermove", onMove); };
  }, [off]);
  return (
    <div ref={box} aria-hidden="true" className={className} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, opacity: 0.34, filter: "saturate(.7)" }}>
      {SPOTS.map(([x, y, w, k], i) => {
        const [t, l, r] = COLORS[k];
        return (
          <span key={i} data-cube="" data-z={w / 46} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: w, transition: "transform .6s cubic-bezier(.22,1,.36,1)" }}>
            <svg viewBox="0 0 40 44" style={{ display: "block", width: "100%", height: "auto", overflow: "visible", filter: "drop-shadow(0 6px 6px rgb(0 0 0 / .18))" }}>
              <g stroke="#1b1622" strokeWidth="2.6" strokeLinejoin="round">
                <path d="M20 2 L38 12 L20 22 L2 12 Z" fill={t} /><path d="M2 12 L20 22 L20 42 L2 32 Z" fill={l} /><path d="M38 12 L20 22 L20 42 L38 32 Z" fill={r} />
              </g>
              <path d="M8 12 L20 5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
            </svg>
          </span>
        );
      })}
    </div>
  );
});
