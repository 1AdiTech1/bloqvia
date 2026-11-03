import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { RewardChip } from "./GameBits";
import { VineLoader } from "./VineLoader";
import { cn } from "@/lib/utils";

const CONFETTI = Array.from({ length: 18 }, (_, i) => i);
const CONFETTI_COLORS = ["bg-sun", "bg-leaf", "bg-sage", "bg-terracotta"];

export function QuizSheet({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const game = useGame();
  const lesson = LESSON_CONTENT.find((l) => l.lesson_id === lessonId)!;
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const choose = async (opt: string) => {
    if (game.busy) return;
    setPicked(opt);
    try {
      await game.completeLesson(lesson.lesson_id, opt);
      setDone(true);
    } catch {
      setWrong((w) => [...w, opt]);
    } finally {
      setPicked(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[45] flex items-end justify-center bg-foreground/30 backdrop-blur-sm animate-in fade-in" role="dialog" aria-modal="true" aria-label={lesson.title}>
      <div className="relative max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[2rem] bg-background px-5 pb-8 pt-4 shadow-lift animate-in slide-in-from-bottom-8">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <button onClick={onClose} aria-label="Close" className="tap absolute right-3 top-3 flex items-center justify-center rounded-full text-muted-foreground">
          <X className="h-5 w-5" />
        </button>

        {!done ? (
          <>
            <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wider text-moss">{lesson.topic}</span>
            <h2 className="mt-3 text-2xl font-bold text-moss">{lesson.title}</h2>
            <p className="mt-3 rounded-2xl bg-sun-soft/60 p-4 leading-relaxed">{lesson.concept}</p>
            <p className="mt-5 font-display text-lg font-semibold">{lesson.question}</p>
            <div className="mt-4 flex flex-col gap-3">
              {lesson.options.map((opt) => (
                <button
                  key={opt}
                  disabled={game.busy}
                  onClick={() => choose(opt)}
                  className={cn(
                    "tap rounded-2xl border-2 px-5 py-3 text-left font-semibold transition-colors",
                    wrong.includes(opt) ? "border-terracotta/60 bg-terracotta/10 text-terracotta" : "border-border bg-card hover:border-leaf",
                    picked === opt && "border-leaf bg-secondary",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            {game.busy && picked && <div className="mt-4"><VineLoader label="Checking your answer…" /></div>}
          </>
        ) : (
          <div className="relative text-center">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible" aria-hidden="true">
              {CONFETTI.map((i) => (
                <span
                  key={i}
                  className={cn("absolute top-0 h-3 w-2 rounded-full animate-confetti", CONFETTI_COLORS[i % 4])}
                  style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.08}s` }}
                />
              ))}
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-moss">Quest complete!</h2>
            <p className="mt-3 text-lg">{lesson.success}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <RewardChip id="gold" amount={lesson.reward_gold} />
              <RewardChip id={lesson.reward_item} amount={lesson.reward_item_amount} />
            </div>
            <div className="card-organic mt-6 p-5 text-left">
              <h3 className="font-bold text-moss">What just happened on NEAR</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{lesson.near_reveal}</p>
              {game.lastTx && (
                <a href={game.lastTx.url} target="_blank" rel="noreferrer" className="tap mt-2 inline-flex items-center gap-1.5 font-semibold text-moss underline-offset-4 hover:underline">
                  See it on the explorer <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <button onClick={onClose} className="tap mt-6 w-full rounded-full bg-moss py-3 text-lg font-semibold text-primary-foreground shadow-soft">
              Back to the map
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
