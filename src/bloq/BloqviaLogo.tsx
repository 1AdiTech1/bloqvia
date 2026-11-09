/**
 * The Bloqvia logo in motion: three lime blocks drop and stack (each landing squashes the one below),
 * then the name types itself with a lime caret that fades. Replays on hover/focus; the top blocks give
 * a small wiggle every 9 s. Colours: blocks #D4F033 / #A6C21A / #D4F033; name Space Grotesk 600.
 */
import { useEffect, useRef, useState } from "react";
import { useMotionOff } from "./motion";

export function BloqviaLogo({ className, nameClassName }: { className?: string; nameClassName?: string }) {
  const [run, setRun] = useState(0);
  const off = useMotionOff(); // motion off: the name is written at once (motion.ts)
  const [typed, setTyped] = useState("Bloqvia");
  const [caret, setCaret] = useState<"off" | "on" | "out">("off");
  // "stack" = drop and stack (on load, on hover); "wig" = the small wiggle every 9 s. k remounts the svg to restart CSS.
  const [mode, setMode] = useState<{ kind: "stack" | "wig"; k: number }>({ kind: "stack", k: 0 });
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const reduce = off;
    timers.current.forEach(window.clearTimeout); timers.current = [];
    if (reduce) { setTyped("Bloqvia"); setCaret("off"); return; }
    setTyped(""); setCaret("off");
    let at = 900;
    timers.current.push(window.setTimeout(() => setCaret("on"), at - 250));
    "Bloqvia".split("").forEach((_, i) => { at += 85 + Math.random() * 70; timers.current.push(window.setTimeout(() => setTyped("Bloqvia".slice(0, i + 1)), at)); });
    timers.current.push(window.setTimeout(() => setCaret("out"), at + 1400));
    return () => timers.current.forEach(window.clearTimeout);
  }, [run, off]);

  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) setMode((m) => ({ kind: "wig", k: m.k + 1 })); }, 9000);
    return () => window.clearInterval(id);
  }, []);

  const replay = () => { setRun((r) => r + 1); setMode((m) => ({ kind: "stack", k: m.k + 1 })); };
  return (
    <span className={["bloqvia-logo", className ?? ""].join(" ")} onMouseEnter={replay} onFocus={replay}>
      <svg key={mode.k} className={mode.kind} viewBox="0 0 44 42" aria-hidden="true">
        <rect className="b3" x="1" y="29" width="42" height="12" rx="6" />
        <rect className="b2" x="1" y="15.5" width="36" height="12" rx="6" />
        <rect className="b1" x="1" y="2" width="31" height="12" rx="6" />
      </svg>
      <span className={["bloqvia-name", nameClassName ?? ""].join(" ")} aria-hidden="true">
        <span>{typed}</span><span className={`caret ${caret}`} />
      </span>
      <span className="sr-only">Bloqvia</span>
    </span>
  );
}
