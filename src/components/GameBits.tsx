import { BloqCoin } from "@/bloq";
import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BatteryCharging, FileCheck2, KeyRound } from "lucide-react";
import { ITEM_NAMES } from "@/game/content";
import { cn } from "@/lib/utils";

export const ITEM_ICONS = {
  "key-fragment": KeyRound,
  "fuel-cell": BatteryCharging,
  "contract-seal": FileCheck2,
} as const;

export function itemLabel(id: string) {
  return id === "gold" ? "BloqGold" : ITEM_NAMES[id] ?? id;
}

/** Coin-like lime disc for BloqGold. */
export function GoldDisc({ className }: { className?: string | undefined }) {
  return (
    <span className={cn("relative inline-flex h-4 w-4 shrink-0 items-center justify-center", className)} aria-hidden="true">
      <BloqCoin size={20} className="h-full w-full" />
    </span>
  );
}

export function ItemIcon({ id, className }: { id: string; className?: string | undefined }) {
  if (id === "gold") return <GoldDisc className={className} />;
  const Icon = ITEM_ICONS[id as keyof typeof ITEM_ICONS] ?? FileCheck2;
  return <Icon className={cn("h-4 w-4", className)} />;
}

export const RewardChip = forwardRef<HTMLSpanElement, { id: string; amount: string | number; className?: string | undefined }>(
  ({ id, amount, className }, ref) => (
    <span
      ref={ref}
      data-chip={id}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold",
        id === "gold" ? "bg-navy text-lime" : "bg-lavender-soft text-navy",
        className,
      )}
    >
      <ItemIcon id={id} /> +{amount} {itemLabel(id)}
    </span>
  ),
);
RewardChip.displayName = "RewardChip";

/** Passport progress ring, 0–3. `tone` is the surface it sits on. */
export function LevelRing({ level, graduated, size = 72, tone = "ivory" }: { level: number; graduated: boolean; size?: number; tone?: "ivory" | "navy" }) {
  const reduce = useReducedMotion();
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(level, 3) / 3;
  const onNavy = tone === "navy";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={size > 100 ? 10 : 7} className={onNavy ? "stroke-navy-soft" : "stroke-lavender-soft"} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={size / 2 + r * Math.cos((i * 2 * Math.PI) / 3)} cy={size / 2 + r * Math.sin((i * 2 * Math.PI) / 3)} r={1.6} className={onNavy ? "fill-lavender" : "fill-navy/40"} />
        ))}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={size > 100 ? 10 : 7}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={reduce ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className={onNavy || graduated ? "stroke-lime" : "stroke-navy"}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-display font-bold leading-none", onNavy ? "text-ivory" : "text-navy")} style={{ fontSize: size / 3.2 }}>
          {Math.min(level, 3)}
        </span>
        {size >= 48 && <span className={cn("text-[10px] font-medium uppercase tracking-[0.14em]", onNavy ? "text-lavender" : "text-muted-foreground")}>of 3</span>}
      </div>
    </div>
  );
}

/** The Graduate seal: a scalloped lime disc with the three-block mark. */
export function GoldSeal({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Graduate seal">
      {Array.from({ length: 16 }).map((_, i) => (
        <circle key={i} cx="32" cy="5" r="5" className="fill-lime" transform={`rotate(${i * 22.5} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="25" className="fill-lime" />
      <circle cx="32" cy="32" r="19" fill="none" className="stroke-navy" strokeWidth="1.5" strokeDasharray="2 3" />
      <rect x="22" y="21" width="15" height="6" rx="2.5" className="fill-navy" />
      <rect x="22" y="29" width="18" height="6" rx="2.5" className="fill-navy" opacity="0.85" />
      <rect x="22" y="37" width="20" height="6" rx="2.5" className="fill-navy" />
    </svg>
  );
}
