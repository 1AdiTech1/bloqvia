import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useGame } from "@/game/useGame";
import { ITEM_IDS, ITEM_NAMES, itemAmount } from "@/game/content";
import { GoldSeal, ItemIcon, LevelRing } from "./GameBits";

export function PassportCard() {
  const { passport, learner } = useGame();
  if (!passport || !learner) return null;
  return (
    <div className="card-organic p-4">
      <Link to="/passport" className="flex items-center gap-4">
        <LevelRing level={passport.level} graduated={passport.graduated} size={64} />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Passport</p>
          <p className="font-display text-lg font-bold text-moss">
            {passport.graduated ? "Graduate" : passport.level >= 3 ? "Ready to graduate" : `Level ${passport.level}`}
          </p>
        </div>
        {passport.graduated && <GoldSeal size={44} />}
      </Link>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sun-soft px-3 py-1 text-sm font-bold text-accent-foreground">
          <Coins className="h-4 w-4" /> {Number(learner.gold)}
        </span>
        {ITEM_IDS.map((id) => (
          <span key={id} title={ITEM_NAMES[id]} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
            <ItemIcon id={id} /> {itemAmount(learner.items, id)}
          </span>
        ))}
      </div>
    </div>
  );
}
