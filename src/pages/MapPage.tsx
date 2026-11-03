import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { PassportCard } from "@/components/PassportCard";
import { QuizSheet } from "@/components/QuizSheet";
import { ItemIcon } from "@/components/GameBits";
import { InventoryBar } from "@/components/lab/InventoryBar";
import { Press, buzz, labEase } from "@/components/lab/motion";
import { cn } from "@/lib/utils";

// Positions along the winding path (percent of width, px from top). Index 3 = shop door.
const STOPS: { x: number; y: number }[] = [
  { x: 28, y: 70 },
  { x: 72, y: 230 },
  { x: 30, y: 390 },
  { x: 50, y: 560 },
];
const PATH = "M28 70 C 28 150, 72 150, 72 230 S 30 310, 30 390 S 50 470, 50 560";

export function MapPage() {
  return (
    <RequireAccount>
      <PhoneShell nav>
        <MapInner />
      </PhoneShell>
    </RequireAccount>
  );
}

type Held = { gold: number; items: [string, string][] };

function MapInner() {
  const game = useGame();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [heldLevel, setHeldLevel] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const learner = game.learner!;
  const completed = learner.completed;
  const level = heldLevel ?? learner.level;

  const openQuest = (id: string) => {
    setHeld({ gold: Number(learner.gold), items: learner.items });
    setHeldLevel(learner.level);
    setSaved(false);
    setOpen(id);
  };
  // One beat each: numbers count up, then the ring ticks, then "Saved on NEAR ✓".
  const landed = () => {
    buzz();
    setHeld(null);
    timers.current.push(setTimeout(() => setHeldLevel(null), reduce ? 0 : 750));
    timers.current.push(setTimeout(() => setSaved(true), reduce ? 0 : 1450));
  };
  const close = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setHeld(null);
    setHeldLevel(null);
    setOpen(null);
  };

  const shopOpen = learner.level === 3 && heldLevel === null;
  const marker = STOPS[Math.min(level, 3)] ?? { x: 50, y: 0 };
  const door = STOPS[3] ?? { x: 50, y: 560 };

  return (
    <>
      <div className="flex flex-col gap-3">
        <PassportCard level={level} />
        <InventoryBar gold={held?.gold} items={held?.items} />
      </div>

      {completed.length === 0 && (
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">Three quests. One merchant. A Passport that's yours.</p>
      )}

      <div className="relative mt-6 h-[700px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 640" preserveAspectRatio="none" aria-hidden="true">
          <path d={PATH} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" className="stroke-lavender/30" style={{ strokeWidth: 10 }} />
          <path d={PATH} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="2 10" className="stroke-lavender/60" style={{ strokeWidth: 3 }} />
          <motion.path
            d={PATH}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            className="stroke-lime"
            style={{ strokeWidth: 4 }}
            initial={false}
            animate={{ pathLength: Math.max(0.001, level / 3) }}
            transition={reduce ? { duration: 0 } : { duration: 1, ease: labEase }}
          />
        </svg>

        {LESSON_CONTENT.map((l, i) => {
          const done = completed.includes(l.lesson_id);
          const available = !completed.includes(l.lesson_id) && i === completed.length;
          const pos = STOPS[i] ?? { x: 50, y: 0 };
          return (
            <div key={l.lesson_id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2" style={{ left: `${pos.x}%`, top: pos.y }}>
              <Press
                disabled={!available}
                onClick={() => openQuest(l.lesson_id)}
                aria-label={`${l.title} — ${done ? "done" : available ? "available" : "locked"}`}
                className={cn(
                  "relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] font-display text-2xl font-semibold transition-colors duration-500",
                  done && "bg-lime text-navy shadow-lift",
                  available && "bg-ivory text-navy shadow-lift",
                  !done && !available && "border-2 border-lavender/70 text-lavender",
                )}
              >
                {available && !reduce && (
                  <motion.span
                    className="absolute inset-0 rounded-[1.6rem] border-2 border-ivory"
                    animate={{ scale: [1, 1.22], opacity: [0.6, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                {done ? <Check className="h-8 w-8" strokeWidth={2.5} /> : available ? `0${i + 1}` : <Lock className="h-6 w-6" />}
                {done && (
                  <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-navy text-lime ring-2 ring-lime">
                    <ItemIcon id={l.reward_item} />
                  </span>
                )}
              </Press>
              <span className={cn("whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em]", done || available ? "text-ivory" : "text-lavender/80")}>{l.title}</span>
            </div>
          );
        })}

        {/* You are here */}
        <motion.div
          className="pointer-events-none absolute z-10 -translate-x-1/2"
          initial={false}
          animate={{ left: `${marker.x}%`, top: marker.y - 66 }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: labEase }}
          aria-label="You are here"
        >
          <motion.span
            className="block h-4 w-6 rounded-md bg-lime shadow-lift"
            animate={reduce ? { y: 0 } : { y: [0, -3, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Bloq's shop door */}
        <div className="absolute flex w-56 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center" style={{ left: `${door.x}%`, top: door.y + 20 }}>
          <ShopDoor open={shopOpen} />
          {shopOpen ? (
            <Link to="/shop" className="tap inline-flex items-center rounded-full bg-lime px-6 font-semibold text-navy shadow-lift active:scale-[0.98]">
              Enter Bloq's shop
            </Link>
          ) : (
            <p className="text-sm text-lavender">Finish the three quests to meet Bloq</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && <QuizSheet key={open} lessonId={open} onClose={close} onLanded={landed} saved={saved} />}
      </AnimatePresence>
    </>
  );
}

function ShopDoor({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-24 w-20 overflow-hidden rounded-t-[2.5rem] border-2 border-lavender/60 bg-navy" style={{ perspective: 400 }} aria-hidden="true">
      <div className="absolute inset-2 rounded-t-[2rem] bg-lime/90" />
      <motion.div
        className={cn("absolute inset-0 origin-left rounded-t-[2.5rem]", open ? "bg-navy-soft" : "bg-navy-soft")}
        initial={false}
        animate={{ rotateY: open ? -78 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 1.1, ease: labEase, delay: 0.3 }}
      >
        <span className="absolute right-3 top-1/2 h-2 w-2 rounded-full bg-lavender" />
        {!open && <Lock className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-lavender" />}
      </motion.div>
    </div>
  );
}
