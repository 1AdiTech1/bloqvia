import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { ChainTrail, type ChainTrailHandle, type TrailStop } from "@/bloq";
import { useFinalBlock } from "@/near";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { GameHeader, PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { QuizSheet } from "@/components/QuizSheet";
import { ItemIcon } from "@/components/GameBits";
import { InventoryBar } from "@/components/lab/InventoryBar";
import { StreakCard } from "@/components/lab/StreakCard";
import { DailyQuestCard } from "@/components/lab/DailyQuestCard";
import { buzz } from "@/components/lab/motion";

const KINDS = ["vault", "battery", "contract"] as const;
const POSTS = ["keys · ed25519", "gas · the relayer pays", "core.bloqvia.testnet"] as const;
const TRAIL_STOPS = [0, 1, 2].map((i) => {
  const l = LESSON_CONTENT[i];
  return { id: l?.lesson_id ?? String(i), title: l?.title ?? "", kind: KINDS[i]!, post: POSTS[i]!, reward: l ? <ItemIcon id={l.reward_item} /> : undefined };
}) as unknown as readonly [TrailStop, TrailStop, TrailStop];

export function MapPage() {
  return (
    <RequireAccount>
      <MapInner />
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
  const trail = useRef<ChainTrailHandle>(null);
  const height = useFinalBlock();

  const learner = game.learner!;
  const completed = learner.completed;
  const foundingDone = completed.filter((id) => !id.startsWith("daily-"));
  const level = heldLevel ?? learner.level;
  const [trailLevel, setTrailLevel] = useState(foundingDone.length); // what the trail shows
  const doneCount = useRef(foundingDone.length);
  doneCount.current = foundingDone.length;

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
    timers.current.push(setTimeout(() => setTrailLevel(doneCount.current), reduce ? 0 : 450));
  };

  const shopOpen = trailLevel >= 3;

  return (
    <PhoneShell nav inlineHeader>
      {/* Phones: header, inventory, cards, heading, trail. Desktop: heading, inventory + pill, trail, cards (2 cols). */}
      <div className="flex flex-col dk:grid dk:grid-cols-[minmax(0,1fr)_auto] dk:items-center dk:gap-x-4">
      <GameHeader level={level} className="order-1 dk:order-2 dk:col-start-2 dk:mb-0" />
      <div className="order-2 dk:order-2 dk:col-start-1 dk:row-start-2">
        <InventoryBar gold={held?.gold} items={held?.items} />
      </div>
      <div className="order-3 mt-3 flex flex-col gap-3 dk:order-4 dk:col-span-2 dk:mt-6 dk:grid dk:grid-cols-2 dk:items-stretch dk:gap-4">
        <StreakCard />
        <DailyQuestCard onPlay={openQuest} />
      </div>

      <div className="order-4 dk:order-1 dk:col-span-2 dk:mb-5">
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime dk:mt-0">Your journey</p>
        <h2 className="mt-2 font-display text-2xl font-medium leading-tight tracking-[-0.03em] dk:text-[2rem]">Three quests. One merchant. A Passport that's yours.</h2>
      </div>

      <div className="order-5 dk:order-3 dk:col-span-2">
      <ChainTrail
        ref={trail}
        className="mt-4 dk:mt-6"
        level={trailLevel}
        blockHeight={height}
        onPlay={(i) => { const l = LESSON_CONTENT[i]; if (l) openQuest(l.lesson_id); }}
        doorAccount="bloq.bloqvia.testnet"
        stops={TRAIL_STOPS}
        door={
          <>
            <p className="text-sm text-lavender">{shopOpen ? "Bloq's shop is open to you." : "Finish the three quests to meet Bloq the merchant"}</p>
            {shopOpen && (
              <Link to="/shop" className="tap inline-flex items-center rounded-full bg-lime px-6 font-semibold text-navy shadow-lift active:scale-[0.98]">
                Enter Bloq's shop
              </Link>
            )}
          </>
        }
      />
      </div>
      </div>

      <AnimatePresence>
        {open && <QuizSheet key={open} lessonId={open} onClose={close} onLanded={landed} saved={saved} />}
      </AnimatePresence>
    </PhoneShell>
  );
}
