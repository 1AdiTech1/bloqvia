import { forwardRef, useEffect, useRef, useState, type ComponentProps } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export const labEase = [0.22, 1, 0.36, 1] as const;

/** Quiet haptic on success where supported. */
export function buzz() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(12); } catch { /* unsupported */ }
  }
}

/** Button with a press-down scale of 0.98 (static when reduced motion is on). */
export const Press = forwardRef<HTMLButtonElement, HTMLMotionProps<"button">>(({ className, ...rest }, ref) => {
  const reduce = useReducedMotion();
  return <motion.button ref={ref} whileTap={reduce ? {} : { scale: 0.98 }} className={cn("tap", className)} {...rest} />;
});
Press.displayName = "Press";

/** Tweens a number towards `value` over `ms`. */
export function useTween(value: number, ms = 700) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce || from.current === value) { from.current = value; setShown(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, ms, reduce]);
  return shown;
}

/** Number that tweens and briefly flashes lime when it rises, coral when it falls. */
export function AnimatedNumber({ value, className, flash = true, ...rest }: { value: number; flash?: boolean } & ComponentProps<"span">) {
  const shown = useTween(value);
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value === prev.current) return;
    setDir(value > prev.current ? "up" : "down");
    prev.current = value;
    const t = setTimeout(() => setDir(null), 650);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span
      {...rest}
      className={cn(
        "inline-block rounded-md px-1 tabular-nums transition-colors duration-500",
        flash && dir === "up" && "bg-lime text-navy",
        flash && dir === "down" && "bg-coral text-navy",
        className,
      )}
    >
      {shown}
    </span>
  );
}
