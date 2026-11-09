import { useEffect, useRef, type ReactNode } from "react";
import { useMotionOff } from "@/bloq";
import { motion, useAnimationControls } from "framer-motion";
import { useGame } from "@/game/useGame";
import { ITEM_IDS, itemAmount } from "@/game/content";
import { GoldDisc, ItemIcon, itemLabel } from "@/components/GameBits";
import { AnimatedNumber } from "./motion";
import { cn } from "@/lib/utils";

/** Chip that springs (scale 1.18, .5s) whenever its value changes. */
function BumpChip({ value, className, children, ...rest }: { value: number; className: string; children: ReactNode; "data-inv": string; title?: string; "aria-label": string }) {
  const controls = useAnimationControls();
  const reduce = useMotionOff();
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (!reduce) void controls.start({ scale: [1, 1.18, 1], transition: { duration: 0.5, type: "tween", ease: [0.34, 1.4, 0.64, 1] } });
  }, [value, reduce, controls]);
  return (
    <motion.span animate={controls} className={className} {...rest}>
      {children}
    </motion.span>
  );
}

/** BloqGold + the three items. Values can be held back while rewards are in flight. */
export function InventoryBar({ gold, items }: { gold?: number | undefined; items?: [string, string][] | undefined }) {
  const { learner } = useGame();
  if (!learner) return null;
  const g = gold ?? Number(learner.gold);
  const its = items ?? learner.items;
  return (
    <div className="flex items-center gap-2 rounded-[20px] bg-navy-soft p-2">
      <BumpChip value={g} data-inv="gold" aria-label={`${g} BloqGold`} className="flex items-center gap-2 rounded-full bg-navy px-3 py-2 text-sm font-semibold text-ivory">
        <GoldDisc className="h-5 w-5" />
        <AnimatedNumber value={g} flash={false} className="font-display text-base" />
      </BumpChip>
      <div className="ml-auto flex gap-1.5">
        {ITEM_IDS.map((id) => {
          const n = itemAmount(its, id);
          return (
            <BumpChip key={id} value={n} data-inv={id} title={itemLabel(id)} aria-label={`${n} ${itemLabel(id)}`} className={cn("flex items-center gap-1.5 rounded-full bg-lavender-soft px-2.5 py-2 text-sm font-semibold text-navy")}>
              <ItemIcon id={id} />
              <AnimatedNumber value={n} flash={false} className="font-display" />
            </BumpChip>
          );
        })}
      </div>
    </div>
  );
}
