import { Check, ExternalLink } from "lucide-react";
import { useDailyQuests } from "@/near";
import { useGame, IS_MOCK } from "@/game/useGame";
import { RewardChip } from "@/components/GameBits";
import { Press } from "@/components/lab/motion";
import { verifyUrl } from "@/components/lab/useDesktop";

export function formatQuestDate(date: string) {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Today's AI-written bonus quest. Never locked; hidden in mock mode or when the feed fails. */
export function DailyQuestCard({ onPlay, highlight = false }: { onPlay: (lessonId: string) => void; highlight?: boolean }) {
  if (IS_MOCK) return null;
  return <DailyQuestInner onPlay={onPlay} highlight={highlight} />;
}

function DailyQuestInner({ onPlay, highlight }: { onPlay: (lessonId: string) => void; highlight: boolean }) {
  const { quests, loading, error } = useDailyQuests();
  const game = useGame();
  if (error) return null;
  if (loading) {
    return <div className="h-14 animate-pulse rounded-[1.6rem] border border-ivory/10 bg-navy-soft motion-reduce:animate-none" aria-label="Loading today's quest" />;
  }
  const q = quests[0];
  if (!q) return null;

  const date = q.lesson_id.slice(6);
  const isToday = date === new Date().toISOString().slice(0, 10);
  const done = game.learner?.completed.includes(q.lesson_id) ?? false;
  const tee = q.generated_by.signature?.signature_kind === "provider_tee";

  return (
    <section className={`flex h-full flex-col rounded-[1.6rem] border border-ivory/10 bg-navy-soft p-5 text-ivory shadow-lift${highlight ? " ring-2 ring-lime shadow-[0_0_26px_rgb(212_240_51/.22)]" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-lime" />
          {isToday ? "Today's quest" : `Latest quest · ${formatQuestDate(date)}`}
        </p>
        <span className="truncate rounded-full bg-lavender/20 px-2.5 py-1 text-[11px] font-medium text-lavender">{q.topic}</span>
      </div>
      <h3 className="mt-2 font-display text-2xl font-medium uppercase leading-none tracking-[-0.03em]">{q.title}</h3>
      {q.concept && <p className="mt-2 line-clamp-2 text-[14px] leading-snug text-ivory/80">{q.concept}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <RewardChip id="gold" amount={q.reward_gold} />
        <RewardChip id={q.reward_item} amount={q.reward_item_amount} />
      </div>
      <div className="mt-auto pt-4">
        {done ? (
          <p className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-lime">
            <Check className="h-5 w-5" strokeWidth={2.5} /> Done — a new one arrives tomorrow
          </p>
        ) : (
          <Press onClick={() => onPlay(q.lesson_id)} className={`min-h-[44px] w-full rounded-full bg-lime py-3 text-base font-semibold text-navy${highlight ? " animate-[bq-pulse_1.8s_ease-in-out_infinite] motion-reduce:animate-none" : ""}`}>
            Play
          </Press>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-lavender">
        Written by an AI agent on NEAR AI Cloud{tee && " · signed in a TEE"}{" · "}
        <a href={verifyUrl(q.generated_by.model)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-lime underline-offset-4 hover:underline">
          Verify <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </p>
    </section>
  );
}
