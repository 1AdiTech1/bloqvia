import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useGame } from "@/game/useGame";
import { BloqMark } from "@/components/Logo";

/** Global busy indicator, error toast and the short "Saved" confirmation. */
export function AppChrome() {
  const game = useGame();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lastHash = useRef<string | null>(null);

  useEffect(() => {
    if (game.error) setErr(game.error);
  }, [game.error]);

  useEffect(() => {
    if (!err) return undefined;
    const t = setTimeout(() => setErr(null), 3500);
    return () => clearTimeout(t);
  }, [err]);

  useEffect(() => {
    const h = game.lastTx?.txHash ?? null;
    if (h && h !== lastHash.current) {
      lastHash.current = h;
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [game.lastTx]);

  const onLanding = path === "/";
  const pill = "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lift";
  const anim = { initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.35 } };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {game.busy && !onLanding && (
          <motion.div key="busy" {...anim} className={`${pill} bg-navy text-ivory`}>
            <span className="animate-pulse"><BloqMark size={24} tone="lime" /></span> Working on it…
          </motion.div>
        )}
        {saved && !game.busy && (
          <motion.div key="saved" {...anim} className={`${pill} bg-lime font-semibold text-navy`}>
            <Check className="h-4 w-4" /> Saved on NEAR ✓
          </motion.div>
        )}
        {err && (
          <motion.div key="err" {...anim} role="alert" className="pointer-events-auto flex max-w-[440px] items-center gap-3 rounded-2xl bg-coral px-4 py-3 text-sm font-medium text-navy shadow-lift">
            <span className="flex-1">{err}</span>
            <button aria-label="Dismiss" className="tap -my-2 -mr-2 flex items-center justify-center" onClick={() => setErr(null)}>
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
