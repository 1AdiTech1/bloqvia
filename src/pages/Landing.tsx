import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useReducedMotion } from "framer-motion";
import { KeyRound, BatteryCharging, FileCheck2, type LucideIcon } from "lucide-react";
import { SignInSheet } from "@/components/brand/SignInSheet";
import { AskDock } from "@/components/brand/AskDock";
import { HopBloq, useMedia } from "@/components/brand/HopBloq";
import { useGame } from "@/game/useGame";
import { cn } from "@/lib/utils";
import {
  BlockSea, Bloq, BloqCoin, BloqviaLogo, FloatingCubes, SpeechBubble, talkMs, useSay,
  type BloqHandle, type BloqHat, type BloqPose, type BloqProp, type FloatingCubesHandle,
} from "@/bloq";

/** Little lime bars (spark) or lavender dots (puff) flying out of a Bloq. Host must be positioned. */
function burst(host: HTMLElement | null, kind: "spark" | "puff", n: number, still: boolean | null) {
  if (!host || still) return;
  const r = host.getBoundingClientRect(), cx = r.width / 2, cy = r.height * 0.3;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = `lv-${kind}`;
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5, d = r.width * (kind === "spark" ? 0.62 : 0.45);
    s.style.left = `${cx}px`; s.style.top = `${cy}px`;
    host.appendChild(s);
    const rot = (a * 180) / Math.PI + 90;
    s.animate(
      [
        { transform: `translate(-50%,-50%) rotate(${rot}deg) scale(.3)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) rotate(${rot}deg) scale(1)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 200, easing: "cubic-bezier(.22,1,.36,1)" },
    ).onfinish = () => s.remove();
  }
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function LandingPage() {
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const game = useGame();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  /** Start buttons: signed in → the "already started" popover; signed out → the sign-in sheet. */
  const startOrRemind = useCallback((e?: React.MouseEvent<HTMLElement>) => {
    if (game.accountId && e) setAnchor(e.currentTarget);
    else setOpen(true);
  }, [game.accountId]);
  /** Explore ↗: signed in → map, signed out → sheet. */
  const explore = useCallback(() => {
    if (game.accountId) navigate({ to: "/map" });
    else setOpen(true);
  }, [game.accountId, navigate]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ivory text-navy">
      <main>
        <Hero onStart={openSheet} onHeaderStart={startOrRemind} />
        <Context />
        <Chapters onExplore={explore} />
        <ExperienceLab onStart={startOrRemind} />
        <Progress />
        <Ready onStart={startOrRemind} />
      </main>
      <footer className="bg-navy pb-24 text-ivory/80 sm:pb-20">
        <div className={cn(WRAP, "flex flex-col gap-3 py-[30px] text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between")}>
          <span className="normal-case">Bloqvia · A friendlier way into Web3.</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ivory/60">
            <span>Built on NEAR · NEAR testnet · NEAR Hackathon 2026</span>
            <a href="https://github.com/1AdiTech1/bloqvia" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-medium text-lime no-underline hover:underline">Source on GitHub</a>
          </span>
          <a href="#top" className="inline-flex min-h-11 items-center font-display text-base font-medium text-lime no-underline">Back to top ↑</a>
        </div>
      </footer>
      {anchor && <StartedPopover anchor={anchor} onClose={() => setAnchor(null)} />}
      <SignInSheet open={open} onClose={close} />
      {!open && <AskDock />}
    </div>
  );
}

/** Small ivory popover under a Start button for players who already have an account. */
function StartedPopover({ anchor, onClose }: { anchor: HTMLElement; onClose: () => void }) {
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const r = anchor.getBoundingClientRect();
    const w = Math.min(300, innerWidth - 24);
    const left = Math.max(12, Math.min(r.left + scrollX, scrollX + innerWidth - w - 12));
    setPos({ top: r.bottom + scrollY + 12, left });
    const t = window.setTimeout(onClose, 6000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!box.current?.contains(n) && !anchor.contains(n)) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [anchor, onClose]);
  if (!pos) return null;
  return (
    <div ref={box} role="status" className="absolute z-50 w-[min(300px,calc(100vw-24px))] rounded-[16px] bg-ivory p-4 text-navy shadow-[0_18px_44px_rgb(22_36_58/.22)] ring-1 ring-navy/10" style={{ top: pos.top, left: pos.left }}>
      <p className="text-[15px] leading-snug">You've already started. Your progress is waiting on the map.</p>
      <button type="button" onClick={() => navigate({ to: "/map" })} className="lv-btn lv-btn-lime mt-3 w-full !py-3 !text-[15px] !shadow-none">Continue to the map</button>
    </div>
  );
}

const WRAP = "mx-auto max-w-[1240px] px-5";
const SECTION = "relative py-[clamp(72px,9vw,116px)]";

/* ---------------- Hero (with the header) ---------------- */

function Hero({ onStart, onHeaderStart }: { onStart: () => void; onHeaderStart: (e: React.MouseEvent<HTMLElement>) => void }) {
  const still = useReducedMotion();
  const game = useGame();
  const navigate = useNavigate();
  const hero = useRef<BloqHandle>(null);
  const cubes = useRef<FloatingCubesHandle>(null);
  const bloqBox = useRef<HTMLDivElement>(null);
  const startBtn = useRef<HTMLButtonElement>(null);
  const hovering = useRef(false);
  const [line, say] = useSay();

  const speak = useCallback((text: string) => { say(text); hero.current?.talk(talkMs(text)); }, [say]);

  const celebrate = useCallback(() => {
    hero.current?.jump();
    cubes.current?.hop();
    window.setTimeout(() => burst(bloqBox.current, "spark", 10, still), 330);
  }, [still]);

  const start = () => {
    celebrate();
    if (game.accountId) navigate({ to: "/map" });
    else onStart();
  };

  // eyes follow the pointer
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = hero.current?.element();
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      hero.current?.look(
        clamp1((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)),
        clamp1((e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)),
      );
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // greeting, then a quiet hint for touch screens: aim at Start now and then
  useEffect(() => {
    const hi = window.setTimeout(() => speak("Hi, I'm Bloq. Tap me, or hover Start."), 1200);
    let back: number | undefined;
    const hint = () => {
      const b = startBtn.current;
      if (!b || hovering.current || still) return;
      const r = b.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      hero.current?.aimAt(b);
      window.clearTimeout(back);
      back = window.setTimeout(() => { if (!hovering.current) hero.current?.aimAt(null); }, 2600);
    };
    const first = window.setTimeout(hint, 3400);
    const every = window.setInterval(hint, 9000);
    return () => { window.clearTimeout(hi); window.clearTimeout(first); window.clearInterval(every); window.clearTimeout(back); };
  }, [speak, still]);

  const aimOn = () => {
    hovering.current = true;
    hero.current?.aimAt(startBtn.current);
    speak("Press Start and I'll make your NEAR account. No seed phrase.");
  };
  const aimOff = () => { hovering.current = false; hero.current?.aimAt(null); };

  return (
    <section id="top" className="lv-dark relative bg-night text-ivory">
      <div className={WRAP}>
        <header className="flex items-center justify-between gap-4 py-[22px]">
          <a href="#top" aria-label="Bloqvia home" className="flex min-h-11 items-center text-ivory no-underline">
            <BloqviaLogo nameClassName="text-ivory" />
          </a>
          <nav className="lv-nav flex items-center gap-[clamp(14px,2.4vw,34px)] font-display text-base font-medium">
            <a href="#context">The big picture</a>
            <a href="#chapters">Chapters</a>
            <a href="#lab">Experience Lab</a>
            <button type="button" onClick={(e) => { celebrate(); onHeaderStart(e); }} className="lv-btn lv-btn-lime !px-5 !py-[13px] !text-[15px] !shadow-none">
              Start learning
            </button>
          </nav>
        </header>

        <div className="grid grid-cols-1 items-center gap-7 pb-[clamp(56px,8vw,110px)] pt-[clamp(36px,7vw,90px)] min-[900px]:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="lv-eyebrow">A friendlier way into Web3</p>
            <h1 className="mt-[26px] text-[clamp(2.1rem,3.6vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.035em] [text-wrap:balance]">
              Web3, without the overwhelm.
            </h1>
            <p className="lv-sub max-w-[34rem]">Learn how the next generation of the internet works, one simple experience at a time.</p>
            <div className="mt-[34px] flex flex-wrap gap-4">
              <button
                ref={startBtn}
                type="button"
                onClick={start}
                onMouseEnter={aimOn}
                onFocus={aimOn}
                onMouseLeave={aimOff}
                onBlur={aimOff}
                className="lv-btn lv-btn-lime"
              >
                {game.accountId ? "Continue to the map" : "Start exploring"}
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("context")?.scrollIntoView({ behavior: still ? "auto" : "smooth" })}
                className="lv-btn lv-btn-ghost"
              >
                Discover Bloqvia
              </button>
            </div>
          </div>

          <div className="relative mx-auto grid aspect-square w-full max-w-[470px] place-items-center">
            <span className="lv-ring" />
            <span className="lv-ring in" />
            <span className="lv-lights" style={{ ["--t" as string]: "9s" }}><i className="lv-comet" /></span>
            <span className="lv-lights in" style={{ ["--t" as string]: "13s", ["--d" as string]: "-5s" }}><i className="lv-comet" /></span>
            <span className="lv-lights rev" style={{ ["--t" as string]: "17s", ["--d" as string]: "-11s" }}><i className="lv-comet" /></span>
            <FloatingCubes ref={cubes} />
            <div ref={bloqBox} className="lv-hero-bloq relative z-[2] w-[66%] cursor-pointer" onClick={celebrate}>
              <Bloq ref={hero} hat="astro" outfit="astro" pose="space" label="Bloq in a space helmet, floating in orbit" className="w-full" />
              <SpeechBubble text={line} tone="light" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- A little context ---------------- */

const ctxCards = [
  { k: "01 READ", title: "Look around.", body: "The early web let us visit pages and find information.", say: "Web1 was like a library. You could read pages, but only a few people could publish them." },
  { k: "02 WRITE", title: "Join in.", body: "People began sharing, posting, and making things together.", say: "Web2 let everyone post. The catch: the platform keeps your account and the data you create." },
  { k: "03 OWN", title: "Take a stake.", body: "Web3 explores ways to hold and move digital things yourself.", say: "Web3 gives you an account only your key controls. On NEAR it even has a name you can read." },
  { k: "04 TRUST", title: "Check the rules.", body: "Shared records can help people see what happened and how.", say: "The rules live in open code on a shared ledger, so anyone can check what happened." },
];

function Context() {
  const still = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [line, say] = useSay();
  const [pose, setPose] = useState<BloqPose>("idle");
  const [facing, setFacing] = useState<"left" | "right">("right");
  const [active, setActive] = useState(-1);
  const st = useRef({ x: -160, idx: -1, sitting: false, lastUser: 0, walkT: 0, sitT: 0 });
  const stillRef = useRef(still);
  stillRef.current = still;
  const narrow = useMedia("(max-width: 980px)");
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;

  const place = (x: number, y: number, ms: number, ease = "linear") => {
    const el = host.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms ${ease}` : "none";
    el.style.transform = `translate(${x}px, ${y}px)`;
    st.current.x = x;
  };
  const oneRow = () => {
    const c = cards.current;
    return !!c[0] && !!c[3] && c[0].offsetTop === c[3].offsetTop;
  };

  const speak = (i: number) => {
    const text = ctxCards[i]!.say;
    say(text);
    bloq.current?.talk(talkMs(text));
  };

  const sitDown = (i: number) => {
    const s = st.current, moving = !stillRef.current;
    bloq.current?.walking(false);
    if (!oneRow()) { setFacing("left"); setPose("present"); s.sitting = false; speak(i); return; }
    setFacing("right"); setPose("sit"); s.sitting = true;
    const h = host.current?.offsetHeight ?? 0;
    place(s.x, h * 0.255 - 20, moving ? 420 : 0, "cubic-bezier(.3,.7,.4,1)");
    s.sitT = window.setTimeout(() => speak(i), moving ? 320 : 0);
  };

  const goTo = (i: number) => {
    if (narrowRef.current) return; // phones: HopBloq takes over
    const s = st.current, moving = !stillRef.current;
    s.idx = i;
    setActive(i);
    window.clearTimeout(s.walkT); window.clearTimeout(s.sitT);
    const tr = track.current?.getBoundingClientRect(), w = host.current?.offsetWidth ?? 0, card = cards.current[i];
    if (!tr || !card) return;
    let target: number;
    if (oneRow()) { const cr = card.getBoundingClientRect(); target = cr.left - tr.left + cr.width * 0.64 - w / 2; }
    else target = tr.width - w;
    const walk = () => {
      const dx = target - s.x;
      if (!moving || Math.abs(dx) < 6) { place(target, 0, 0); sitDown(i); return; }
      const dur = Math.min(2600, Math.max(500, Math.abs(dx) * 3.2));
      setPose("idle");
      setFacing(dx < 0 ? "left" : "right");
      bloq.current?.walking(true);
      place(target, 0, dur);
      s.walkT = window.setTimeout(() => sitDown(i), dur);
    };
    if (s.sitting && moving) {
      s.sitting = false;
      setPose("idle");
      place(s.x, 0, 300, "cubic-bezier(.3,.7,.4,1)");
      s.sitT = window.setTimeout(walk, 300);
    } else { s.sitting = false; walk(); }
  };
  const goRef = useRef(goTo);
  goRef.current = goTo;

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let tour: number | undefined, first: number | undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      window.clearInterval(tour);
      if (!e.isIntersecting) return;
      if (st.current.idx < 0) first = window.setTimeout(() => goRef.current(0), 250);
      tour = window.setInterval(() => {
        if (Date.now() - st.current.lastUser > 7000) goRef.current((st.current.idx + 1) % ctxCards.length);
      }, 6500);
    }), { threshold: 0.35 });
    io.observe(el);
    const onResize = () => { if (st.current.idx >= 0) { st.current.x = -9999; goRef.current(st.current.idx); } };
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect(); window.clearInterval(tour); window.clearTimeout(first);
      window.clearTimeout(st.current.walkT); window.clearTimeout(st.current.sitT);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const pick = (i: number) => { st.current.lastUser = Date.now(); if (i !== st.current.idx) goTo(i); };

  return (
    <section ref={section} id="context" className={cn(SECTION, "bg-lavender-soft")}>
      <div className={WRAP}>
        <p className="lv-eyebrow">A little context</p>
        <h2 className="lv-h2">The internet has changed. Let's make sense of it.</h2>
        <p className="lv-sub">You don't need to know all the jargon. Start with the big ideas, and we'll figure out the rest together.</p>
        {!narrow && <div ref={track} className="relative mt-2.5 h-[clamp(230px,21vw,280px)]">
          <div
            ref={host}
            className="absolute -bottom-3.5 left-0 z-[2] w-[clamp(118px,11vw,150px)] cursor-pointer"
            style={{ transform: "translateX(-160px)" }}
            onClick={() => { bloq.current?.jump(); window.setTimeout(() => burst(host.current, "spark", 10, still), 330); }}
          >
            <Bloq ref={bloq} hat="cap2" pose={pose} facing={facing} label="Bloq walking to the card you pick" className="w-full" />
            <SpeechBubble text={line} />
          </div>
        </div>}
        <div className={cn("relative grid grid-cols-1 gap-4 min-[521px]:grid-cols-2 min-[981px]:grid-cols-4", narrow && "mt-2.5 pt-24")}>
          {narrow && <HopBloq base={{ hat: "cap2" }} onActive={setActive} label="Bloq sitting on the card you're reading" />}
          {ctxCards.map((c, i) => (
            <button
              key={c.k}
              ref={(el) => { cards.current[i] = el; }}
              data-hop=""
              data-say={c.say}
              type="button"
              onMouseEnter={() => pick(i)}
              onFocus={() => pick(i)}
              onClick={() => pick(i)}
              className={cn("lv-card lv-c4", active === i && "on")}
            >
              <span className="font-display text-sm font-medium tracking-[.06em] text-purple-d">{c.k}</span>
              <b className="mt-[26px] font-display text-[1.35rem] font-medium leading-[1.2] tracking-[-0.02em]">{c.title}</b>
              <small className="text-[15px] text-muted-foreground">{c.body}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Shared: speak once when a section is 45% in view ---------------- */

function useIntro(section: React.RefObject<HTMLElement | null>, speak: (t: string) => void, text: string) {
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let shown = false, t: number | undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !shown) { shown = true; t = window.setTimeout(() => speak(text), 500); }
      if (!e.isIntersecting) shown = false;
    }), { threshold: 0.45 });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(t); };
  }, [section, speak, text]);
}

/* ---------------- Perch: Bloq on top of a 3-card row, dressing for each card ---------------- */

interface PerchCard { key: string; hat: BloqHat; prop: BloqProp; say: string }

function usePerch(start: { hat: BloqHat; prop: BloqProp }, intro: string) {
  const still = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const [line, say] = useSay();
  const [hat, setHat] = useState<BloqHat>(start.hat);
  const [prop, setProp] = useState<BloqProp>(start.prop);
  const [active, setActive] = useState(-1);
  const timers = useRef<number[]>([]);
  const speak = useCallback((text: string) => { say(text); bloq.current?.talk(talkMs(text)); }, [say]);
  useIntro(section, speak, intro);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);

  const go = (i: number, c: PerchCard, card: HTMLElement) => {
    setActive(i); setHat(c.hat); setProp(c.prop);
    const hr = host.current?.getBoundingClientRect(), cr = card.getBoundingClientRect();
    if (hr) bloq.current?.look(clamp1((cr.left + cr.width / 2 - (hr.left + hr.width / 2)) / (innerWidth / 2)), 0.8);
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [
      window.setTimeout(() => burst(host.current, "puff", 7, still), 260),
      window.setTimeout(() => speak(c.say), 420),
    ];
  };
  const tap = () => { bloq.current?.jump(); window.setTimeout(() => burst(host.current, "spark", 10, still), 330); };
  const handlers = (i: number, c: PerchCard) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => go(i, c, e.currentTarget),
    onFocus: (e: React.FocusEvent<HTMLElement>) => go(i, c, e.currentTarget),
    onClick: (e: React.MouseEvent<HTMLElement>) => go(i, c, e.currentTarget),
  });
  return { section, host, bloq, line, hat, prop, active, setActive, tap, handlers };
}

/** Desktop: absolute, standing on the card row. Under 860px: his own right-aligned row, low enough that his bubble clears the subtitle. */
const PERCH_HOST = "relative z-[2] mb-[-22px] ml-auto mr-2 mt-[88px] w-[132px] cursor-pointer min-[861px]:absolute min-[861px]:bottom-[calc(100%-22px)] min-[861px]:right-[clamp(8px,3vw,40px)] min-[861px]:m-0 min-[861px]:w-[clamp(120px,12vw,160px)]";

/* ---------------- Your first adventure ---------------- */

const chapterCards: (PerchCard & { Icon: LucideIcon; title: string; body: string; bg: string })[] = [
  { key: "01 The Vault", Icon: KeyRound, title: "Keys", body: "A key is a way to prove something digital belongs to you. Find out why keeping it safe matters.", hat: "captain", prop: "key", say: "Keys. Your public key is a mailbox anyone can see. The private key is the only one that opens it.", bg: "bg-card" },
  { key: "02 The Fuel System", Icon: BatteryCharging, title: "Gas", body: "Some actions on a blockchain need a small fee. See what that fee helps pay for.", hat: "hardhat", prop: "fuel", say: "Gas is the small fee for the computers doing the work. In Bloqvia I pay it for you.", bg: "bg-lav-card border-[#e2d4f6]" },
  { key: "03 Smart Agreements", Icon: FileCheck2, title: "Smart contracts", body: "Think of rules that run when agreed conditions are met. Learn what they can, and can't, do.", hat: "beret", prop: "scroll", say: "A smart contract is a vending machine made of code, with the rules printed on it for everyone.", bg: "bg-lime-pale border-[#dfe9b8]" },
];

function Chapters({ onExplore }: { onExplore: () => void }) {
  const p = usePerch({ hat: "beanie", prop: "bulb" }, "Three chapters, one idea each. Point at one and I'll dress for it.");
  const narrow = useMedia("(max-width: 860px)");
  return (
    <section ref={p.section} id="chapters" className={cn(SECTION, "bg-ivory")}>
      <div className={WRAP}>
        <p className="lv-eyebrow">Your first adventure</p>
        <h2 className="lv-h2">Three chapters. A lot less confusion.</h2>
        <p className="lv-sub">Meet the essentials one small idea at a time. Your guide is ready when you are.</p>
        <div className={cn("relative min-[861px]:mt-10", narrow && "mt-2.5 pt-24")}>
          {narrow ? (
            <HopBloq base={{ hat: "beanie", prop: "bulb" }} looks={chapterCards} onActive={p.setActive} label="Bloq, changing hats for each chapter" />
          ) : (
          <div ref={p.host} className={PERCH_HOST} onClick={p.tap}>
            <Bloq ref={p.bloq} hat={p.hat} prop={p.prop} pose="hold" label="Bloq, changing hats for each chapter" className="w-full" />
            <SpeechBubble text={p.line} side="left" />
          </div>
          )}
          <div className="grid grid-cols-1 gap-[18px] min-[861px]:grid-cols-3">
            {chapterCards.map((c, i) => (
              <button key={c.key} type="button" data-hop="" data-say={c.say} {...(narrow ? {} : p.handlers(i, c))} className={cn("lv-card lv-c3", c.bg, p.active === i && "on")}>
                <span className="font-display text-[13px] font-medium uppercase tracking-[.1em] text-purple-d">{c.key}</span>
                <span className="mt-[18px] grid size-[58px] place-items-center rounded-[15px] bg-navy text-lime">
                  <c.Icon size={22} aria-hidden="true" />
                </span>
                <b className="mt-1.5 font-display text-[1.4rem] font-medium leading-[1.2] tracking-[-0.02em]">{c.title}</b>
                <small className="text-[15.5px] text-muted-foreground">{c.body}</small>
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onExplore(); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onExplore(); } }}
                  className="lv-explore mt-auto inline-flex min-h-11 items-center self-start font-display text-[17px] font-medium"
                >Explore ↗</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-10 text-muted-foreground"><b className="font-display font-medium text-navy">Continue your journey with</b> Digital ownership · Transactions · Decentralised finance · <button type="button" onClick={onExplore} className="lv-explore inline-flex min-h-11 items-center font-display font-medium">Season 2 on the map ↗</button></p>
      </div>
    </section>
  );
}

/* ---------------- Experience Lab ---------------- */

const labCards: (PerchCard & { title: string; body: string })[] = [
  { key: "quests", title: "Quests", body: "Learn by doing short challenges.", hat: "detective", prop: "magnifier", say: "Answer right and the contract mints your items. A wrong answer is refused by the chain itself." },
  { key: "merchant", title: "The Merchant", body: "See a market move as players trade.", hat: "tophat", prop: "cube", say: "My prices follow one rule in the contract: the more I hold of something, the less I pay for it." },
  { key: "passport", title: "The Passport", body: "Keep track of your journey.", hat: "aviator", prop: "passport", say: "Your Passport is an NFT that levels up on chain. Nobody can sell you one." },
];

function ExperienceLab({ onStart }: { onStart: (e?: React.MouseEvent<HTMLElement>) => void }) {
  const p = usePerch({ hat: "tophat", prop: "cube" }, "Everything in the Lab is a real NEAR testnet transaction you can check.");
  const narrow = useMedia("(max-width: 860px)");
  return (
    <section ref={p.section} id="lab" className={cn(SECTION, "lv-dark bg-navy text-ivory")}>
      <div className={WRAP}>
        <h2 className="lv-h2 !mt-0">Less memorising. More 'oh, I get it.'</h2>
        <p className="lv-sub">Try things for yourself in a space made for learning.</p>
        <div className={cn("relative min-[861px]:mt-[70px]", narrow && "mt-2.5 pt-24")}>
          {narrow ? (
            <HopBloq base={{ hat: "tophat", prop: "cube" }} looks={labCards} onActive={p.setActive} tone="light" label="Bloq in the Experience Lab" />
          ) : (
          <div ref={p.host} className={PERCH_HOST} onClick={p.tap}>
            <Bloq ref={p.bloq} hat={p.hat} prop={p.prop} pose="hold" label="Bloq in the Experience Lab" className="w-full" />
            <SpeechBubble text={p.line} side="left" tone="light" />
          </div>
          )}
          <div className="grid grid-cols-1 gap-[18px] min-[861px]:grid-cols-3">
            {labCards.map((c, i) => (
              <button key={c.key} type="button" data-hop="" data-say={c.say} {...(narrow ? {} : p.handlers(i, c))} className={cn("lv-card lv-c3 lv-l", p.active === i && "on")}>
                <i aria-hidden="true" />
                <b>{c.title}</b>
                <small>{c.body}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10">
          <button type="button" onClick={(e) => onStart(e)} className="lv-btn lv-btn-lime">Enter the Experience Lab</button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Your progress ---------------- */

const progItems: { name: string; body: string; prop: BloqProp; say: string; icon: React.CSSProperties; Icon?: LucideIcon }[] = [
  { name: "BloqGold", body: "A little recognition for the effort you put in.", prop: "coin", say: "BloqGold is game gold minted by the contract. It's for playing, not money.", icon: { background: "var(--purple-soft)" } },
  { name: "Key Fragment", body: "A reminder of what you learned about keys.", prop: "key", say: "Key Fragments come from The Vault, the chapter about keys.", Icon: KeyRound, icon: { background: "var(--lime)", borderRadius: "50% 50% 50% 8px" } },
  { name: "Fuel Cell", body: "A marker from your journey through gas.", prop: "fuel", say: "Fuel Cells come from The Fuel System, the chapter about gas.", Icon: BatteryCharging, icon: { background: "var(--peach)" } },
  { name: "Contract Seal", body: "A keepsake from the smart agreements chapter.", prop: "badge", say: "The Contract Seal comes from Smart Agreements, the smart contracts chapter.", Icon: FileCheck2, icon: { background: "var(--lavender-soft)", borderRadius: "50%" } },
];

const GUILLOCHE = Array.from({ length: 14 }, (_, i) => {
  let d = "";
  for (let x = 0; x <= 330; x += 6) {
    const y = 110 + Math.sin(x / 26 + i * 0.45) * (30 + i * 4) + Math.sin(x / 9 + i) * 4;
    d += (x ? " L" : "M") + x + " " + y.toFixed(1);
  }
  return { d, stroke: i % 3 ? "#b47ff0" : "#d4f033" };
});

function Progress() {
  const still = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const [line, say] = useSay();
  const [prop, setProp] = useState<BloqProp>("badge");
  const [active, setActive] = useState(-1);
  const timers = useRef<number[]>([]);
  const speak = useCallback((text: string) => { say(text); bloq.current?.talk(talkMs(text)); }, [say]);
  useIntro(section, speak, "Every reward here is recorded on chain. Point at one.");
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);

  const pick = (i: number) => { setActive(i); setProp(progItems[i]!.prop); speak(progItems[i]!.say); };
  const celebrate = () => {
    setProp("badge");
    bloq.current?.jump();
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [
      window.setTimeout(() => burst(host.current, "spark", 12, still), 320),
      window.setTimeout(() => speak("Graduate and your Passport is sealed for good. That's the one you can't buy."), 800),
    ];
  };
  const tilt = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (still) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 18).toFixed(1)}deg`);
    el.style.setProperty("--rx", `${(-y * 14).toFixed(1)}deg`);
    el.style.setProperty("--mx", (x * 2).toFixed(2));
  };
  const untilt = (e: React.PointerEvent<HTMLButtonElement>) => { ["--rx", "--ry", "--mx"].forEach((k) => e.currentTarget.style.removeProperty(k)); };
  const narrow = useMedia("(max-width: 959px)");
  const box = useRef<HTMLDivElement>(null);
  const pass = useRef<HTMLButtonElement>(null);
  const hop = useRef<ProgHopHandle>(null);
  const [passOn, setPassOn] = useState(false);

  return (
    <section ref={section} id="progress" className={cn(SECTION, "bg-ivory", narrow && "lv-prog-hop")}>
      <div ref={box} className={cn(WRAP, "relative grid grid-cols-1 items-center gap-9 min-[960px]:grid-cols-2 min-[960px]:gap-14")}>
        {narrow && <ProgHop ref={hop} box={box} onPass={setPassOn} />}
        <div>
          <h2 className="lv-h2 !mt-0">Your progress, made visible</h2>
          <p className="lv-sub">Every step counts. Learn something new, complete a chapter, and collect reminders of how far you've come.</p>
          <div className={cn("mt-[30px] grid grid-cols-1 gap-3.5 min-[461px]:grid-cols-2", narrow && "pt-[100px]")}>
            {progItems.map((it, i) => (
              <button key={it.name} type="button" data-hop="" data-prop={it.prop} data-say={it.say} {...(narrow ? {} : { onMouseEnter: () => pick(i), onFocus: () => pick(i), onClick: () => pick(i) })} className={cn("lv-card lv-it", active === i && "on")}>
                <i aria-hidden="true" style={it.icon} className="grid place-items-center">{it.Icon ? <it.Icon size={18} strokeWidth={2.2} /> : <BloqCoin size={26} />}</i>
                <b>{it.name}</b>
                <small>{it.body}</small>
              </button>
            ))}
          </div>
          <p className="mt-[26px] border-l-4 border-lime pl-[18px] text-[1.06rem] text-muted-foreground">Finish the season and earn a Passport that records your achievement.</p>
        </div>
        <div className="lv-panel">
          <span className="lv-pring" />
          <span className="lv-porbit" aria-hidden="true">
            <span className="lv-lights violet" style={{ ["--t" as string]: "11s" }}><i className="lv-comet" /></span>
            <span className="lv-lights violet rev" style={{ ["--t" as string]: "16s", ["--d" as string]: "-6s" }}><i className="lv-comet" /></span>
            <span className="lv-lights violet in" style={{ ["--t" as string]: "8s", ["--d" as string]: "-3s" }}><i className="lv-comet" /></span>
          </span>
          {!narrow && (
            <div ref={host} className="lv-prog-bloq" onClick={celebrate}>
              <Bloq ref={bloq} hat="grad" prop={prop} pose="hold" label="Bloq graduating" className="w-full" />
              <SpeechBubble text={line} />
            </div>
          )}
          <div className="lv-pass-wrap" data-panel="">
            <button
              ref={pass}
              type="button"
              className={cn("lv-pass", narrow && passOn && "on")}
              aria-label="Bloqvia Web3 Passport, example: level 3 of 3, soulbound NFT on NEAR testnet"
              {...(narrow ? { onClick: () => hop.current?.cheer() } : { onMouseEnter: celebrate, onClick: celebrate })}
              onPointerMove={tilt}
              onPointerLeave={untilt}
            >
              <svg className="guil" viewBox="0 0 330 220" preserveAspectRatio="none" aria-hidden="true">
                {GUILLOCHE.map((g, i) => <path key={i} d={g.d} fill="none" stroke={g.stroke} strokeWidth=".7" />)}
              </svg>
              <span className="holo" aria-hidden="true" />
              <span className="prow brandrow" aria-hidden="true">
                <svg viewBox="0 0 44 42"><rect x="1" y="29" width="42" height="12" rx="6" fill="#d4f033" /><rect x="1" y="15.5" width="36" height="12" rx="6" fill="#a6c21a" /><rect x="1" y="2" width="31" height="12" rx="6" fill="#d4f033" /></svg>
                <b>Bloqvia</b>
              </span>
              <span className="prow kind" aria-hidden="true">WEB3 PASSPORT</span>
              <span className="chipic" aria-hidden="true" />
              <svg className="nfc" viewBox="0 0 14 20" aria-hidden="true"><path d="M2 4 C6 7 6 13 2 16 M6 2 C11 6 11 14 6 18 M10 1 C15 6 15 14 10 19" fill="none" stroke="#f6f3ec" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <span className="fields" aria-hidden="true">
                <span className="wide"><small>Holder</small><i>learner-7c4f.bloqvia.testnet</i></span>
                <span><small>Level</small><i>3 / 3</i></span>
                <span><small>Type</small><i>Soulbound</i></span>
                <span className="wide"><small>Chain · standard</small><i>NEAR testnet · NEP-171</i></span>
              </span>
              <svg className="seal" viewBox="0 0 100 100" aria-hidden="true">
                <defs><path id="lv-sealpath" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" /></defs>
                <g className="spinner"><text fontFamily="JetBrains Mono, monospace" fontSize="8.6" fontWeight="700" letterSpacing="2.6" fill="#d4f033"><textPath href="#lv-sealpath">EARNED · NOT BOUGHT · VERIFIED ON CHAIN · </textPath></text></g>
                <circle cx="50" cy="50" r="27" fill="none" stroke="#d4f033" strokeWidth="1.5" strokeDasharray="3 3" />
                <g transform="translate(36 37)"><g className="sealc"><rect x="0" y="18" width="28" height="8" rx="4" fill="#d4f033" /><rect x="0" y="9" width="24" height="8" rx="4" fill="#a6c21a" /><rect x="0" y="0" width="20" height="8" rx="4" fill="#d4f033" /></g></g>
              </svg>
              <span className="mrz" aria-hidden="true">P&lt;BLQ&lt;LEARNER&lt;7C4F&lt;&lt;BLOQVIA&lt;TESTNET&lt;&lt;&lt;&lt;&lt;<br />NEP171&lt;SOULBOUND&lt;&lt;LVL3&lt;&lt;KEYS&lt;GAS&lt;CONTRACTS&lt;&lt;</span>
              <span className="scan" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Progress: travelling Bloq on phones/tablets ---------------- */

type ProgHopHandle = { cheer: () => void };
const PASS_LINE = "Graduate and your Passport is sealed for good. That's the one you can't buy.";

/** Below 960px: one Bloq seated on the reward card in view, then jumping into the Passport panel. */
const ProgHop = forwardRef<ProgHopHandle, { box: React.RefObject<HTMLDivElement | null>; onPass: (on: boolean) => void }>(function ProgHop({ box, onPass }, ref) {
  const still = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const [line, say] = useSay();
  const [quiet, setQuiet] = useState(false);
  const [pose, setPose] = useState<BloqPose>("sit");
  const [prop, setProp] = useState<BloqProp>("coin");
  const [inPanel, setInPanel] = useState(false);
  const stillRef = useRef(still);
  stillRef.current = still;
  const passRef = useRef(onPass);
  passRef.current = onPass;
  const st = useRef({ at: -2 as number, started: false, timers: [] as number[] });

  const speak = useCallback((t: string) => { setQuiet(false); say(t); bloq.current?.talk(talkMs(t)); }, [say]);
  const sparks = useCallback(() => burst(host.current, "spark", 12, stillRef.current), []);
  useImperativeHandle(ref, () => ({
    cheer: () => {
      if (st.current.at !== -1) return;
      setPose("cheer"); bloq.current?.setMood("laugh", 1600); bloq.current?.jump(); window.setTimeout(sparks, 300);
    },
  }), [sparks]);

  useEffect(() => {
    const el = host.current, b = box.current;
    if (!el || !b) return;
    const s = st.current;
    const cards = () => Array.from(b.querySelectorAll<HTMLElement>("[data-hop]"));
    const panel = () => b.querySelector<HTMLElement>(".lv-panel");
    const clear = () => { s.timers.forEach((t) => window.clearTimeout(t)); s.timers = []; };
    const later = (ms: number, f: () => void) => { s.timers.push(window.setTimeout(f, stillRef.current ? 0 : ms)); };
    const place = (i: number, animate: boolean) => {
      const br = b.getBoundingClientRect();
      const anim = animate && !stillRef.current;
      el.style.transition = anim ? "transform .6s cubic-bezier(.34,1.3,.64,1), width .6s cubic-bezier(.34,1.3,.64,1)" : "none";
      let x: number, y: number, w: number;
      if (i === -1) {
        const pr = panel()?.getBoundingClientRect();
        if (!pr) return;
        w = 112; x = pr.left - br.left + 14; y = pr.bottom - br.top - 14 - (w * 4) / 3;
      } else {
        const c = cards()[i];
        if (!c) return;
        const r = c.getBoundingClientRect();
        w = 86; x = r.right - br.left - w - 12; y = r.top - br.top - (w * 4) / 3 * 0.75 + 4;
      }
      el.style.width = `${w}px`;
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    const target = () => {
      const vh = window.innerHeight;
      const pr = panel()?.getBoundingClientRect();
      if (pr && pr.top < vh * 0.62) return -1;
      const mid = vh * 0.45;
      let best = 0, d = Infinity;
      cards().forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const dd = Math.abs(r.top + r.height / 2 - mid);
        if (dd < d) { d = dd; best = i; }
      });
      return best;
    };
    const markCard = (i: number) => cards().forEach((c, k) => c.classList.toggle("on", k === i));
    const settle = (i: number) => {
      if (i === -1) {
        setProp("badge"); setPose("cheer"); bloq.current?.setMood("laugh", 1600); bloq.current?.jump();
        window.setTimeout(sparks, stillRef.current ? 0 : 300);
        passRef.current(true);
        later(640, () => { setPose("hold"); speak(PASS_LINE); });
      } else {
        setPose("sit");
        const t = cards()[i]?.dataset["say"];
        if (t) speak(t);
      }
    };
    const go = (i: number, animate: boolean) => {
      clear();
      const from = s.at;
      s.at = i;
      setInPanel(i === -1);
      if (i !== -1) passRef.current(false);
      markCard(i);
      const p = i === -1 ? null : (cards()[i]?.dataset["prop"] as BloqProp | undefined);
      if (!animate || stillRef.current) {
        place(i, false);
        if (p) setProp(p);
        settle(i);
        return;
      }
      setQuiet(true);
      setPose("idle");
      bloq.current?.jump();
      later(120, () => { place(i, true); if (p) setProp(p); });
      later(i === -1 ? 760 : 700, () => settle(i));
      void from;
    };

    place(0, false);
    let raf = 0;
    let panelTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (raf || !s.started) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const i = target();
        if (i === -1) {
          if (s.at !== -1 && panelTimer === undefined) panelTimer = setTimeout(() => {
            panelTimer = undefined;
            if (target() === -1) go(-1, true);
          }, 500);
        } else {
          clearTimeout(panelTimer);
          panelTimer = undefined;
          if (i !== s.at) go(i, true);
        }
      });
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !s.started) { s.started = true; go(target(), false); }
    }), { threshold: 0.1 });
    io.observe(b);
    const onResize = () => place(s.at === -2 ? 0 : s.at, false);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect(); clear();
      clearTimeout(panelTimer);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cards().forEach((c) => c.classList.remove("on"));
      passRef.current(false);
    };
  }, [box, speak, sparks]);

  return (
    <div ref={host} className="absolute left-0 top-0 z-[4] w-[86px] cursor-pointer" onClick={() => { bloq.current?.jump(); bloq.current?.setMood("laugh", 900); }}>
      <div className="relative">
        <Bloq ref={bloq} hat="grad" prop={prop} pose={pose} label="Bloq graduating" className="w-full" />
        <SpeechBubble text={quiet ? null : line} className={inPanel ? "hop-say hop-up" : "hop-say"} />
      </div>
    </div>
  );
});

/* ---------------- Ready when you are ---------------- */

const SPLASH_COLORS = ["var(--lime)", "#b47ff0", "#ffffff"];

function Ready({ onStart }: { onStart: (e?: React.MouseEvent<HTMLElement>) => void }) {
  const still = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const rider = useRef<HTMLDivElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const [line, say] = useSay();
  const speak = useCallback((text: string) => { say(text); bloq.current?.talk(talkMs(text)); }, [say]);
  useIntro(section, speak, "Starting is free: I make your account and pay the gas. Hop on!");
  const stillRef = useRef(still);
  stillRef.current = still;

  useEffect(() => {
    const el = bloq.current?.element();
    const box = rider.current;
    if (!el || !box) return;
    const onSplash = (e: Event) => {
      if (stillRef.current) return;
      const dir = (e as CustomEvent<{ dir: number }>).detail?.dir ?? 1;
      const w = box.offsetWidth, h = box.offsetHeight;
      const x0 = w * (dir > 0 ? 0.12 : 0.88), y0 = h * 0.9;
      for (let i = 0; i < 12; i++) {
        const s = document.createElement("span");
        s.className = "lv-splash";
        s.style.background = SPLASH_COLORS[i % 3]!;
        s.style.left = `${x0}px`; s.style.top = `${y0}px`;
        box.appendChild(s);
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, d = 40 + Math.random() * 60;
        const dx = Math.cos(a) * d, dy = Math.sin(a) * d, spin = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 300);
        s.animate(
          [
            { transform: "translate(-50%,-50%) rotate(0deg) scale(.6)", opacity: 1 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
            { transform: `translate(calc(-50% + ${dx * 1.3}px), calc(-50% + ${dy + 50}px)) rotate(${spin}deg) scale(.8)`, opacity: 0 },
          ],
          { duration: 900 + Math.random() * 300, easing: "cubic-bezier(.22,1,.36,1)" },
        ).onfinish = () => s.remove();
      }
    };
    el.addEventListener("bloq:splash", onSplash);
    return () => el.removeEventListener("bloq:splash", onSplash);
  }, []);

  return (
    <section ref={section} id="ready" className={cn(SECTION, "bg-lavender-soft")}>
      <div className={cn(WRAP, "grid grid-cols-1 items-center gap-[30px] min-[860px]:grid-cols-[.9fr_1.1fr]")}>
        <div className="relative pt-5">
          <BlockSea riderRef={rider} />
          <div ref={rider} className="relative z-[2] mx-auto mb-[52px] mt-[110px] w-[clamp(210px,25vw,300px)] cursor-pointer" onClick={() => bloq.current?.wobble()}>
            <Bloq ref={bloq} hat="surf" outfit="surf" pose="ride" label="Bloq surfing a wave, keeping his balance" className="w-full" />
            <SpeechBubble text={line} />
          </div>
        </div>
        <div>
          <h2 className="lv-h2 !mt-0">Ready when you are.</h2>
          <p className="lv-sub">You don't have to understand everything to take the first step.</p>
          <div className="mt-[26px]">
            <button
              type="button"
              className="lv-btn lv-btn-navy lv-btn-ready"
              onClick={(e) => { bloq.current?.wobble(); onStart(e); }}
              onMouseEnter={() => { bloq.current?.rideWave(true); bloq.current?.setMood("laugh", 900); }}
              onMouseLeave={() => bloq.current?.rideWave(false)}
            >
              Start learning
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
