import { Check } from "lucide-react";
import { explorer, useSponsoredQuest } from "@/near";
import { IS_MOCK, useGame } from "@/game/useGame";
import { RewardChip } from "@/components/GameBits";
import { Press } from "@/components/lab/motion";

export function SponsoredQuestCard({ onPlay, highlight = false }: { onPlay: (lessonId: string) => void; highlight?: boolean }) {
  if (IS_MOCK) return null;
  return <SponsoredQuestInner onPlay={onPlay} highlight={highlight} />;
}

function SponsoredQuestInner({ onPlay, highlight }: { onPlay: (lessonId: string) => void; highlight: boolean }) {
  const game = useGame();
  const { quest, done, loading, error } = useSponsoredQuest(game.learner?.completed ?? []);
  if (loading || error || !quest) return null;

  return (
    <section className={`relative overflow-hidden rounded-[1.6rem] border border-ivory/10 bg-navy-soft p-5 text-ivory shadow-lift${highlight ? " ring-2 ring-lime shadow-[0_0_26px_rgb(212_240_51/.22)]" : " ring-1 ring-purple/45 shadow-[0_0_28px_rgb(180_127_240/.35),0_18px_40px_rgb(0_0_0/.35)]"}`}>
      <i aria-hidden="true" className="pointer-events-none absolute inset-[-40%_-60%] animate-[bq-sheen_7s_ease-in-out_infinite_alternate] motion-reduce:animate-none" style={{ background: "linear-gradient(115deg, transparent 42%, rgb(255 255 255 / .10) 50%, transparent 58%)" }} />
      <style>{"@keyframes bq-sheen { from { transform: translateX(-12%); } to { transform: translateX(12%); } }"}</style>
      <div className="relative grid grid-cols-1 dk:grid-cols-[minmax(0,1fr)_250px] dk:gap-x-5 dk:items-start">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-purple shadow-[0_0_8px_rgb(180_127_240/.9)]" />
              Sponsored quest
            </p>
            <span className="truncate rounded-full bg-lavender/20 px-2.5 py-1 text-[11px] font-medium text-lavender">{quest.topic}</span>
          </div>
          <h3 className="mt-2 font-display text-2xl font-medium uppercase leading-none tracking-[-0.03em]">{quest.title}</h3>
          <p className="mt-2 line-clamp-2 text-[14px] leading-snug text-ivory/80">{quest.concept}</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <RewardChip id="gold" amount={quest.reward_gold} className="px-3 text-[13px]" />
            <RewardChip id={quest.reward_item} amount={quest.reward_item_amount} className="px-3 text-[13px]" />
          </div>
          <div className="mt-[18px]">
            {done ? (
              <p className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-lime"><Check className="h-5 w-5" strokeWidth={2.5} /> Done — thanks for playing</p>
            ) : (
              <Press onClick={() => onPlay(quest.lesson_id)} className={`min-h-[44px] w-full dk:w-[200px] rounded-full bg-lime py-3 text-base font-semibold text-navy${highlight ? " animate-[bq-pulse_1.8s_ease-in-out_infinite] motion-reduce:animate-none" : ""}`}>Play</Press>
            )}
          </div>
        </div>
        <div className="mt-4 min-w-0 dk:mt-0">
          <div className="rounded-xl bg-navy/80 px-3 py-2 text-[11.5px]">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-md bg-gradient-to-br from-purple to-purple-d" />
              <span>Brought to you by <b>{quest.sponsor.url ? <a href={quest.sponsor.url} target="_blank" rel="noopener noreferrer">{quest.sponsor.name}</a> : quest.sponsor.name}</b></span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-lavender">
              {quest.sponsor.house ? `nobody bought today's slot, so Bloqvia's own purse did: ${quest.slot.price}` : `paid ${quest.slot.price} for today's slot`}{" · x402 · "}
              {quest.slot.tx_hash ? <a href={explorer.tx(quest.slot.tx_hash)} target="_blank" rel="noopener noreferrer">explorer ↗</a> : "explorer ↗"}
            </p>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-lavender">
            {quest.sponsor.house ? "Written by Bloqvia · " : "Written by the sponsor · "}checked by Bloqvia's validator · answer hashed on chain · <span className="font-semibold text-lime">the reward is the contract's, not the sponsor's</span>
          </p>
        </div>
      </div>
    </section>
  );
}