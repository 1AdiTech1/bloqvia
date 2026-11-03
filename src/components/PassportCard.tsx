import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useGame } from "@/game/useGame";
import { GoldSeal, LevelRing } from "./GameBits";

/** Compact passport header. `level` can be held back by the map while rewards land. */
export function PassportCard({ level: override }: { level?: number }) {
  const { passport } = useGame();
  if (!passport) return null;
  const level = override ?? passport.level;
  return (
    <Link to="/passport" className="flex items-center gap-4 rounded-3xl bg-ivory p-3 pr-4 text-navy shadow-lift active:scale-[0.98] transition-transform">
      <span data-inv="ring"><LevelRing level={level} graduated={passport.graduated} size={56} /></span>
      <div className="flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Passport</p>
        <p className="font-display text-lg font-semibold">
          {passport.graduated ? "Graduate" : level >= 3 ? "Ready to graduate" : `Level ${level}`}
        </p>
      </div>
      {passport.graduated ? <GoldSeal size={40} /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
    </Link>
  );
}
