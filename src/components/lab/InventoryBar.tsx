import { useGame } from "@/game/useGame";
import { ITEM_IDS, itemAmount } from "@/game/content";
import { GoldDisc, ItemIcon, itemLabel } from "@/components/GameBits";
import { AnimatedNumber } from "./motion";

/** BloqGold + the three items. Values can be held back while rewards are in flight. */
export function InventoryBar({ gold, items }: { gold?: number | undefined; items?: [string, string][] | undefined }) {
  const { learner } = useGame();
  if (!learner) return null;
  const g = gold ?? Number(learner.gold);
  const its = items ?? learner.items;
  return (
    <div className="flex items-center gap-2 rounded-3xl border border-ivory/10 bg-navy-soft/70 p-2">
      <span data-inv="gold" className="flex items-center gap-2 rounded-full bg-navy px-3 py-2 text-sm font-semibold text-ivory" aria-label={`${g} BloqGold`}>
        <GoldDisc className="h-5 w-5" />
        <AnimatedNumber value={g} flash={false} className="font-display text-base" />
      </span>
      <div className="ml-auto flex gap-1.5">
        {ITEM_IDS.map((id) => (
          <span key={id} data-inv={id} title={itemLabel(id)} aria-label={`${itemAmount(its, id)} ${itemLabel(id)}`} className="flex items-center gap-1.5 rounded-full bg-lavender-soft px-2.5 py-2 text-sm font-semibold text-navy">
            <ItemIcon id={id} />
            <AnimatedNumber value={itemAmount(its, id)} flash={false} />
          </span>
        ))}
      </div>
    </div>
  );
}
