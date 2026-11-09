import { useEffect, useRef } from "react";
import { ExternalLink, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { ItemIcon } from "@/components/GameBits";
import { Web3Passport } from "@/components/lab/Web3Passport";
import { Bloq, SpeechBubble, talkMs, useSay, type BloqHandle, useMotionOff } from "@/bloq";
import { cn } from "@/lib/utils";
import { SEASON2_CHAPTERS, season2Done } from "@/near";

export function PassportPage() {
  return (
    <RequireAccount>
      <PhoneShell nav>
        <PassportInner />
      </PhoneShell>
    </RequireAccount>
  );
}

const STAMP_TILT = [-6, 4, -3];

function restLine(level: number, graduated: boolean): string {
  if (graduated) return "Sealed for good. This one can't be bought, sold or moved.";
  if (level <= 0) return "Empty for now. Your first quest adds a stamp.";
  if (level >= 3) return "Level 3! Now graduate in the shop.";
  const left = 3 - level;
  return `Level ${level}! ${left} more to go.`;
}

function PassportInner() {
  const game = useGame();
  const reduce = useMotionOff();
  const p = game.passport;
  const completed = game.learner?.completed ?? [];
  const bloq = useRef<BloqHandle>(null);
  const rest = restLine(p?.level ?? 0, p?.graduated ?? false);
  const [line, sayLine] = useSay();
  const shown = line || rest;
  const say = (t: string) => { sayLine(t); bloq.current?.talk(talkMs(t)); };

  useEffect(() => {
    const t = setTimeout(() => bloq.current?.talk(talkMs(rest)), 500);
    return () => clearTimeout(t);
  }, [rest]);

  const tapCard = () => {
    bloq.current?.jump();
    say("It's an NFT that only levels up. The contract refuses transfers.");
  };

  if (!p || !game.accountId) return null;
  const stamped = season2Done(p);
  const chaptersDone = SEASON2_CHAPTERS.filter((id) => completed.includes(id)).length;

  return (
    <div className="flex flex-col">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">Your credential</p>
      <div className="dk:mt-4 dk:grid dk:grid-cols-2 dk:items-start dk:gap-8">
      <motion.div className="mt-4 dk:mt-0" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <Web3Passport holder={p.owner_id} level={p.level} graduated={p.graduated} stamps={p.stamps} onClick={tapCard} />
      </motion.div>

      <div className="flex flex-col">
      <div className="mt-8 grid grid-cols-3 gap-2.5 dk:mt-0">
        {LESSON_CONTENT.map((l, i) => {
          const done = completed.includes(l.lesson_id);
          return (
            <div key={l.lesson_id} className={cn("flex flex-col items-center gap-2 text-center font-display text-[10.5px] font-semibold uppercase leading-tight tracking-[0.1em]", done ? "text-ivory" : "text-lavender")}>
              {done ? (
                <motion.span
                  initial={reduce ? false : { scale: 1.6, opacity: 0, rotate: (STAMP_TILT[i] ?? 0) - 20 }}
                  animate={{ scale: 1, opacity: 1, rotate: STAMP_TILT[i] ?? 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.2 + i * 0.12 }}
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-lime text-navy"
                  style={{ boxShadow: "inset 0 0 0 4px rgb(22 36 58 / .12), 0 0 0 3px rgb(212 240 51 / .25)" }}
                >
                  <ItemIcon id={l.reward_item} className="h-7 w-7" />
                </motion.span>
              ) : (
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed border-lavender/40 text-lavender/60">
                  <Lock className="h-5 w-5" />
                </span>
              )}
              {l.title}
            </div>
          );
        })}
      </div>

      <div className="passport-seasons">
        <div><span className={`season-dot${p.graduated || p.level >= 3 ? " done" : ""}`}>{p.graduated || p.level >= 3 ? "✓" : "·"}</span><b>Season 1 · First steps</b><small>{p.graduated ? "graduated" : `${p.level} of 3 quests`}</small></div>
        <div><span className={`season-dot${stamped ? " done" : ""}`}>{stamped ? "✓" : "·"}</span><b>Season 2 · Going further</b><small>{stamped ? <a href={game.explorer.passport(game.accountId)} target="_blank" rel="noopener noreferrer">stamped · explorer ↗</a> : p.level < 3 ? "opens after Season 1" : `${chaptersDone} of 3 chapters`}</small></div>
      </div>

      <div className="mt-8 flex items-end gap-3">
        <button type="button" onClick={tapCard} aria-label="Bloq" className="w-[120px] shrink-0">
          <Bloq ref={bloq} hat={p.graduated ? "grad" : "aviator"} prop={p.graduated ? "badge" : "passport"} pose="hold" label={p.graduated ? "Bloq in a graduation cap" : "Bloq the aviator"} />
        </button>
        <div className="mt-3 min-w-0 self-start">
          <SpeechBubble side="right" tone="light" text={shown} />
        </div>
      </div>

      <a href={game.explorer.passport(game.accountId)} target="_blank" rel="noreferrer" className="tap mt-4 inline-flex items-center gap-1.5 self-center font-semibold text-lime underline-offset-4 hover:underline">
        View on the explorer <ExternalLink className="h-4 w-4" />
      </a>
      </div>
      </div>
    </div>
  );
}
