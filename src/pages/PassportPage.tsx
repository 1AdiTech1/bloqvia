import { ExternalLink, Lock, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { GoldSeal, ItemIcon, LevelRing } from "@/components/GameBits";
import { Wordmark } from "@/components/Logo";
import { labEase } from "@/components/lab/motion";
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
  const reduce = useReducedMotion();
  const p = game.passport!;
  const completed = game.learner?.completed ?? [];

  return (
    <div className="flex flex-col items-center">
      <p className="self-start text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">Your credential</p>
      <motion.article
        initial={reduce ? false : { opacity: 0, y: 16, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.7, ease: labEase }}
        className="relative mt-4 flex min-h-[560px] w-full flex-col overflow-hidden rounded-[2rem] border border-ivory/10 border-l-[6px] border-l-lime bg-navy-soft p-6 shadow-lift"
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lavender/10" aria-hidden="true" />
        <div className="relative flex items-center justify-between">
          <Wordmark tone="lime" size={24} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lavender/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-lavender">
            <ShieldCheck className="h-3.5 w-3.5" /> Non-transferable
          </span>
        </div>

        <div className="relative mt-10 flex flex-col items-center text-center">
          <LevelRing level={p.level} graduated={p.graduated} size={168} tone="navy" />
          <h1 className="mt-5 font-display text-4xl font-medium uppercase tracking-[-0.04em] text-ivory">{p.graduated ? "Graduate" : `Level ${p.level}`}</h1>
          <p className="mt-2 break-all font-mono text-xs text-lavender">{p.owner_id}</p>
        </div>

        <div className="relative mt-auto grid grid-cols-3 gap-3 pt-8">
          {LESSON_CONTENT.map((l, i) => {
            const done = completed.includes(l.lesson_id);
            return (
              <div key={l.lesson_id} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed border-lavender/40">
                  {done ? (
                    <motion.span
                      initial={reduce ? false : { scale: 0.4, opacity: 0, rotate: 0 }}
                      animate={{ scale: 1, opacity: 1, rotate: i % 2 ? 2 : -2 }}
                      transition={{ duration: 0.5, delay: 0.3 + i * 0.15, ease: labEase }}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-lime text-navy"
                    >
                      <ItemIcon id={l.reward_item} className="h-7 w-7" />
                    </motion.span>
                  ) : (
                    <Lock className="h-5 w-5 text-lavender/60" />
                  )}
                </span>
                <span className={cn("text-[11px] font-semibold uppercase tracking-[0.1em]", done ? "text-ivory" : "text-lavender/70")}>{l.title}</span>
              </div>
            );
          })}
        </div>

        {p.graduated && (
          <motion.div
            className="absolute right-5 top-24"
            initial={reduce ? false : { scale: 1.8, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            transition={{ duration: 0.7, delay: 0.5, ease: labEase }}
          >
            <GoldSeal size={76} />
          </motion.div>
        )}
      </motion.article>

      <a href={game.explorer.passport(game.accountId!)} target="_blank" rel="noreferrer" className="tap mt-6 inline-flex items-center gap-1.5 font-semibold text-lime underline-offset-4 hover:underline">
        View on the explorer <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
