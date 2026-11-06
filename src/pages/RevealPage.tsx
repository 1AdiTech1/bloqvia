import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Copy, ExternalLink, KeyRound, ShieldCheck, TriangleAlert, User } from "lucide-react";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { GoldSeal } from "@/components/GameBits";
import { Press, labEase } from "@/components/lab/motion";
import { Bloq, SpeechBubble, talkMs, useSay, type BloqHandle, type BloqPose } from "@/bloq";
import { CubeBurst } from "@/components/lab/CubeBurst";

export function RevealPage() {
  return (
    <RequireAccount>
      <PhoneShell chain>
        <RevealInner />
      </PhoneShell>
    </RequireAccount>
  );
}

function Beat({ delay, children, className }: { delay: number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
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

function RevealInner() {
  const game = useGame();
  const navigate = useNavigate();
  const id = game.accountId!;
  const [copied, setCopied] = useState(false);
  const accountUrl = game.explorer.account(id);
  const graduated = game.learner?.graduated;
  const lastUrl = game.lastTx ? game.explorer.tx(game.lastTx.txHash) : accountUrl;

  const steps = [
    "You tapped Start — a NEAR account was created for you, and Bloqvia's relayer paid for it",
    ...LESSON_CONTENT.filter((l) => game.learner?.completed.includes(l.lesson_id)).map((l) => `Quest "${l.title}" — rewards minted to your account`),
    "Your trades with Bloq — settled by his smart contract",
    ...(graduated ? ["Graduation — your Passport was sealed"] : []),
  ];

  const copy = async () => {
    const key = game.exportSecretKey();
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const preview = game.exportSecretKey();

  const reduce = useReducedMotion();
  const det = useRef<BloqHandle>(null);
  const [pose, setPose] = useState<BloqPose>("hold");
  const [burst, setBurst] = useState(false);
  const [line, sayLine] = useSay();
  useEffect(() => {
    const say = (t: string) => { sayLine(t, 5200); det.current?.talk(talkMs(t)); };
    const ts = [
      window.setTimeout(() => { det.current?.setMood("o"); det.current?.look(-0.6, 0.6); say("Hmm… every step left a trace on chain."); }, 600),
      window.setTimeout(() => { det.current?.look(0, 0); setPose("cheer"); det.current?.jump(); det.current?.setMood("laugh", 1600); if (!reduce) setBurst(true); }, 3400),
      window.setTimeout(() => { setPose("thumbs"); say("Case closed: it was yours the whole time."); }, 4600),
    ];
    return () => ts.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playAgain = () => {
    game.signOut();
    navigate({ to: "/" });
  };

  return (
    <>
      <Beat delay={0.1} className="flex flex-col items-stretch pt-24">
        <div className="flex items-end justify-between gap-4">
          <GoldSeal size={72} />
          <div className="relative w-[126px] shrink-0">
            <Bloq ref={det} hat="detective" prop="magnifier" pose={pose} label="Bloq the detective" />
            <SpeechBubble text={line} tone="light" />
            {burst && <CubeBurst className="top-[55%]" />}
          </div>
        </div>
        <h1 className="mt-6 font-display text-display-md font-medium uppercase tracking-[-0.04em] text-ivory">It was on NEAR the whole time.</h1>
      </Beat>
      <Beat delay={0.9}>
        <p className="mt-4 text-lg leading-relaxed text-lavender">
          Every quest, trade and stamp was a real transaction on the NEAR blockchain — in an account that belongs to you.
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
            <p className="text-sm text-muted-foreground">A non-transferable token at level {game.passport?.level}{graduated ? ", sealed as Graduate" : ""}.</p>
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
        <p className="mt-12 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">What happened</p>
        <ol className="mt-5 border-l border-lavender/40 pl-6">
          {steps.map((label, i) => (
            <li key={i} className="relative pb-6">
              <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-[4px] bg-lime ring-4 ring-navy" />
              <p className="font-medium text-ivory">{label}</p>
              <ExtLink light href={i === steps.length - 1 ? lastUrl : accountUrl}>View transaction</ExtLink>
            </li>
          ))}
        </ol>
      </Beat>

      <Beat delay={3.6} className="mt-8 flex flex-col items-center text-center">
        <p className="font-display text-2xl font-medium leading-tight text-ivory">Thanks for playing. Everything you earned is yours.</p>
        <Press onClick={playAgain} className="mt-6 rounded-full px-5 text-sm font-semibold text-lavender underline-offset-4 hover:underline">
          Play again
        </Press>
      </Beat>
    </>
  );
}
