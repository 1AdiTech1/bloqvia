import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Check, ExternalLink, RotateCcw, X } from "lucide-react";
import { useGame } from "@/game/useGame";
import { Bloq, SpeechBubble, useSay, talkMs, type BloqHandle, type BloqHat, type BloqProp, type BloqPose, useMotionOff } from "@/bloq";
import { useChapters, SEASON2_CHAPTERS, useDailyQuests, type GeneratedBy } from "@/near";
import { formatQuestDate } from "./lab/DailyQuestCard";
import { LESSON_CONTENT, type LessonContent } from "@/game/content";
import { RewardChip, ItemIcon } from "./GameBits";
import { LabLoader } from "./LabLoader";
import { Press, labEase } from "./lab/motion";
import { cn } from "@/lib/utils";
import { useIsDesktop, verifyUrl } from "./lab/useDesktop";
import { AskBloqButton, AskBloqSheet } from "./lab/AskBloqSheet";
import { SheetGrab, useSheetDrag } from "./lab/SheetGrab";

type SheetLesson = Omit<LessonContent, "answer"> & { answer?: string; explanation?: string; generated_by?: GeneratedBy };

type Flight = { id: string; from: DOMRect; to: DOMRect };

const LOOKS: Record<string, { hat: BloqHat; prop: BloqProp; hello: string }> = {
  "the-vault": { hat: "captain", prop: "key", hello: "Chapter one: keys. Read the idea, then pick one." },
  "the-fuel-system": { hat: "hardhat", prop: "fuel", hello: "Hard hat on. This one's about gas, the fuel of the network." },
  "smart-agreements": { hat: "beret", prop: "scroll", hello: "Last one: smart contracts. The rules are printed on the machine." },
  "chapter-ownership": { hat: "aviator", prop: "passport", hello: "Chapter four: owning things on chain. Your Passport is the example." },
  "chapter-transactions": { hat: "agent", prop: "key", hello: "Chapter five: transactions. Who signs, who pays, and why nobody can change it." },
  "chapter-defi": { hat: "tophat", prop: "coin", hello: "Last one: DeFi. My shop is a tiny market run by code." },
};
const DAILY_LOOK = { hat: "bucket" as BloqHat, prop: "bulb" as BloqProp, hello: "Today's quest was written by an AI agent. The chain still checks your answer." };
const CUBE_COLORS = ["#d4f033", "#b47ff0", "#ffffff"];

/**
 * Quiz bottom sheet. On success the reward chips fly to the inventory bar,
 * then `onLanded` lets the map release the held numbers; `saved` arrives last.
 */
export function QuizSheet({ lessonId, onClose, onLanded, saved, onBag }: { lessonId: string; onClose: () => void; onLanded: () => void; saved: boolean; onBag?: (show: boolean, card?: DOMRect) => void }) {
  const game = useGame();
  const reduce = useMotionOff();
  const desktop = useIsDesktop();
  const daily = useDailyQuests().quests.find((q) => q.lesson_id === lessonId);
  const chapter = useChapters().chapters.find((c) => c.lesson_id === lessonId);
  const index = LESSON_CONTENT.findIndex((l) => l.lesson_id === lessonId);
  const founding = LESSON_CONTENT[index];
  const lesson: SheetLesson | undefined = daily ?? chapter ?? founding;
  useEffect(() => {
    if (!lesson) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [shake, setShake] = useState(0);
  const [done, setDone] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const firstOption = useRef<HTMLButtonElement>(null);
  const [asking, setAsking] = useState(false);
  const bloq = useRef<BloqHandle>(null);
  const bloqBox = useRef<HTMLDivElement>(null);
  const [line, sayLine] = useSay();
  const [pose, setPose] = useState<BloqPose>("hold");
  const shakeCtl = useAnimationControls();
  const [burst, setBurst] = useState(0);
  const look = daily ? DAILY_LOOK : LOOKS[lessonId] ?? DAILY_LOOK;
  const sheet = useSheetDrag(onClose, !desktop);
  const sheetPanel = sheet.ref;
  const say = (t: string) => { sayLine(t); bloq.current?.talk(talkMs(t)); };

  useEffect(() => {
    const t = setTimeout(() => { bloq.current?.jump(); say(look.hello); }, 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checking = game.busy && !!picked;
  useEffect(() => {
    if (checking) { bloq.current?.setMood("o"); bloq.current?.look(0, -0.8); }
  }, [checking]);

  const choose = async (opt: string) => {
    if (game.busy || !lesson) return;
    setPicked(opt);
    try {
      await game.completeLesson(lesson.lesson_id, opt);
      setDone(true);
      setPose("cheer");
      bloq.current?.jump();
      bloq.current?.setMood("laugh", 2200);
      if (!reduce) setBurst((b) => b + 1);
      say("Yes! The contract checked it. Here come your rewards!");
    } catch {
      setWrong((w) => (w.includes(opt) ? w : [...w, opt]));
      setShake((s) => s + 1);
      bloq.current?.look(0, 0);
      bloq.current?.setMood("o", 1400);
      if (!reduce) void shakeCtl.start({ x: [0, -7, 6, -4, 2, 0], transition: { duration: 0.5, ease: "easeOut" } });
      say("Oops, the contract said no. Read the hint below.");
    } finally {
      setPicked(null);
    }
  };

  // Rewards land (prompt 27): the screen stays where the player is. If the inventory bar is in view above the sheet,
  // the chips fly into it; otherwise the bag (the map's copy of the bar, [data-bag]) slides down from the top,
  // the chips fly into it, and it slides away.
  useEffect(() => {
    if (!done || !lesson) return;
    const ids = ["gold", lesson.reward_item];
    const onPage = (id: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-inv="${id}"]`)).find((el) => !el.closest("[data-bag]"));
    const bar = onPage("gold")?.getBoundingClientRect();
    const sheetTop = sheetPanel.current?.getBoundingClientRect().top ?? window.innerHeight;
    const inView = !!bar && bar.top >= 0 && bar.bottom <= Math.min(window.innerHeight, sheetTop);
    const bag = !inView && !!onBag;
    if (bag) onBag?.(true, sheetPanel.current?.getBoundingClientRect()); // the card's edges, for desktop (prompt 27c)
    const target = (id: string) => (bag ? document.querySelector<HTMLElement>(`[data-bag] [data-inv="${id}"]`) : onPage(id));
    const t1 = setTimeout(() => {
      const fl = ids
        .map((id) => {
          const r = bloqBox.current?.getBoundingClientRect();
          const from = r ? new DOMRect(r.left + r.width * 0.45 - 18, r.top + r.height * 0.35 - 18, 36, 36) : document.querySelector(`[data-chip="${id}"]`)?.getBoundingClientRect();
          const to = target(id)?.getBoundingClientRect();
          return from && to ? { id, from, to } : null;
        })
        .filter((f): f is Flight => !!f);
      if (!reduce) setFlights(fl);
    }, reduce ? 0 : bag ? 420 : 350); // with the bag: once it has slid down (0.4 s)
    const t2 = setTimeout(() => { setFlights([]); onLanded(); setPose("thumbs"); }, reduce ? 50 : bag ? 1220 : 1100);
    const t3 = bag ? setTimeout(() => onBag?.(false), reduce ? 2000 : 3100) : undefined;
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); if (bag) onBag?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (!lesson) return null;
  const gen = daily?.generated_by;
  const lastWrong = wrong.length > 0 && !done;

  return (
    <motion.div className="fixed inset-0 z-[45] flex items-end justify-center dk:items-center dk:pb-6 dk:pt-[110px] dk:pl-[calc(max(0px,(100vw-1440px)/2)+220px)] dk:pr-[calc(max(0px,(100vw-1440px)/2)+330px)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={lesson.title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-navy/50" />
      <motion.div
        initial={reduce ? { opacity: 0 } : desktop ? { scale: 0.96, opacity: 0 } : { y: 80, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : desktop ? { scale: 0.96, opacity: 0 } : { y: 80, opacity: 0 }}
        transition={desktop ? { duration: 0.22, ease: labEase } : { duration: 0.5, ease: labEase }}
        className="relative w-full max-w-[480px] dk:max-w-[560px]"
        ref={sheet.ref}
        {...sheet.dragProps}
      >
      <motion.div
        ref={bloqBox}
        animate={shakeCtl}
        className="absolute z-10 w-[104px] cursor-pointer"
        style={{ right: 68, top: 0, y: "-74%" }}
        onClick={() => { bloq.current?.jump(); bloq.current?.setMood("laugh", 800); }}
      >
        <div className="relative">
          <Bloq ref={bloq} hat={look.hat} prop={look.prop} pose={pose} label="Bloq, your guide" />
          <SpeechBubble text={line} side="left" tone="light" />
          {burst > 0 && <CubeBurst key={burst} />}
        </div>
      </motion.div>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full text-navy/60 hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-navy">
        <X className="h-5 w-5" />
      </button>
      <AskBloqSheet open={asking && !done} onClose={() => setAsking(false)} lessonId={lesson.lesson_id} context="quiz" />
      <div className="flex max-h-[80vh] w-full flex-col rounded-t-[2rem] bg-ivory pb-[14px] pr-2 text-navy shadow-lift dk:max-h-[calc(100vh-136px)] dk:rounded-[28px] dk:pt-[14px]">
      <SheetGrab controls={sheet.controls} onClose={onClose} />
      <div className="bq-scroll min-h-0 flex-1 overflow-y-auto pb-3 pl-[30px] pr-5 dk:pt-4">

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-lavender-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">{lesson.topic}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{daily ? `Daily quest · ${formatQuestDate(daily.lesson_id.slice(6))}` : chapter ? `Chapter 0${SEASON2_CHAPTERS.findIndex((id) => id === lessonId) + 4}` : `Chapter ${index + 1}`}</span>
        </div>

        {!done ? (
          <>
            <h2 className="mt-4 font-display text-3xl font-medium uppercase leading-none tracking-[-0.04em]">{lesson.title}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-navy/80">{lesson.concept}</p>
            <AskBloqButton label="Ask Bloq about this" onClick={() => setAsking(true)} className="-ml-3 mt-2 text-navy/70" />
            <p className="mt-6 font-display text-xl font-medium leading-snug">{lesson.question}</p>
            <motion.div
              key={shake}
              animate={shake && !reduce ? { x: [0, -10, 9, -6, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="mt-4 flex flex-col gap-2.5"
            >
              {lesson.options.map((opt, i) => (
                <Press
                  key={opt}
                  ref={i === 0 ? firstOption : undefined}
                  disabled={game.busy}
                  onClick={() => choose(opt)}
                  className={cn(
                    "flex min-h-[56px] items-center justify-between rounded-2xl border-2 px-5 py-3 text-left font-semibold transition-colors disabled:opacity-60",
                    wrong.includes(opt) ? "border-coral bg-coral/20 text-navy/70 line-through decoration-coral decoration-2" : "border-navy/10 bg-card hover:border-navy",
                    picked === opt && "border-navy bg-lavender-soft",
                  )}
                >
                  {opt}
                  <span className="ml-3 font-display text-xs text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                </Press>
              ))}
            </motion.div>
            {game.busy && picked && <div className="mt-4"><LabLoader tone="navy" label="Checking your answer on NEAR…" /></div>}
            <AnimatePresence>
              {lastWrong && lesson.explanation && !game.busy && (
                <motion.div
                  key={`exp-${shake}`}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: labEase }}
                  className="mt-5 rounded-2xl border-l-4 border-coral bg-coral/15 p-4"
                >
                  <p className="text-[15px] leading-relaxed">{lesson.explanation}</p>
                  <Press onClick={() => firstOption.current?.focus()} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-semibold underline-offset-4 hover:underline">
                    <RotateCcw className="h-4 w-4" /> Try again
                  </Press>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: labEase }}>
            <h2 className="mt-4 font-display text-3xl font-medium uppercase leading-none tracking-[-0.04em]">Quest complete</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-navy/80">{lesson.success}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <RewardChip id="gold" amount={lesson.reward_gold} className={cn(flights.length && "opacity-30")} />
              <RewardChip id={lesson.reward_item} amount={lesson.reward_item_amount} className={cn(flights.length && "opacity-30")} />
            </div>
            <div className="mt-3 h-6">
              <AnimatePresence>
                {saved && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    <Check className="h-4 w-4" /> Saved on NEAR ✓
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-4 rounded-3xl bg-navy p-5 text-ivory">
              <h3 className="font-display text-lg font-medium text-lime">What just happened on NEAR</h3>
              <p className="mt-2 text-sm leading-relaxed text-ivory/80">{lesson.near_reveal}</p>
              {gen && (
                <div className="mt-4 border-t border-ivory/15 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lavender">Who wrote this quest</p>
                  <p className="mt-2 text-sm leading-relaxed text-ivory/80">
                    An AI agent (<code className="font-mono text-xs">{gen.model}</code>) on NEAR AI Cloud wrote it; the relayer hashed the answer and stored the quest on the Bloqvia contract, so your answer was checked by the chain, not by the AI.
                  </p>
                  {gen.signature?.signature_kind === "provider_tee" && (
                    <p className="mt-2 text-sm leading-relaxed text-ivory/70">Signed inside a TEE (hardware enclave) by the model's provider.</p>
                  )}
                  <p className="mt-2 break-all font-mono text-xs text-ivory/70">chat {gen.chat_id}</p>
                  <a href={verifyUrl(gen.model)} target="_blank" rel="noopener noreferrer" className="tap mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-lime underline-offset-4 hover:underline">
                    Verify the signature <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
              {game.lastTx && (
                <a href={game.lastTx.url} target="_blank" rel="noreferrer" className="tap mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-lime underline-offset-4 hover:underline">
                  See it on the explorer <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <Press onClick={onClose} className="mt-6 w-full rounded-full bg-navy py-3.5 text-base font-semibold text-ivory">
              Back to the map
            </Press>
          </motion.div>
        )}
      </div>
      </div>
      </motion.div>

      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
            {flights.map((f, i) => (
              <motion.span
                key={f.id}
                className={cn("fixed left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full shadow-lift", f.id === "gold" ? "bg-lime text-navy" : "bg-lavender-soft text-navy")}
                initial={{ x: f.from.left + 8, y: f.from.top, scale: 1, opacity: 1 }}
                animate={{ x: f.to.left + f.to.width / 2 - 18, y: f.to.top + f.to.height / 2 - 18, scale: 0.7, opacity: [1, 1, 0.9] }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: labEase }}
              >
                <ItemIcon id={f.id} />
              </motion.span>
            ))}
          </div>,
          document.body,
        )}
    </motion.div>
  );
}

/** Twelve small spinning cubes thrown from Bloq's hands. */
function CubeBurst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[55%]" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const d = 46 + (i % 3) * 14;
        return (
          <motion.span
            key={i}
            className="absolute block h-[10px] w-[10px] rounded-[2px]"
            style={{ background: CUBE_COLORS[i % 3], border: "1.5px solid #16243A" }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - 20, rotate: 360, opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
    </div>
  );
}
