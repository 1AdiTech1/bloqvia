import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Map, Store } from "lucide-react";
import { cn } from "@/lib/utils";

/** Centered 480px column on the navy night background. */
export function PhoneShell({ children, nav = false }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className="min-h-screen w-full bg-night text-ivory">
      <div className={cn("mx-auto min-h-screen w-full max-w-[480px] px-5 pt-6", nav ? "pb-32" : "pb-12")}>{children}</div>
      {nav && <BottomNav />}
    </div>
  );
}

const tabs = [
  { to: "/map", label: "Map", icon: Map },
  { to: "/shop", label: "Shop", icon: Store },
  { to: "/passport", label: "Passport", icon: BadgeCheck },
] as const;

function BottomNav() {
  return (
    <nav aria-label="Game" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-[440px] justify-around rounded-full border border-ivory/10 bg-navy-soft/95 p-1.5 shadow-lift backdrop-blur">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="tap flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-lavender transition-colors active:scale-[0.98]"
            activeProps={{ className: "bg-lime !text-navy" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
