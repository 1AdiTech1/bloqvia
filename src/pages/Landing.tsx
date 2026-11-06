import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useReducedMotion } from "framer-motion";
import { Coins, KeyRound, Fuel, FileCheck2, BadgeCheck } from "lucide-react";
import { BloqMark } from "@/components/Logo";
import { CTA, Display, Eyebrow, Illustration, Reveal, Section } from "@/components/brand/primitives";
import { SignInSheet } from "@/components/brand/SignInSheet";
import { useGame } from "@/game/useGame";
import { cn } from "@/lib/utils";
import {
  Bloq, BloqviaLogo, FloatingCubes, SpeechBubble, talkMs, useSay,
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

  return (
    <div className="min-h-screen overflow-x-clip bg-ivory text-navy">
      <main>
        <Hero onStart={openSheet} />
        <Context />
        <Chapters />
        <ExperienceLab onStart={openSheet} />
        <Rewards />
        <FinalCTA onStart={openSheet} />
      </main>
      <footer className="bg-navy py-8 text-center text-sm text-ivory/70">
        Built on NEAR · NEAR testnet · NEAR Hackathon 2026 ·{" "}
        <a href="https://github.com/1AdiTech1/bloqvia" target="_blank" rel="noreferrer" className="font-medium text-lime underline-offset-4 hover:underline">
          Source on GitHub
        </a>
      </footer>
      <SignInSheet open={open} onClose={close} />
    </div>
  );
}

const WRAP = "mx-auto max-w-[1240px] px-5";
const SECTION = "relative py-[clamp(72px,9vw,116px)]";

/* ---------------- Hero (with the header) ---------------- */

function Hero({ onStart }: { onStart: () => void }) {
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
            <button type="button" onClick={start} className="lv-btn lv-btn-lime !px-5 !py-[13px] !text-[15px] !shadow-none">
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
        <div ref={track} className="relative mt-2.5 h-[clamp(230px,21vw,280px)]">
          <div
            ref={host}
            className="absolute -bottom-3.5 left-0 z-[2] w-[clamp(118px,11vw,150px)] cursor-pointer"
            style={{ transform: "translateX(-160px)" }}
            onClick={() => { bloq.current?.jump(); window.setTimeout(() => burst(host.current, "spark", 10, still), 330); }}
          >
            <Bloq ref={bloq} hat="cap2" pose={pose} facing={facing} label="Bloq walking to the card you pick" className="w-full" />
            <SpeechBubble text={line} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[521px]:grid-cols-2 min-[981px]:grid-cols-4">
          {ctxCards.map((c, i) => (
            <button
              key={c.k}
              ref={(el) => { cards.current[i] = el; }}
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

/* ---------------- Your first adventure ---------------- */

const chapterCards: { k: string; ic: string; title: string; body: string; hat: BloqHat; prop: BloqProp; say: string; bg: string }[] = [
  { k: "01 The Vault", ic: "⌑", title: "Keys", body: "A key is a way to prove something digital belongs to you. Find out why keeping it safe matters.", hat: "captain", prop: "key", say: "Keys. Your public key is a mailbox anyone can see. The private key is the only one that opens it.", bg: "bg-card" },
  { k: "02 The Fuel System", ic: "↗", title: "Gas", body: "Some actions on a blockchain need a small fee. See what that fee helps pay for.", hat: "hardhat", prop: "fuel", say: "Gas is the small fee for the computers doing the work. In Bloqvia I pay it for you.", bg: "bg-lav-card border-[#e2d4f6]" },
  { k: "03 Smart Agreements", ic: "✓", title: "Smart contracts", body: "Think of rules that run when agreed conditions are met. Learn what they can, and can't, do.", hat: "beret", prop: "scroll", say: "A smart contract is a vending machine made of code, with the rules printed on it for everyone.", bg: "bg-lime-pale border-[#dfe9b8]" },
];

function Chapters() {
  const still = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const [line, say] = useSay();
  const [hat, setHat] = useState<BloqHat>("beanie");
  const [prop, setProp] = useState<BloqProp>("bulb");
  const [active, setActive] = useState(-1);
  const timers = useRef<number[]>([]);

  const speak = useCallback((text: string) => { say(text); bloq.current?.talk(talkMs(text)); }, [say]);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let shown = false, t: number | undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !shown) { shown = true; t = window.setTimeout(() => speak("Three chapters, one idea each. Point at one and I'll dress for it."), 500); }
      if (!e.isIntersecting) shown = false;
    }), { threshold: 0.45 });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(t); timers.current.forEach((x) => window.clearTimeout(x)); };
  }, [speak]);

  const go = (i: number, card: HTMLElement) => {
    const c = chapterCards[i]!;
    setActive(i);
    setHat(c.hat);
    setProp(c.prop);
    const hr = host.current?.getBoundingClientRect(), cr = card.getBoundingClientRect();
    if (hr) bloq.current?.look(clamp1((cr.left + cr.width / 2 - (hr.left + hr.width / 2)) / (innerWidth / 2)), 0.8);
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [
      window.setTimeout(() => burst(host.current, "puff", 7, still), 260),
      window.setTimeout(() => speak(c.say), 420),
    ];
  };

  return (
    <section ref={section} id="chapters" className={cn(SECTION, "bg-ivory")}>
      <div className={WRAP}>
        <p className="lv-eyebrow">Your first adventure</p>
        <h2 className="lv-h2">Three chapters. A lot less confusion.</h2>
        <p className="lv-sub">Meet the essentials one small idea at a time. Your guide is ready when you are.</p>
        <div className="relative mt-10">
          <div
            ref={host}
            className="relative z-[2] mb-[-22px] ml-auto mr-2 w-[132px] cursor-pointer min-[861px]:absolute min-[861px]:bottom-[calc(100%-22px)] min-[861px]:right-[clamp(8px,3vw,40px)] min-[861px]:m-0 min-[861px]:w-[clamp(120px,12vw,160px)]"
            onClick={() => { bloq.current?.jump(); window.setTimeout(() => burst(host.current, "spark", 10, still), 330); }}
          >
            <Bloq ref={bloq} hat={hat} prop={prop} pose="hold" label="Bloq, changing hats for each chapter" className="w-full" />
            <SpeechBubble text={line} side="left" />
          </div>
          <div className="grid grid-cols-1 gap-[18px] min-[861px]:grid-cols-3">
            {chapterCards.map((c, i) => (
              <button
                key={c.k}
                type="button"
                onMouseEnter={(e) => go(i, e.currentTarget)}
                onFocus={(e) => go(i, e.currentTarget)}
                onClick={(e) => go(i, e.currentTarget)}
                className={cn("lv-card lv-c3", c.bg, active === i && "on")}
              >
                <span className="font-display text-[13px] font-medium uppercase tracking-[.1em] text-purple-d">{c.k}</span>
                <span aria-hidden="true" className="mt-[18px] grid size-[58px] place-items-center rounded-[15px] bg-navy font-display text-[22px] font-semibold text-lime">{c.ic}</span>
                <b className="mt-1.5 font-display text-[1.4rem] font-medium leading-[1.2] tracking-[-0.02em]">{c.title}</b>
                <small className="text-[15.5px] text-muted-foreground">{c.body}</small>
                <span className="mt-auto self-start border-b-[2.5px] border-navy pb-[5px] font-display text-[17px] font-medium">Explore ↗</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-10 text-muted-foreground"><b className="font-display font-medium text-navy">Coming next</b> · Digital ownership · Transactions · Decentralised finance</p>
      </div>
    </section>
  );
}

function ExperienceLab({ onStart }: { onStart: () => void }) {
  const points = [
    ["Quests", "Short challenges that mint real items into your account."],
    ["The Merchant", "Prices that move with what every player buys and sells."],
    ["The Passport", "A record of what you've done — earned, never bought."],
  ];
  return (
    <Section tone="navy" id="lab">
      <div className="grid gap-12 lg:grid-cols-12 lg:items-center" style={{ ["--display-accent" as string]: "var(--lime)" }}>
        <div className="order-2 lg:order-1 lg:col-span-6">
          <Illustration ratio="square" composition="lab" alt="The Experience Lab" />
        </div>
        <div className="order-1 lg:order-2 lg:col-span-6">
          <Eyebrow className="text-lavender">The Experience Lab</Eyebrow>
          <Display lines={["Don't just learn it.", "Experience it."]} accent={1} />
          <dl className="mt-10 divide-y divide-ivory/10">
            {points.map(([t, b], i) => (
              <Reveal key={t} delay={i * 0.08}>
                <div className="grid grid-cols-[7rem_1fr] gap-4 py-5">
                  <dt className="font-display text-sm uppercase tracking-[0.16em] text-lime">{t}</dt>
                  <dd className="text-ivory/75">{b}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
          <CTA onClick={onStart} className="mt-8">Enter the Experience Lab</CTA>
        </div>
      </div>
    </Section>
  );
}

function Rewards() {
  const items = [
    { Icon: Coins, name: "BloqGold", line: "The currency you earn and spend.", c: "bg-lime" },
    { Icon: KeyRound, name: "Key Fragment", line: "Proof you understood ownership.", c: "bg-lavender" },
    { Icon: Fuel, name: "Fuel Cell", line: "Earned by mastering the cost of action.", c: "bg-coral" },
    { Icon: FileCheck2, name: "Contract Seal", line: "Your mark on a self-keeping promise.", c: "bg-ivory" },
  ];
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Eyebrow>Rewards</Eyebrow>
          <Display lines={["What you earn", "is yours."]} />
          <p className="mt-6 max-w-md text-lg text-muted-foreground">Achievements here aren't points in someone else's database. Finish the season and graduate with a Passport that can't be sold or faked.</p>
        </div>
        <div className="lg:col-span-7">
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[2rem] bg-border">
            {items.map(({ Icon, name, line, c }, i) => (
              <Reveal key={name} delay={i * 0.06} className="bg-card">
                <li className="flex h-full flex-col gap-4 p-6 md:p-8">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${c} text-navy ring-1 ring-navy/10`}><Icon className="h-5 w-5" /></span>
                  <span className="font-display text-xl font-medium">{name}</span>
                  <span className="text-sm text-muted-foreground">{line}</span>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal className="mt-4">
            <div className="flex items-center gap-5 rounded-[2rem] bg-navy p-6 text-ivory md:p-8">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-lime text-navy"><BadgeCheck className="h-6 w-6" /></span>
              <div>
                <p className="font-display text-xl font-medium uppercase tracking-[-0.02em]">The Passport</p>
                <p className="text-sm text-ivory/70">Graduation, recorded for good.</p>
              </div>
              <span className="ml-auto hidden sm:block"><BloqMark size={40} tone="lime" /></span>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

function FinalCTA({ onStart }: { onStart: () => void }) {
  return (
    <Section tone="navy" inner="text-center md:py-40">
      <div style={{ ["--display-accent" as string]: "var(--lime)" }}>
        <Display size="lg" accent={1} lines={["Your journey into Web3", "starts here."]} className="mx-auto max-w-5xl" />
        <CTA onClick={onStart} className="mt-12">Start learning</CTA>
      </div>
    </Section>
  );
}
