import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BadgeCheck, Map, Store, Users } from "lucide-react";
import { AgentPod, BloqviaLogo, type AgentPodHandle } from "@/bloq";
import { useGame, IS_MOCK } from "@/game/useGame";
import { LevelRing } from "@/components/GameBits";
import { AskBloqSheet, type AskContext } from "@/components/lab/AskBloqSheet";
import { cn } from "@/lib/utils";

/** Centered 480px column on the navy night background. */
export function PhoneShell({ children, nav = false, headerLevel }: { children: ReactNode; nav?: boolean; headerLevel?: number | undefined }) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-night text-ivory">
      <div className={cn("mx-auto min-h-screen w-full max-w-[480px] px-5 pt-4", nav ? "pb-32" : "pb-12")}>
        {nav && <GameHeader level={headerLevel} />}
        {children}
      </div>
      {nav && <BottomNav />}
    </div>
  );
}

function GameHeader({ level: override }: { level?: number | undefined }) {
  const { passport } = useGame();
  const level = Math.min(override ?? passport?.level ?? 0, 3);
  const graduated = !!passport?.graduated;
  const text = graduated ? "Graduate" : level >= 3 ? "Ready to graduate" : `Level ${level}`;
  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <span className="text-[30px] leading-none [&_svg]:h-[30px] [&_svg]:w-auto">
        <BloqviaLogo nameClassName="text-ivory" />
      </span>
      <Link to="/passport" aria-label={`Passport: ${text}`} className="tap flex min-h-[44px] items-center gap-2 rounded-full bg-ivory py-1 pl-1 pr-3.5 text-navy shadow-lift">
        <span data-inv="ring"><LevelRing level={level} graduated={graduated} size={34} /></span>
        <span className="flex flex-col leading-none">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-navy/60">Passport</span>
          <span className="mt-0.5 font-display text-[13px] font-semibold">{text}</span>
        </span>
      </Link>
    </header>
  );
}

const tabs = [
  { to: "/map", label: "Map", icon: Map },
  { to: "/shop", label: "Shop", icon: Store },
  { to: "/cohort", label: "Missions", icon: Users },
  { to: "/passport", label: "Passport", icon: BadgeCheck },
] as const;

const CONTEXT_BY_PATH: Record<string, AskContext> = { "/map": "map", "/shop": "shop", "/cohort": "missions", "/passport": "passport" };

function BottomNav() {
  return (
    <nav aria-label="Game" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-[440px] items-center gap-2.5">
        <div className="flex flex-1 justify-around rounded-full border border-ivory/10 bg-navy-soft/95 p-1.5 shadow-lift backdrop-blur">
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="tap flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-lavender transition-colors active:scale-[0.98]"
              activeProps={{ className: "bg-lime !text-navy" }}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
        {!IS_MOCK && <AgentDock />}
      </div>
    </nav>
  );
}

function AgentDock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const context = CONTEXT_BY_PATH[path] ?? "map";
  const [open, setOpen] = useState(false);
  const pod = useRef<AgentPodHandle>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") pod.current?.peek();
    }, 14000);
    return () => window.clearInterval(t);
  }, [open]);

  return (
    <>
      <div className="group relative shrink-0">
        <button
          ref={btn}
          type="button"
          aria-label="Ask Bloq, the AI agent"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="relative flex h-[62px] w-[62px] items-center justify-center rounded-full bg-navy-soft shadow-lift"
        >
          <AgentPod size={58} ref={pod} />
          <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 h-[13px] w-[13px] rounded-full bg-lime ring-2 ring-navy motion-safe:animate-pulse" />
        </button>
        <span aria-hidden="true" className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-full bg-ivory px-3 py-1.5 text-xs font-semibold text-navy opacity-0 shadow-lift transition-opacity group-hover:opacity-100 md:block">
          Ask Bloq · AI agent
        </span>
      </div>
      <AskBloqSheet
        open={open}
        onClose={() => {
          setOpen(false);
          setTimeout(() => btn.current?.focus(), 30);
        }}
        context={context}
      />
    </>
  );
}
