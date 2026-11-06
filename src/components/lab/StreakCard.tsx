import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Info, X } from "lucide-react";
import { useStreak } from "@/near";
import { LabLoader } from "@/components/LabLoader";
import { AnimatedNumber, Press, buzz, labEase } from "@/components/lab/motion";
import { cn } from "@/lib/utils";

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function StreakCard() {
  if (import.meta.env.VITE_GAME_MODE === "mock") return null;
  return <StreakInner />;
}

function StreakInner() {
  const s = useStreak();
  const reduce = useReducedMotion();
  const [left, setLeft] = useState<number | null>(null);
  const [info, setInfo] = useState(false);
  const [log, setLog] = useState(false);
  const logBtn = useRef<HTMLButtonElement>(null);
  const logPanel = useRef<HTMLDivElement>(null);
  const [logUp, setLogUp] = useState(false);
  useLayoutEffect(() => {
    if (!log) { setLogUp(false); return; }
    const place = () => {
      const panel = logPanel.current;
      const card = panel?.offsetParent as HTMLElement | null;
      if (!panel || !card) return;
      // Where the panel's bottom would sit if it hung below the card (top: 100% - 12px).
      const bottomIfDown = card.getBoundingClientRect().bottom - 12 + panel.getBoundingClientRect().height;
      setLogUp(bottomIfDown > window.innerHeight - 16);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [log]);
  useEffect(() => {
    if (!log) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (logPanel.current?.contains(t) || logBtn.current?.contains(t)) return;
      setLog(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setLog(false); logBtn.current?.focus(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [log]);
  const refreshed = useRef(false);
  const { streak, member } = s;

  // Count the chain's seconds_left_in_day down locally; refresh when the day rolls.
  useEffect(() => {
    if (!streak) return;
    setLeft(streak.seconds_left_in_day);
    refreshed.current = false;
  }, [streak?.day, streak?.seconds_left_in_day]);
  useEffect(() => {
    const id = setInterval(() => {
      setLeft((v) => {
        if (v === null) return v;
        const n = Math.max(0, v - 1);
        if (n === 0 && !refreshed.current) {
          refreshed.current = true;
          void s.refresh();
        }
        return n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [s.refresh]);

  if (!s.enabled || !streak) return null;

  const p = streak.params;
  const pct = streak.today_target > 0 ? Math.min(1, streak.today_count / streak.today_target) : 0;
  const done = !!member?.checked_in_today;
  const history = [...streak.history].sort((a, b) => b.day - a.day).slice(0, 7);

  const onCheckIn = async () => {
    try {
      await s.checkIn();
      buzz();
    } catch {
      /* error shown below */
    }
  };

  return (
    <section className="relative h-full rounded-[1.6rem] bg-ivory p-5 text-navy shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy/60">Community streak</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold leading-none tracking-tight">
              <AnimatedNumber value={streak.streak} className="px-0" />
            </span>
            <span className="font-display text-lg font-medium">days</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full bg-lavender/50 px-2.5 py-1 text-xs font-medium">best {streak.best_streak}</span>
          <button
            type="button"
            onClick={() => setInfo((v) => !v)}
            aria-expanded={info}
            aria-label="How the streak works"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-navy/5"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {info && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: labEase }}
            className="mt-3 overflow-hidden rounded-xl bg-lavender/25 p-3 text-sm leading-relaxed"
          >
            Each day the community needs {p.daily_target} check-ins. A day that makes it mints {p.reward_per_checkin} STREAK to everyone who checked
            in; a day that misses burns {p.burn_per_miss} from the treasury and resets the streak. The rule lives in the contract; nobody can change
            it. On testnet a Bloqvia day is {Math.round((p.day_length_seconds / 60) * 10) / 10} minutes so you can watch it happen.
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
          <motion.div
            className="h-full rounded-full bg-lime"
            initial={false}
            animate={{ width: `${pct * 100}%` }}
            transition={{ duration: reduce ? 0 : 0.7, ease: labEase }}
          />
        </div>
        <p className="mt-2 text-sm">
          <AnimatedNumber value={streak.today_count} className="px-0.5 font-semibold" /> of {streak.today_target} check-ins today
        </p>
        <p className="text-xs tabular-nums text-navy/60">next day in {fmt(left ?? streak.seconds_left_in_day)}</p>
      </div>

      <div className="mt-4">
        {s.busy ? (
          <div className="flex min-h-11 items-center justify-center gap-3 rounded-full bg-navy/5 px-4 [&>div]:flex-row [&>div]:py-0">
            <LabLoader tone="navy" size={24} label="Saving your check-in…" />
          </div>
        ) : done ? (
          <div className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-lime bg-lime/20 font-display font-semibold" aria-disabled="true">
            <Check className="h-5 w-5" strokeWidth={2.5} /> Checked in today ✓
          </div>
        ) : (
          <Press
            onClick={onCheckIn}
            disabled={!member}
            className="min-h-11 w-full rounded-full bg-lime font-display font-semibold text-navy shadow-lift disabled:opacity-50"
          >
            Check in
          </Press>
        )}
        {s.error && (
          <div className="mt-2 flex items-start gap-2 text-sm text-coral">
            <p className="min-w-0 flex-1 break-words font-medium">{s.error}</p>
            <button type="button" onClick={s.clearError} aria-label="Dismiss" className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {(member || (s.lastTx && !s.busy)) && (
        <p className="mt-4 flex items-baseline justify-between gap-3 text-sm">
          {member ? (
            <span className="min-w-0">
              You hold <span className="font-semibold">{member.balance}</span> STREAK · {member.total_checkins} {member.total_checkins === 1 ? "check-in" : "check-ins"}
            </span>
          ) : <span />}
          {s.lastTx && !s.busy && (
            <a href={s.lastTx.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-semibold text-navy no-underline outline-none hover:text-[#6f8f0f] focus-visible:text-[#6f8f0f]">
              explorer ↗
            </a>
          )}
        </p>
      )}

      <div className="mt-3 border-t border-navy/10 pt-1">
        <button
          ref={logBtn}
          type="button"
          onClick={() => setLog((v) => !v)}
          aria-expanded={log}
          aria-controls="streak-last-days"
          className="flex min-h-11 w-full items-center justify-between text-sm font-medium"
        >
          Last days
          <ChevronDown className={cn("h-4 w-4 transition-transform", log && "rotate-180")} />
        </button>
      </div>
      {log && (
        <div
          ref={logPanel}
          id="streak-last-days"
          className={cn("bq-pop absolute left-[10px] right-[10px] z-30 rounded-[18px] bg-card py-3 pr-2 text-navy shadow-[0_22px_50px_rgb(0_0_0/.35),0_0_0_1px_#e3dccb]", logUp ? "bq-pop-up top-auto bottom-[56px]" : "top-[calc(100%-12px)]")}
        >
          {history.length === 0 ? (
            <p className="px-4 text-sm text-navy/60">No days recorded yet.</p>
          ) : (
            <ul className="bq-scroll max-h-[236px] space-y-1.5 overflow-y-auto pl-4 pr-2 text-sm">
              {history.map((d) => (
                <li key={d.day} className="flex items-center justify-between gap-3 whitespace-nowrap">
                  <span className="min-w-0 truncate"><span className="font-semibold">Day {d.day}</span> · {d.checkins} {d.checkins === 1 ? "check-in" : "check-ins"}</span>
                  {d.met ? <span className="shrink-0 font-semibold text-[#6f8f0f]">kept · +{d.minted}</span> : <span className="shrink-0 font-semibold text-coral">missed · −{d.burned}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 px-4 font-mono text-[11px] text-navy/55">Treasury {streak.treasury} · supply {streak.total_supply}</p>
        </div>
      )}
    </section>
  );
}
