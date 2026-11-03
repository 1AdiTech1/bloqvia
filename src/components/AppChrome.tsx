import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Check, Leaf, X } from "lucide-react";
import { useGame } from "@/game/useGame";

/** Global busy indicator, error toast and the short "Saved" confirmation. */
export function AppChrome() {
  const game = useGame();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lastHash = useRef<string | null>(null);

  useEffect(() => {
    if (game.error) {
      setErr(game.error);
      const t = setTimeout(() => setErr(null), 3500);
      return () => clearTimeout(t);
    }
  }, [game.error]);

  useEffect(() => {
    const h = game.lastTx?.txHash ?? null;
    if (h && h !== lastHash.current) {
      lastHash.current = h;
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2200);
      return () => clearTimeout(t);
    }
  }, [game.lastTx]);

  const onLanding = path === "/";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {game.busy && !onLanding && (
        <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-moss shadow-soft">
          <Leaf className="h-4 w-4 animate-spin [animation-duration:2.5s]" /> Working on it…
        </div>
      )}
      {saved && !game.busy && (
        <div className="flex items-center gap-2 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lift animate-in fade-in slide-in-from-top-2">
          <Check className="h-4 w-4" /> Saved on NEAR ✓
        </div>
      )}
      {err && (
        <div
          role="alert"
          className="pointer-events-auto flex max-w-[440px] items-center gap-3 rounded-2xl bg-terracotta px-4 py-3 text-sm font-medium text-destructive-foreground shadow-lift animate-in fade-in slide-in-from-top-2"
        >
          <span className="flex-1">{err}</span>
          <button aria-label="Dismiss" className="tap -my-2 -mr-2 flex items-center justify-center" onClick={() => setErr(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
