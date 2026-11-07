import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { ChainTrail, type ChainTrailHandle, type TrailStop } from "@/bloq";
import { useChapters, useFinalBlock, SEASON2_CHAPTERS, season2Done } from "@/near";
import { useGame, IS_MOCK } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { GameHeader, PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { QuizSheet } from "@/components/QuizSheet";
import { ItemIcon } from "@/components/GameBits";
import { InventoryBar } from "@/components/lab/InventoryBar";
import { StreakCard } from "@/components/lab/StreakCard";
import { DailyQuestCard } from "@/components/lab/DailyQuestCard";
import { buzz, Press } from "@/components/lab/motion";
import { Web3Passport } from "@/components/lab/Web3Passport";
import { seasonProgress } from "@/components/lab/seasonProgress";

const KINDS = ["vault", "battery", "contract"] as const;
const POSTS = ["keys · ed25519", "gas · the relayer pays", "core.bloqvia.testnet"] as const;
const TRAIL_STOPS = [0, 1, 2].map((i) => {
  const l = LESSON_CONTENT[i];
  return { id: l?.lesson_id ?? String(i), title: l?.title ?? "", kind: KINDS[i] ?? "vault", post: POSTS[i] ?? "", reward: l ? <ItemIcon id={l.reward_item} /> : undefined };
}) as unknown as readonly [TrailStop, TrailStop, TrailStop];
const S2_KINDS = ["ownership", "transfer", "pool"] as const;
const S2_POSTS = ["NFTs · NEP-171", "signed · NEP-366", "pricing.rs · the curve"] as const;
const S2_TITLES = ["Digital Ownership", "Transactions", "Decentralised Finance"] as const;
const OFFICER = { hat: "captain", prop: "passport", label: "Bloq the officer, in the Passport office" } as const;
const ASK = "Ready for Season 2? Press Start and I'll jump in!";

function SeasonCard({ season, icon, progress, ready, locked = false, action, cardRef }: { season: 1 | 2; icon: ReactNode; progress?: number; ready: boolean; locked?: boolean; action?: ReactNode; cardRef?: RefObject<HTMLDivElement | null> }) {
  return <div ref={cardRef} id={season === 2 ? "season-2" : undefined} className={`scard season-${season}${ready ? " open" : ""}${locked ? " locked" : ""}`}>
    <span className="g-ico" aria-hidden="true">{icon}</span>
    <div className="g-txt"><span className="eb">Season {season} · {season === 1 ? "The Block Fields" : "Network City"}{progress !== undefined && <span className="text-lavender"> · {progress}/3</span>}</span>
      <b><span className="season-wide">{season === 1 ? "The Vault · The Fuel System · Smart Agreements" : "Digital ownership · Transactions · Decentralised finance"}</span><span className="season-narrow">{season === 1 ? "Vault · Fuel · Agreements" : "Ownership · Tx · DeFi"}</span></b></div>{action}
  </div>;
}

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
  const trail2 = useRef<ChainTrailHandle>(null);
  const card2 = useRef<HTMLDivElement>(null);
  const height = useFinalBlock();
  const { chapters } = useChapters();

  const learner = game.learner;
  const completed = learner?.completed ?? [];
  const { foundingDone, chaptersDone, s1Done } = seasonProgress(completed);
  const stamped = season2Done(game.passport);
  const level = heldLevel ?? learner?.level ?? 0;
  const [trailLevel, setTrailLevel] = useState(foundingDone.length); // what the trail shows
  const [s2Level, setS2Level] = useState(chaptersDone);
  const [storedStart, setStoredStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [curtain, setCurtain] = useState(false);
  const started = chaptersDone > 0 || stamped || storedStart;
  const [arrivedOffice, setArrivedOffice] = useState(false);
  const [moment, setMoment] = useState(false);
  const [stampWaitExpired, setStampWaitExpired] = useState(false);
  const thirdThisVisit = useRef(false);
  const celebrated = useRef(false);
  const pendingS1 = useRef(false);
  const mounted = useRef(true);
  const startReady = useRef(false);
  const chapterCount = useRef(chaptersDone);
  chapterCount.current = chaptersDone;
  const doneCount = useRef(foundingDone.length);
  doneCount.current = foundingDone.length;

  useEffect(() => {
    mounted.current = true;
    try { setStoredStart(!!game.accountId && localStorage.getItem(`bloqvia:s2:${game.accountId}`) === "1"); } catch { setStoredStart(false); }
    startReady.current = true;
    if (location.hash === "#season-2") requestAnimationFrame(() => card2.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    return () => { mounted.current = false; timers.current.forEach(clearTimeout); };
  }, [game.accountId, reduce]);

  const seat = () => {
    const r = card2.current?.getBoundingClientRect(), b = card2.current?.querySelector(".g-btn")?.getBoundingClientRect();
    const t = card2.current?.querySelector(".g-txt b")?.getBoundingClientRect();
    if (!r) return null;
    if (!b) return { x: r.right - 70, y: r.top };
    const gapL = t ? Math.min(t.right, b.left) : b.left - 90;
    return { x: Math.max(Math.min((gapL + b.left) / 2, b.left - 46), gapL + 16), y: r.top };
  };
  useEffect(() => {
    if (!s1Done || started || (!reduce && pendingS1.current) || !startReady.current) return;
    const perch = () => { const target = seat(); if (target) void trail.current?.perchAt(target, ASK, true, true); };
    const timer = setTimeout(perch, 450);
    let resizeTimer: ReturnType<typeof setTimeout>;
    const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(perch, 200); };
    window.addEventListener("resize", resize);
    return () => { clearTimeout(timer); clearTimeout(resizeTimer); window.removeEventListener("resize", resize); };
  }, [s1Done, started, reduce]);

  useEffect(() => {
    if (chaptersDone !== 3 || stamped) { setStampWaitExpired(false); return; }
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      void game.refresh().catch(() => {});
      if (ticks >= 10) { clearInterval(timer); setStampWaitExpired(true); }
    }, 3000);
    return () => clearInterval(timer);
  }, [chaptersDone, stamped, game.refresh]);

  useEffect(() => {
    if (!arrivedOffice || !stamped || !thirdThisVisit.current || celebrated.current) return;
    celebrated.current = true;
    setMoment(true);
    const timer = setTimeout(() => { setMoment(false); trail2.current?.cheer("Stamped! Season 2 is on your Passport for good."); }, 2600);
    return () => clearTimeout(timer);
  }, [arrivedOffice, stamped]);

  const arrived1 = (n: number) => {
    if (n !== 3 || started) return;
    pendingS1.current = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!mounted.current) return; const target = seat(); if (target) void trail.current?.perchAt(target, ASK, false, true); }));
  };
  const startSeason2 = async () => {
    if (!s1Done || IS_MOCK || startingRef.current) return false;
    if (started) return true;
    const target = trail2.current?.entry();
    if (!target) return false;
    startingRef.current = true;
    setStarting(true);
    try { if (game.accountId) localStorage.setItem(`bloqvia:s2:${game.accountId}`, "1"); } catch { /* Keep start in memory when storage is unavailable. */ }
    const timer = setTimeout(() => { if (mounted.current) setCurtain(true); }, reduce ? 0 : 900);
    timers.current.push(timer);
    await trail.current?.jumpTo(target, "Here I go!");
    if (!mounted.current) return false;
    setStoredStart(true);
    setCurtain(true);
    setStarting(false);
    startingRef.current = false;
    timers.current.push(setTimeout(() => trail2.current?.greet(), 60));
    return true;
  };
  const playChapter = async (i: number) => {
    const id = SEASON2_CHAPTERS[i];
    if (!id || IS_MOCK || !s1Done || startingRef.current) return;
    if (started || await startSeason2()) openQuest(id);
  };
  const s2Stops = SEASON2_CHAPTERS.map((id, i) => {
    const c = chapters.find((chapter) => chapter.lesson_id === id);
    return { id, title: c?.title ?? S2_TITLES[i] ?? "", kind: S2_KINDS[i] ?? "ownership", post: S2_POSTS[i] ?? "", ...(c ? { reward: <ItemIcon id={c.reward_item} /> } : {}) };
  }) as unknown as readonly [TrailStop, TrailStop, TrailStop];

  const openQuest = (id: string) => {
    if (!learner) return;
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
    if (open === SEASON2_CHAPTERS[2] && chapterCount.current === 3 && s2Level < 3) thirdThisVisit.current = true;
    if (doneCount.current === 3 && trailLevel < 3) pendingS1.current = true;
    timers.current.push(setTimeout(() => {
      setTrailLevel(doneCount.current);
      setS2Level(chapterCount.current);
      // ChainTrail places the guide immediately under reduced motion, without firing onArrived.
      if (reduce) {
        if (pendingS1.current) arrived1(doneCount.current);
        if (thirdThisVisit.current && chapterCount.current === 3) setArrivedOffice(true);
      }
    }, reduce ? 0 : 450));
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

      <div className="season-map order-5 dk:order-3 dk:col-span-2">
      <SeasonCard season={1} icon={s1Done ? "✓" : "1"} progress={foundingDone.length} ready />
      <ChainTrail
        ref={trail}
        className="mt-4 dk:mt-6"
        level={trailLevel}
        blockHeight={height}
        onPlay={(i) => { const l = LESSON_CONTENT[i]; if (l) openQuest(l.lesson_id); }}
        doorAccount="bloq.bloqvia.testnet"
        stops={TRAIL_STOPS}
        guideAt={started ? "gone" : "here"}
        curtain={started || curtain}
        hostHello="Hello! The shop's still open. Come and trade any time."
        intro={!(s1Done && !started)}
        onArrived={arrived1}
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
      <SeasonCard cardRef={card2} season={2} icon={!s1Done ? "🔒" : stamped ? "✓" : "2"} ready={s1Done} locked={!s1Done} {...(started ? { progress: chaptersDone } : {})}
        {...(s1Done && !started ? { action: <Press disabled={starting || IS_MOCK} onClick={() => void startSeason2()} className="g-btn"><span className="season-wide">Start Season 2 ↓</span><span className="season-narrow">Start ↓</span></Press> } : {})} />
      <div className="relative">
      <ChainTrail ref={trail2} world="city" locked={!s1Done || IS_MOCK} level={s2Level} stops={s2Stops} firstNumber={4} host={OFFICER} doorAccount="passport.bloqvia.testnet" className={s1Done ? "mt-4 dk:mt-6" : "dim mt-4 dk:mt-6"}
        guideAt={started ? "here" : "gone"} intro={started} blockHeight={height}
        tip={(l, st) => l >= 3 ? "Season 2 done! Your Passport has its stamp." : `Welcome to Network City! Chapter 0${l + 4}: ${st[l]?.title}. Tap the glowing block.`}
        onPlay={(i) => void playChapter(i)} onArrived={(n) => { if (n === 3) setArrivedOffice(true); }}
        door={<>{stamped && !moment ? <><p className="text-sm text-ivory"><span className="text-lime">✓</span> Stamped on NEAR · Season 2</p><Link to="/passport" className="tap inline-flex items-center rounded-full border-[1.5px] border-lime px-6 font-semibold text-lime">See your Passport</Link></> : <p className="text-sm text-lavender">{chaptersDone < 3 ? "Finish Season 2 to get your Passport stamp" : stampWaitExpired ? "Your stamp is on its way. Check back in a minute." : "Season 2 complete. Here comes your stamp…"}</p>}</>} />
        {moment && game.passport && <div className="season-stamp-moment" role="status" aria-label="Your Passport gets the Season 2 stamp"><Web3Passport holder={game.passport.owner_id} level={game.passport.level} graduated={game.passport.graduated} stamps={["season-2"]} slam={!reduce} />{game.lastTx && <a className="season-stamp-caption" href={game.lastTx.url} target="_blank" rel="noopener noreferrer">Stamped on NEAR · View transaction ↗</a>}</div>}
      </div>
      </div>
      </div>

      <AnimatePresence>
        {open && <QuizSheet key={open} lessonId={open} onClose={close} onLanded={landed} saved={saved} />}
      </AnimatePresence>
    </PhoneShell>
  );
}
