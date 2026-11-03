import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Map, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function PhoneShell({ children, nav = false }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className="min-h-screen w-full">
      <div className={cn("mx-auto min-h-screen w-full max-w-[480px] bg-background/70 px-5 pt-6 shadow-lift backdrop-blur-sm", nav ? "pb-28" : "pb-10")}>
        {children}
      </div>
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
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-[440px] justify-around rounded-full border border-border bg-card/95 p-1.5 shadow-lift backdrop-blur">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="tap flex flex-1 flex-col items-center justify-center rounded-full py-1.5 text-xs font-semibold text-muted-foreground transition-colors"
            activeProps={{ className: "bg-secondary text-moss" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
