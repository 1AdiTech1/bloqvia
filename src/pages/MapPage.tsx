import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, Store } from "lucide-react";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { PassportCard } from "@/components/PassportCard";
import { QuizSheet } from "@/components/QuizSheet";
import { cn } from "@/lib/utils";

// Node positions along the winding path (percent of width, px from top)
const NODES = [
  { x: 25, y: 50 },
  { x: 72, y: 190 },
  { x: 32, y: 330 },
];

export function MapPage() {
  return (
    <RequireAccount>
      <PhoneShell nav>
        <MapInner />
      </PhoneShell>
    </RequireAccount>
  );
}

function MapInner() {
  const game = useGame();
  const [open, setOpen] = useState<string | null>(null);
  const completed = game.learner?.completed ?? [];
  const level = game.learner?.level ?? 0;

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-moss">Your journey</h1>
      <PassportCard />

      <div className="relative mt-6 h-[430px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 430" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M25 50 C 25 130, 72 110, 72 190 S 32 250, 32 330 S 50 420, 60 430"
            fill="none"
            strokeWidth="2.2"
            strokeDasharray="1 4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-sage"
            style={{ strokeWidth: 6 }}
          />
        </svg>
        {LESSON_CONTENT.map((l, i) => {
          const done = completed.includes(l.lesson_id);
          const available = !done && i === completed.length;
          const pos = NODES[i] ?? { x: 50, y: 50 };
          return (
            <div
              key={l.lesson_id}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
              style={{ left: `${pos.x}%`, top: pos.y }}
            >
              <button
                disabled={!available}
                onClick={() => setOpen(l.lesson_id)}
                aria-label={`${l.title} — ${done ? "done" : available ? "available" : "locked"}`}
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-[2rem_1.4rem] border-4 font-display text-2xl font-bold shadow-soft transition-transform",
                  done && "border-leaf bg-leaf text-primary-foreground",
                  available && "animate-pulse-ring border-sun bg-sun-soft text-moss hover:scale-105",
                  !done && !available && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-9 w-9" /> : available ? i + 1 : <Lock className="h-7 w-7" />}
              </button>
              <span className={cn("rounded-full bg-card px-3 py-1 text-sm font-semibold shadow-soft", done || available ? "text-moss" : "text-muted-foreground")}>
                {l.title}
              </span>
            </div>
          );
        })}
      </div>

      <div className="card-organic mt-4 flex items-center gap-4 p-5">
        <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem_0.75rem]", level >= 3 ? "bg-sun-soft text-moss" : "bg-muted text-muted-foreground")}>
          {level >= 3 ? <Store className="h-7 w-7" /> : <Lock className="h-6 w-6" />}
        </span>
        <div className="flex-1">
          <h2 className="font-bold text-moss">Bloq's shop</h2>
          <p className="text-sm text-muted-foreground">
            {level >= 3 ? "Bloq is waiting with his wares." : "Finish the three quests to meet Bloq"}
          </p>
        </div>
        {level >= 3 && (
          <Link to="/shop" className="tap flex items-center rounded-full bg-moss px-5 font-semibold text-primary-foreground shadow-soft">
            Visit
          </Link>
        )}
      </div>

      {open && <QuizSheet lessonId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
