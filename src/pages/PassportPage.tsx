import { ExternalLink, Lock, ShieldCheck } from "lucide-react";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { GoldSeal, ItemIcon, LevelRing } from "@/components/GameBits";
import { cn } from "@/lib/utils";

export function PassportPage() {
  return (
    <RequireAccount>
      <PhoneShell nav>
        <PassportInner />
      </PhoneShell>
    </RequireAccount>
  );
}

function PassportInner() {
  const game = useGame();
  const p = game.passport!;
  const completed = game.learner?.completed ?? [];

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="self-start text-2xl font-bold text-moss">Passport</h1>
      <div className="card-organic relative mt-5 w-full overflow-hidden p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sun-soft" aria-hidden="true" />
        <div className="relative flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wider text-moss">
            <ShieldCheck className="h-4 w-4" /> Non-transferable
          </span>
          <div className="mt-6"><LevelRing level={p.level} graduated={p.graduated} size={150} /></div>
          <h2 className="mt-4 text-2xl font-extrabold text-moss">{p.graduated ? "Graduate" : `Level ${p.level}`}</h2>
          <p className="mt-1 break-all text-xs text-muted-foreground">{p.owner_id}</p>
          {p.graduated && <div className="mt-4"><GoldSeal size={80} /></div>}
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3">
          {LESSON_CONTENT.map((l) => {
            const done = completed.includes(l.lesson_id);
            return (
              <div key={l.lesson_id} className="flex flex-col items-center gap-2">
                <span
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed",
                    done ? "-rotate-6 border-leaf bg-secondary text-moss" : "border-border text-muted-foreground",
                  )}
                >
                  {done ? <ItemIcon id={l.reward_item} className="h-7 w-7" /> : <Lock className="h-5 w-5" />}
                </span>
                <span className="text-xs font-semibold">{l.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      <a
        href={game.explorer.passport(game.accountId!)}
        target="_blank"
        rel="noreferrer"
        className="tap mt-6 inline-flex items-center gap-1.5 font-semibold text-moss underline-offset-4 hover:underline"
      >
        View on the explorer <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
