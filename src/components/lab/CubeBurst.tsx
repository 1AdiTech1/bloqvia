import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const CUBE_COLORS = ["#d4f033", "#b47ff0", "#ffffff"];

/** Twelve small spinning cubes thrown out from the centre of the parent box. Re-key to replay. */
export function CubeBurst({ className, size = 10 }: { className?: string; size?: number }) {
  return (
    <div className={cn("pointer-events-none absolute left-1/2 top-1/2 z-20", className)} aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const d = 46 + (i % 3) * 14;
        return (
          <motion.span
            key={i}
            className="absolute block rounded-[2px]"
            style={{ width: size, height: size, background: CUBE_COLORS[i % 3], border: "1.5px solid #16243A" }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - 20, rotate: 360, opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
    </div>
  );
}
