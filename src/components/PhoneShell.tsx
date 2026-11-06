import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BadgeCheck, House, Map, Store, Users } from "lucide-react";
import { AgentPod, BloqviaLogo, type AgentPodHandle } from "@/bloq";
import { useGame, IS_MOCK } from "@/game/useGame";
import { LevelRing } from "@/components/GameBits";
import { AskBloqSheet, type AskContext } from "@/components/lab/AskBloqSheet";
import { ChainPanel } from "@/components/lab/ChainPanel";
import { cn } from "@/lib/utils";

/**
 * Phones/tablets: centred 480px column on navy. Desktop (≥1100px, `dk:`): layout A —
 * left rail (logo, tabs, agent card) · centre column (max 760px) · "On NEAR" panel.
 * `chain` shows the panel without the rail (the Reveal). `inlineHeader` lets a page place <GameHeader /> itself.
 */
export function PhoneShell({
  children, nav = false, chain = false, headerLevel, inlineHeader = false,
}: { children: ReactNode; nav?: boolean; chain?: boolean; headerLevel?: number | undefined; inlineHeader?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const context = CONTEXT_BY_PATH[path] ?? "map";
  const [asking, setAsking] = useState(false);
  const returnTo = useRef<HTMLElement | null>(null);
  const showPanel = nav || chain;
  const ask = (el: HTMLElement) => { returnTo.current = el; setAsking(true); };

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-night text-ivory">
      <div
        className={cn(
          "dk:mx-auto dk:grid dk:min-h-screen dk:max-w-[1440px]",
          nav ? "dk:grid-cols-[220px_minmax(0,1fr)_330px]" : chain ? "dk:grid-cols-[minmax(0,1fr)_330px]" : "",
        )}
      >
        {nav && <Rail onAsk={ask} asking={asking} />}
        <div className={cn("mx-auto min-h-screen w-full max-w-[480px] px-5 pt-4 dk:max-w-[760px] dk:px-7 dk:pb-12 dk:pt-7", nav ? "pb-32" : "pb-12")}>
          {nav && !inlineHeader && <GameHeader level={headerLevel} />}
          {children}
        </div>
        {showPanel && (
          <div className="hidden dk:block">
            <div className="bq-scroll sticky top-[14px] my-[14px] mr-2 max-h-[calc(100vh-28px)] overflow-y-auto py-3 pl-6 pr-4">
              <ChainPanel limit={chain ? 40 : 8} />
            </div>
          </div>
        )}
      </div>
      {nav && <BottomNav onAsk={ask} asking={asking} />}
      {nav && !IS_MOCK && (
        <AskBloqSheet
          open={asking}
          onClose={() => { setAsking(false); setTimeout(() => returnTo.current?.focus(), 30); }}
          context={context}
        />
      )}
    </div>
  );
}

/** Passport pill (ring keeps data-inv="ring" for reward flights). On desktop the logo moves to the rail. */
export function GameHeader({ level: override, className }: { level?: number | undefined; className?: string }) {
  const { passport } = useGame();
  const level = Math.min(override ?? passport?.level ?? 0, 3);
  const graduated = !!passport?.graduated;
  const text = graduated ? "Graduate" : level >= 3 ? "Ready to graduate" : `Level ${level}`;
  return (
    <header className={cn("mb-5 flex items-center justify-between gap-3 dk:justify-end", className)}>
      <span className="text-[30px] leading-none dk:hidden [&_svg]:h-[30px] [&_svg]:w-auto">
        <BloqviaLogo nameClassName="text-ivory" />
      </span>
      <Link to="/passport" aria-label={`Passport: ${text}`} className="tap flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-ivory py-1 pl-1 pr-3.5 text-navy shadow-lift">
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
  { to: "/map", label: "Map", short: "", icon: Map },
  { to: "/shop", label: "Shop", short: "", icon: Store },
  { to: "/cohort", label: "Missions", short: "", icon: Users },
  { to: "/passport", label: "Passport", short: "Pass", icon: BadgeCheck },
] as const;

const TAB = "tap flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[9px] font-semibold uppercase tracking-[0.02em] text-lavender max-[359px]:text-[8px] max-[359px]:tracking-normal transition-colors active:scale-[0.98]";

const CONTEXT_BY_PATH: Record<string, AskContext> = { "/map": "map", "/shop": "shop", "/cohort": "missions", "/passport": "passport" };

type AskProps = { onAsk: (el: HTMLElement) => void; asking: boolean };

/** Every 14s while the sheet is closed and the tab visible, the agent peeks out. */
function usePeek(asking: boolean) {
  const pod = useRef<AgentPodHandle>(null);
  useEffect(() => {
    if (asking) return;
    const t = window.setInterval(() => {
      const el = pod.current;
      if (document.visibilityState === "visible" && el) el.peek();
    }, 14000);
    return () => window.clearInterval(t);
  }, [asking]);
  return pod;
}

function Rail({ onAsk, asking }: AskProps) {
  return (
    <aside className="hidden dk:block">
      <div className="sticky top-0 flex h-screen flex-col gap-8 px-5 py-7">
        <Link to="/map" aria-label="Bloqvia map" className="text-[30px] leading-none [&_svg]:h-[30px] [&_svg]:w-auto">
          <BloqviaLogo nameClassName="text-ivory" />
        </Link>
        <nav aria-label="Game" className="flex flex-col gap-1.5">
          <Link to="/" className="flex h-12 items-center gap-3 rounded-[14px] px-4 font-display text-[15px] font-medium text-ivory transition-colors hover:bg-navy-soft">
            <House className="h-5 w-5" />
            Home
          </Link>
          <div aria-hidden="true" className="my-1 h-px bg-ivory/10" />
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex h-12 items-center gap-3 rounded-[14px] px-4 font-display text-[15px] font-medium text-lavender transition-colors hover:bg-navy-soft hover:text-ivory"
              activeProps={{ className: "!bg-lime !text-navy" }}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
        {!IS_MOCK && <RailAgent onAsk={onAsk} asking={asking} />}
      </div>
    </aside>
  );
}

function RailAgent({ onAsk, asking }: AskProps) {
  const pod = usePeek(asking);
  return (
    <button
      type="button"
      aria-label="Ask Bloq, the AI agent"
      aria-haspopup="dialog"
      aria-expanded={asking}
      onClick={(e) => onAsk(e.currentTarget)}
      className="mt-auto flex items-center gap-3 rounded-2xl bg-navy-soft p-3 pt-5 text-left transition-colors hover:bg-navy-soft/80"
    >
      <AgentPod size={44} ref={pod} />
      <span className="flex flex-col leading-tight">
        <span className="font-display text-[15px] font-semibold text-ivory">Ask Bloq</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-lavender">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-lime motion-safe:animate-pulse" />AI agent · online
        </span>
      </span>
    </button>
  );
}

function BottomNav({ onAsk, asking }: AskProps) {
  return (
    <nav aria-label="Game" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 dk:hidden">
      <div className="flex w-full max-w-[440px] items-center gap-2.5 max-[359px]:gap-1.5">
        <div className="flex min-w-0 flex-1 justify-around rounded-full border border-ivory/10 bg-navy-soft/95 p-1 shadow-lift backdrop-blur">
          <Link to="/" className={TAB} activeOptions={{ exact: true }}>
            <House className="h-5 w-5" />
            Home
          </Link>
          {tabs.map(({ to, label, short, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={TAB}
              activeProps={{ className: "bg-lime !text-navy" }}
            >
              <Icon className="h-5 w-5" />
              {short ? <><span className="max-[359px]:hidden">{label}</span><span className="min-[360px]:hidden">{short}</span></> : label}
            </Link>
          ))}
        </div>
        {!IS_MOCK && <AgentDock onAsk={onAsk} asking={asking} />}
      </div>
    </nav>
  );
}

function AgentDock({ onAsk, asking }: AskProps) {
  const pod = usePeek(asking);
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        aria-label="Ask Bloq, the AI agent"
        aria-haspopup="dialog"
        aria-expanded={asking}
        onClick={(e) => onAsk(e.currentTarget)}
        className="relative flex h-[62px] w-[62px] items-center justify-center rounded-full bg-navy-soft shadow-lift"
      >
        <AgentPod size={58} ref={pod} />
        <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 h-[13px] w-[13px] rounded-full bg-lime ring-2 ring-navy motion-safe:animate-pulse" />
      </button>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-full bg-ivory px-3 py-1.5 text-xs font-semibold text-navy opacity-0 shadow-lift transition-opacity group-hover:opacity-100 md:block">
        Ask Bloq · AI agent
      </span>
    </div>
  );
}
