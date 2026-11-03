import { motion, useReducedMotion } from "framer-motion";

/** Three blocks assembling into the Bloqvia mark, looped. */
export function LabLoader({ label, tone = "lime" }: { label?: string; tone?: "lime" | "navy" }) {
  const reduce = useReducedMotion();
  const fill = tone === "lime" ? "fill-lime" : "fill-navy";
  const blocks = [
    { y: 3, w: 22, from: -18 },
    { y: 15, w: 26, from: 18 },
    { y: 27, w: 28, from: -18 },
  ];
  return (
    <div className="flex flex-col items-center gap-3 py-2" role="status" aria-live="polite">
      <svg width="48" height="48" viewBox="0 0 40 40" aria-hidden="true">
        {blocks.map((b, i) => (
          <motion.rect
            key={i}
            x={6}
            y={b.y}
            width={b.w}
            height={10}
            rx={4}
            className={fill}
            initial={false}
            animate={reduce ? { x: 0, opacity: 1 } : { x: [b.from, 0, 0, b.from], opacity: [0, 1, 1, 0] }}
            transition={reduce ? {} : { duration: 2, times: [0, 0.3, 0.75, 1], repeat: Infinity, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>
      {label && <p className={tone === "lime" ? "text-sm font-medium text-ivory" : "text-sm font-medium text-navy"}>{label}</p>}
    </div>
  );
}
