import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, ExternalLink, KeyRound, ShieldCheck, TriangleAlert, User } from "lucide-react";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { GoldSeal } from "@/components/GameBits";
import { Press, labEase } from "@/components/lab/motion";
import { Bloq, SpeechBubble, talkMs, useSay, type BloqHandle, type BloqPose, useMotionOff } from "@/bloq";
import { CubeBurst } from "@/components/lab/CubeBurst";
import { useBloqvia, useChapters, SEASON2_CHAPTERS, season2Done } from "@/near";
import { SeasonStamp, Web3Passport } from "@/components/lab/Web3Passport";

export function RevealPage() {
  return (
    <RequireAccount>
      <PhoneShell chain>
        <RevealInner />
      </PhoneShell>
    </RequireAccount>
  );
}

export function Season2RevealPage() {
  return <RequireAccount><PhoneShell chain><RevealInner season2 /></PhoneShell></RequireAccount>;
}

function Beat({ delay, children, className }: { delay: number; children: ReactNode; className?: string }) {
  const reduce = useMotionOff();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay, ease: labEase }}>
      {children}
    </motion.div>
  );
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-ivory p-5 text-navy shadow-lift">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-lime">{icon}</span>
        <h2 className="font-display text-xl font-medium">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ExtLink({ href, children, light = false }: { href: string; children: ReactNode; light?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`tap inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline ${light ? "text-lime" : "text-navy"}`}>
      {children} <ExternalLink className="h-4 w-4" />
    </a>
  );
}

function RevealInner({ season2 = false }: { season2?: boolean }) {
  const game = useGame();
  const navigate = useNavigate();
  const id = game.accountId ?? "";
  const s2 = season2Done(game.passport);
  const { chapters } = useChapters();
  const { txLog } = useBloqvia();
  const completedChapters = SEASON2_CHAPTERS.filter((chapterId) => game.learner?.completed.includes(chapterId));
  const fallbackTitles = ["Digital Ownership", "Transactions", "Decentralised Finance"];
  const [copied, setCopied] = useState(false);
  const accountUrl = game.explorer.account(id);
  const graduated = game.learner?.graduated;
  const lastUrl = game.lastTx ? game.explorer.tx(game.lastTx.txHash) : accountUrl;
  useEffect(() => {
    if (season2 && !s2) void navigate({ to: "/map", replace: true });
  }, [season2, s2, navigate]);

  const steps = [
    "You tapped Start — a NEAR account was created for you, and Bloqvia's relayer paid for it",
    ...LESSON_CONTENT.filter((l) => game.learner?.completed.includes(l.lesson_id)).map((l) => `Quest "${l.title}" — rewards minted to your account`),
    "Your trades with Bloq — settled by his smart contract",
    ...(graduated ? ["Graduation — your Passport was sealed"] : []),
    ...(completedChapters.length ? [`Chapters ${completedChapters.map((chapterId) => `"${chapters.find((c) => c.lesson_id === chapterId)?.title ?? fallbackTitles[SEASON2_CHAPTERS.indexOf(chapterId)]}"`).join(", ")}: rewards minted to your account`] : []),
    ...(s2 ? ["Season 2 stamp: added to your Passport by the Passport office"] : []),
  ];

  const copy = async () => {
    const key = game.exportSecretKey();
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const preview = game.exportSecretKey();

  const reduce = useMotionOff();
  const det = useRef<BloqHandle>(null);
  const [pose, setPose] = useState<BloqPose>("hold");
  const [burst, setBurst] = useState(false);
  const [line, sayLine] = useSay();
  useEffect(() => {
    const say = (t: string) => { sayLine(t, 5200); det.current?.talk(talkMs(t)); };
    const ts = [
      window.setTimeout(() => { det.current?.setMood("o"); det.current?.look(-0.6, 0.6); say(season2 ? "Three chapters, one stamp. All of it on chain." : "Hmm… every step left a trace on chain."); }, 600),
      window.setTimeout(() => { det.current?.look(0, 0); setPose("cheer"); det.current?.jump(); det.current?.setMood("laugh", 1600); if (!reduce) setBurst(true); }, 3400),
      window.setTimeout(() => { setPose("thumbs"); say(season2 ? "Stamped for good. This Passport only ever gains." : "Case closed: it was yours the whole time."); }, 4600),
    ];
    return () => ts.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (season2 && !s2) return null;

  return (
    <>
      <Beat delay={0.1} className="flex flex-col items-stretch pt-24">
        <div className="flex items-end justify-between gap-4">
          {season2 ? <SeasonStamp className="season-reveal-stamp" /> : <GoldSeal size={72} />}
          <div className="relative w-[126px] shrink-0">
            <Bloq ref={det} hat={season2 ? "captain" : "detective"} prop={season2 ? "passport" : "magnifier"} pose={pose} label={season2 ? "Bloq the Passport officer" : "Bloq the detective"} />
            <SpeechBubble text={line} tone="light" />
            {burst && <CubeBurst className="top-[55%]" />}
          </div>
        </div>
        <h1 className="mt-6 font-display text-display-md font-medium uppercase tracking-[-0.04em] text-ivory">{season2 ? "Season 2, stamped on NEAR." : "It was on NEAR the whole time."}</h1>
      </Beat>
      <Beat delay={0.9}>
        <p className="mt-4 text-lg leading-relaxed text-lavender">
          {season2 ? "Three chapters and a stamp: real transactions on the NEAR blockchain, in an account that belongs to you." : "Every quest, trade and stamp was a real transaction on the NEAR blockchain — in an account that belongs to you."}
        </p>
      </Beat>

      <div className="mt-10 flex flex-col gap-4">
        <Beat delay={1.6}>
          <Card icon={<User className="h-5 w-5" />} title="Your account">
            <p className="break-all rounded-2xl bg-muted p-3 font-mono text-sm">{id}</p>
            <ExtLink href={accountUrl}>View account</ExtLink>
          </Card>
        </Beat>
        <Beat delay={2.1}>
          <Card icon={<ShieldCheck className="h-5 w-5" />} title="Your Passport">
            {season2 && game.passport && <Web3Passport className="mb-5 max-w-none" holder={game.passport.owner_id} level={game.passport.level} graduated={game.passport.graduated} stamps={game.passport.stamps} />}
            <p className="text-sm text-muted-foreground">A non-transferable token at level {game.passport?.level}{graduated ? ", sealed as Graduate" : ""}{season2 ? ", with the Season 2 stamp." : "."}</p>
            <ExtLink href={game.explorer.passport(id)}>View Passport</ExtLink>
          </Card>
        </Beat>
        <Beat delay={2.6}>
          <Card icon={<KeyRound className="h-5 w-5" />} title="Your key">
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate rounded-2xl bg-muted p-3 font-mono text-sm">{preview ? `${preview.slice(0, 12)}${"•".repeat(16)}` : "—"}</p>
              <Press onClick={copy} className="flex items-center gap-1.5 rounded-full bg-navy px-4 font-semibold text-ivory">
                <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
              </Press>
            </div>
            <p className="mt-3 flex gap-2 rounded-2xl bg-coral p-3 text-sm font-medium text-navy">
              <TriangleAlert className="h-5 w-5 shrink-0" /> Whoever holds this key controls the account. Keep it private.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Import it into any NEAR wallet.</p>
          </Card>
        </Beat>
      </div>

      <Beat delay={3.2}>
        <p className="mt-12 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">{season2 ? "What happened in Season 2" : "What happened"}</p>
        <ol className="mt-5 border-l border-lavender/40 pl-6">
          {season2 ? completedChapters.map((chapterId) => {
            const title = chapters.find((c) => c.lesson_id === chapterId)?.title ?? fallbackTitles[SEASON2_CHAPTERS.indexOf(chapterId)];
            const last = chapterId === "chapter-defi";
            const tx = txLog.find((entry) => entry.kind === "quest" && entry.ref === chapterId);
            return <li key={chapterId} className="relative pb-6">
              <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-[4px] ring-4 ring-navy ${last ? "bg-lime" : "season-chapter-bullet"}`} />
              <p className="font-medium text-ivory">Chapter "{title}": {last ? "rewards minted, and your Passport stamped in the same transaction" : "rewards minted to your account"}</p>
              <ExtLink light href={tx?.url ?? accountUrl}>View transaction</ExtLink>
            </li>;
          }) : steps.map((label, i) => (
            <li key={i} className="relative pb-6">
              <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-[4px] bg-lime ring-4 ring-navy" />
              <p className="font-medium text-ivory">{label}</p>
              <ExtLink light href={i === steps.length - 1 ? lastUrl : accountUrl}>View transaction</ExtLink>
            </li>
          ))}
        </ol>
      </Beat>

      <Beat delay={3.6} className="mt-8 flex flex-col items-center text-center">
        <p className="font-display text-2xl font-medium leading-tight text-ivory">{s2 ? "Both seasons done. Thanks for playing. Everything you earned is yours." : "Season 1 done. Everything you earned is yours."}</p>
        <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <Press onClick={() => navigate(season2 ? { to: "/map", hash: "keep-going" } : { to: "/map" })} className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 font-display font-semibold ${s2 ? "bg-lime text-navy shadow-lift" : "border-[1.5px] border-lavender/40 bg-transparent text-lavender"}`}>
            <ArrowLeft className="h-5 w-5" /> Back to the map
          </Press>
          {!s2 && <Press onClick={() => navigate({ to: "/map", hash: "season-2" })} className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-lime px-6 font-display font-semibold text-navy shadow-lift">Continue your journey →</Press>}
        </div>
      </Beat>
    </>
  );
}
