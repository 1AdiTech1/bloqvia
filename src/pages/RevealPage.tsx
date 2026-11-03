import { useState } from "react";
import { Copy, ExternalLink, KeyRound, ShieldCheck, TriangleAlert, User } from "lucide-react";
import { useGame } from "@/game/useGame";
import { LESSON_CONTENT } from "@/game/content";
import { PhoneShell } from "@/components/PhoneShell";
import { RequireAccount } from "@/components/RequireAccount";
import { GoldSeal } from "@/components/GameBits";
import { LeafDivider } from "@/components/VineLoader";
import type { ReactNode } from "react";

export function RevealPage() {
  return (
    <RequireAccount>
      <PhoneShell>
        <RevealInner />
      </PhoneShell>
    </RequireAccount>
  );
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card-organic p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-moss">{icon}</span>
        <h2 className="text-lg font-bold text-moss">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-moss underline-offset-4 hover:underline">
      {children} <ExternalLink className="h-4 w-4" />
    </a>
  );
}

function RevealInner() {
  const game = useGame();
  const id = game.accountId!;
  const key = game.exportSecretKey();
  const [copied, setCopied] = useState(false);
  const accountUrl = game.explorer.account(id);
  const graduated = game.learner?.graduated;

  const timeline = [
    { label: "You signed in with your email — a NEAR account was created for you", url: accountUrl },
    ...LESSON_CONTENT.filter((l) => game.learner?.completed.includes(l.lesson_id)).map((l) => ({
      label: `Quest "${l.title}" — rewards minted to your account`,
      url: accountUrl,
    })),
    { label: "Trades with Bloq — settled by his smart contract", url: accountUrl },
    ...(graduated ? [{ label: "Graduation — your Passport was sealed", url: game.lastTx?.url ?? accountUrl }] : []),
  ];

  const copy = async () => {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="flex flex-col items-center pt-4 text-center">
        <GoldSeal size={84} />
        <h1 className="mt-4 text-4xl font-extrabold leading-tight text-moss">It was on NEAR the whole time.</h1>
        <p className="mt-3 text-muted-foreground">
          Every quest, trade and stamp was a real transaction on the NEAR blockchain — in an account that belongs to you.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <Card icon={<User className="h-5 w-5" />} title="Your account">
          <p className="break-all rounded-xl bg-muted p-3 font-mono text-sm">{id}</p>
          <ExtLink href={accountUrl}>View account</ExtLink>
        </Card>
        <Card icon={<ShieldCheck className="h-5 w-5" />} title="Your Passport">
          <p className="text-sm text-muted-foreground">A non-transferable token at level {game.passport?.level}{graduated ? ", sealed as Graduate" : ""}.</p>
          <ExtLink href={game.explorer.passport(id)}>View Passport</ExtLink>
        </Card>
        <Card icon={<KeyRound className="h-5 w-5" />} title="Your key">
          <div className="flex items-center gap-2">
            <p className="flex-1 truncate rounded-xl bg-muted p-3 font-mono text-sm">
              {key ? `${key.slice(0, 12)}${"•".repeat(16)}` : "—"}
            </p>
            <button onClick={copy} className="tap flex items-center gap-1.5 rounded-full bg-moss px-4 font-semibold text-primary-foreground">
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 flex gap-2 rounded-xl bg-terracotta/15 p-3 text-sm text-terracotta">
            <TriangleAlert className="h-5 w-5 shrink-0" /> Whoever holds this key controls the account. Keep it private.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Import it into any NEAR wallet.</p>
        </Card>
      </div>

      <div className="my-8"><LeafDivider /></div>

      <h2 className="text-xl font-bold text-moss">What happened</h2>
      <ol className="mt-4 border-l-2 border-sage pl-5">
        {timeline.map((t, i) => (
          <li key={i} className="relative pb-5">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-leaf ring-4 ring-background" />
            <p className="font-medium">{t.label}</p>
            <ExtLink href={t.url}>View transaction</ExtLink>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-center font-display text-lg font-semibold text-moss">
        Thanks for playing. Everything you earned is yours.
      </p>
    </>
  );
}
