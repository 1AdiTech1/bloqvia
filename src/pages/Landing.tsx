import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Coins, KeyRound, Fuel, FileCheck2, BadgeCheck } from "lucide-react";
import { Wordmark, BloqMark } from "@/components/Logo";
import { CTA, Display, Eyebrow, Illustration, Reveal, Section, ease } from "@/components/brand/primitives";
import { SignInSheet } from "@/components/brand/SignInSheet";

const chapters = [
  { n: "Chapter 1", topic: "Keys", title: "The Vault", hook: "Who really holds the key to what you own?", comp: "vault" as const },
  { n: "Chapter 2", topic: "Gas", title: "The Fuel System", hook: "Every action has a cost. Learn who pays it, and why.", comp: "fuel" as const },
  { n: "Chapter 3", topic: "Smart contracts", title: "Smart Agreements", hook: "Promises written in code that keep themselves.", comp: "contract" as const },
];

const web3Story = [
  { label: "Read", title: "First, the web let us read.", body: "Pages were published by a few and visited by many. Information moved one way." },
  { label: "Write", title: "Then it let us write.", body: "Social platforms gave everyone a voice — but the platforms kept the accounts, the data and the value." },
  { label: "Own", title: "Now it lets us own.", body: "With Web3, what you earn and create lives in an account that is truly yours, recorded on a shared public ledger no single company controls." },
  { label: "Trust", title: "Trust, built in.", body: "Rules run as open code. Anyone can check them, nobody can quietly change them. That's the shift — and you can learn it by doing." },
];

export function LandingPage() {
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="min-h-screen bg-ivory text-navy">
      <Header onStart={openSheet} />
      <main>
        <Hero onStart={openSheet} />
        <IntroWeb3 />
        <Fundamentals />
        <ExperienceLab onStart={openSheet} />
        <Rewards />
        <FinalCTA onStart={openSheet} />
      </main>
      <footer className="bg-navy py-8 text-center text-sm text-ivory/70">
        Built on NEAR · NEAR Hackathon 2026 ·{" "}
        <a href="https://github.com/your-org/bloqvia" target="_blank" rel="noreferrer" className="font-medium text-lime underline-offset-4 hover:underline">
          Source code
        </a>
      </footer>
      <SignInSheet open={open} onClose={close} />
    </div>
  );
}

function Header({ onStart }: { onStart: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-3 md:px-6">
      <div className="mx-auto mt-3 flex max-w-7xl items-center justify-between rounded-full bg-navy/85 px-4 py-2 backdrop-blur-md md:px-6">
        <Link to="/" aria-label="Bloqvia home" className="tap flex items-center"><Wordmark tone="lime" /></Link>
        <button onClick={onStart} className="tap rounded-full bg-lime px-5 font-display text-xs font-medium uppercase tracking-[0.14em] text-navy transition-transform hover:-translate-y-0.5">
          Start
        </button>
      </div>
    </header>
  );
}

function Hero({ onStart }: { onStart: () => void }) {
  const reduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden bg-night pb-16 pt-28 text-ivory md:pb-24 md:pt-36">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7" style={{ ["--display-accent" as string]: "var(--lime)" }}>
          <Eyebrow className="text-lavender">Web3, explained by playing it</Eyebrow>
          <Display as="h1" size="xl" lines={["The internet", "is evolving."]} />
          <Display as="h2" size="lg" accent={0} lines={["Understand", "what's next."]} className="mt-2" />
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.5 }}
            className="mt-8 max-w-lg text-lg text-ivory/75 md:text-xl"
          >
            Discover blockchain, digital ownership and the technology changing how we interact with the world. No technical knowledge required.
          </motion.p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <CTA onClick={onStart}>Start exploring</CTA>
            <CTA variant="ghost-light" arrow={false} onClick={() => document.getElementById("discover")?.scrollIntoView()}>
              Discover Bloqvia
            </CTA>
          </div>
        </div>
        <div className="lg:col-span-5">
          <Illustration ratio="hero" composition="hero" alt="Floating blocks connected along a path" className="ring-1 ring-ivory/10 lg:aspect-[4/5]" />
        </div>
      </div>
    </section>
  );
}

function IntroWeb3() {
  const [active, setActive] = useState(0);
  return (
    <Section id="discover">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Eyebrow>Introducing Web3</Eyebrow>
          <Display lines={["A new internet.", "A new way to think."]} className="[--display-accent:var(--navy-soft)]" />
          <div className="mt-12 space-y-3">
            {web3Story.map((s, i) => (
              <motion.button
                key={s.label}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                onViewportEnter={() => setActive(i)}
                viewport={{ margin: "-45% 0px -45% 0px" }}
                className={`tap block w-full rounded-2xl border-l-2 px-5 py-4 text-left transition-colors duration-500 ${active === i ? "border-navy bg-card" : "border-transparent opacity-55 hover:opacity-90"}`}
              >
                <span className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground">0{i + 1} · {s.label}</span>
                <span className="mt-1 block font-display text-2xl font-medium tracking-[-0.03em]">{s.title}</span>
                <span className="mt-2 block text-muted-foreground">{s.body}</span>
              </motion.button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-6">
          <div className="lg:sticky lg:top-28">
            <Web3Diagram step={active} />
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Diagram morphs from one-way broadcast → central hub → owned accounts → open network. */
function Web3Diagram({ step }: { step: number }) {
  const nodes = [[80, 80], [320, 80], [60, 220], [340, 220], [200, 40], [200, 260]];
  const hub = [200, 150];
  const t = { duration: 0.9, ease };
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-night">
      <svg viewBox="0 0 400 300" className="h-full w-full" role="img" aria-label="Diagram of how the internet changes from read, to write, to own">
        {nodes.map(([x, y], i) => (
          <motion.line key={`h${i}`} x1={hub[0]} y1={hub[1]} x2={x} y2={y} stroke="var(--ivory)" animate={{ opacity: step <= 1 ? 0.35 : 0.05 }} transition={t} strokeDasharray={step === 0 ? "3 6" : "0"} />
        ))}
        {nodes.map(([x, y], i) =>
          nodes.slice(i + 1).map(([x2, y2], j) => (
            <motion.line key={`m${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} stroke="var(--lime)" animate={{ opacity: step === 3 ? 0.35 : 0 }} transition={t} />
          )),
        )}
        <motion.rect
          x={hub[0] - 34} y={hub[1] - 24} width="68" height="48" rx="14"
          animate={{ opacity: step >= 2 ? 0.08 : 1, fill: step === 0 ? "var(--ivory)" : "var(--coral)" }}
          transition={t}
        />
        {nodes.map(([x, y], i) => (
          <motion.rect
            key={`n${i}`} x={x - 18} y={y - 14} width="36" height="28" rx="9"
            animate={{ fill: step >= 2 ? (i % 2 ? "var(--lime)" : "var(--lavender)") : "var(--navy-soft)", scale: step >= 2 ? 1.15 : 1 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            transition={{ ...t, delay: i * 0.05 }}
            stroke="var(--ivory)" strokeOpacity="0.3"
          />
        ))}
      </svg>
      <p className="absolute bottom-5 left-6 font-display text-xs uppercase tracking-[0.2em] text-lavender">
        Web{step === 0 ? "1 · read" : step === 1 ? "2 · write" : "3 · " + (step === 2 ? "own" : "trust")}
      </p>
    </div>
  );
}

function Fundamentals() {
  return (
    <Section tone="lavender">
      <Eyebrow>Discover the fundamentals · Season 1</Eyebrow>
      <Display lines={["Three chapters.", "Play them today."]} />
      <div className="mt-16 space-y-16 md:space-y-24">
        {chapters.map((c, i) => (
          <Reveal key={c.title}>
            <article className={`grid items-center gap-8 md:grid-cols-12 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div className={i === 1 ? "md:col-span-7" : "md:col-span-5"}>
                <Illustration ratio={i === 1 ? "wide" : "square"} composition={c.comp} alt={`${c.title} illustration`} />
              </div>
              <div className={i === 1 ? "md:col-span-5" : "md:col-span-7 md:pl-8"}>
                <p className="font-display text-sm uppercase tracking-[0.2em] text-navy/60">{c.n} — {c.topic}</p>
                <h3 className="mt-3 font-display text-display-md font-medium uppercase tracking-[-0.04em]">{c.title}</h3>
                <p className="mt-4 max-w-md text-lg text-navy/75">{c.hook}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-20 border-t border-navy/15 pt-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-10">
          <p className="font-display text-xs uppercase tracking-[0.22em] text-navy/60">Next season</p>
          {["Digital ownership", "Transactions", "Decentralised finance"].map((t) => (
            <p key={t} className="flex items-center gap-3 font-display text-lg text-navy/55">
              {t}
              <span className="rounded-full border border-navy/20 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em]">Coming</span>
            </p>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

function ExperienceLab({ onStart }: { onStart: () => void }) {
  const points = [
    ["Quests", "Short challenges that mint real items into your account."],
    ["The Merchant", "Prices that move with what every player buys and sells."],
    ["The Passport", "A record of what you've done — earned, never bought."],
  ];
  return (
    <Section tone="navy">
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
