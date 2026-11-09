import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { Bloq, ChainTrail, SpeechBubble, leap, talkMs, useSay, walkTo, type BloqHandle, type BloqPose, type ChainTrailHandle, type TrailStop, useMotionOff } from "@/bloq";
import { useChapters, useFinalBlock, SEASON2_CHAPTERS, season2Done, useAfterSeasons, type AfterStep } from "@/near";
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
import { AfterSeasonsCard } from "@/components/lab/AfterSeasonsCard";
import { useIsDesktop } from "@/components/lab/useDesktop";

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
const GRADUATE_FIRST = "Graduate in my shop first. Your sealed Passport opens Season 2.";

function SeasonCard({ season, icon, progress, ready, locked = false, action, cardRef, onTap }: { season: 1 | 2; icon: ReactNode; progress?: number; ready: boolean; locked?: boolean; action?: ReactNode; cardRef?: RefObject<HTMLDivElement | null>; onTap?: () => void }) {
  return <div ref={cardRef} id={season === 2 ? "season-2" : undefined} onClick={(e) => { if (e.target instanceof Element && !e.target.closest("a,button")) onTap?.(); }} className={`scard season-${season}${ready ? " open" : ""}${locked ? " locked" : ""}`}>
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
  const navigate = useNavigate();
  const reduce = useMotionOff();
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
  const graduated = !!learner?.graduated;
  const s2Open = (s1Done && graduated) || stamped;
  const level = heldLevel ?? learner?.level ?? 0;
  const [trailLevel, setTrailLevel] = useState(foundingDone.length); // what the trail shows
  const [s2Level, setS2Level] = useState(chaptersDone);
  const [storedStart, setStoredStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [curtain, setCurtain] = useState(false);
  const started = (graduated && (chaptersDone > 0 || storedStart)) || stamped;
  const [arrivedOffice, setArrivedOffice] = useState(false);
  const [moment, setMoment] = useState(false);
  const [stampWaitExpired, setStampWaitExpired] = useState(false);
  const thirdThisVisit = useRef(false);
  const celebrated = useRef(false);
  const pendingS1 = useRef(false);
  const seated = useRef(false);
  const mounted = useRef(true);
  const startReady = useRef(false);
  const chapterCount = useRef(chaptersDone);
  chapterCount.current = chaptersDone;
  const doneCount = useRef(foundingDone.length);
  doneCount.current = foundingDone.length;

  // After Season 2 (prompt 26): Bloq's tour of the daily cards.
  const after = useAfterSeasons({ accountId: game.accountId, stamped, completed });
  const desktop = useIsDesktop();
  const rootRef = useRef<HTMLDivElement>(null);
  const cardsBox = useRef<HTMLDivElement>(null);
  const streakBox = useRef<HTMLDivElement>(null);
  const dailyBox = useRef<HTMLDivElement>(null);
  const listBox = useRef<HTMLDivElement>(null);
  const tourHost = useRef<HTMLDivElement>(null);
  const tourBody = useRef<HTMLDivElement>(null);
  const tourBloq = useRef<BloqHandle>(null);
  const tourFlight = useRef<(() => void) | null>(null);
  const leftCity = useRef(false);
  const sheetWasOpen = useRef(false);
  const [bag, setBag] = useState(false);
  const [bagBox, setBagBox] = useState<{ left: number; width: number }>();
  const invBox = useRef<HTMLDivElement>(null);
  const [tourPose, setTourPose] = useState<BloqPose>("sit");
  const [tourFacing, setTourFacing] = useState<"left" | "right">("right");
  const [officerIn, setOfficerIn] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tourLine, sayTourRaw] = useSay();

  useEffect(() => {
    mounted.current = true;
    try { setStoredStart(!!game.accountId && localStorage.getItem(`bloqvia:s2:${game.accountId}`) === "1"); } catch { setStoredStart(false); }
    startReady.current = true;
    if (location.hash === "#season-2") requestAnimationFrame(() => card2.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    if (location.hash === "#keep-going") requestAnimationFrame(() => cardsBox.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
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
    if (!(trailLevel >= 3 && s2Open && !started && !pendingS1.current) || !startReady.current) return;
    const perch = async () => { const target = seat(); if (target) { await trail.current?.perchAt(target, ASK, true, true); seated.current = true; } };
    const timer = setTimeout(perch, 450);
    return () => clearTimeout(timer);
  }, [trailLevel, s2Open, started, reduce]);

  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;
    const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!seated.current) return; const target = seat(); if (target) void trail.current?.perchAt(target, ASK, true, true); }, 200); };
    window.addEventListener("resize", resize);
    return () => { clearTimeout(resizeTimer); window.removeEventListener("resize", resize); };
  }, []);

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
    if (chaptersDone === 3 && s2Level < 3) thirdThisVisit.current = true;
  }, [chaptersDone, s2Level]);

  useEffect(() => {
    if (!arrivedOffice || !stamped || !thirdThisVisit.current || celebrated.current) return;
    setMoment(true);
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      celebrated.current = true;
      setMoment(false);
      trail2.current?.cheer("Stamped! Season 2 is on your Passport for good.");
      revealTimer = setTimeout(() => { void navigate({ to: "/season-2" }); }, reduce ? 900 : 2600);
    }, 2600);
    return () => { clearTimeout(timer); clearTimeout(revealTimer); };
  }, [arrivedOffice, stamped, navigate, reduce]);

  const arrived1 = (n: number) => {
    if (n !== 3 || started) return;
    if (!graduated) { pendingS1.current = false; trail.current?.say(GRADUATE_FIRST); return; }
    requestAnimationFrame(() => requestAnimationFrame(async () => { if (!mounted.current) return; const target = seat(); if (target) { await trail.current?.perchAt(target, ASK, false, true); pendingS1.current = false; seated.current = true; } }));
  };
  const startSeason2 = async () => {
    if (!s2Open || IS_MOCK || startingRef.current) return false;
    if (started) return true;
    const target = trail2.current?.entry();
    if (!target) return false;
    startingRef.current = true;
    seated.current = false;
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
    if (!graduated && !stamped) { if (s1Done) trail.current?.say(GRADUATE_FIRST); return; }
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
  const showBag = (on: boolean) => { if (on) { const r = invBox.current?.getBoundingClientRect(); if (r) setBagBox({ left: r.left, width: r.width }); } setBag(on); };
  const close = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setHeld(null);
    setBag(false);
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

  const touring = after.active && after.ready && !moment && !thirdThisVisit.current;
  const tourOn = touring && after.tourStarted;
  const W = desktop ? 100 : 86;
  const LINE: Record<AfterStep, string> = {
    streak: "Both seasons done! Now the community needs you: check in today. When enough of us do, everyone who checked in gets STREAK.",
    daily: "Checked in! Next, today's quest. An AI agent wrote it this morning, and the chain still checks your answer.",
    missions: desktop
      ? "One more, just for graduates: Missions. The DAO's board pays testnet NEAR for small tasks. It's in the menu on the left."
      : "One more, just for graduates: Missions. The DAO's board pays testnet NEAR for small tasks. Tap Missions below.",
    done: "That's everything for today. Come back tomorrow for a new quest and a new streak day.",
  };
  const sayTour = (line: string) => { sayTourRaw(line); tourBloq.current?.talk(talkMs(line)); };
  const boxFor = (step: AfterStep) => step === "streak" ? streakBox.current : step === "daily" ? dailyBox.current : listBox.current;
  const spotFor = (step: AfterStep) => {
    const root = rootRef.current, box = boxFor(step);
    if (!root || !box) return null;
    const br = root.getBoundingClientRect(), r = box.getBoundingClientRect();
    return { x: r.right - br.left - W - 16, y: r.top - br.top - (W * 4) / 3 * 0.75 + 4, w: W };
  };
  const placeTour = (step: AfterStep) => {
    const host = tourHost.current, spot = spotFor(step);
    if (!host || !spot) return false;
    host.style.transition = "none";
    host.style.width = `${spot.w}px`;
    host.style.visibility = "visible";
    host.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
    return true;
  };
  const tourAt = useRef<AfterStep | null>(null);
  const tourApi = useRef({ placeTour, spotFor, sayTour, LINE });
  tourApi.current = { placeTour, spotFor, sayTour, LINE };

  // He appears sitting on the current step, then jumps (leap) to each next one on the same visit.
  // While the quiz sheet is open he waits; 600 ms after it closes (its exit) he jumps (prompt 26b).
  useEffect(() => {
    if (!tourOn) { tourAt.current = null; return; }
    if (open) { sheetWasOpen.current = true; return; }
    const step = after.next, api = tourApi.current;
    if (tourAt.current === step) { sheetWasOpen.current = false; return; }
    const prevStep = tourAt.current;
    const first = prevStep === null;
    tourAt.current = step;
    if (first || reduce) {
      sheetWasOpen.current = false;
      tourFlight.current?.(); tourFlight.current = null;
      requestAnimationFrame(() => { api.placeTour(step); setTourFacing("right"); setTourPose("sit"); });
      timers.current.push(setTimeout(() => tourApi.current.sayTour(tourApi.current.LINE[step]), 500));
      return;
    }
    const jump = () => {
      if (!mounted.current || tourAt.current !== step) return;
      const host = tourHost.current, spot = tourApi.current.spotFor(step);
      if (!host || !spot) return;
      tourFlight.current?.();
      // Desktop, the next card is beside this one (streak → Today's quest): he stands up, walks along the cards'
      // top edges and sits down (prompt 27, docs/design/morning-fixes, section 2). Otherwise he jumps, as before.
      const from = prevStep ? tourApi.current.spotFor(prevStep) : null;
      if (desktop && from && Math.abs(from.y - spot.y) < 8) {
        const lift = (W * 4) / 3 * 0.22 + 4; // from sitting on the edge to standing on it
        const upFrom = from.y - lift, up = spot.y - lift;
        let stopWalk: (() => number) | null = null;
        setTourPose("idle");
        host.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${from.x}px, ${upFrom}px)` }], { duration: 260, easing: "cubic-bezier(.3,.7,.4,1)" });
        host.style.transform = `translate(${from.x}px, ${upFrom}px)`;
        const t = window.setTimeout(() => {
          setTourFacing(spot.x >= from.x ? "right" : "left");
          tourBloq.current?.walking(true, true);
          stopWalk = walkTo(host, spot.x, {
            y: up,
            run: false,
            onArrive: () => {
              stopWalk = null;
              tourFlight.current = null;
              tourBloq.current?.walking(false);
              host.animate([{ transform: `translate(${spot.x}px, ${up}px)` }, { transform: `translate(${spot.x}px, ${spot.y}px)` }], { duration: 300, easing: "cubic-bezier(.5,0,.6,1.3)" });
              host.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
              setTourFacing("right");
              setTourPose("sit");
              tourBloq.current?.setMood("laugh", 900);
              timers.current.push(setTimeout(() => tourApi.current.sayTour(tourApi.current.LINE[step]), 260));
            },
          });
        }, 280);
        tourFlight.current = () => { window.clearTimeout(t); stopWalk?.(); tourBloq.current?.walking(false); };
        return;
      }
      setTourPose("idle");
      tourFlight.current = leap(host, spot, {
        body: tourBody.current,
        onTakeoff: (dir) => { setTourFacing(dir); setTourPose("cheer"); },
        onLand: () => { tourFlight.current = null; setTourFacing("right"); setTourPose("sit"); tourBloq.current?.setMood("laugh", 900); timers.current.push(setTimeout(() => tourApi.current.sayTour(tourApi.current.LINE[step]), 260)); },
      });
    };
    if (sheetWasOpen.current) { sheetWasOpen.current = false; timers.current.push(setTimeout(jump, 600)); }
    else jump();
  }, [tourOn, after.next, reduce, open]);

  // Re-place him on resize and when the cards change size, unless he is in the air.
  useEffect(() => {
    if (!tourOn) return;
    const again = () => { if (!tourFlight.current && tourAt.current) tourApi.current.placeTour(tourAt.current); };
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(again) : null;
    if (cardsBox.current) ro?.observe(cardsBox.current);
    if (rootRef.current) ro?.observe(rootRef.current);
    window.addEventListener("resize", again);
    return () => { ro?.disconnect(); window.removeEventListener("resize", again); };
  }, [tourOn]);
  useEffect(() => () => { tourFlight.current?.(); }, []);

  // Leaving Network City, once per account: Season 2's guide jumps onto the first card, the officer goes in.
  useEffect(() => {
    if (!touring || after.tourStarted || leftCity.current) return;
    const timer = setTimeout(async () => {
      const s = tourApi.current.spotFor(after.next), br = rootRef.current?.getBoundingClientRect();
      if (!s || !br) return;
      leftCity.current = true;
      setLeaving(true);
      timers.current.push(setTimeout(() => { if (mounted.current) setOfficerIn(true); }, reduce ? 0 : 1400)); // as he takes off
      await trail2.current?.jumpTo({ x: br.left + s.x + W / 2, y: br.top + s.y + (W * 4) / 3 * 0.75 }, "Both seasons done! Come with me.");
      if (!mounted.current) return;
      after.startTour();
      setLeaving(false);
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touring, after.tourStarted]);

  const scrollTo = (el: HTMLDivElement | null) => el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });

  const shopOpen = trailLevel >= 3;
  const stampPendingMoment = (thirdThisVisit.current || (chaptersDone === 3 && s2Level < 3)) && !celebrated.current;

  return (
    <PhoneShell nav inlineHeader glow={tourOn && after.next === "missions" ? "/cohort" : undefined}>
      {/* Phones: header, heading, inventory, seasons, community cards. Desktop unchanged. */}
      <div ref={rootRef} data-leaving={leaving || undefined} className="relative flex flex-col dk:grid dk:grid-cols-[minmax(0,1fr)_auto] dk:items-center dk:gap-x-4">
      {tourOn && (
        <div ref={tourHost} className="absolute left-0 top-0 z-[6]" style={{ width: W, visibility: "hidden" }}>
          <div ref={tourBody} style={{ transformOrigin: "50% 92%" }} onClick={() => sayTour(LINE[after.next])}>
            <Bloq ref={tourBloq} hat="cap" pose={tourPose} facing={tourFacing} label="Bloq, your guide" className="w-full" />
          </div>
          <SpeechBubble text={tourLine} className="hop-say" />
        </div>
      )}
      <GameHeader level={level} className="order-1 dk:order-2 dk:col-start-2 dk:mb-0" />
      <div ref={invBox} className="order-3 mt-4 dk:mt-0 dk:order-2 dk:col-start-1 dk:row-start-2">
        <InventoryBar gold={held?.gold} items={held?.items} />
      </div>
      {after.active ? (
        <div id="keep-going" ref={cardsBox} className="order-5 mt-[112px] flex scroll-mt-[120px] flex-col gap-[100px] dk:order-4 dk:col-span-2 dk:mt-[112px] dk:grid dk:grid-cols-2 dk:items-stretch dk:gap-4">
          <div ref={streakBox} className="min-w-0 empty:hidden"><StreakCard highlight={tourOn && after.next === "streak"} /></div>
          <div ref={dailyBox} className="min-w-0 empty:hidden"><DailyQuestCard onPlay={openQuest} highlight={tourOn && after.next === "daily"} /></div>
          <div ref={listBox} className="min-w-0 dk:col-span-2 dk:mt-[84px]"><AfterSeasonsCard after={after} onCheckIn={() => scrollTo(streakBox.current)} onPlay={() => scrollTo(dailyBox.current)} /></div>
        </div>
      ) : (
      <div ref={cardsBox} className="order-5 mt-10 flex flex-col gap-3 dk:order-4 dk:col-span-2 dk:mt-6 dk:grid dk:grid-cols-2 dk:items-stretch dk:gap-4">
        <StreakCard />
        <DailyQuestCard onPlay={openQuest} />
      </div>
      )}

      <div className="journey-line order-2 dk:order-1 dk:col-span-2 dk:mb-5">
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime dk:mt-0">Your journey</p>
        <h2 className="mt-2 whitespace-nowrap font-display text-2xl font-medium leading-tight tracking-[-0.03em]">
          <span className="dk:hidden">Two seasons. One Passport.</span>
          <span className="hidden dk:inline">Six quests. Two seasons. A Passport that's yours.</span>
        </h2>
      </div>

      <div className="season-map order-4 mt-6 dk:mt-0 dk:order-3 dk:col-span-2">
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
        intro={!(s2Open && !started)}
        {...(!graduated ? { tip: (l: number) => l >= 3 ? GRADUATE_FIRST : l <= 0 ? `Hi, I'm Bloq. Tap the first block and we'll open ${TRAIL_STOPS[0].title}.` : `Next up: ${TRAIL_STOPS[l]?.title ?? "the next quest"}. Tap the glowing block.` } : {})}
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
      <SeasonCard cardRef={card2} season={2} icon={!s2Open ? "🔒" : stamped ? "✓" : "2"} ready={s2Open} locked={!s2Open} onTap={() => { if (s1Done && !graduated) trail.current?.say(GRADUATE_FIRST); }} {...(started ? { progress: chaptersDone } : {})}
        {...(s1Done && !graduated ? { action: <Link to="/shop" className="g-btn graduate-first"><span className="season-wide">Graduate first ↑</span><span className="season-narrow">Graduate ↑</span></Link> } : s2Open && !started ? { action: <Press disabled={starting || IS_MOCK} onClick={() => void startSeason2()} className="g-btn"><span className="season-wide">Start Season 2 ↓</span><span className="season-narrow">Start ↓</span></Press> } : {})} />
      <div className="relative" onPointerDownCapture={(e) => { if (s1Done && !graduated && e.target instanceof Element && e.target.closest(".blk")) trail.current?.say(GRADUATE_FIRST); }}>
      <ChainTrail ref={trail2} world="city" locked={!s2Open || IS_MOCK} level={s2Level} stops={s2Stops} firstNumber={4} host={OFFICER} doorAccount="passport.bloqvia.testnet" className={s2Open ? "mt-4 dk:mt-6" : "dim mt-4 dk:mt-6"}
        guideAt={started && !(after.active && after.tourStarted) ? "here" : "gone"} intro={started} blockHeight={height}
        curtain={after.active && (after.tourStarted || officerIn)} hostHello="Your stamp is safe with me. Come and see your Passport any time."
        tip={(l, st) => l >= 3 ? "Season 2 done! Your Passport has its stamp." : `Welcome to Network City! Chapter 0${l + 4}: ${st[l]?.title}. Tap the glowing block.`}
        onPlay={(i) => void playChapter(i)} onArrived={(n) => { if (n === 3) setArrivedOffice(true); }}
        door={<>{stamped && !moment && !stampPendingMoment ? <><p className="text-sm text-ivory"><span className="text-lime">✓</span> Stamped on NEAR · Season 2</p><Link to="/passport" className="tap inline-flex items-center rounded-full border-[1.5px] border-lime px-6 font-semibold text-lime">See your Passport</Link></> : <p className="text-sm text-lavender">{chaptersDone < 3 ? "Finish Season 2 to get your Passport stamp" : stampWaitExpired && !stampPendingMoment ? "Your stamp is on its way. Check back in a minute." : "Season 2 complete. Here comes your stamp…"}</p>}</>} />
        {moment && game.passport && <div className="season-stamp-moment" role="status" aria-label="Your Passport gets the Season 2 stamp"><Web3Passport holder={game.passport.owner_id} level={game.passport.level} graduated={game.passport.graduated} stamps={["season-2"]} slam={!reduce} />{game.lastTx && <a className="season-stamp-caption" href={game.lastTx.url} target="_blank" rel="noopener noreferrer">Stamped on NEAR · View transaction ↗</a>}</div>}
      </div>
      </div>
      </div>

      <AnimatePresence>
        {open && <QuizSheet key={open} lessonId={open} onClose={close} onLanded={landed} saved={saved} onBag={showBag} />}
      </AnimatePresence>
      {typeof document !== "undefined" && createPortal(
        <div data-bag="" aria-hidden="true" className={bag ? "bag-dock in" : "bag-dock"} style={bagBox}>
          <InventoryBar gold={held?.gold} items={held?.items} />
        </div>,
        document.body,
      )}
    </PhoneShell>
  );
}
