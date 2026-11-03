import { Coins, Flame, KeyRound, Stamp } from "lucide-react";
import { ITEM_NAMES } from "@/game/content";
import { cn } from "@/lib/utils";

export const ITEM_ICONS = {
  "key-fragment": KeyRound,
  "fuel-cell": Flame,
  "contract-seal": Stamp,
  gold: Coins,
} as const;

export function ItemIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ITEM_ICONS[id as keyof typeof ITEM_ICONS] ?? Coins;
  return <Icon className={cn("h-4 w-4", className)} />;
}

export function RewardChip({ id, amount }: { id: string; amount: string | number }) {
  const gold = id === "gold";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
        gold ? "bg-sun-soft text-accent-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      <ItemIcon id={id} /> +{amount} {ITEM_NAMES[id]}
    </span>
  );
}

export function LevelRing({ level, graduated, size = 72 }: { level: number; graduated: boolean; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(level, 3) / 3;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn("transition-all duration-700", graduated ? "stroke-sun" : "stroke-leaf")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold leading-none text-moss" style={{ fontSize: size / 3.4 }}>
          {Math.min(level, 3)}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">of 3</span>
      </div>
    </div>
  );
}

export function GoldSeal({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Graduate seal">
      {Array.from({ length: 12 }).map((_, i) => (
        <ellipse
          key={i}
          cx="32"
          cy="9"
          rx="5"
          ry="9"
          className="fill-sun"
          transform={`rotate(${i * 30} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="18" className="fill-sun-soft stroke-sun" strokeWidth="3" />
      <path d="M24 32l6 6 11-12" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="stroke-moss" />
    </svg>
  );
}
