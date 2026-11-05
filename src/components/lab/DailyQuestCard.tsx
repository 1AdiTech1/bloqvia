import { Check, ExternalLink } from "lucide-react";
import { useDailyQuests } from "@/near";
import { useGame, IS_MOCK } from "@/game/useGame";
import { RewardChip } from "@/components/GameBits";
import { Press } from "@/components/lab/motion";

export function formatQuestDate(date: string) {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Today's AI-written bonus quest. Never locked; hidden in mock mode or when the feed fails. */
export function DailyQuestCard({ onPlay }: { onPlay: (lessonId: string) => void }) {
  if (IS_MOCK) return null;
  return <DailyQuestInner onPlay={onPlay} />;
}

function DailyQuestInner({ onPlay }: { onPlay: (lessonId: string) => void }) {
  const { quests, loading, error } = useDailyQuests();
  const game = useGame();
  if (error) return null;
  if (loading) {
    return <div className="h-14 animate-pulse rounded-[1.6rem] border border-lavender/30 bg-navy motion-reduce:animate-none" aria-label="Loading today's quest" />;
  }
  const q = quests[0];
  if (!q) return null;

  const date = q.lesson_id.slice(6);
  const isToday = date === new Date().toISOString().slice(0, 10);
  const done = game.learner?.completed.includes(q.lesson_id) ?? false;
  const tee = q.generated_by.signature?.signature_kind === "provider_tee";

  return (
    <section className="rounded-[1.6rem] border border-lavender/30 bg-navy p-5 text-ivory shadow-lift">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">
          {isToday ? "Today's quest" : `Latest quest · ${formatQuestDate(date)}`}
        </p>
        <span className="truncate rounded-full bg-lavender/20 px-2.5 py-1 text-[11px] font-medium text-lavender">{q.topic}</span>
      </div>
      <h3 className="mt-2 font-display text-2xl font-medium uppercase leading-none tracking-[-0.03em]">{q.title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <RewardChip id="gold" amount={q.reward_gold} />
        <RewardChip id={q.reward_item} amount={q.reward_item_amount} />
      </div>
      <div className="mt-4">
        {done ? (
          <p className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-lime">
            <Check className="h-5 w-5" strokeWidth={2.5} /> Done — a new one arrives tomorrow
          </p>
        ) : (
          <Press onClick={() => onPlay(q.lesson_id)} className="min-h-[44px] w-full rounded-full bg-lime py-3 text-base font-semibold text-navy">
            Play
          </Press>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-lavender">
        Written by an AI agent on NEAR AI Cloud{tee && " · signed in a TEE"}{" · "}
        <a href="https://cloud.near.ai/verify" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-lime underline-offset-4 hover:underline">
          Verify <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </p>
    </section>
  );
}
